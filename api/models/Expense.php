<?php
/**
 * Expense Database Model
 */
class Expense {

    public static function getList($db, $month = null) {
        $query = "SELECT e.*, u.name as entered_by_name 
                  FROM expenses e
                  LEFT JOIN users u ON e.entered_by = u.id";
        $params = [];

        if ($month) {
            $query .= " WHERE DATE_FORMAT(e.entry_date, '%Y-%m') = :month";
            $params['month'] = $month;
        }

        $query .= " ORDER BY e.entry_date DESC, e.id DESC";

        $stmt = $db->prepare($query);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public static function getSummary($db, $month = null) {
        $query = "SELECT 
                    COALESCE(SUM(CASE WHEN expense_type = 'Saving Balance' THEN amount ELSE 0 END), 0) as saving_expense,
                    COALESCE(SUM(CASE WHEN expense_type = 'Loan Balance' THEN amount ELSE 0 END), 0) as loan_expense,
                    COALESCE(SUM(CASE WHEN expense_type = 'Individual' THEN amount ELSE 0 END), 0) as individual_expense
                  FROM expenses";
        $params = [];

        if ($month) {
            $query .= " WHERE DATE_FORMAT(entry_date, '%Y-%m') = :month";
            $params['month'] = $month;
        }

        $stmt = $db->prepare($query);
        $stmt->execute($params);
        return $stmt->fetch();
    }

    public static function getById($db, $id) {
        $stmt = $db->prepare("SELECT * FROM expenses WHERE id = :id");
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public static function create($db, $data) {
        $db->beginTransaction();
        try {
            $uuid = Validator::uuid();
            
            // Generate prefix based on expense type
            require_once __DIR__ . '/../helpers/NumberGenerator.php';
            $prefix = 'EX-IND';
            if ($data['expense_type'] === 'Saving Balance') {
                $prefix = 'EX-SV';
            } elseif ($data['expense_type'] === 'Loan Balance') {
                $prefix = 'EX-LN';
            }
            $expenseNo = NumberGenerator::generate($db, $prefix);

            $stmt = $db->prepare("
                INSERT INTO expenses (
                    uuid, expense_no, expense_type, amount, entry_date, remarks, branch_id, entered_by
                ) VALUES (
                    :uuid, :expense_no, :expense_type, :amount, :entry_date, :remarks, :branch_id, :entered_by
                )
            ");
            $stmt->execute([
                'uuid' => $uuid,
                'expense_no' => $expenseNo,
                'expense_type' => $data['expense_type'],
                'amount' => $data['amount'],
                'entry_date' => $data['entry_date'],
                'remarks' => $data['remarks'] ?? null,
                'branch_id' => $data['branch_id'] ?? null,
                'entered_by' => $data['entered_by']
            ]);
            $expenseId = $db->lastInsertId();

            // Integrate with cash_book if it is 'Saving Balance' or 'Loan Balance'
            if (in_array($data['expense_type'], ['Saving Balance', 'Loan Balance'])) {
                // Compute running balance for branch
                $stmtBal = $db->prepare("SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END), 0) FROM cash_book WHERE branch_id = :branch_id");
                $stmtBal->execute(['branch_id' => $data['branch_id']]);
                $currBal = (float)$stmtBal->fetchColumn();
                $newBal = $currBal - $data['amount'];

                // Add to cash book
                $stmtCash = $db->prepare("
                    INSERT INTO cash_book (
                        uuid, entry_date, entry_type, category, description, reference_no, reference_type, amount, balance_after, branch_id, entered_by
                    ) VALUES (
                        :uuid, :entry_date, 'debit', :category, :description, :ref_no, 'expense', :amount,
                        :balance_after, :branch_id, :entered_by
                    )
                ");
                $stmtCash->execute([
                    'uuid' => Validator::uuid(),
                    'entry_date' => $data['entry_date'],
                    'category' => 'Expense (' . $data['expense_type'] . ')',
                    'description' => $data['remarks'] ?? 'Business Expense',
                    'ref_no' => $expenseNo,
                    'amount' => $data['amount'],
                    'balance_after' => $newBal,
                    'branch_id' => $data['branch_id'] ?? null,
                    'entered_by' => $data['entered_by']
                ]);
            }

            $db->commit();
            return $expenseId;
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    public static function update($db, $id, $data) {
        $db->beginTransaction();
        try {
            $oldExpense = self::getById($db, $id);
            if (!$oldExpense) {
                throw new Exception('Expense not found.');
            }

            $oldType = $oldExpense['expense_type'];
            $newType = $data['expense_type'];
            $oldAmount = (float)$oldExpense['amount'];
            $newAmount = (float)$data['amount'];
            $expenseNo = $oldExpense['expense_no'];

            // Regenerate number if type changes to keep the prefix correct (EX-SV / EX-LN / EX-IND)
            if ($oldType !== $newType) {
                require_once __DIR__ . '/../helpers/NumberGenerator.php';
                $prefix = 'EX-IND';
                if ($newType === 'Saving Balance') {
                    $prefix = 'EX-SV';
                } elseif ($newType === 'Loan Balance') {
                    $prefix = 'EX-LN';
                }
                $expenseNo = NumberGenerator::generate($db, $prefix);
            }

            $stmt = $db->prepare("
                UPDATE expenses SET 
                    expense_type = :expense_type,
                    expense_no = :expense_no,
                    amount = :amount,
                    entry_date = :entry_date,
                    remarks = :remarks
                WHERE id = :id
            ");
            $stmt->execute([
                'id' => $id,
                'expense_type' => $newType,
                'expense_no' => $expenseNo,
                'amount' => $newAmount,
                'entry_date' => $data['entry_date'],
                'remarks' => $data['remarks'] ?? null
            ]);

            // Sync with cash_book
            $isOldBusiness = in_array($oldType, ['Saving Balance', 'Loan Balance']);
            $isNewBusiness = in_array($newType, ['Saving Balance', 'Loan Balance']);

            if ($isOldBusiness && $isNewBusiness) {
                // Fetch the existing cash book entry using old expense_no
                $stmtCash = $db->prepare("SELECT id FROM cash_book WHERE reference_no = :ref_no AND reference_type = 'expense' LIMIT 1");
                $stmtCash->execute(['ref_no' => $oldExpense['expense_no']]);
                $cashId = $stmtCash->fetchColumn();

                if ($cashId) {
                    // Update entry and propagate balance after
                    $stmtUpdate = $db->prepare("
                        UPDATE cash_book SET 
                            amount = :amount,
                            category = :category,
                            description = :description,
                            entry_date = :entry_date,
                            reference_no = :ref_no
                        WHERE id = :id
                    ");
                    $stmtUpdate->execute([
                        'id' => $cashId,
                        'amount' => $newAmount,
                        'category' => 'Expense (' . $newType . ')',
                        'description' => $data['remarks'] ?? 'Business Expense',
                        'entry_date' => $data['entry_date'],
                        'ref_no' => $expenseNo
                    ]);

                    $diff = $oldAmount - $newAmount; // Since debit, if amount increases, balance decreases
                    $stmtProp = $db->prepare("UPDATE cash_book SET balance_after = balance_after + :diff WHERE id >= :id");
                    $stmtProp->execute(['diff' => $diff, 'id' => $cashId]);
                }
            } elseif ($isOldBusiness && !$isNewBusiness) {
                // Changed from Business to Individual: Delete cash book entry using old expense_no
                $stmtCash = $db->prepare("SELECT id FROM cash_book WHERE reference_no = :ref_no AND reference_type = 'expense' LIMIT 1");
                $stmtCash->execute(['ref_no' => $oldExpense['expense_no']]);
                $cashId = $stmtCash->fetchColumn();

                if ($cashId) {
                    $stmtProp = $db->prepare("UPDATE cash_book SET balance_after = balance_after + :diff WHERE id > :id");
                    $stmtProp->execute(['diff' => $oldAmount, 'id' => $cashId]);

                    $stmtDel = $db->prepare("DELETE FROM cash_book WHERE id = :id");
                    $stmtDel->execute(['id' => $cashId]);
                }
            } elseif (!$isOldBusiness && $isNewBusiness) {
                // Changed from Individual to Business: Create cash book entry using new expense_no
                $stmtBal = $db->prepare("SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END), 0) FROM cash_book WHERE branch_id = :branch_id");
                $stmtBal->execute(['branch_id' => $oldExpense['branch_id']]);
                $currBal = (float)$stmtBal->fetchColumn();
                $newBal = $currBal - $newAmount;

                $stmtCash = $db->prepare("
                    INSERT INTO cash_book (
                        uuid, entry_date, entry_type, category, description, reference_no, reference_type, amount, balance_after, branch_id, entered_by
                    ) VALUES (
                        :uuid, :entry_date, 'debit', :category, :description, :ref_no, 'expense', :amount,
                        :balance_after, :branch_id, :entered_by
                    )
                ");
                $stmtCash->execute([
                    'uuid' => Validator::uuid(),
                    'entry_date' => $data['entry_date'],
                    'category' => 'Expense (' . $newType . ')',
                    'description' => $data['remarks'] ?? 'Business Expense',
                    'ref_no' => $expenseNo,
                    'amount' => $newAmount,
                    'balance_after' => $newBal,
                    'branch_id' => $oldExpense['branch_id'],
                    'entered_by' => $oldExpense['entered_by']
                ]);
            }

            $db->commit();
            return true;
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    public static function delete($db, $id) {
        $db->beginTransaction();
        try {
            $expense = self::getById($db, $id);
            if (!$expense) {
                throw new Exception('Expense not found.');
            }

            $isBusiness = in_array($expense['expense_type'], ['Saving Balance', 'Loan Balance']);
            $amount = (float)$expense['amount'];

            if ($isBusiness) {
                $stmtCash = $db->prepare("SELECT id FROM cash_book WHERE reference_no = :ref_no AND reference_type = 'expense' LIMIT 1");
                $stmtCash->execute(['ref_no' => $expense['expense_no']]);
                $cashId = $stmtCash->fetchColumn();

                if ($cashId) {
                    $stmtProp = $db->prepare("UPDATE cash_book SET balance_after = balance_after + :diff WHERE id > :id");
                    $stmtProp->execute(['diff' => $amount, 'id' => $cashId]);

                    $stmtDel = $db->prepare("DELETE FROM cash_book WHERE id = :id");
                    $stmtDel->execute(['id' => $cashId]);
                }
            }

            $stmt = $db->prepare("DELETE FROM expenses WHERE id = :id");
            $stmt->execute(['id' => $id]);

            $db->commit();
            return true;
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }
}

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

            // Business expense fund pool se paisa nikalta hai (withdraw bucket)
            if (in_array($data['expense_type'], ['Saving Balance', 'Loan Balance'])) {
                $pool = $data['expense_type'] === 'Loan Balance' ? 'loan_fund' : 'saving_fund';
                Fund::applyPoolTxn($db, $pool, 'debit', 'expense', $data['amount'], [
                    'reference_no' => $expenseNo,
                    'description'  => 'Expense (' . $data['expense_type'] . '): ' . ($data['remarks'] ?? 'Business Expense'),
                    'entry_date'   => $data['entry_date'],
                    'entered_by'   => $data['entered_by']
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

            // Fund pool sync: purana business expense reverse karo, naya apply karo
            $isOldBusiness = in_array($oldType, ['Saving Balance', 'Loan Balance']);
            $isNewBusiness = in_array($newType, ['Saving Balance', 'Loan Balance']);

            if ($isOldBusiness) {
                $oldPool = $oldType === 'Loan Balance' ? 'loan_fund' : 'saving_fund';
                Fund::applyPoolTxn($db, $oldPool, 'credit', 'expense_reversed', $oldAmount, [
                    'reference_no' => $oldExpense['expense_no'],
                    'description'  => 'Expense adjusted (old entry reversed): ' . $oldExpense['expense_no'],
                    'entry_date'   => $data['entry_date'],
                    'entered_by'   => $oldExpense['entered_by']
                ]);
            }
            if ($isNewBusiness) {
                $newPool = $newType === 'Loan Balance' ? 'loan_fund' : 'saving_fund';
                Fund::applyPoolTxn($db, $newPool, 'debit', 'expense', $newAmount, [
                    'reference_no' => $expenseNo,
                    'description'  => 'Expense (' . $newType . '): ' . ($data['remarks'] ?? 'Business Expense'),
                    'entry_date'   => $data['entry_date'],
                    'entered_by'   => $oldExpense['entered_by']
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
                // Fund pool me paisa wapas (expense reverse)
                $pool = $expense['expense_type'] === 'Loan Balance' ? 'loan_fund' : 'saving_fund';
                Fund::applyPoolTxn($db, $pool, 'credit', 'expense_reversed', $amount, [
                    'reference_no' => $expense['expense_no'],
                    'description'  => 'Expense deleted: ' . $expense['expense_no'],
                    'entered_by'   => $expense['entered_by']
                ]);
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

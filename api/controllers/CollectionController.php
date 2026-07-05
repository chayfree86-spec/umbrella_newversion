<?php
/**
 * Daily Collections and Receipts Controller
 */
class CollectionController {

    public static function today($db, $authUser) {
        $branchId = $_GET['branch_id'] ?? null;
        $agentId = $_GET['agent_id'] ?? null;
        $date = $_GET['date'] ?? date('Y-m-d');
        // Optional date range (Reports page sends start_date/end_date)
        $startDate = $_GET['start_date'] ?? $date;
        $endDate = $_GET['end_date'] ?? $date;

        if ($authUser['role_slug'] === 'agent') {
            $agentId = $authUser['agent_id'];
        }

        $bind = ['start_date' => $startDate, 'end_date' => $endDate];
        $whereSql = "WHERE lc.collection_date BETWEEN :start_date AND :end_date AND lc.is_reversal = 0";

        if ($branchId) {
            $whereSql .= " AND lc.branch_id = :branch_id";
            $bind['branch_id'] = $branchId;
        }
        if ($agentId) {
            $whereSql .= " AND lc.agent_id = :agent_id";
            $bind['agent_id'] = $agentId;
        }

        // Loan Collections (newest first)
        $stmtLoans = $db->prepare("
            SELECT lc.*, c.full_name as customer_name, la.loan_account_no as account_no, 'Loan' as account_type, u.name as collector_name
            FROM loan_collections lc
            JOIN customers c ON lc.customer_id = c.id
            JOIN loan_accounts la ON lc.loan_account_id = la.id
            JOIN users u ON lc.collected_by = u.id
            $whereSql
            ORDER BY lc.id DESC
        ");
        $stmtLoans->execute($bind);
        $loans = $stmtLoans->fetchAll();

        // Savings Deposits (newest first)
        $whereSqlSavings = str_replace('lc.', 'sd.', $whereSql);
        $whereSqlSavings = str_replace('collection_date', 'deposit_date', $whereSqlSavings);

        $stmtSavings = $db->prepare("
            SELECT sd.*, c.full_name as customer_name, sa.saving_account_no as account_no, 'Saving' as account_type, u.name as collector_name
            FROM saving_deposits sd
            JOIN customers c ON sd.customer_id = c.id
            JOIN saving_accounts sa ON sd.saving_account_id = sa.id
            JOIN users u ON sd.collected_by = u.id
            $whereSqlSavings
            ORDER BY sd.id DESC
        ");
        $stmtSavings->execute($bind);
        $savings = $stmtSavings->fetchAll();

        // Combine
        $list = [];
        foreach ($loans as $l) {
            $list[] = [
                'id' => 'L-' . $l['id'],
                'sort_key' => $l['created_at'] ?? $l['collection_date'] . ' 00:00:00',
                'receipt_no' => $l['receipt_no'],
                'account_no' => $l['account_no'],
                'customer_name' => $l['customer_name'],
                'account_type' => 'Loan',
                'amount' => $l['collected_amount'],
                'penalty' => $l['penalty_amount'],
                'payment_mode' => $l['payment_mode'],
                'collector' => $l['collector_name'],
                'date' => $l['collection_date']
            ];
        }
        foreach ($savings as $s) {
            $list[] = [
                'id' => 'S-' . $s['id'],
                'sort_key' => $s['created_at'] ?? $s['deposit_date'] . ' 00:00:00',
                'receipt_no' => $s['receipt_no'],
                'account_no' => $s['account_no'],
                'customer_name' => $s['customer_name'],
                'account_type' => 'Saving',
                'amount' => $s['deposit_amount'],
                'penalty' => 0,
                'payment_mode' => $s['payment_mode'],
                'collector' => $s['collector_name'],
                'date' => $s['deposit_date']
            ];
        }

        // Newest first across both lists (uses created_at timestamp)
        usort($list, function($a, $b) {
            return strcmp($b['sort_key'], $a['sort_key']);
        });

        // Drop helper sort_key from response
        $list = array_map(function($row) {
            unset($row['sort_key']);
            return $row;
        }, $list);

        Response::success($list);
    }

    public static function due($db, $authUser) {
        $branchId = $_GET['branch_id'] ?? null;
        $agentId = $_GET['agent_id'] ?? null;
        $date = $_GET['date'] ?? date('Y-m-d');

        if ($authUser['role_slug'] === 'agent') {
            $agentId = $authUser['agent_id'];
        }

        $bind = ['date' => $date];
        $where = ["la.account_status IN ('Approved', 'Active', 'Defaulter')"];

        if ($branchId) {
            $where[] = "la.branch_id = :branch_id";
            $bind['branch_id'] = $branchId;
        }
        if ($agentId) {
            $where[] = "la.agent_id = :agent_id";
            $bind['agent_id'] = $agentId;
        }

        $whereSql = implode(" AND ", $where);

        // Fetch accounts that have installments due on or before today and paid_amount < total_due
        $stmt = $db->prepare("
            SELECT DISTINCT la.id, la.loan_account_no, la.emi_amount, c.full_name as customer_name, c.mobile as customer_mobile,
            ag.name as agent_name,
            (SELECT SUM(total_due - paid_amount) FROM loan_installments WHERE loan_account_id = la.id AND due_date <= :date) as pending_due
            FROM loan_accounts la
            JOIN customers c ON la.customer_id = c.id
            JOIN agents ag ON la.agent_id = ag.id
            JOIN loan_installments li ON li.loan_account_id = la.id
            WHERE $whereSql AND li.due_date <= :date2 AND li.status != 'Paid'
        ");
        $bind['date2'] = $date;
        $stmt->execute($bind);
        $dues = $stmt->fetchAll();

        // Format
        $list = [];
        foreach ($dues as $d) {
            if ($d['pending_due'] > 0) {
                $list[] = [
                    'account_no' => $d['loan_account_no'],
                    'customer_name' => $d['customer_name'],
                    'mobile' => $d['customer_mobile'],
                    'due_amount' => $d['pending_due'],
                    'emi_amount' => $d['emi_amount'],
                    'agent_name' => $d['agent_name']
                ];
            }
        }

        Response::success($list);
    }

    public static function byAgent($db, $authUser, $agentId) {
        // Fetch accounts assigned to specific agent for daily collection checklist
        $stmt = $db->prepare("
            SELECT la.id, la.loan_account_no as accNo, 'Loan' as type, la.emi_amount as emiAmt,
            la.outstanding_amount as outstanding, c.full_name as customer_name, c.mobile as phone,
            b.name as branch, ar.name as area, ag.name as agent,
            (SELECT COUNT(*) FROM loan_collections WHERE loan_account_id = la.id AND collection_date = CURRENT_DATE() AND is_reversal = 0) as today_paid
            FROM loan_accounts la
            JOIN customers c ON la.customer_id = c.id
            JOIN branches b ON la.branch_id = b.id
            JOIN areas ar ON la.area_id = ar.id
            JOIN agents ag ON la.agent_id = ag.id
            WHERE la.agent_id = :agent_id AND la.account_status IN ('Approved', 'Active', 'Defaulter') AND la.deleted_at IS NULL
            
            UNION ALL
            
            SELECT sa.id, sa.saving_account_no as accNo, 'Saving' as type, sa.deposit_amount as emiAmt,
            sa.total_deposited as outstanding, c.full_name as customer_name, c.mobile as phone,
            b.name as branch, ar.name as area, ag.name as agent,
            (SELECT COUNT(*) FROM saving_deposits WHERE saving_account_id = sa.id AND deposit_date = CURRENT_DATE() AND is_reversal = 0) as today_paid
            FROM saving_accounts sa
            JOIN customers c ON sa.customer_id = c.id
            JOIN branches b ON sa.branch_id = b.id
            JOIN areas ar ON sa.area_id = ar.id
            JOIN agents ag ON sa.agent_id = ag.id
            WHERE sa.agent_id = :agent_id2 AND sa.account_status IN ('Approved', 'Active') AND sa.deleted_at IS NULL
        ");
        $stmt->execute(['agent_id' => $agentId, 'agent_id2' => $agentId]);
        $rows = $stmt->fetchAll();

        // Format to match old React mock schema
        $list = [];
        foreach ($rows as $row) {
            $list[] = [
                'id' => $row['id'],
                'accNo' => $row['accNo'],
                'type' => $row['type'],
                'emiAmt' => (float)$row['emiAmt'],
                'outstanding' => (float)$row['outstanding'],
                'todayStatus' => $row['today_paid'] > 0 ? 'Paid' : 'Pending',
                'customer' => [
                    'name' => $row['customer_name'],
                    'phone' => $row['phone']
                ],
                'branch' => $row['branch'],
                'area' => $row['area'],
                'agent' => $row['agent']
            ];
        }

        Response::success($list);
    }

    public static function collectLoan($db, $authUser, $input) {
        $errors = Validator::required($input, ['account_no', 'collected_amount']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        $account = LoanAccount::getByAccountNo($db, $input['account_no']);
        if (!$account) {
            Response::error('Loan account not found.', 404);
        }

        $input['loan_account_id'] = $account['id'];
        $input['collected_by'] = $authUser['id'];

        try {
            $receiptNo = LoanCollection::collect($db, $input);
            Response::success(['receipt_no' => $receiptNo], 'Loan payment collected successfully.');
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public static function collectSaving($db, $authUser, $input) {
        $errors = Validator::required($input, ['account_no', 'deposit_amount']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        $account = SavingAccount::getByAccountNo($db, $input['account_no']);
        if (!$account) {
            Response::error('Savings account not found.', 404);
        }

        $input['saving_account_id'] = $account['id'];
        $input['collected_by'] = $authUser['id'];

        try {
            $receiptNo = SavingDeposit::deposit($db, $input);
            Response::success(['receipt_no' => $receiptNo], 'Savings deposit recorded successfully.');
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public static function history($db, $authUser) {
        [$page, $perPage, $offset] = Validator::getPaginationParams();

        $where = [];
        $bind = [];

        if ($authUser['role_slug'] === 'agent') {
            $where[] = "r.agent_id = :agent_id";
            $bind['agent_id'] = $authUser['agent_id'];
        }

        $whereSql = !empty($where) ? "WHERE " . implode(" AND ", $where) : "";

        // Total count
        $stmtCount = $db->prepare("SELECT COUNT(*) FROM receipts r $whereSql");
        $stmtCount->execute($bind);
        $total = $stmtCount->fetchColumn();

        // List
        $stmt = $db->prepare("
            SELECT r.*, c.full_name as customer_name, u.name as generated_name
            FROM receipts r
            LEFT JOIN customers c ON r.customer_id = c.id
            LEFT JOIN users u ON r.generated_by = u.id
            $whereSql
            ORDER BY r.id DESC
            LIMIT :limit OFFSET :offset
        ");
        $stmt->bindValue(':limit', (int)$perPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', (int)$offset, PDO::PARAM_INT);
        foreach ($bind as $key => $val) {
            $stmt->bindValue(":$key", $val);
        }
        $stmt->execute();
        $receipts = $stmt->fetchAll();

        Response::paginated($receipts, $total, $page, $perPage);
    }

    public static function receipt($db, $authUser, $receiptNo) {
        $stmt = $db->prepare("SELECT * FROM receipts WHERE receipt_no = :receipt_no");
        $stmt->execute(['receipt_no' => $receiptNo]);
        $receipt = $stmt->fetch();

        if (!$receipt) {
            Response::error('Receipt not found.', 404);
        }

        // Fetch detail based on type
        if ($receipt['receipt_type'] === 'loan_collection') {
            $stmtDet = $db->prepare("
                SELECT lc.*, c.full_name as customer_name, la.loan_account_no as account_no, u.name as collector_name,
                b.name as branch_name, ar.name as area_name
                FROM loan_collections lc
                JOIN customers c ON lc.customer_id = c.id
                JOIN loan_accounts la ON lc.loan_account_id = la.id
                JOIN users u ON lc.collected_by = u.id
                JOIN branches b ON lc.branch_id = b.id
                JOIN areas ar ON lc.area_id = ar.id
                WHERE lc.id = :id
            ");
            $stmtDet->execute(['id' => $receipt['reference_id']]);
            $detail = $stmtDet->fetch();
            $receipt['detail'] = $detail;
        } elseif ($receipt['receipt_type'] === 'saving_deposit') {
            $stmtDet = $db->prepare("
                SELECT sd.*, c.full_name as customer_name, sa.saving_account_no as account_no, u.name as collector_name,
                b.name as branch_name, ar.name as area_name
                FROM saving_deposits sd
                JOIN customers c ON sd.customer_id = c.id
                JOIN saving_accounts sa ON sd.saving_account_id = sa.id
                JOIN users u ON sd.collected_by = u.id
                JOIN branches b ON sd.branch_id = b.id
                JOIN areas ar ON sd.area_id = ar.id
                WHERE sd.id = :id
            ");
            $stmtDet->execute(['id' => $receipt['reference_id']]);
            $detail = $stmtDet->fetch();
            $receipt['detail'] = $detail;
        }

        Response::success($receipt);
    }

    public static function delete($db, $authUser, $receiptNo) {
        $db->beginTransaction();
        try {
            // 1. Get receipt from receipts table
            $stmt = $db->prepare("SELECT * FROM receipts WHERE receipt_no = :receipt_no FOR UPDATE");
            $stmt->execute(['receipt_no' => $receiptNo]);
            $receipt = $stmt->fetch();
            if (!$receipt) {
                throw new Exception('Receipt not found.');
            }

            // 2. Based on type, delete/recalculate
            if ($receipt['receipt_type'] === 'loan_collection') {
                // Fetch the loan collection
                $stmtLC = $db->prepare("SELECT * FROM loan_collections WHERE id = :id FOR UPDATE");
                $stmtLC->execute(['id' => $receipt['reference_id']]);
                $loanColl = $stmtLC->fetch();
                if ($loanColl) {
                    $loanAccountId = $loanColl['loan_account_id'];

                    // Check if there is a newer non-reversed collection for this account (LIFO safety check)
                    $stmtNewer = $db->prepare("
                        SELECT COUNT(*) FROM loan_collections 
                        WHERE loan_account_id = :loan_id AND id > :id AND is_reversal = 0
                    ");
                    $stmtNewer->execute(['loan_id' => $loanAccountId, 'id' => $loanColl['id']]);
                    if ($stmtNewer->fetchColumn() > 0) {
                        throw new Exception('Cannot reset this collection. Only the most recent collection can be reset first.');
                    }

                    // Delete the loan collection row
                    $db->prepare("DELETE FROM loan_collections WHERE id = :id")->execute(['id' => $loanColl['id']]);

                    // Reset all installments to Pending
                    $db->prepare("
                        UPDATE loan_installments 
                        SET paid_amount = 0.00, status = 'Pending', paid_at = NULL, penalty_amount = 0.00
                        WHERE loan_account_id = :loan_id
                    ")->execute(['loan_id' => $loanAccountId]);

                    // Fetch remaining collections for this account
                    $stmtAllColl = $db->prepare("
                        SELECT * FROM loan_collections 
                        WHERE loan_account_id = :loan_id AND is_reversal = 0
                        ORDER BY id ASC
                    ");
                    $stmtAllColl->execute(['loan_id' => $loanAccountId]);
                    $allCollections = $stmtAllColl->fetchAll();

                    $totalPaid = 0;
                    $totalPenalty = 0;

                    // Re-apply remaining collections to installments sequentially
                    foreach ($allCollections as $coll) {
                        $remainingAmount = $coll['collected_amount'];
                        $penaltyAmount = $coll['penalty_amount'];
                        $totalPaid += $remainingAmount;
                        $totalPenalty += $penaltyAmount;

                        // Fetch unpaid installments
                        $stmtInsts = $db->prepare("
                            SELECT * FROM loan_installments 
                            WHERE loan_account_id = :loan_id AND status != 'Paid'
                            ORDER BY installment_no ASC
                        ");
                        $stmtInsts->execute(['loan_id' => $loanAccountId]);
                        $installments = $stmtInsts->fetchAll();

                        $allocs = [];
                        foreach ($installments as $inst) {
                            if ($remainingAmount <= 0) break;

                            $instId = $inst['id'];
                            $totalDue = $inst['total_due'];
                            $paidAmt = $inst['paid_amount'];
                            $pending = $totalDue - $paidAmt;

                            if ($remainingAmount >= $pending) {
                                $allocatedForInst = $pending;
                                $remainingAmount -= $pending;
                                $db->prepare("
                                    UPDATE loan_installments 
                                    SET paid_amount = total_due, status = 'Paid', paid_at = NOW() 
                                    WHERE id = :id
                                ")->execute(['id' => $instId]);
                            } else {
                                $allocatedForInst = $remainingAmount;
                                $db->prepare("
                                    UPDATE loan_installments 
                                    SET paid_amount = paid_amount + :allocated, status = 'Partial' 
                                    WHERE id = :id
                                ")->execute(['allocated' => $remainingAmount, 'id' => $instId]);
                                $remainingAmount = 0;
                            }

                            $allocs[] = [
                                'installment_id' => (int)$inst['id'],
                                'due_date' => $inst['due_date'],
                                'amount' => $allocatedForInst
                            ];
                        }

                        if ($remainingAmount > 0) {
                            $allocs[] = [
                                'installment_id' => null,
                                'due_date' => 'Advance',
                                'amount' => $remainingAmount
                            ];
                        }

                        // Update recalculated allocations in database
                        $db->prepare("UPDATE loan_collections SET installment_allocations = :alloc WHERE id = :id")
                           ->execute(['alloc' => json_encode($allocs), 'id' => $coll['id']]);

                        // Apply penalty to the first unpaid installment if any
                        if ($penaltyAmount > 0) {
                            $stmtUnpaid = $db->prepare("
                                SELECT id FROM loan_installments 
                                WHERE loan_account_id = :loan_id AND status != 'Paid'
                                ORDER BY installment_no ASC LIMIT 1
                            ");
                            $stmtUnpaid->execute(['loan_id' => $loanAccountId]);
                            $firstUnpaidId = $stmtUnpaid->fetchColumn();
                            if ($firstUnpaidId) {
                                $db->prepare("
                                    UPDATE loan_installments 
                                    SET penalty_amount = penalty_amount + :penalty 
                                    WHERE id = :id
                                ")->execute(['penalty' => $penaltyAmount, 'id' => $firstUnpaidId]);
                            }
                        }
                    }

                    // Update loan account balance
                    $stmtAccount = $db->prepare("SELECT principal_amount, total_payable, emi_amount FROM loan_accounts WHERE id = :id");
                    $stmtAccount->execute(['id' => $loanAccountId]);
                    $loanAcc = $stmtAccount->fetch();

                    $newOutstanding = max(0, $loanAcc['total_payable'] - $totalPaid);
                    $newStatus = ($newOutstanding <= 0) ? 'Closed' : 'Active';

                    $stmtUpdateAccount = $db->prepare("
                        UPDATE loan_accounts 
                        SET total_paid = :total_paid, outstanding_amount = :outstanding_amount, 
                            penalty_amount = :penalty_amount, account_status = :status,
                            closed_at = :closed_at, closed_by = :closed_by
                        WHERE id = :id
                    ");
                    $stmtUpdateAccount->execute([
                        'total_paid' => $totalPaid,
                        'outstanding_amount' => $newOutstanding,
                        'penalty_amount' => $totalPenalty,
                        'status' => $newStatus,
                        'closed_at' => ($newStatus === 'Closed') ? date('Y-m-d H:i:s') : null,
                        'closed_by' => ($newStatus === 'Closed') ? $authUser['id'] : null,
                        'id' => $loanAccountId
                    ]);
                }
            } elseif ($receipt['receipt_type'] === 'saving_deposit') {
                // Fetch the saving deposit
                $stmtSD = $db->prepare("SELECT * FROM saving_deposits WHERE id = :id FOR UPDATE");
                $stmtSD->execute(['id' => $receipt['reference_id']]);
                $savingDep = $stmtSD->fetch();
                if ($savingDep) {
                    $savingAccountId = $savingDep['saving_account_id'];

                    // Check if there is a newer non-reversed deposit for this account (LIFO safety check)
                    $stmtNewer = $db->prepare("
                        SELECT COUNT(*) FROM saving_deposits 
                        WHERE saving_account_id = :saving_id AND id > :id AND is_reversal = 0
                    ");
                    $stmtNewer->execute(['saving_id' => $savingAccountId, 'id' => $savingDep['id']]);
                    if ($stmtNewer->fetchColumn() > 0) {
                        throw new Exception('Cannot reset this deposit. Only the most recent deposit can be reset first.');
                    }

                    // Delete the deposit row
                    $db->prepare("DELETE FROM saving_deposits WHERE id = :id")->execute(['id' => $savingDep['id']]);

                    // Reset all installments to Pending
                    $db->prepare("
                        UPDATE saving_installments 
                        SET paid_amount = 0.00, status = 'Pending'
                        WHERE saving_account_id = :saving_id
                    ")->execute(['saving_id' => $savingAccountId]);

                    // Fetch remaining deposits
                    $stmtAllDep = $db->prepare("
                        SELECT * FROM saving_deposits 
                        WHERE saving_account_id = :saving_id AND is_reversal = 0
                        ORDER BY id ASC
                    ");
                    $stmtAllDep->execute(['saving_id' => $savingAccountId]);
                    $allDeposits = $stmtAllDep->fetchAll();

                    $totalDeposited = 0;
                    foreach ($allDeposits as $dep) {
                        $remainingAmount = $dep['deposit_amount'];
                        $totalDeposited += $remainingAmount;

                        // Fetch unpaid installments
                        $stmtInsts = $db->prepare("
                            SELECT * FROM saving_installments 
                            WHERE saving_account_id = :saving_id AND status != 'Paid'
                            ORDER BY installment_no ASC
                        ");
                        $stmtInsts->execute(['saving_id' => $savingAccountId]);
                        $installments = $stmtInsts->fetchAll();

                        $allocs = [];
                        foreach ($installments as $inst) {
                            if ($remainingAmount <= 0) break;

                            $instId = $inst['id'];
                            $totalDue = $inst['total_due'];
                            $paidAmt = $inst['paid_amount'];
                            $pending = $totalDue - $paidAmt;

                            if ($remainingAmount >= $pending) {
                                $allocatedForInst = $pending;
                                $remainingAmount -= $pending;
                                $db->prepare("
                                    UPDATE saving_installments 
                                    SET paid_amount = total_due, status = 'Paid' 
                                    WHERE id = :id
                                ")->execute(['id' => $instId]);
                            } else {
                                $allocatedForInst = $remainingAmount;
                                $db->prepare("
                                    UPDATE saving_installments 
                                    SET paid_amount = paid_amount + :allocated, status = 'Partial' 
                                    WHERE id = :id
                                ")->execute(['allocated' => $remainingAmount, 'id' => $instId]);
                                $remainingAmount = 0;
                            }

                            $allocs[] = [
                                'installment_id' => (int)$inst['id'],
                                'due_date' => $inst['due_date'],
                                'amount' => $allocatedForInst
                            ];
                        }

                        if ($remainingAmount > 0) {
                            $allocs[] = [
                                'installment_id' => null,
                                'due_date' => 'Advance',
                                'amount' => $remainingAmount
                            ];
                        }

                        // Update recalculated allocations in database
                        $db->prepare("UPDATE saving_deposits SET installment_allocations = :alloc WHERE id = :id")
                           ->execute(['alloc' => json_encode($allocs), 'id' => $dep['id']]);
                    }

                    // Update saving account total_deposited
                    $stmtUpdateAccount = $db->prepare("
                        UPDATE saving_accounts 
                        SET total_deposited = :total_deposited
                        WHERE id = :id
                    ");
                    $stmtUpdateAccount->execute([
                        'total_deposited' => $totalDeposited,
                        'id' => $savingAccountId
                    ]);
                }
            }

            // 3. Delete from central receipts table
            $db->prepare("DELETE FROM receipts WHERE receipt_no = :receipt_no")->execute(['receipt_no' => $receiptNo]);

            // 4. Delete from cash book
            $db->prepare("
                DELETE FROM cash_book 
                WHERE reference_no = :receipt_no AND reference_type IN ('loan_collection', 'saving_deposit')
            ")->execute(['receipt_no' => $receiptNo]);

            $db->commit();
            Response::success(null, 'Collection reset successfully.');
        } catch (Exception $e) {
            $db->rollBack();
            Response::error($e->getMessage(), 400);
        }
    }

    public static function update($db, $authUser, $receiptNo, $data) {
        $db->beginTransaction();
        try {
            // 1. Get receipt from receipts table
            $stmt = $db->prepare("SELECT * FROM receipts WHERE receipt_no = :receipt_no FOR UPDATE");
            $stmt->execute(['receipt_no' => $receiptNo]);
            $receipt = $stmt->fetch();
            if (!$receipt) {
                throw new Exception('Receipt not found.');
            }

            // Parse inputs
            $newAmount = floatval($data['amount'] ?? 0);
            $newPenalty = floatval($data['penalty'] ?? 0);
            $newPaymentMode = $data['payment_mode'] ?? 'Cash';
            $newRemarks = $data['remarks'] ?? '';
            $newDate = $data['date'] ?? date('Y-m-d');

            if ($newAmount <= 0) {
                throw new Exception('Amount must be greater than 0.');
            }

            // 2. Based on type, update & recalculate
            if ($receipt['receipt_type'] === 'loan_collection') {
                // Fetch the loan collection
                $stmtLC = $db->prepare("SELECT * FROM loan_collections WHERE id = :id FOR UPDATE");
                $stmtLC->execute(['id' => $receipt['reference_id']]);
                $loanColl = $stmtLC->fetch();
                if ($loanColl) {
                    $loanAccountId = $loanColl['loan_account_id'];

                    // Check LIFO safety: Only the most recent collection can be updated
                    $stmtNewer = $db->prepare("
                        SELECT COUNT(*) FROM loan_collections 
                        WHERE loan_account_id = :loan_id AND id > :id AND is_reversal = 0
                    ");
                    $stmtNewer->execute(['loan_id' => $loanAccountId, 'id' => $loanColl['id']]);
                    if ($stmtNewer->fetchColumn() > 0) {
                        throw new Exception('Cannot update this collection. Only the most recent collection can be updated first.');
                    }

                    // Get loan account ratios for split calculation
                    $stmtAccInfo = $db->prepare("SELECT principal_amount, total_payable FROM loan_accounts WHERE id = :id");
                    $stmtAccInfo->execute(['id' => $loanAccountId]);
                    $loanAccInfo = $stmtAccInfo->fetch();
                    $ratio = $loanAccInfo['total_payable'] > 0 ? ($loanAccInfo['principal_amount'] / $loanAccInfo['total_payable']) : 1;
                    $newPrincipal = round($newAmount * $ratio, 2);
                    $newInterest = round($newAmount - $newPrincipal, 2);

                    // Update the loan collection row
                    $db->prepare("
                        UPDATE loan_collections 
                        SET collected_amount = :amount, penalty_amount = :penalty, 
                            payment_mode = :payment_mode, remarks = :remarks, collection_date = :date,
                            principal_amount = :principal, interest_amount = :interest
                        WHERE id = :id
                    ")->execute([
                        'amount' => $newAmount,
                        'penalty' => $newPenalty,
                        'payment_mode' => $newPaymentMode,
                        'remarks' => $newRemarks,
                        'date' => $newDate,
                        'principal' => $newPrincipal,
                        'interest' => $newInterest,
                        'id' => $loanColl['id']
                    ]);

                    // Reset all installments to Pending
                    $db->prepare("
                        UPDATE loan_installments 
                        SET paid_amount = 0.00, status = 'Pending', paid_at = NULL, penalty_amount = 0.00
                        WHERE loan_account_id = :loan_id
                    ")->execute(['loan_id' => $loanAccountId]);

                    // Fetch all collections for this account (including the updated one)
                    $stmtAllColl = $db->prepare("
                        SELECT * FROM loan_collections 
                        WHERE loan_account_id = :loan_id AND is_reversal = 0
                        ORDER BY id ASC
                    ");
                    $stmtAllColl->execute(['loan_id' => $loanAccountId]);
                    $allCollections = $stmtAllColl->fetchAll();

                    $totalPaid = 0;
                    $totalPenalty = 0;

                    // Re-apply collections sequentially
                    foreach ($allCollections as $coll) {
                        $remainingAmount = $coll['collected_amount'];
                        $penaltyAmount = $coll['penalty_amount'];
                        $totalPaid += $remainingAmount;
                        $totalPenalty += $penaltyAmount;

                        // Fetch unpaid installments
                        $stmtInsts = $db->prepare("
                            SELECT * FROM loan_installments 
                            WHERE loan_account_id = :loan_id AND status != 'Paid'
                            ORDER BY installment_no ASC
                        ");
                        $stmtInsts->execute(['loan_id' => $loanAccountId]);
                        $installments = $stmtInsts->fetchAll();

                        $allocs = [];
                        foreach ($installments as $inst) {
                            if ($remainingAmount <= 0) break;

                            $instId = $inst['id'];
                            $totalDue = $inst['total_due'];
                            $paidAmt = $inst['paid_amount'];
                            $pending = $totalDue - $paidAmt;

                            if ($remainingAmount >= $pending) {
                                $allocatedForInst = $pending;
                                $remainingAmount -= $pending;
                                $db->prepare("
                                    UPDATE loan_installments 
                                    SET paid_amount = total_due, status = 'Paid', paid_at = NOW() 
                                    WHERE id = :id
                                ")->execute(['id' => $instId]);
                            } else {
                                $allocatedForInst = $remainingAmount;
                                $db->prepare("
                                    UPDATE loan_installments 
                                    SET paid_amount = paid_amount + :allocated, status = 'Partial' 
                                    WHERE id = :id
                                ")->execute(['allocated' => $remainingAmount, 'id' => $instId]);
                                $remainingAmount = 0;
                            }

                            $allocs[] = [
                                'installment_id' => (int)$inst['id'],
                                'due_date' => $inst['due_date'],
                                'amount' => $allocatedForInst
                            ];
                        }

                        if ($remainingAmount > 0) {
                            $allocs[] = [
                                'installment_id' => null,
                                'due_date' => 'Advance',
                                'amount' => $remainingAmount
                            ];
                        }

                        // Update recalculated allocations in database
                        $db->prepare("UPDATE loan_collections SET installment_allocations = :alloc WHERE id = :id")
                           ->execute(['alloc' => json_encode($allocs), 'id' => $coll['id']]);

                        // Apply penalty to the first unpaid installment if any
                        if ($penaltyAmount > 0) {
                            $stmtUnpaid = $db->prepare("
                                SELECT id FROM loan_installments 
                                WHERE loan_account_id = :loan_id AND status != 'Paid'
                                ORDER BY installment_no ASC LIMIT 1
                            ");
                            $stmtUnpaid->execute(['loan_id' => $loanAccountId]);
                            $firstUnpaidId = $stmtUnpaid->fetchColumn();
                            if ($firstUnpaidId) {
                                $db->prepare("
                                    UPDATE loan_installments 
                                    SET penalty_amount = penalty_amount + :penalty 
                                    WHERE id = :id
                                ")->execute(['penalty' => $penaltyAmount, 'id' => $firstUnpaidId]);
                            }
                        }
                    }

                    // Update loan account balance
                    $stmtAccount = $db->prepare("SELECT principal_amount, total_payable, emi_amount FROM loan_accounts WHERE id = :id");
                    $stmtAccount->execute(['id' => $loanAccountId]);
                    $loanAcc = $stmtAccount->fetch();

                    $newOutstanding = max(0, $loanAcc['total_payable'] - $totalPaid);
                    $newStatus = ($newOutstanding <= 0) ? 'Closed' : 'Active';

                    $stmtUpdateAccount = $db->prepare("
                        UPDATE loan_accounts 
                        SET total_paid = :total_paid, outstanding_amount = :outstanding_amount, 
                            penalty_amount = :penalty_amount, account_status = :status,
                            closed_at = :closed_at, closed_by = :closed_by
                        WHERE id = :id
                    ");
                    $stmtUpdateAccount->execute([
                        'total_paid' => $totalPaid,
                        'outstanding_amount' => $newOutstanding,
                        'penalty_amount' => $totalPenalty,
                        'status' => $newStatus,
                        'closed_at' => ($newStatus === 'Closed') ? date('Y-m-d H:i:s') : null,
                        'closed_by' => ($newStatus === 'Closed') ? $authUser['id'] : null,
                        'id' => $loanAccountId
                    ]);
                }
            } elseif ($receipt['receipt_type'] === 'saving_deposit') {
                // Fetch the saving deposit
                $stmtSD = $db->prepare("SELECT * FROM saving_deposits WHERE id = :id FOR UPDATE");
                $stmtSD->execute(['id' => $receipt['reference_id']]);
                $savingDep = $stmtSD->fetch();
                if ($savingDep) {
                    $savingAccountId = $savingDep['saving_account_id'];

                    // Check LIFO safety: Only the most recent deposit can be updated
                    $stmtNewer = $db->prepare("
                        SELECT COUNT(*) FROM saving_deposits 
                        WHERE saving_account_id = :saving_id AND id > :id AND is_reversal = 0
                    ");
                    $stmtNewer->execute(['saving_id' => $savingAccountId, 'id' => $savingDep['id']]);
                    if ($stmtNewer->fetchColumn() > 0) {
                        throw new Exception('Cannot update this deposit. Only the most recent deposit can be updated first.');
                    }

                    // Update saving_deposits row
                    $db->prepare("
                        UPDATE saving_deposits 
                        SET deposit_amount = :amount, payment_mode = :payment_mode, 
                            remarks = :remarks, deposit_date = :date
                        WHERE id = :id
                    ")->execute([
                        'amount' => $newAmount,
                        'payment_mode' => $newPaymentMode,
                        'remarks' => $newRemarks,
                        'date' => $newDate,
                        'id' => $savingDep['id']
                    ]);

                    // Reset all installments to Pending
                    $db->prepare("
                        UPDATE saving_installments 
                        SET paid_amount = 0.00, status = 'Pending'
                        WHERE saving_account_id = :saving_id
                    ")->execute(['saving_id' => $savingAccountId]);

                    // Fetch all deposits (including the updated one)
                    $stmtAllDep = $db->prepare("
                        SELECT * FROM saving_deposits 
                        WHERE saving_account_id = :saving_id AND is_reversal = 0
                        ORDER BY id ASC
                    ");
                    $stmtAllDep->execute(['saving_id' => $savingAccountId]);
                    $allDeposits = $stmtAllDep->fetchAll();

                    $totalDeposited = 0;
                    foreach ($allDeposits as $dep) {
                        $remainingAmount = $dep['deposit_amount'];
                        $totalDeposited += $remainingAmount;

                        // Fetch unpaid installments
                        $stmtInsts = $db->prepare("
                            SELECT * FROM saving_installments 
                            WHERE saving_account_id = :saving_id AND status != 'Paid'
                            ORDER BY installment_no ASC
                        ");
                        $stmtInsts->execute(['saving_id' => $savingAccountId]);
                        $installments = $stmtInsts->fetchAll();

                        $allocs = [];
                        foreach ($installments as $inst) {
                            if ($remainingAmount <= 0) break;

                            $instId = $inst['id'];
                            $totalDue = $inst['total_due'];
                            $paidAmt = $inst['paid_amount'];
                            $pending = $totalDue - $paidAmt;

                            if ($remainingAmount >= $pending) {
                                $allocatedForInst = $pending;
                                $remainingAmount -= $pending;
                                $db->prepare("
                                    UPDATE saving_installments 
                                    SET paid_amount = total_due, status = 'Paid' 
                                    WHERE id = :id
                                ")->execute(['id' => $instId]);
                            } else {
                                $allocatedForInst = $remainingAmount;
                                $db->prepare("
                                    UPDATE saving_installments 
                                    SET paid_amount = paid_amount + :allocated, status = 'Partial' 
                                    WHERE id = :id
                                ")->execute(['allocated' => $remainingAmount, 'id' => $instId]);
                                $remainingAmount = 0;
                            }

                            $allocs[] = [
                                'installment_id' => (int)$inst['id'],
                                'due_date' => $inst['due_date'],
                                'amount' => $allocatedForInst
                            ];
                        }

                        if ($remainingAmount > 0) {
                            $allocs[] = [
                                'installment_id' => null,
                                'due_date' => 'Advance',
                                'amount' => $remainingAmount
                            ];
                        }

                        // Update recalculated allocations in database
                        $db->prepare("UPDATE saving_deposits SET installment_allocations = :alloc WHERE id = :id")
                           ->execute(['alloc' => json_encode($allocs), 'id' => $dep['id']]);
                    }

                    // Update saving account total_deposited
                    $stmtUpdateAccount = $db->prepare("
                        UPDATE saving_accounts 
                        SET total_deposited = :total_deposited
                        WHERE id = :id
                    ");
                    $stmtUpdateAccount->execute([
                        'total_deposited' => $totalDeposited,
                        'id' => $savingAccountId
                    ]);
                }
            }

            // 3. Update central receipts table
            $db->prepare("
                UPDATE receipts 
                SET amount = :amount, payment_mode = :payment_mode, created_at = :date
                WHERE receipt_no = :receipt_no
            ")->execute([
                'amount' => $newAmount + $newPenalty,
                'payment_mode' => $newPaymentMode,
                'date' => $newDate . ' ' . date('H:i:s'),
                'receipt_no' => $receiptNo
            ]);

            // 4. Update cash book entry
            $stmtTx = $db->prepare("SELECT id, branch_id FROM cash_book WHERE reference_no = :receipt_no");
            $stmtTx->execute(['receipt_no' => $receiptNo]);
            $cbTx = $stmtTx->fetch();
            if ($cbTx) {
                $stmtBal = $db->prepare("SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END), 0) FROM cash_book WHERE branch_id = :branch_id AND id < :id");
                $stmtBal->execute(['branch_id' => $cbTx['branch_id'], 'id' => $cbTx['id']]);
                $balBefore = (float)$stmtBal->fetchColumn();
                $newBalAfter = $balBefore + $newAmount + $newPenalty;
                
                $db->prepare("
                    UPDATE cash_book 
                    SET amount = :amount, entry_date = :date, balance_after = :bal_after,
                        description = :description
                    WHERE id = :id
                ")->execute([
                    'amount' => $newAmount + $newPenalty,
                    'date' => $newDate,
                    'bal_after' => $newBalAfter,
                    'description' => $receipt['receipt_type'] === 'loan_collection' ? "Received EMI payment for Loan: " . $receipt['account_no'] : "Deposit to Saving: " . $receipt['account_no'],
                    'id' => $cbTx['id']
                ]);
            }

            $db->commit();
            Response::success(null, 'Collection updated successfully.');
        } catch (Exception $e) {
            $db->rollBack();
            Response::error($e->getMessage(), 400);
        }
    }
}
?>

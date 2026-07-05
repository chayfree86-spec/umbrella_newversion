<?php
/**
 * Loan Account Controller
 */
class LoanController {

    public static function index($db, $authUser) {
        $params = $_GET;
        if ($authUser['role_slug'] === 'agent') {
            $params['agent_id'] = $authUser['agent_id'];
        } elseif ($authUser['role_slug'] === 'branch_manager') {
            $params['branch_id'] = $authUser['branch_id'];
        } elseif ($authUser['role_slug'] === 'area_manager') {
            $params['area_id'] = $authUser['area_id'];
        }

        [$page, $perPage, $offset] = Validator::getPaginationParams();
        $params['limit'] = $perPage;
        $params['offset'] = $offset;

        [$data, $total] = LoanAccount::getAll($db, $params);
        Response::paginated($data, $total, $page, $perPage);
    }

    public static function show($db, $authUser, $id) {
        $account = LoanAccount::getById($db, $id);
        if (!$account) {
            // Try fetching by account number (accNo)
            $account = LoanAccount::getByAccountNo($db, $id);
            if (!$account) {
                Response::error('Loan account not found.', 404);
            }
        }

        if ($authUser['role_slug'] === 'agent' && $account['agent_id'] != $authUser['agent_id']) {
            Response::error('Access denied to this loan account.', 403);
        }

        Response::success($account);
    }

    public static function store($db, $authUser, $input) {
        $errors = Validator::required($input, ['customer_id', 'loan_plan_id', 'principal_amount']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        // Resolve custom plan
        if ($input['loan_plan_id'] === 'custom') {
            $stmtCustom = $db->prepare("SELECT id FROM loan_plans WHERE name = 'Custom Loan Plan' LIMIT 1");
            $stmtCustom->execute();
            $customPlanId = $stmtCustom->fetchColumn();
            if (!$customPlanId) {
                $stmtInsert = $db->prepare("
                    INSERT INTO loan_plans (uuid, name, min_amount, max_amount, interest_rate, interest_type, duration_value, duration_unit, collection_frequency, processing_fee, penalty_per_day, status, created_by)
                    VALUES (UUID(), 'Custom Loan Plan', 0.00, 0.00, 0.00, 'Flat', 0, 'Days', 'Daily', 0.00, 0.00, 'Active', :created_by)
                ");
                $stmtInsert->execute(['created_by' => $authUser['id']]);
                $customPlanId = $db->lastInsertId();
            }
            $input['loan_plan_id'] = $customPlanId;
        }

        // Validate plan & customer
        $plan = LoanPlan::getById($db, $input['loan_plan_id']);
        if (!$plan) {
            Response::error('Invalid loan plan selected.', 422);
        }
        if ($plan['name'] !== 'Custom Loan Plan' && (int)$plan['duration_value'] <= 0) {
            Response::error('Selected loan plan has invalid duration (' . $plan['duration_value'] . '). Update the plan first.', 422);
        }

        $customer = Customer::getById($db, $input['customer_id']);
        if (!$customer) {
            Response::error('Invalid customer selected.', 422);
        }

        $input['branch_id'] = $customer['branch_id'];
        $input['area_id'] = $customer['area_id'];
        $input['agent_id'] = $customer['agent_id'];
        $input['created_by'] = $authUser['id'];

        $isCustom = ($plan['name'] === 'Custom Loan Plan');

        $input['interest_rate'] = $isCustom ? (isset($input['interest_rate']) ? floatval($input['interest_rate']) : floatval($plan['interest_rate'])) : floatval($plan['interest_rate']);
        $input['interest_type'] = $isCustom ? ($input['interest_type'] ?? $plan['interest_type']) : $plan['interest_type'];
        $input['collection_frequency'] = $isCustom ? ($input['collection_frequency'] ?? $plan['collection_frequency']) : $plan['collection_frequency'];
        $durationDays = 0;
        $durationMonths = 0;
        $durVal = $isCustom ? (isset($input['duration_value']) ? intval($input['duration_value']) : intval($plan['duration_value'])) : intval($plan['duration_value']);
        $durUnit = $isCustom ? ($input['duration_unit'] ?? $plan['duration_unit']) : $plan['duration_unit'];

        $startDateStr = $input['start_date'] ?? date('Y-m-d');
        $startDateTime = new DateTime($startDateStr);
        $endDateTime = clone $startDateTime;

        if ($durUnit === 'Days') {
            $durationDays = $durVal;
            $durationMonths = $durVal / 30;
        } elseif ($durUnit === 'Months') {
            $durationMonths = $durVal;
            $durationDays = $durVal * 30;
        } elseif ($durUnit === 'Years') {
            $durationMonths = $durVal * 12;
            $durationDays = $durVal * 360;
        }

        $input['duration_days'] = $durationDays;
        $input['duration_months'] = $durationMonths;

        // Interest amount calculation
        $pAmt = floatval($input['principal_amount']);
        $rate = floatval($input['interest_rate']);
        
        $loanPeriod = Setting::getVal($db, 'interest_calculation_period_loan', 'monthly');
        $timeFactor = ($loanPeriod === 'yearly') ? ($durationMonths / 12) : $durationMonths;

        $interestAmount = ($input['interest_type'] === 'Flat') 
            ? ($pAmt * ($rate / 100) * $timeFactor) 
            : ($pAmt * ($rate / 100) * $timeFactor * 0.7);
        $totalPayable = $pAmt + $interestAmount;

        $input['interest_amount'] = $interestAmount;
        $input['total_payable'] = $totalPayable;
        $input['processing_fee'] = $isCustom ? (isset($input['processing_fee']) ? floatval($input['processing_fee']) : floatval($plan['processing_fee'])) : floatval($plan['processing_fee']);
        
        // Calculate number of installments N
        $freq = $isCustom ? ($input['collection_frequency'] ?? $plan['collection_frequency']) : $plan['collection_frequency'];
        $N = 0;
        if ($freq === 'Daily') {
            $N = $durationDays;
        } elseif ($freq === 'Weekly') {
            $N = round($durationDays / 7);
        } elseif ($freq === 'Monthly') {
            $N = $durationMonths;
        }
        if ($N <= 0) $N = 1;

        $input['emi_amount'] = $isCustom ? (isset($input['emi_amount']) ? floatval($input['emi_amount']) : round($totalPayable / $N, 2)) : round($totalPayable / $N, 2);
        
        $input['start_date'] = $startDateStr;
        $input['end_date'] = $endDateTime->format('Y-m-d');

        $input['account_status'] = 'Processing'; // Awaiting approval by default

        $id = LoanAccount::create($db, $input);
        $account = LoanAccount::getById($db, $id);

        AuditLog::log($db, $authUser['id'], 'create_loan_account', 'loan_accounts', $id, null, $account);
        Response::success($account, 'Loan account application created. Awaiting manager approval.', 201);
    }

    public static function statement($db, $authUser, $id) {
        $account = LoanAccount::getById($db, $id);
        if (!$account) {
            $account = LoanAccount::getByAccountNo($db, $id);
            if (!$account) {
                Response::error('Loan account not found.', 404);
            }
        }

        $transactions = LoanAccount::getStatement($db, $account['id']);
        $installments = LoanAccount::getInstallments($db, $account['id']);
        Response::success([
            'transactions' => $transactions,
            'installments' => $installments
        ]);
    }

    public static function installments($db, $authUser, $id) {
        $account = LoanAccount::getById($db, $id);
        if (!$account) {
            $account = LoanAccount::getByAccountNo($db, $id);
            if (!$account) {
                Response::error('Loan account not found.', 404);
            }
        }

        $installments = LoanAccount::getInstallments($db, $account['id']);
        Response::success($installments);
    }

    public static function collect($db, $authUser, $id, $input) {
        $account = LoanAccount::getById($db, $id);
        if (!$account) {
            $account = LoanAccount::getByAccountNo($db, $id);
            if (!$account) {
                Response::error('Loan account not found.', 404);
            }
        }

        $errors = Validator::required($input, ['collected_amount']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        $input['loan_account_id'] = $account['id'];
        $input['collected_by'] = $authUser['id'];
        $input['collection_date'] = $input['collection_date'] ?? date('Y-m-d');

        try {
            $receiptNo = LoanCollection::collect($db, $input);
            Response::success(['receipt_no' => $receiptNo], 'Loan payment recorded successfully.');
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public static function close($db, $authUser, $id, $input) {
        $account = LoanAccount::getById($db, $id);
        if (!$account) {
            $account = LoanAccount::getByAccountNo($db, $id);
            if (!$account) {
                Response::error('Loan account not found.', 404);
            }
        }

        $closeDate = !empty($input['close_date']) ? $input['close_date'] : date('Y-m-d');
        $settlementAmount = !empty($input['settlement_amount']) ? (float)$input['settlement_amount'] : 0.0;
        $waiverAmount = !empty($input['waiver_amount']) ? (float)$input['waiver_amount'] : 0.0;
        $paymentMode = !empty($input['payment_mode']) ? $input['payment_mode'] : 'Cash';
        $remarks = !empty($input['remarks']) ? $input['remarks'] : 'Loan Settlement';

        // 1. If settlement amount is collected, record a collection first
        $receiptNo = null;
        if ($settlementAmount > 0) {
            $receiptNo = LoanCollection::collect($db, [
                'loan_account_id' => $account['id'],
                'collected_amount' => $settlementAmount,
                'penalty_amount' => 0,
                'payment_mode' => $paymentMode,
                'remarks' => $remarks . " (Settlement Payment)",
                'collected_by' => $authUser['id'],
                'collection_date' => $closeDate
            ]);
        }

        // 2. Fetch all remaining unpaid installments
        $stmtInsts = $db->prepare("
            SELECT * FROM loan_installments 
            WHERE loan_account_id = :loan_id AND status != 'Paid'
            ORDER BY installment_no ASC
        ");
        $stmtInsts->execute(['loan_id' => $account['id']]);
        $remainingInsts = $stmtInsts->fetchAll();

        // 3. Mark all remaining installments as Paid (paid_amount = total_due)
        $stmtUpdateInst = $db->prepare("
            UPDATE loan_installments 
            SET status = 'Paid', paid_amount = total_due, paid_at = :closed_at
            WHERE id = :id
        ");
        foreach ($remainingInsts as $inst) {
            $stmtUpdateInst->execute([
                'closed_at' => $closeDate . ' ' . date('H:i:s'),
                'id' => $inst['id']
            ]);
        }

        // 4. Update the loan account status to Closed
        $stmt = $db->prepare("
            UPDATE loan_accounts
            SET account_status = 'Closed', 
                outstanding_amount = 0.00,
                closed_at = :closed_at, 
                closed_by = :closed_by
            WHERE id = :id
        ");
        $stmt->execute([
            'closed_at' => $closeDate . ' ' . date('H:i:s'),
            'closed_by' => $authUser['id'],
            'id' => $account['id']
        ]);

        AuditLog::log($db, $authUser['id'], 'close_loan_account', 'loan_accounts', $account['id']);
        Response::success(['receipt_no' => $receiptNo], 'Loan account closed successfully.');
    }

    public static function approve($db, $authUser, $id, $input) {
        $account = LoanAccount::getById($db, $id);
        if (!$account) {
            $account = LoanAccount::getByAccountNo($db, $id);
            if (!$account) {
                Response::error('Loan account not found.', 404);
            }
        }

        // Allow approve in Processing OR repair flow for Approved/Active accounts
        // with missing installments OR a malformed schedule OR if explicitly forced
        $instCount = (int)$db->query("SELECT COUNT(*) FROM loan_installments WHERE loan_account_id = " . (int)$account['id'])->fetchColumn();
        $paidCount = (int)$db->query("SELECT COUNT(*) FROM loan_installments WHERE loan_account_id = " . (int)$account['id'] . " AND status='Paid'")->fetchColumn();
        $expectedCount = 0;
        if ((float)$account['emi_amount'] > 0 && (float)$account['total_payable'] > 0) {
            $expectedCount = (int)ceil((float)$account['total_payable'] / (float)$account['emi_amount']);
        }
        $isMalformed = ((int)$account['duration_days'] <= 0)
            || ($expectedCount > 1 && $instCount < $expectedCount)
            || empty($account['approved_at']);
        $force = !empty($input['force']);
        $isRepair = in_array($account['account_status'], ['Approved', 'Active']) && ($instCount === 0 || $isMalformed || $force);
        if ($account['account_status'] !== 'Processing' && !$isRepair) {
            Response::error('Only Processing accounts can be approved (current: ' . $account['account_status'] . '). Pass force=true to re-approve.', 400);
        }
        if ($force && $paidCount > 0) {
            Response::error('Cannot re-approve: ' . $paidCount . ' installment(s) already paid. Reverse collections first.', 400);
        }

        $db->beginTransaction();
        try {
            $startDate = !empty($input['start_date']) ? $input['start_date'] : date('Y-m-d');

            // Derive duration_days from account; if 0 (legacy bad plan), compute from total_payable / emi_amount
            $durationDays = (int)$account['duration_days'];
            $frequency = $account['collection_frequency'] ?? 'Daily';
            $emi = (float)$account['emi_amount'];
            $totalPayable = (float)$account['total_payable'];
            if ($durationDays <= 0 && $emi > 0 && $totalPayable > 0) {
                $installmentsCount = (int)ceil($totalPayable / $emi);
                if ($frequency === 'Daily') {
                    $durationDays = $installmentsCount;
                } elseif ($frequency === 'Weekly') {
                    $durationDays = $installmentsCount * 7;
                } elseif ($frequency === 'Monthly') {
                    $startDateTime = new DateTime($startDate);
                    $endDateTime = clone $startDateTime;
                    $endDateTime->modify("+$installmentsCount month");
                    $durationDays = $endDateTime->diff($startDateTime)->days;
                }
            }

            if ($durationDays <= 0) {
                throw new Exception('Cannot derive loan duration. Check plan duration and account EMI.');
            }

            $approvedDate = !empty($input['approved_date']) ? $input['approved_date'] : date('Y-m-d');
            $approvedAt = $approvedDate . ' ' . date('H:i:s');
            $endDate = date('Y-m-d', strtotime("$approvedDate +$durationDays days"));

            $stmt = $db->prepare("
                UPDATE loan_accounts SET
                    account_status = 'Active',
                    approved_by = :approved_by,
                    approved_at = :approved_at,
                    start_date = :start_date,
                    end_date = :end_date,
                    duration_days = :duration_days,
                    created_at = :created_at
                WHERE id = :id
            ");
            $stmt->execute([
                'approved_by' => $authUser['id'],
                'approved_at' => $approvedAt,
                'start_date' => $startDate,
                'end_date' => $endDate,
                'duration_days' => $durationDays,
                'created_at' => $startDate . ' ' . date('H:i:s'),
                'id' => $account['id']
            ]);

            // Fresh approval par loan fund se paisa DISTRIBUTE hua —
            // pool + fund_loan_history me entry (repair/re-approve par nahi)
            if ($account['account_status'] === 'Processing') {
                Fund::applyPoolTxn($db, 'loan_fund', 'debit', 'loan_disbursed', $account['principal_amount'], [
                    'reference_no' => $account['loan_account_no'],
                    'description'  => 'Loan disbursed: ' . $account['loan_account_no'],
                    'entry_date'   => $approvedDate,
                    'entered_by'   => $authUser['id']
                ]);
            }

            // Clear existing installments (safety) and generate fresh
            $db->prepare("DELETE FROM loan_installments WHERE loan_account_id = :id")
               ->execute(['id' => $account['id']]);

            $genData = array_merge((array)$account, [
                'start_date' => $approvedDate,
                'duration_days' => $durationDays,
                'duration_months' => $account['duration_months'],
                'collection_frequency' => $frequency,
                'principal_amount' => $account['principal_amount'],
                'interest_amount' => $account['interest_amount'],
                'total_payable' => $totalPayable,
                'emi_amount' => $emi
            ]);
            LoanAccount::generateInstallments($db, $account['id'], $genData);

            $db->commit();
            AuditLog::log($db, $authUser['id'], $isRepair ? 'repair_loan_schedule' : 'approve_loan_account', 'loan_accounts', $account['id'], $account, ['status' => 'Active', 'duration_days' => $durationDays]);

            $updated = LoanAccount::getById($db, $account['id']);
            $msg = $isRepair ? 'Loan schedule repaired successfully.' : 'Loan account approved and EMI schedule generated.';
            Response::success($updated, $msg);
        } catch (Exception $e) {
            $db->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public static function reject($db, $authUser, $id, $input) {
        $account = LoanAccount::getById($db, $id);
        if (!$account) {
            $account = LoanAccount::getByAccountNo($db, $id);
            if (!$account) {
                Response::error('Loan account not found.', 404);
            }
        }
        if (!in_array($account['account_status'], ['Processing', 'Approved', 'Active'])) {
            Response::error('Cannot reject from status: ' . $account['account_status'], 400);
        }

        // Block if any installment is paid (collections exist)
        $paidCount = (int)$db->query("SELECT COUNT(*) FROM loan_installments WHERE loan_account_id = " . (int)$account['id'] . " AND status = 'Paid'")->fetchColumn();
        if ($paidCount > 0) {
            Response::error('Cannot reject: ' . $paidCount . ' installment(s) already paid. Reverse collections first.', 400);
        }

        $db->beginTransaction();
        try {
            // Approved/Active account reject par disbursed paisa loan fund me wapas
            if (!empty($account['approved_at']) && in_array($account['account_status'], ['Approved', 'Active'])) {
                Fund::applyPoolTxn($db, 'loan_fund', 'credit', 'disbursal_reversed', $account['principal_amount'], [
                    'reference_no' => $account['loan_account_no'],
                    'description'  => 'Disbursal reversed (rejected): ' . $account['loan_account_no'],
                    'entered_by'   => $authUser['id']
                ]);
            }

            // Clean up schedule — Rejected/Processing accounts must not carry installments
            $db->prepare("DELETE FROM loan_installments WHERE loan_account_id = :id")
               ->execute(['id' => $account['id']]);

            $stmt = $db->prepare("
                UPDATE loan_accounts SET
                    account_status = 'Rejected',
                    approved_at = NULL,
                    approved_by = NULL,
                    start_date = NULL,
                    end_date = NULL
                WHERE id = :id
            ");
            $stmt->execute(['id' => $account['id']]);

            $db->commit();
            AuditLog::log($db, $authUser['id'], 'reject_loan_account', 'loan_accounts', $account['id']);
            Response::success(null, 'Loan account rejected and schedule cleared.');
        } catch (Exception $e) {
            $db->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public static function reset($db, $authUser, $id, $input) {
        $account = LoanAccount::getById($db, $id);
        if (!$account) {
            $account = LoanAccount::getByAccountNo($db, $id);
            if (!$account) {
                Response::error('Loan account not found.', 404);
            }
        }
        if ($account['account_status'] === 'Processing') {
            Response::error('Account is already in Processing state.', 400);
        }

        // Block if any installment is paid
        $paidCount = (int)$db->query("SELECT COUNT(*) FROM loan_installments WHERE loan_account_id = " . (int)$account['id'] . " AND status = 'Paid'")->fetchColumn();
        if ($paidCount > 0) {
            Response::error('Cannot reset: ' . $paidCount . ' installment(s) already paid. Reverse collections first.', 400);
        }

        $db->beginTransaction();
        try {
            // Approved/Active se wapas Processing — disbursal reverse hota hai
            if (!empty($account['approved_at']) && in_array($account['account_status'], ['Approved', 'Active', 'Defaulter', 'NPA'])) {
                Fund::applyPoolTxn($db, 'loan_fund', 'credit', 'disbursal_reversed', $account['principal_amount'], [
                    'reference_no' => $account['loan_account_no'],
                    'description'  => 'Disbursal reversed (reset to processing): ' . $account['loan_account_no'],
                    'entered_by'   => $authUser['id']
                ]);
            }

            $db->prepare("DELETE FROM loan_installments WHERE loan_account_id = :id")
               ->execute(['id' => $account['id']]);

            $stmt = $db->prepare("
                UPDATE loan_accounts SET
                    account_status = 'Processing',
                    approved_at = NULL,
                    approved_by = NULL,
                    start_date = NULL,
                    end_date = NULL
                WHERE id = :id
            ");
            $stmt->execute(['id' => $account['id']]);

            $db->commit();
            AuditLog::log($db, $authUser['id'], 'reset_loan_account', 'loan_accounts', $account['id']);
            $updated = LoanAccount::getById($db, $account['id']);
            Response::success($updated, 'Loan account reset to Processing. Schedule cleared.');
        } catch (Exception $e) {
            $db->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public static function destroy($db, $authUser, $id) {
        $account = LoanAccount::getById($db, $id);
        if (!$account) {
            $account = LoanAccount::getByAccountNo($db, $id);
            if (!$account) {
                Response::error('Loan account not found.', 404);
            }
        }

        if ($account['account_status'] !== 'Rejected') {
            Response::error('Only Rejected accounts can be deleted.', 400);
        }

        $db->beginTransaction();
        try {
            $stmt = $db->prepare("UPDATE loan_accounts SET deleted_at = NOW() WHERE id = :id");
            $stmt->execute(['id' => $account['id']]);

            $db->commit();
            AuditLog::log($db, $authUser['id'], 'delete_loan_account', 'loan_accounts', $account['id']);
            Response::success(null, 'Loan account deleted successfully.');
        } catch (Exception $e) {
            $db->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public static function clearLedger($db, $authUser, $id) {
        $account = LoanAccount::getById($db, $id);
        if (!$account) {
            $account = LoanAccount::getByAccountNo($db, $id);
            if (!$account) {
                Response::error('Loan account not found.', 404);
            }
        }

        $db->beginTransaction();
        try {
            // Jo paisa collect hua tha wo loan fund se wapas nikal jata hai
            $stmtSum = $db->prepare("SELECT COALESCE(SUM(collected_amount + penalty_amount), 0) FROM loan_collections WHERE loan_account_id = :id AND is_reversal = 0");
            $stmtSum->execute(['id' => $account['id']]);
            $clearedTotal = (float)$stmtSum->fetchColumn();
            if ($clearedTotal > 0) {
                Fund::applyPoolTxn($db, 'loan_fund', 'debit', 'collection_reversed', $clearedTotal, [
                    'reference_no' => $account['loan_account_no'],
                    'description'  => 'Ledger cleared — collections reversed: ' . $account['loan_account_no'],
                    'entered_by'   => $authUser['id']
                ]);
            }

            // Delete all collections
            $db->prepare("DELETE FROM loan_collections WHERE loan_account_id = :id")->execute(['id' => $account['id']]);

            // Reset installments to Pending
            $db->prepare("
                UPDATE loan_installments 
                SET paid_amount = 0.00, status = 'Pending', paid_at = NULL, penalty_amount = 0.00
                WHERE loan_account_id = :loan_id
            ")->execute(['loan_id' => $account['id']]);

            // Reset loan account
            $db->prepare("
                UPDATE loan_accounts 
                SET total_paid = 0.00, outstanding_amount = total_payable, penalty_amount = 0.00, account_status = 'Active'
                WHERE id = :id
            ")->execute(['id' => $account['id']]);

            // Delete central receipts
            $db->prepare("DELETE FROM receipts WHERE account_no = :acc_no AND receipt_type = 'loan_collection'")
               ->execute(['acc_no' => $account['loan_account_no']]);

            $db->commit();
            AuditLog::log($db, $authUser['id'], 'clear_loan_ledger', 'loan_accounts', $account['id']);
            Response::success(null, 'Payment ledger cleared successfully.');
        } catch (Exception $e) {
            $db->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }
}
?>

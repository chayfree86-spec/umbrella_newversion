<?php
/**
 * Saving Account Controller
 */
class SavingController {

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

        [$data, $total] = SavingAccount::getAll($db, $params);
        Response::paginated($data, $total, $page, $perPage);
    }

    public static function show($db, $authUser, $id) {
        $account = SavingAccount::getById($db, $id);
        if (!$account) {
            $account = SavingAccount::getByAccountNo($db, $id);
            if (!$account) {
                Response::error('Savings account not found.', 404);
            }
        }

        if ($authUser['role_slug'] === 'agent' && $account['agent_id'] != $authUser['agent_id']) {
            Response::error('Access denied to this savings account.', 403);
        }

        Response::success($account);
    }

    public static function store($db, $authUser, $input) {
        $errors = Validator::required($input, ['customer_id', 'saving_plan_id']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        // Validate plan & customer
        $plan = SavingPlan::getById($db, $input['saving_plan_id']);
        if (!$plan) {
            Response::error('Invalid savings plan selected.', 422);
        }

        $customer = Customer::getById($db, $input['customer_id']);
        if (!$customer) {
            Response::error('Invalid customer selected.', 422);
        }

        $durationMonths = 12;
        if ($plan['duration_unit'] === 'Days') {
            $durationMonths = ceil($plan['duration_value'] / 30);
        } elseif ($plan['duration_unit'] === 'Years') {
            $durationMonths = $plan['duration_value'] * 12;
        }

        $input['branch_id'] = $customer['branch_id'];
        $input['area_id'] = $customer['area_id'];
        $input['agent_id'] = $customer['agent_id'];
        $input['created_by'] = $authUser['id'];
        $input['deposit_amount'] = isset($input['deposit_amount']) ? floatval($input['deposit_amount']) : floatval($plan['deposit_amount']);
        $input['interest_rate'] = isset($input['interest_rate']) ? floatval($input['interest_rate']) : floatval($plan['interest_rate']);
        $input['duration_months'] = $durationMonths;
        $input['maturity_amount'] = isset($input['maturity_amount']) ? floatval($input['maturity_amount']) : floatval($plan['maturity_amount']);
        $input['collection_frequency'] = $plan['collection_frequency'];
        $input['start_date'] = date('Y-m-d');
        $input['maturity_date'] = date('Y-m-d', strtotime("+$durationMonths months"));
        $input['account_status'] = 'Processing';

        $id = SavingAccount::create($db, $input);
        $account = SavingAccount::getById($db, $id);

        AuditLog::log($db, $authUser['id'], 'create_saving_account', 'saving_accounts', $id, null, $account);
        Response::success($account, 'Savings account created. Awaiting manager approval.', 201);
    }

    public static function statement($db, $authUser, $id) {
        $account = SavingAccount::getById($db, $id);
        if (!$account) {
            $account = SavingAccount::getByAccountNo($db, $id);
            if (!$account) {
                Response::error('Savings account not found.', 404);
            }
        }

        $statement = SavingAccount::getStatement($db, $account['id']);

        // Generate virtual schedule from start_date based on frequency + deposit amount
        $schedule = [];
        if (!empty($account['start_date']) && in_array($account['account_status'], ['Approved', 'Active', 'Matured', 'Closed'])) {
            $start = new DateTime($account['start_date']);
            $end = new DateTime($account['maturity_date'] ?? date('Y-m-d', strtotime('+1 year')));
            $depositAmt = (float)$account['deposit_amount'];
            $frequency = $account['collection_frequency'] ?? 'Daily';

            $interval = $frequency === 'Daily' ? 'P1D' : ($frequency === 'Weekly' ? 'P7D' : 'P1M');

            // Load actual deposits for matching
            $stmt = $db->prepare("SELECT deposit_date, deposit_amount FROM saving_deposits WHERE saving_account_id = :id AND is_reversal = 0 ORDER BY deposit_date ASC");
            $stmt->execute(['id' => $account['id']]);
            $depositRows = $stmt->fetchAll();

            // Bucket deposits per date for quick lookup
            $depositsByDate = [];
            foreach ($depositRows as $row) {
                $d = $row['deposit_date'];
                if (!isset($depositsByDate[$d])) $depositsByDate[$d] = 0;
                $depositsByDate[$d] += (float)$row['deposit_amount'];
            }

            $cur = clone $start;
            $i = 1;
            while ($cur <= $end && $i <= 1000) {
                $dueDate = $cur->format('Y-m-d');
                $paid = $depositsByDate[$dueDate] ?? 0;
                $status = $paid >= $depositAmt ? 'Paid' : ($paid > 0 ? 'Partial' : 'Pending');
                $schedule[] = [
                    'installment_no' => $i,
                    'due_date' => $dueDate,
                    'total_due' => $depositAmt,
                    'paid_amount' => $paid,
                    'status' => $status
                ];
                $cur->add(new DateInterval($interval));
                $i++;
            }
        }

        Response::success([
            'transactions' => $statement,
            'installments' => $schedule
        ]);
    }

    public static function deposit($db, $authUser, $id, $input) {
        $account = SavingAccount::getById($db, $id);
        if (!$account) {
            $account = SavingAccount::getByAccountNo($db, $id);
            if (!$account) {
                Response::error('Savings account not found.', 404);
            }
        }

        $errors = Validator::required($input, ['deposit_amount']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        $input['saving_account_id'] = $account['id'];
        $input['collected_by'] = $authUser['id'];
        $input['deposit_date'] = $input['deposit_date'] ?? date('Y-m-d');

        try {
            $receiptNo = SavingDeposit::deposit($db, $input);
            Response::success(['receipt_no' => $receiptNo], 'Savings deposit recorded successfully.');
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public static function mature($db, $authUser, $id, $input) {
        $account = SavingAccount::getById($db, $id);
        if (!$account) {
            $account = SavingAccount::getByAccountNo($db, $id);
            if (!$account) {
                Response::error('Savings account not found.', 404);
            }
        }

        $db->beginTransaction();
        try {
            // Process payout
            $interestEarned = $account['total_deposited'] * ($account['interest_rate'] / 100);
            $totalPayout = $account['total_deposited'] + $interestEarned;

            $stmt = $db->prepare("
                INSERT INTO saving_maturity (
                    saving_account_id, maturity_date, total_deposited, interest_earned, bonus_amount, total_payout, payout_mode, payout_date, processed_by
                ) VALUES (
                    :id, NOW(), :deposited, :interest, 0.00, :payout, :mode, NOW(), :processed_by
                )
            ");
            $stmt->execute([
                'id' => $account['id'],
                'deposited' => $account['total_deposited'],
                'interest' => $interestEarned,
                'payout' => $totalPayout,
                'mode' => $input['payment_mode'] ?? 'Bank Transfer',
                'processed_by' => $authUser['id']
            ]);

            // Update status
            $stmtUpdate = $db->prepare("UPDATE saving_accounts SET account_status = 'Matured', closed_at = NOW(), closed_by = :closed_by WHERE id = :id");
            $stmtUpdate->execute([
                'closed_by' => $authUser['id'],
                'id' => $account['id']
            ]);

            // Debit from cash book
            $stmtCashBook = $db->prepare("
                INSERT INTO cash_book (
                    uuid, entry_date, entry_type, category, description, reference_no, reference_type, amount, balance_after, branch_id, entered_by
                ) VALUES (
                    :uuid, NOW(), 'debit', 'Savings Payout', :description, :ref_no, 'savings_maturity', :amount, 
                    (SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END), 0) - :amount2 FROM cash_book WHERE branch_id = :branch_id),
                    :branch_id, :entered_by
                )
            ");
            $stmtCashBook->execute([
                'uuid' => Validator::uuid(),
                'description' => "Maturity payout processed for Savings Account: " . $account['saving_account_no'],
                'ref_no' => $account['saving_account_no'],
                'amount' => $totalPayout,
                'amount2' => $totalPayout,
                'branch_id' => $account['branch_id'],
                'entered_by' => $authUser['id']
            ]);

            $db->commit();
            Response::success(null, 'Savings account maturity payout processed successfully.');
        } catch (Exception $e) {
            $db->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public static function close($db, $authUser, $id, $input) {
        $account = SavingAccount::getById($db, $id);
        if (!$account) {
            $account = SavingAccount::getByAccountNo($db, $id);
            if (!$account) {
                Response::error('Savings account not found.', 404);
            }
        }

        $stmt = $db->prepare("
            UPDATE saving_accounts
            SET account_status = 'Closed', closed_at = NOW(), closed_by = :closed_by
            WHERE id = :id
        ");
        $stmt->execute([
            'closed_by' => $authUser['id'],
            'id' => $account['id']
        ]);

        AuditLog::log($db, $authUser['id'], 'close_saving_account', 'saving_accounts', $account['id']);
        Response::success(null, 'Savings account closed successfully.');
    }

    public static function approve($db, $authUser, $id, $input) {
        $account = SavingAccount::getById($db, $id);
        if (!$account) {
            $account = SavingAccount::getByAccountNo($db, $id);
            if (!$account) {
                Response::error('Savings account not found.', 404);
            }
        }

        if ($account['account_status'] !== 'Processing') {
            Response::error('Only Processing accounts can be approved (current: ' . $account['account_status'] . ').', 400);
        }

        $db->beginTransaction();
        try {
            $startDate = !empty($input['start_date']) ? $input['start_date'] : date('Y-m-d');
            $durationMonths = (int)$account['duration_months'];
            $maturityDate = date('Y-m-d', strtotime("$startDate +$durationMonths months"));

            $stmt = $db->prepare("
                UPDATE saving_accounts SET
                    account_status = 'Active',
                    approved_by = :approved_by,
                    approved_at = NOW(),
                    start_date = :start_date,
                    maturity_date = :maturity_date
                WHERE id = :id
            ");
            $stmt->execute([
                'approved_by' => $authUser['id'],
                'start_date' => $startDate,
                'maturity_date' => $maturityDate,
                'id' => $account['id']
            ]);

            // Clear existing schedule (safety) and generate fresh
            $db->prepare("DELETE FROM saving_installments WHERE saving_account_id = :id")
               ->execute(['id' => $account['id']]);

            SavingAccount::generateInstallments($db, $account['id'], [
                'start_date' => $startDate,
                'maturity_date' => $maturityDate,
                'deposit_amount' => $account['deposit_amount'],
                'collection_frequency' => $account['collection_frequency']
            ]);

            $db->commit();
            AuditLog::log($db, $authUser['id'], 'approve_saving_account', 'saving_accounts', $account['id']);
            $updated = SavingAccount::getById($db, $account['id']);
            Response::success($updated, 'Savings account approved and deposit schedule generated.');
        } catch (Exception $e) {
            $db->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public static function reject($db, $authUser, $id, $input) {
        $account = SavingAccount::getById($db, $id);
        if (!$account) {
            $account = SavingAccount::getByAccountNo($db, $id);
            if (!$account) {
                Response::error('Savings account not found.', 404);
            }
        }
        if ($account['account_status'] !== 'Processing') {
            Response::error('Only Processing accounts can be rejected.', 400);
        }
        $db->prepare("UPDATE saving_accounts SET account_status = 'Rejected' WHERE id = :id")
            ->execute(['id' => $account['id']]);
        AuditLog::log($db, $authUser['id'], 'reject_saving_account', 'saving_accounts', $account['id']);
        Response::success(null, 'Savings account rejected.');
    }
}
?>

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

        // Resolve custom plan
        if ($input['saving_plan_id'] === 'custom') {
            $stmtCustom = $db->prepare("SELECT id FROM saving_plans WHERE name = 'Custom Savings Plan' LIMIT 1");
            $stmtCustom->execute();
            $customPlanId = $stmtCustom->fetchColumn();
            if (!$customPlanId) {
                $stmtInsert = $db->prepare("
                    INSERT INTO saving_plans (uuid, name, deposit_amount, interest_rate, duration_value, duration_unit, collection_frequency, maturity_amount, status, created_by)
                    VALUES (UUID(), 'Custom Savings Plan', 0.00, 0.00, 0, 'Days', 'Daily', 0.00, 'Active', :created_by)
                ");
                $stmtInsert->execute(['created_by' => $authUser['id']]);
                $customPlanId = $db->lastInsertId();
            }
            $input['saving_plan_id'] = $customPlanId;
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

        $isCustom = ($plan['name'] === 'Custom Savings Plan');

        $durVal = $isCustom ? (isset($input['duration_value']) ? intval($input['duration_value']) : intval($plan['duration_value'])) : intval($plan['duration_value']);
        $durUnit = $isCustom ? ($input['duration_unit'] ?? $plan['duration_unit']) : $plan['duration_unit'];

        $durationMonths = 12;
        if ($durUnit === 'Days') {
            $durationMonths = ceil($durVal / 30);
        } elseif ($durUnit === 'Months') {
            $durationMonths = $durVal;
        } elseif ($durUnit === 'Years') {
            $durationMonths = $durVal * 12;
        }

        $input['branch_id'] = $customer['branch_id'];
        $input['area_id'] = $customer['area_id'];
        $input['agent_id'] = $customer['agent_id'];
        $input['created_by'] = $authUser['id'];
        
        $input['deposit_amount'] = isset($input['deposit_amount']) ? floatval($input['deposit_amount']) : floatval($plan['deposit_amount']);
        $input['interest_rate'] = isset($input['interest_rate']) ? floatval($input['interest_rate']) : floatval($plan['interest_rate']);
        $input['duration_months'] = $durationMonths;
        $input['maturity_amount'] = isset($input['maturity_amount']) ? floatval($input['maturity_amount']) : floatval($plan['maturity_amount']);
        $input['collection_frequency'] = $isCustom ? ($input['collection_frequency'] ?? $plan['collection_frequency']) : $plan['collection_frequency'];
        $input['start_date'] = $input['start_date'] ?? date('Y-m-d');
        $input['maturity_date'] = date('Y-m-d', strtotime("+$durationMonths months", strtotime($input['start_date'])));
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
        $installments = SavingAccount::getInstallments($db, $account['id']);

        Response::success([
            'transactions' => $statement,
            'installments' => $installments
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
            // Payout account ke PROMISED maturity_amount se nikalta hai:
            //  - poore deposits hue    -> exact promised maturity milti hai
            //  - adhoore deposits hue  -> promised interest pro-rata milta hai
            // (Pehle flat deposited*rate% tha jo duration ignore karta tha aur
            //  registration me dikhaayi maturity se match nahi hota tha.)
            $deposited = (float)$account['total_deposited'];

            $stmtSched = $db->prepare("SELECT COALESCE(SUM(total_due), 0) FROM saving_installments WHERE saving_account_id = :id");
            $stmtSched->execute(['id' => $account['id']]);
            $scheduleTotal = (float)$stmtSched->fetchColumn();

            $promisedMaturity = (float)$account['maturity_amount'];
            $promisedInterest = max(0, $promisedMaturity - $scheduleTotal);

            if ($scheduleTotal > 0 && $promisedInterest > 0) {
                $interestEarned = round($promisedInterest * min(1, $deposited / $scheduleTotal), 2);
            } else {
                // Fallback (schedule/maturity set nahi) — purana flat formula
                $interestEarned = round($deposited * ($account['interest_rate'] / 100), 2);
            }
            $totalPayout = $deposited + $interestEarned;

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

            // Saving fund se payout nikla — pool WITHDRAW + history entry
            Fund::applyPoolTxn($db, 'saving_fund', 'debit', 'maturity_payout', $totalPayout, [
                'reference_no' => $account['saving_account_no'],
                'description'  => 'Maturity payout: ' . $account['saving_account_no'],
                'entered_by'   => $authUser['id']
            ]);

            // Update status
            $stmtUpdate = $db->prepare("UPDATE saving_accounts SET account_status = 'Matured', closed_at = NOW(), closed_by = :closed_by WHERE id = :id");
            $stmtUpdate->execute([
                'closed_by' => $authUser['id'],
                'id' => $account['id']
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

        $instCount = (int)$db->query("SELECT COUNT(*) FROM saving_installments WHERE saving_account_id = " . (int)$account['id'])->fetchColumn();
        $isRepair = in_array($account['account_status'], ['Approved', 'Active']) && $instCount === 0;
        if ($account['account_status'] !== 'Processing' && !$isRepair) {
            Response::error('Only Processing accounts can be approved (current: ' . $account['account_status'] . ').', 400);
        }

        $db->beginTransaction();
        try {
            $startDate = !empty($input['start_date']) ? $input['start_date'] : date('Y-m-d');
            $durationMonths = (int)$account['duration_months'];
            if ($durationMonths <= 0) {
                throw new Exception('Invalid saving plan duration. Update the plan first.');
            }
            $approvedDate = !empty($input['approved_date']) ? $input['approved_date'] : date('Y-m-d');
            $approvedAt = $approvedDate . ' ' . date('H:i:s');
            $maturityDate = date('Y-m-d', strtotime("$approvedDate +$durationMonths months"));

            $stmt = $db->prepare("
                UPDATE saving_accounts SET
                    account_status = 'Active',
                    approved_by = :approved_by,
                    approved_at = :approved_at,
                    start_date = :start_date,
                    maturity_date = :maturity_date,
                    created_at = :created_at
                WHERE id = :id
            ");
            $stmt->execute([
                'approved_by' => $authUser['id'],
                'approved_at' => $approvedAt,
                'start_date' => $startDate,
                'maturity_date' => $maturityDate,
                'created_at' => $startDate . ' ' . date('H:i:s'),
                'id' => $account['id']
            ]);

            // Clear existing schedule (safety) and generate fresh
            $db->prepare("DELETE FROM saving_installments WHERE saving_account_id = :id")
               ->execute(['id' => $account['id']]);

            SavingAccount::generateInstallments($db, $account['id'], [
                'start_date' => $approvedDate,
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

    public static function reset($db, $authUser, $id, $input) {
        $account = SavingAccount::getById($db, $id);
        if (!$account) {
            $account = SavingAccount::getByAccountNo($db, $id);
            if (!$account) {
                Response::error('Savings account not found.', 404);
            }
        }
        if ($account['account_status'] === 'Processing') {
            Response::error('Account is already in Processing state.', 400);
        }

        // Block if any installment is paid
        $paidCount = (int)$db->query("SELECT COUNT(*) FROM saving_installments WHERE saving_account_id = " . (int)$account['id'] . " AND status = 'Paid'")->fetchColumn();
        if ($paidCount > 0) {
            Response::error('Cannot reset: ' . $paidCount . ' installment(s) already paid. Reverse collections first.', 400);
        }

        $db->beginTransaction();
        try {
            $db->prepare("DELETE FROM saving_installments WHERE saving_account_id = :id")
               ->execute(['id' => $account['id']]);

            $stmt = $db->prepare("
                UPDATE saving_accounts SET
                    account_status = 'Processing',
                    approved_at = NULL,
                    approved_by = NULL,
                    start_date = NULL,
                    maturity_date = NULL
                WHERE id = :id
            ");
            $stmt->execute(['id' => $account['id']]);

            $db->commit();
            AuditLog::log($db, $authUser['id'], 'reset_saving_account', 'saving_accounts', $account['id']);
            $updated = SavingAccount::getById($db, $account['id']);
            Response::success($updated, 'Savings account reset to Processing. Schedule cleared.');
        } catch (Exception $e) {
            $db->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public static function destroy($db, $authUser, $id) {
        $account = SavingAccount::getById($db, $id);
        if (!$account) {
            $account = SavingAccount::getByAccountNo($db, $id);
            if (!$account) {
                Response::error('Savings account not found.', 404);
            }
        }

        if ($account['account_status'] !== 'Rejected') {
            Response::error('Only Rejected accounts can be deleted.', 400);
        }

        $db->beginTransaction();
        try {
            $stmt = $db->prepare("UPDATE saving_accounts SET deleted_at = NOW() WHERE id = :id");
            $stmt->execute(['id' => $account['id']]);

            $db->commit();
            AuditLog::log($db, $authUser['id'], 'delete_saving_account', 'saving_accounts', $account['id']);
            Response::success(null, 'Savings account deleted successfully.');
        } catch (Exception $e) {
            $db->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public static function clearLedger($db, $authUser, $id) {
        $account = SavingAccount::getById($db, $id);
        if (!$account) {
            $account = SavingAccount::getByAccountNo($db, $id);
            if (!$account) {
                Response::error('Savings account not found.', 404);
            }
        }

        $db->beginTransaction();
        try {
            // Jo deposits aaye the wo saving fund se wapas nikal jate hain
            $stmtSum = $db->prepare("SELECT COALESCE(SUM(deposit_amount), 0) FROM saving_deposits WHERE saving_account_id = :id AND is_reversal = 0");
            $stmtSum->execute(['id' => $account['id']]);
            $clearedTotal = (float)$stmtSum->fetchColumn();
            if ($clearedTotal > 0) {
                Fund::applyPoolTxn($db, 'saving_fund', 'debit', 'deposit_reversed', $clearedTotal, [
                    'reference_no' => $account['saving_account_no'],
                    'description'  => 'Ledger cleared — deposits reversed: ' . $account['saving_account_no'],
                    'entered_by'   => $authUser['id']
                ]);
            }

            // Delete all deposits
            $db->prepare("DELETE FROM saving_deposits WHERE saving_account_id = :id")->execute(['id' => $account['id']]);

            // Reset installments to Pending
            $db->prepare("
                UPDATE saving_installments 
                SET paid_amount = 0.00, status = 'Pending'
                WHERE saving_account_id = :saving_id
            ")->execute(['saving_id' => $account['id']]);

            // Reset savings account
            $db->prepare("
                UPDATE saving_accounts 
                SET total_deposited = 0.00
                WHERE id = :id
            ")->execute(['id' => $account['id']]);

            // Delete central receipts
            $db->prepare("DELETE FROM receipts WHERE account_no = :acc_no AND receipt_type = 'saving_deposit'")
               ->execute(['acc_no' => $account['saving_account_no']]);

            $db->commit();
            AuditLog::log($db, $authUser['id'], 'clear_saving_ledger', 'saving_accounts', $account['id']);
            Response::success(null, 'Savings ledger cleared successfully.');
        } catch (Exception $e) {
            $db->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }
}
?>

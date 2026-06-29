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

        // Validate plan & customer
        $plan = LoanPlan::getById($db, $input['loan_plan_id']);
        if (!$plan) {
            Response::error('Invalid loan plan selected.', 422);
        }

        $customer = Customer::getById($db, $input['customer_id']);
        if (!$customer) {
            Response::error('Invalid customer selected.', 422);
        }

        $input['branch_id'] = $customer['branch_id'];
        $input['area_id'] = $customer['area_id'];
        $input['agent_id'] = $customer['agent_id'];
        $input['created_by'] = $authUser['id'];
        $input['interest_rate'] = $plan['interest_rate'];
        $input['interest_type'] = $plan['interest_type'];
        $input['collection_frequency'] = $plan['collection_frequency'];

        $durationDays = 0;
        $durationMonths = 0;
        if ($plan['duration_unit'] === 'Days') {
            $durationDays = $plan['duration_value'];
        } elseif ($plan['duration_unit'] === 'Months') {
            $durationMonths = $plan['duration_value'];
            $durationDays = $plan['duration_value'] * 30;
        }
        $input['duration_days'] = $durationDays;
        $input['duration_months'] = $durationMonths;

        // Interest amount calculation
        $pAmt = $input['principal_amount'];
        $rate = $plan['interest_rate'];
        $interestAmount = ($plan['interest_type'] === 'Flat') ? ($pAmt * ($rate / 100)) : ($pAmt * ($rate / 100) * 0.7);
        $totalPayable = $pAmt + $interestAmount;

        $input['interest_amount'] = $interestAmount;
        $input['total_payable'] = $totalPayable;
        $input['processing_fee'] = $plan['processing_fee'];
        $input['emi_amount'] = round($totalPayable / ($plan['duration_value'] ?: 1), 2);
        $input['start_date'] = date('Y-m-d');
        $input['end_date'] = date('Y-m-d', strtotime("+$durationDays days"));
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

        $stmt = $db->prepare("
            UPDATE loan_accounts
            SET account_status = 'Closed', closed_at = NOW(), closed_by = :closed_by
            WHERE id = :id
        ");
        $stmt->execute([
            'closed_by' => $authUser['id'],
            'id' => $account['id']
        ]);

        AuditLog::log($db, $authUser['id'], 'close_loan_account', 'loan_accounts', $account['id']);
        Response::success(null, 'Loan account closed successfully.');
    }

    public static function approve($db, $authUser, $id, $input) {
        $account = LoanAccount::getById($db, $id);
        if (!$account) {
            $account = LoanAccount::getByAccountNo($db, $id);
            if (!$account) {
                Response::error('Loan account not found.', 404);
            }
        }

        if ($account['account_status'] !== 'Processing') {
            Response::error('Only Processing accounts can be approved (current: ' . $account['account_status'] . ').', 400);
        }

        $db->beginTransaction();
        try {
            $startDate = !empty($input['start_date']) ? $input['start_date'] : date('Y-m-d');
            $durationDays = (int)$account['duration_days'];
            $endDate = date('Y-m-d', strtotime("$startDate +$durationDays days"));

            $stmt = $db->prepare("
                UPDATE loan_accounts SET
                    account_status = 'Active',
                    approved_by = :approved_by,
                    approved_at = NOW(),
                    start_date = :start_date,
                    end_date = :end_date
                WHERE id = :id
            ");
            $stmt->execute([
                'approved_by' => $authUser['id'],
                'start_date' => $startDate,
                'end_date' => $endDate,
                'id' => $account['id']
            ]);

            // Clear existing installments (safety) and generate fresh
            $db->prepare("DELETE FROM loan_installments WHERE loan_account_id = :id")
               ->execute(['id' => $account['id']]);

            $genData = array_merge((array)$account, [
                'start_date' => $startDate,
                'duration_days' => $durationDays,
                'duration_months' => $account['duration_months'],
                'collection_frequency' => $account['collection_frequency'],
                'principal_amount' => $account['principal_amount'],
                'interest_amount' => $account['interest_amount'],
                'total_payable' => $account['total_payable'],
                'emi_amount' => $account['emi_amount']
            ]);
            LoanAccount::generateInstallments($db, $account['id'], $genData);

            $db->commit();
            AuditLog::log($db, $authUser['id'], 'approve_loan_account', 'loan_accounts', $account['id'], $account, ['status' => 'Active']);

            $updated = LoanAccount::getById($db, $account['id']);
            Response::success($updated, 'Loan account approved and EMI schedule generated.');
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
        if ($account['account_status'] !== 'Processing') {
            Response::error('Only Processing accounts can be rejected.', 400);
        }

        $stmt = $db->prepare("UPDATE loan_accounts SET account_status = 'Rejected' WHERE id = :id");
        $stmt->execute(['id' => $account['id']]);

        AuditLog::log($db, $authUser['id'], 'reject_loan_account', 'loan_accounts', $account['id']);
        Response::success(null, 'Loan account rejected.');
    }
}
?>

<?php
/**
 * Customer Controller
 */
class CustomerController {

    public static function index($db, $authUser) {
        $params = $_GET;
        
        // Scope data to agent/branch depending on role
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

        [$data, $total] = Customer::getAll($db, $params);
        Response::paginated($data, $total, $page, $perPage);
    }

    public static function show($db, $authUser, $id) {
        $customer = Customer::getProfileDetails($db, $id);
        if (!$customer) {
            Response::error('Customer not found.', 404);
        }

        // Access checks
        if ($authUser['role_slug'] === 'agent' && $customer['agent_id'] != $authUser['agent_id']) {
            Response::error('Access denied to this customer record.', 403);
        }

        Response::success($customer);
    }

    public static function search($db, $authUser) {
        $q = $_GET['q'] ?? '';
        if (strlen($q) < 2) {
            Response::success([]);
        }

        $params = ['search' => $q, 'limit' => 20, 'offset' => 0];
        if ($authUser['role_slug'] === 'agent') {
            $params['agent_id'] = $authUser['agent_id'];
        }

        [$data, $total] = Customer::getAll($db, $params);
        Response::success($data);
    }

    public static function profile($db, $authUser, $id) {
        self::show($db, $authUser, $id);
    }

    public static function register($db, $authUser, $input) {
        $errors = Validator::required($input, ['full_name', 'mobile', 'branch_id', 'area_id', 'agent_id']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        // Validate branch, area, agent
        if (!Branch::getById($db, $input['branch_id'])) {
            Response::error('Invalid branch selected.', 422);
        }
        if (!Area::getById($db, $input['area_id'])) {
            Response::error('Invalid area selected.', 422);
        }
        if (!Agent::getById($db, $input['agent_id'])) {
            Response::error('Invalid agent selected.', 422);
        }

        $db->beginTransaction();

        try {
            // 1. Create Customer
            $input['created_by'] = $authUser['id'];
            $customerId = Customer::create($db, $input);

            // 2. Create Address
            if (!empty($input['address'])) {
                $stmt = $db->prepare("
                    INSERT INTO customer_addresses (customer_id, address_type, address_line1, city, state, pincode)
                    VALUES (:customer_id, 'Permanent', :address, :city, :state, :pincode)
                ");
                $stmt->execute([
                    'customer_id' => $customerId,
                    'address' => $input['address'],
                    'city' => $input['city'] ?? null,
                    'state' => $input['state'] ?? null,
                    'pincode' => $input['pincode'] ?? null
                ]);
            }

            // 3. Create KYC
            $stmt = $db->prepare("
                INSERT INTO customer_kyc (
                    customer_id, aadhaar_no, pan_no, bank_name, bank_account_no, bank_ifsc, verified
                ) VALUES (
                    :customer_id, :aadhaar_no, :pan_no, :bank_name, :bank_account_no, :bank_ifsc, 1
                )
            ");
            $stmt->execute([
                'customer_id' => $customerId,
                'aadhaar_no' => $input['aadhaar_no'] ?? null,
                'pan_no' => $input['pan_no'] ?? null,
                'bank_name' => $input['bank_name'] ?? null,
                'bank_account_no' => $input['bank_account_no'] ?? null,
                'bank_ifsc' => $input['bank_ifsc'] ?? null
            ]);

            // 4. Create Guarantor (if present)
            if (!empty($input['guarantor_name'])) {
                $stmt = $db->prepare("
                    INSERT INTO guarantors (customer_id, name, mobile, relation, aadhaar_no, address, monthly_income)
                    VALUES (:customer_id, :name, :mobile, :relation, :aadhaar_no, :address, :monthly_income)
                ");
                $stmt->execute([
                    'customer_id' => $customerId,
                    'name' => $input['guarantor_name'],
                    'mobile' => $input['guarantor_mobile'] ?? null,
                    'relation' => $input['guarantor_relation'] ?? null,
                    'aadhaar_no' => $input['guarantor_aadhaar'] ?? null,
                    'address' => $input['guarantor_address'] ?? null,
                    'monthly_income' => $input['guarantor_income'] ?? 0.00
                ]);
            }

            $createdAccountNo = '';
            $createdAccountType = '';

            // 5. Open Selected Account (Loan or Saving Plan)
            // 5. Open Selected Account (Loan or Saving Plan)
            if (!empty($input['plan_type'])) {
                if ($input['plan_type'] === 'Loan') {
                    if (empty($input['plan_id'])) {
                        // Find or create "Custom Loan Plan"
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
                        $planId = $customPlanId;
                    } else {
                        $planId = $input['plan_id'];
                    }

                    $plan = LoanPlan::getById($db, $planId);
                    if ($plan) {
                        $pAmt = $input['principal_amount'] ?? $plan['min_amount'];
                        $rate = $input['interest_rate'] ?? $plan['interest_rate'];
                        $type = $plan['interest_type'];
                        
                        $durationDays = 0;
                        $durationMonths = 0;
                        if ($plan['duration_unit'] === 'Days') {
                            $durationDays = $plan['duration_value'];
                        } elseif ($plan['duration_unit'] === 'Months') {
                            $durationMonths = $plan['duration_value'];
                            $durationDays = $plan['duration_value'] * 30;
                        }

                        // Calculate interest component & total payable
                        $interestAmount = 0;
                        if ($type === 'Flat') {
                            $interestAmount = $pAmt * ($rate / 100);
                        } else {
                            // Reducing balance approximation
                            $interestAmount = $pAmt * ($rate / 100) * 0.7; 
                        }
                        $totalPayable = $pAmt + $interestAmount;

                        // Auto calculate daily/weekly/monthly EMI
                        $emiAmt = $input['emi_amount'] ?? round($totalPayable / $plan['duration_value'], 2);

                        $loanData = [
                            'customer_id' => $customerId,
                            'loan_plan_id' => $plan['id'],
                            'branch_id' => $input['branch_id'],
                            'area_id' => $input['area_id'],
                            'agent_id' => $input['agent_id'],
                            'principal_amount' => $pAmt,
                            'interest_rate' => $rate,
                            'interest_type' => $type,
                            'interest_amount' => $interestAmount,
                            'processing_fee' => $plan['processing_fee'],
                            'total_payable' => $totalPayable,
                            'emi_amount' => $emiAmt,
                            'duration_days' => $durationDays,
                            'duration_months' => $durationMonths,
                            'collection_frequency' => $plan['collection_frequency'],
                            'start_date' => date('Y-m-d'),
                            'end_date' => date('Y-m-d', strtotime("+$durationDays days")),
                            'account_status' => 'Approved', // Auto approval for field entries
                            'created_by' => $authUser['id']
                        ];

                        $accountId = LoanAccount::create($db, $loanData);
                        $acc = LoanAccount::getById($db, $accountId);
                        $createdAccountNo = $acc['loan_account_no'];
                        $createdAccountType = 'Loan';
                    }
                } elseif ($input['plan_type'] === 'Saving') {
                    if (empty($input['plan_id'])) {
                        // Find or create "Custom Savings Plan"
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
                        $planId = $customPlanId;
                    } else {
                        $planId = $input['plan_id'];
                    }

                    $plan = SavingPlan::getById($db, $planId);
                    if ($plan) {
                        $durationMonths = 12;
                        if ($plan['duration_unit'] === 'Days') {
                            $durationMonths = ceil($plan['duration_value'] / 30);
                        } elseif ($plan['duration_unit'] === 'Years') {
                            $durationMonths = $plan['duration_value'] * 12;
                        }

                        // Allow overriding from input payload
                        $depAmt = isset($input['deposit_amount']) ? floatval($input['deposit_amount']) : (isset($input['emi_amount']) ? floatval($input['emi_amount']) : floatval($plan['deposit_amount']));
                        $rate = isset($input['interest_rate']) ? floatval($input['interest_rate']) : floatval($plan['interest_rate']);
                        $maturityAmt = isset($input['maturity_amount']) ? floatval($input['maturity_amount']) : floatval($plan['maturity_amount']);

                        $savingData = [
                            'customer_id' => $customerId,
                            'saving_plan_id' => $plan['id'],
                            'branch_id' => $input['branch_id'],
                            'area_id' => $input['area_id'],
                            'agent_id' => $input['agent_id'],
                            'deposit_amount' => $depAmt,
                            'interest_rate' => $rate,
                            'duration_months' => $durationMonths,
                            'maturity_amount' => $maturityAmt,
                            'collection_frequency' => $plan['collection_frequency'],
                            'start_date' => date('Y-m-d'),
                            'maturity_date' => date('Y-m-d', strtotime("+$durationMonths months")),
                            'account_status' => 'Approved', // Auto approval for field entries
                            'created_by' => $authUser['id']
                        ];

                        $accountId = SavingAccount::create($db, $savingData);
                        $acc = SavingAccount::getById($db, $accountId);
                        $createdAccountNo = $acc['saving_account_no'];
                        $createdAccountType = 'Saving';
                    }
                }
            }

            // Sync Notification & Event
            $stmtSync = $db->prepare("
                INSERT INTO sync_events (
                    event_type, module, reference_id, branch_id, area_id, agent_id, user_id, title, message
                ) VALUES (
                    'customer_created', 'customers', :reference_id, :branch_id, :area_id, :agent_id, :user_id, :title, :message
                )
            ");
            $stmtSync->execute([
                'reference_id' => $customerId,
                'branch_id' => $input['branch_id'],
                'area_id' => $input['area_id'],
                'agent_id' => $input['agent_id'],
                'user_id' => $authUser['id'],
                'title' => 'New Customer Registered',
                'message' => "Customer {$input['full_name']} registered with {$createdAccountType} account: {$createdAccountNo}"
            ]);

            $db->commit();

            Response::success([
                'customer_id' => $customerId,
                'account_no' => $createdAccountNo,
                'account_type' => $createdAccountType
            ], 'Customer registration completed successfully.', 201);

        } catch (Exception $e) {
            $db->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public static function update($db, $authUser, $id, $input) {
        $customer = Customer::getById($db, $id);
        if (!$customer) {
            Response::error('Customer not found.', 404);
        }

        $errors = Validator::required($input, ['full_name', 'mobile', 'branch_id', 'area_id', 'agent_id']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        $input['updated_by'] = $authUser['id'];
        Customer::update($db, $id, $input);
        $updated = Customer::getById($db, $id);

        AuditLog::log($db, $authUser['id'], 'update_customer', 'customers', $id, $customer, $updated);
        Response::success($updated, 'Customer updated successfully.');
    }

    public static function destroy($db, $authUser, $id) {
        $customer = Customer::getById($db, $id);
        if (!$customer) {
            Response::error('Customer not found.', 404);
        }

        // Check if has active loans/savings
        $stmt = $db->prepare("SELECT COUNT(*) FROM loan_accounts WHERE customer_id = :id AND account_status NOT IN ('Closed','Rejected') AND deleted_at IS NULL");
        $stmt->execute(['id' => $id]);
        $activeLoans = $stmt->fetchColumn();

        $stmt = $db->prepare("SELECT COUNT(*) FROM saving_accounts WHERE customer_id = :id AND account_status NOT IN ('Closed','Rejected') AND deleted_at IS NULL");
        $stmt->execute(['id' => $id]);
        $activeSavings = $stmt->fetchColumn();

        if ($activeLoans > 0 || $activeSavings > 0) {
            Response::error('Cannot delete customer with active loan or saving accounts.', 400);
        }

        Customer::delete($db, $id);

        AuditLog::log($db, $authUser['id'], 'delete_customer', 'customers', $id, $customer);
        Response::success(null, 'Customer deleted successfully.');
    }

    public static function uploadDocuments($db, $authUser, $id) {
        $customer = Customer::getById($db, $id);
        if (!$customer) {
            Response::error('Customer not found.', 404);
        }

        if (empty($_FILES)) {
            Response::error('No files uploaded.', 400);
        }

        $paths = [];
        foreach ($_FILES as $key => $file) {
            try {
                $path = FileUpload::upload($file, 'kyc');
                $paths[$key] = $path;

                // Update KYC or add documents
                if ($key === 'aadhaar_front') {
                    $stmt = $db->prepare("UPDATE customer_kyc SET aadhaar_front_path = :path WHERE customer_id = :id");
                    $stmt->execute(['path' => $path, 'id' => $id]);
                } elseif ($key === 'aadhaar_back') {
                    $stmt = $db->prepare("UPDATE customer_kyc SET aadhaar_back_path = :path WHERE customer_id = :id");
                    $stmt->execute(['path' => $path, 'id' => $id]);
                } elseif ($key === 'pan') {
                    $stmt = $db->prepare("UPDATE customer_kyc SET pan_path = :path WHERE customer_id = :id");
                    $stmt->execute(['path' => $path, 'id' => $id]);
                } elseif ($key === 'cheque') {
                    $stmt = $db->prepare("UPDATE customer_kyc SET cheque_path = :path WHERE customer_id = :id");
                    $stmt->execute(['path' => $path, 'id' => $id]);
                } else {
                    $stmt = $db->prepare("
                        INSERT INTO customer_documents (customer_id, document_type, document_name, file_path, uploaded_by)
                        VALUES (:id, :type, :name, :path, :uploaded_by)
                    ");
                    $stmt->execute([
                        'id' => $id,
                        'type' => $key,
                        'name' => $file['name'],
                        'path' => $path,
                        'uploaded_by' => $authUser['id']
                    ]);
                }
            } catch (Exception $e) {
                return Response::error($e->getMessage(), 400);
            }
        }

        AuditLog::log($db, $authUser['id'], 'upload_kyc_docs', 'customers', $id, null, $paths);
        Response::success($paths, 'Documents uploaded successfully.');
    }
}
?>

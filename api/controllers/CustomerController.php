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

    public static function checkMobile($db, $authUser) {
        $mobile = $_GET['mobile'] ?? '';
        if (empty($mobile)) {
            Response::error('Mobile number is required.', 400);
        }

        $customer = Customer::getByCodeOrMobile($db, $mobile);
        if ($customer) {
            Response::success([
                'registered' => true,
                'customer' => [
                    'full_name' => $customer['full_name'],
                    'customer_code' => $customer['customer_code']
                ]
            ]);
        } else {
            Response::success([
                'registered' => false
            ]);
        }
    }

    public static function profile($db, $authUser, $id) {
        self::show($db, $authUser, $id);
    }

    public static function register($db, $authUser, $input) {
        $errors = Validator::required($input, ['full_name', 'mobile', 'branch_id', 'area_id', 'agent_id']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        // Agent role: KYC + guarantor/nominee hamesha mandatory (API bypass rok)
        if ($authUser['role_slug'] === 'agent') {
            $kycErrors = Validator::required($input, ['aadhaar_no', 'pan_no', 'bank_name', 'bank_account_no', 'bank_ifsc']);
            if (!empty($kycErrors)) {
                Response::error('KYC details are mandatory for agent registrations.', 422, $kycErrors);
            }
            $guarErrors = Validator::required($input, ['guarantor_name', 'guarantor_mobile', 'guarantor_relation', 'guarantor_aadhaar']);
            if (!empty($guarErrors)) {
                $who = (($input['plan_type'] ?? 'Loan') === 'Saving') ? 'Nominee' : 'Guarantor';
                Response::error("{$who} details are mandatory for agent registrations.", 422, $guarErrors);
            }
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

        // Validate unique mobile number
        $existing = Customer::getByCodeOrMobile($db, $input['mobile']);
        if ($existing) {
            Response::error("Mobile number is already registered with {$existing['full_name']} ({$existing['customer_code']}).", 422);
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
            if (empty($input['plan_type']) || !in_array($input['plan_type'], ['Loan', 'Saving'])) {
                throw new Exception("Plan type is required and must be either 'Loan' or 'Saving'.");
            }

            if ($input['plan_type'] === 'Loan') {
                if (empty($input['plan_id'])) {
                    // Find or create "Custom Loan Plan"
                    $stmtCustom = $db->prepare("SELECT id FROM loan_plans WHERE name = 'Custom Loan Plan' AND deleted_at IS NULL LIMIT 1");
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
                if (!$plan) {
                    throw new Exception("Selected loan plan not found (ID: " . var_export($planId, true) . ").");
                }
                if ($plan) {
                        $pAmt = $input['principal_amount'] ?? $plan['min_amount'];
                        $rate = $input['interest_rate'] ?? $plan['interest_rate'];
                        $type = !empty($input['interest_type']) ? $input['interest_type'] : $plan['interest_type'];
                        $durVal = !empty($input['duration_value']) ? intval($input['duration_value']) : intval($plan['duration_value']);
                        $durUnit = !empty($input['duration_unit']) ? $input['duration_unit'] : $plan['duration_unit'];
                        $freq = !empty($input['collection_frequency']) ? $input['collection_frequency'] : $plan['collection_frequency'];
                        $startDateStr = !empty($input['start_date']) ? $input['start_date'] : date('Y-m-d');
                        $startDateTime = new DateTime($startDateStr);
                        $endDateTime = clone $startDateTime;

                        $durationDays = 0;
                        $durationMonths = 0;
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

                        // Calculate interest component & total payable using live setting
                        $loanPeriod = Setting::getVal($db, 'interest_calculation_period_loan', 'monthly');
                        $timeFactor = ($loanPeriod === 'yearly') ? ($durationMonths / 12) : $durationMonths;

                        $interestAmount = 0;
                        if ($type === 'Flat') {
                            $interestAmount = $pAmt * ($rate / 100) * $timeFactor;
                        } else {
                            $interestAmount = $pAmt * ($rate / 100) * $timeFactor * 0.7; 
                        }
                        $totalPayable = $pAmt + $interestAmount;

                        // Calculate N for EMI
                        $N = 0;
                        if ($freq === 'Daily') {
                            $N = $durationDays;
                        } elseif ($freq === 'Weekly') {
                            $N = round($durationDays / 7);
                        } elseif ($freq === 'Monthly') {
                            $N = $durationMonths;
                        }
                        if ($N <= 0) $N = 1;

                        $emiAmt = $input['emi_amount'] ?? round($totalPayable / $N, 2);

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
                            'processing_fee' => $input['processing_fee'] ?? $plan['processing_fee'],
                            'total_payable' => $totalPayable,
                            'emi_amount' => $emiAmt,
                            'duration_days' => $durationDays,
                            'duration_months' => $durationMonths,
                            'collection_frequency' => $freq,
                            'start_date' => !empty($input['start_date']) ? $input['start_date'] : date('Y-m-d'),
                            'end_date' => date('Y-m-d', strtotime((!empty($input['start_date']) ? $input['start_date'] : date('Y-m-d')) . " +$durationDays days")),
                            'account_status' => 'Processing', // Set to Processing for verification workflow
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
                        $stmtCustom = $db->prepare("SELECT id FROM saving_plans WHERE name = 'Custom Savings Plan' AND deleted_at IS NULL LIMIT 1");
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
                    if (!$plan) {
                        throw new Exception("Selected savings plan not found (ID: " . var_export($planId, true) . ").");
                    }
                    if ($plan) {
                        $durVal = !empty($input['duration_value']) ? intval($input['duration_value']) : intval($plan['duration_value']);
                        $durUnit = !empty($input['duration_unit']) ? $input['duration_unit'] : $plan['duration_unit'];
                        $freq = !empty($input['collection_frequency']) ? $input['collection_frequency'] : $plan['collection_frequency'];

                        $durationMonths = 12;
                        if ($durUnit === 'Days') {
                            $durationMonths = ceil($durVal / 30);
                        } elseif ($durUnit === 'Years') {
                            $durationMonths = $durVal * 12;
                        } else {
                            $durationMonths = $durVal;
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
                            'collection_frequency' => $freq,
                            'start_date' => !empty($input['start_date']) ? $input['start_date'] : date('Y-m-d'),
                            'maturity_date' => date('Y-m-d', strtotime((!empty($input['start_date']) ? $input['start_date'] : date('Y-m-d')) . " +$durationMonths months")),
                            'account_status' => 'Processing', // Set to Processing for verification workflow
                            'created_by' => $authUser['id']
                        ];

                        $accountId = SavingAccount::create($db, $savingData);
                        $acc = SavingAccount::getById($db, $accountId);
                        $createdAccountNo = $acc['saving_account_no'];
                        $createdAccountType = 'Saving';
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

            // Agent ne registration kiya to Super Admin + us branch/area ke
            // managers ko notify karo (notification bell abhi tak khaali
            // rehta tha kyuki koi bhi jagah Notification::create nahi hota tha)
            if ($authUser['role_slug'] === 'agent') {
                try {
                    Notification::notifyAdmins($db, [
                        'branch_id' => $input['branch_id'],
                        'area_id' => $input['area_id'],
                        'title' => 'New Customer Registered',
                        'message' => "{$authUser['name']} registered a new customer \"{$input['full_name']}\" — {$createdAccountType} account {$createdAccountNo}.",
                        'type' => 'success',
                        'module' => 'customers',
                        'ref_id' => $customerId,
                        'exclude_user_id' => $authUser['id']
                    ]);
                } catch (Exception $notifyEx) {
                    error_log('notifyAdmins (registration) failed: ' . $notifyEx->getMessage());
                }
            }

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

        // Edit form status nahi bhejta — purana status preserve karo, warna
        // Deactive/Blocked customer edit hote hi wapas Active ho jata tha
        if (!isset($input['status']) || $input['status'] === '') {
            $input['status'] = $customer['status'];
        }

        $db->beginTransaction();
        try {
            $input['updated_by'] = $authUser['id'];
            Customer::update($db, $id, $input);

            // Update or Insert Address
            if (isset($input['address'])) {
                $stmtCheck = $db->prepare("SELECT COUNT(*) FROM customer_addresses WHERE customer_id = :customer_id");
                $stmtCheck->execute(['customer_id' => $id]);
                $hasAddress = $stmtCheck->fetchColumn() > 0;

                if ($hasAddress) {
                    $stmt = $db->prepare("
                        UPDATE customer_addresses SET
                            address_line1 = :address,
                            city = :city,
                            state = :state,
                            pincode = :pincode,
                            updated_at = NOW()
                        WHERE customer_id = :customer_id
                    ");
                } else {
                    $stmt = $db->prepare("
                        INSERT INTO customer_addresses (customer_id, address_type, address_line1, city, state, pincode)
                        VALUES (:customer_id, 'Permanent', :address, :city, :state, :pincode)
                    ");
                }
                $stmt->execute([
                    'customer_id' => $id,
                    'address' => $input['address'],
                    'city' => $input['city'] ?? null,
                    'state' => $input['state'] ?? null,
                    'pincode' => $input['pincode'] ?? null
                ]);
            }

            // Update or Insert KYC
            if (isset($input['aadhaar_no']) || isset($input['pan_no']) || isset($input['bank_name']) || isset($input['bank_account_no']) || isset($input['bank_ifsc'])) {
                $stmtCheck = $db->prepare("SELECT COUNT(*) FROM customer_kyc WHERE customer_id = :customer_id");
                $stmtCheck->execute(['customer_id' => $id]);
                $hasKyc = $stmtCheck->fetchColumn() > 0;

                if ($hasKyc) {
                    $stmt = $db->prepare("
                        UPDATE customer_kyc SET
                            aadhaar_no = :aadhaar_no,
                            pan_no = :pan_no,
                            bank_name = :bank_name,
                            bank_account_no = :bank_account_no,
                            bank_ifsc = :bank_ifsc,
                            updated_at = NOW()
                        WHERE customer_id = :customer_id
                    ");
                } else {
                    $stmt = $db->prepare("
                        INSERT INTO customer_kyc (
                            customer_id, aadhaar_no, pan_no, bank_name, bank_account_no, bank_ifsc, verified
                        ) VALUES (
                            :customer_id, :aadhaar_no, :pan_no, :bank_name, :bank_account_no, :bank_ifsc, 1
                        )
                    ");
                }
                $stmt->execute([
                    'customer_id' => $id,
                    'aadhaar_no' => $input['aadhaar_no'] ?? null,
                    'pan_no' => $input['pan_no'] ?? null,
                    'bank_name' => $input['bank_name'] ?? null,
                    'bank_account_no' => $input['bank_account_no'] ?? null,
                    'bank_ifsc' => $input['bank_ifsc'] ?? null
                ]);
            }

            $db->commit();
            $updated = Customer::getProfileDetails($db, $id);
            AuditLog::log($db, $authUser['id'], 'update_customer', 'customers', $id, $customer, $updated);
            Response::success($updated, 'Customer updated successfully.');
        } catch (Exception $e) {
            $db->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public static function setStatus($db, $authUser, $id, $input) {
        $customer = Customer::getById($db, $id);
        if (!$customer) {
            Response::error('Customer not found.', 404);
        }

        $status = $input['status'] ?? '';
        if (!in_array($status, ['Active', 'Blocked', 'Deactive'])) {
            Response::error('Invalid status. Allowed: Active, Blocked, Deactive.', 422);
        }

        $stmt = $db->prepare("UPDATE customers SET status = :status, updated_by = :uid WHERE id = :id AND deleted_at IS NULL");
        $stmt->execute(['status' => $status, 'uid' => $authUser['id'], 'id' => $id]);

        AuditLog::log($db, $authUser['id'], 'set_customer_status', 'customers', $id, ['status' => $customer['status']], ['status' => $status]);
        Response::success(['status' => $status], "Customer status updated to {$status}.");
    }

    public static function destroy($db, $authUser, $id) {
        $customer = Customer::getById($db, $id);
        if (!$customer) {
            Response::error('Customer not found.', 404);
        }

        // HARD delete — sirf tab allowed jab customer ke saare accounts
        // abhi Processing (ya Rejected) me hon, yaani kuch approve nahi hua
        // aur koi paisa move nahi hua.
        $stmt = $db->prepare("SELECT COUNT(*) FROM loan_accounts WHERE customer_id = :id AND account_status NOT IN ('Processing','Rejected') AND deleted_at IS NULL");
        $stmt->execute(['id' => $id]);
        $approvedLoans = (int)$stmt->fetchColumn();

        $stmt = $db->prepare("SELECT COUNT(*) FROM saving_accounts WHERE customer_id = :id AND account_status NOT IN ('Processing','Rejected') AND deleted_at IS NULL");
        $stmt->execute(['id' => $id]);
        $approvedSavings = (int)$stmt->fetchColumn();

        if ($approvedLoans > 0 || $approvedSavings > 0) {
            Response::error('Profile can only be deleted while all its accounts are still in Processing. This customer has approved/active account(s).', 400);
        }

        // Safety net: koi payment record ho to hard delete block
        $stmt = $db->prepare("SELECT COUNT(*) FROM loan_collections WHERE customer_id = :id");
        $stmt->execute(['id' => $id]);
        $collCount = (int)$stmt->fetchColumn();

        $stmt = $db->prepare("SELECT COUNT(*) FROM saving_deposits WHERE customer_id = :id");
        $stmt->execute(['id' => $id]);
        $depCount = (int)$stmt->fetchColumn();

        if ($collCount > 0 || $depCount > 0) {
            Response::error('Cannot delete: payment records exist for this customer. Reset the collections first.', 400);
        }

        $db->beginTransaction();
        try {
            // Saving-side children (deposits/maturity par CASCADE nahi hai)
            $db->prepare("DELETE sm FROM saving_maturity sm JOIN saving_accounts sa ON sm.saving_account_id = sa.id WHERE sa.customer_id = :id")
               ->execute(['id' => $id]);
            $db->prepare("DELETE FROM saving_deposits WHERE customer_id = :id")->execute(['id' => $id]);
            $db->prepare("DELETE FROM loan_collections WHERE customer_id = :id")->execute(['id' => $id]);

            // Accounts — installments FK CASCADE se saath me delete honge
            $db->prepare("DELETE FROM loan_accounts WHERE customer_id = :id")->execute(['id' => $id]);
            $db->prepare("DELETE FROM saving_accounts WHERE customer_id = :id")->execute(['id' => $id]);

            // Central receipts + sync trail
            $db->prepare("DELETE FROM receipts WHERE customer_id = :id")->execute(['id' => $id]);
            $db->prepare("DELETE FROM sync_events WHERE module = 'customers' AND reference_id = :id")->execute(['id' => $id]);

            // Aakhir me customer row — addresses / kyc / documents / guarantors
            // FK ON DELETE CASCADE se khud clear ho jayenge
            $db->prepare("DELETE FROM customers WHERE id = :id")->execute(['id' => $id]);

            $db->commit();
            AuditLog::log($db, $authUser['id'], 'hard_delete_customer', 'customers', $id, $customer, null);
            Response::success(null, 'Customer profile and all related records permanently deleted.');
        } catch (Exception $e) {
            $db->rollBack();
            Response::error($e->getMessage(), 500);
        }
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

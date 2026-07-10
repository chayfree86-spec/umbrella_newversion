-- ============================================================
-- UMBRELLA FINANCE - Master Seed Data
-- Generated from current local ufin database on 2026-07-05 09:02:11
-- ============================================================

SET time_zone = '+05:30';
SET FOREIGN_KEY_CHECKS = 0;

-- ROLES
INSERT INTO `roles` (`id`, `name`, `slug`, `description`, `is_system`, `created_at`, `updated_at`) VALUES
(1, 'Super Admin', 'super_admin', 'Full system access with all permissions', 1, '2026-06-29 15:40:28', '2026-06-29 15:40:28'),
(2, 'Branch Manager', 'branch_manager', 'Branch-level management access', 1, '2026-06-29 15:40:28', '2026-06-29 15:40:28'),
(3, 'Area Manager', 'area_manager', 'Area-level operational access', 1, '2026-06-29 15:40:28', '2026-06-29 15:40:28'),
(4, 'Agent / Collection Executive', 'agent', 'Field collection and customer registration', 1, '2026-06-29 15:40:28', '2026-06-29 15:40:28'),
(5, 'Customer', 'customer', 'Future mobile app access for customers', 1, '2026-06-29 15:40:28', '2026-06-29 15:40:28')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `slug` = VALUES(`slug`), `description` = VALUES(`description`), `is_system` = VALUES(`is_system`), `created_at` = VALUES(`created_at`), `updated_at` = VALUES(`updated_at`);


-- PERMISSIONS
INSERT INTO `permissions` (`id`, `name`, `slug`, `module`, `description`, `created_at`) VALUES
(1, 'View Dashboard', 'dashboard.view', 'dashboard', NULL, '2026-06-29 15:40:28'),
(2, 'View Customers', 'customers.view', 'customers', NULL, '2026-06-29 15:40:28'),
(3, 'Create Customer', 'customers.create', 'customers', NULL, '2026-06-29 15:40:28'),
(4, 'Edit Customer', 'customers.edit', 'customers', NULL, '2026-06-29 15:40:28'),
(5, 'Delete Customer', 'customers.delete', 'customers', NULL, '2026-06-29 15:40:28'),
(6, 'View Loans', 'loans.view', 'loans', NULL, '2026-06-29 15:40:28'),
(7, 'Create Loan', 'loans.create', 'loans', NULL, '2026-06-29 15:40:28'),
(8, 'Approve Loan', 'loans.approve', 'loans', NULL, '2026-06-29 15:40:28'),
(9, 'Close Loan', 'loans.close', 'loans', NULL, '2026-06-29 15:40:28'),
(10, 'View Savings', 'savings.view', 'savings', NULL, '2026-06-29 15:40:28'),
(11, 'Create Saving', 'savings.create', 'savings', NULL, '2026-06-29 15:40:28'),
(12, 'Approve Saving', 'savings.approve', 'savings', NULL, '2026-06-29 15:40:28'),
(13, 'Process Maturity', 'savings.maturity', 'savings', NULL, '2026-06-29 15:40:28'),
(14, 'Close Saving', 'savings.close', 'savings', NULL, '2026-06-29 15:40:28'),
(15, 'View Collections', 'collections.view', 'collections', NULL, '2026-06-29 15:40:28'),
(16, 'Create Collection', 'collections.create', 'collections', NULL, '2026-06-29 15:40:28'),
(17, 'Void Collection', 'collections.void', 'collections', NULL, '2026-06-29 15:40:28'),
(18, 'View Reports', 'reports.view', 'reports', NULL, '2026-06-29 15:40:28'),
(19, 'Export Reports', 'reports.export', 'reports', NULL, '2026-06-29 15:40:28'),
(20, 'View Funds', 'funds.view', 'funds', NULL, '2026-06-29 15:40:28'),
(21, 'Manage Funds', 'funds.manage', 'funds', NULL, '2026-06-29 15:40:28'),
(22, 'View Settings', 'settings.view', 'settings', NULL, '2026-06-29 15:40:28'),
(23, 'Edit Settings', 'settings.edit', 'settings', NULL, '2026-06-29 15:40:28'),
(24, 'View Users', 'users.view', 'users', NULL, '2026-06-29 15:40:28'),
(25, 'Create User', 'users.create', 'users', NULL, '2026-06-29 15:40:28'),
(26, 'Edit User', 'users.edit', 'users', NULL, '2026-06-29 15:40:28'),
(27, 'Delete User', 'users.delete', 'users', NULL, '2026-06-29 15:40:28'),
(28, 'View Branches', 'branches.view', 'branches', NULL, '2026-06-29 15:40:28'),
(29, 'Manage Branches', 'branches.manage', 'branches', NULL, '2026-06-29 15:40:28'),
(30, 'View Areas', 'areas.view', 'areas', NULL, '2026-06-29 15:40:28'),
(31, 'Manage Areas', 'areas.manage', 'areas', NULL, '2026-06-29 15:40:28'),
(32, 'View Agents', 'agents.view', 'agents', NULL, '2026-06-29 15:40:28'),
(33, 'Manage Agents', 'agents.manage', 'agents', NULL, '2026-06-29 15:40:28'),
(34, 'View Plans', 'plans.view', 'plans', NULL, '2026-06-29 15:40:28'),
(35, 'Manage Plans', 'plans.manage', 'plans', NULL, '2026-06-29 15:40:28'),
(36, 'View Policies', 'policies.view', 'policies', NULL, '2026-06-29 15:40:28'),
(37, 'Manage Policies', 'policies.manage', 'policies', NULL, '2026-06-29 15:40:28')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `slug` = VALUES(`slug`), `module` = VALUES(`module`), `description` = VALUES(`description`), `created_at` = VALUES(`created_at`);


-- ROLE PERMISSIONS
INSERT INTO `role_permissions` (`role_id`, `permission_id`) VALUES
(1, 1),
(1, 2),
(1, 3),
(1, 4),
(1, 5),
(1, 6),
(1, 7),
(1, 8),
(1, 9),
(1, 10),
(1, 11),
(1, 12),
(1, 13),
(1, 14),
(1, 15),
(1, 16),
(1, 17),
(1, 18),
(1, 19),
(1, 20),
(1, 21),
(1, 22),
(1, 23),
(1, 24),
(1, 25),
(1, 26),
(1, 27),
(1, 28),
(1, 29),
(1, 30),
(1, 31),
(1, 32),
(1, 33),
(1, 34),
(1, 35),
(1, 36),
(1, 37),
(2, 1),
(2, 2),
(2, 3),
(2, 4),
(2, 6),
(2, 7),
(2, 8),
(2, 9),
(2, 10),
(2, 11),
(2, 12),
(2, 13),
(2, 14),
(2, 15),
(2, 16),
(2, 17),
(2, 18),
(2, 19),
(2, 20),
(2, 24),
(2, 30),
(2, 32),
(2, 33),
(2, 34),
(3, 1),
(3, 2),
(3, 3),
(3, 4),
(3, 6),
(3, 7),
(3, 10),
(3, 11),
(3, 15),
(3, 16),
(3, 18),
(3, 32),
(3, 34),
(4, 1),
(4, 2),
(4, 3),
(4, 6),
(4, 10),
(4, 15),
(4, 16),
(4, 34)
ON DUPLICATE KEY UPDATE `role_id` = VALUES(`role_id`), `permission_id` = VALUES(`permission_id`);


-- POLICIES
INSERT INTO `policies` (`id`, `uuid`, `name`, `role`, `description`, `allow_login`, `allow_disbursement`, `allow_agent_assignment`, `allow_out_area`, `max_limit`, `allow_online_apply`, `allow_backdated`, `session_timeout`, `is_system`, `created_by`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'c0d879da-73a2-11f1-9bd3-00155df136a0', 'Super Admin Policy', 'Super Admin', NULL, 1, 1, 1, 1, '10000000.00', 1, 1, 120, 1, NULL, '2026-06-29 15:40:28', '2026-06-29 15:40:28', NULL),
(2, 'c0d89f3c-73a2-11f1-9bd3-00155df136a0', 'Standard Manager Policy', 'Branch Manager', NULL, 1, 1, 1, 0, '500000.00', 1, 0, 60, 1, NULL, '2026-06-29 15:40:28', '2026-06-29 15:40:28', NULL),
(3, 'c0d8a113-73a2-11f1-9bd3-00155df136a0', 'Standard Agent Policy', 'Agent / Collection Executive', NULL, 1, 0, 0, 0, '10000.00', 0, 0, 30, 1, NULL, '2026-06-29 15:40:28', '2026-06-29 15:40:28', NULL),
(4, 'c0d8a161-73a2-11f1-9bd3-00155df136a0', 'Standard Customer Policy', 'Customer (Future Mobile App)', NULL, 1, 0, 0, 0, '0.00', 0, 0, 15, 1, NULL, '2026-06-29 15:40:28', '2026-06-29 15:40:28', NULL),
(5, '9bf03f56-f84e-4016-9fca-25bd56f3f485', 'Test Policy Updated', 'Area Manager', NULL, 1, 1, 1, 1, '100000.00', 0, 1, 60, 0, 1, '2026-06-29 16:06:25', '2026-06-29 16:06:25', '2026-06-29 16:06:25')
ON DUPLICATE KEY UPDATE `uuid` = VALUES(`uuid`), `name` = VALUES(`name`), `role` = VALUES(`role`), `description` = VALUES(`description`), `allow_login` = VALUES(`allow_login`), `allow_disbursement` = VALUES(`allow_disbursement`), `allow_agent_assignment` = VALUES(`allow_agent_assignment`), `allow_out_area` = VALUES(`allow_out_area`), `max_limit` = VALUES(`max_limit`), `allow_online_apply` = VALUES(`allow_online_apply`), `allow_backdated` = VALUES(`allow_backdated`), `session_timeout` = VALUES(`session_timeout`), `is_system` = VALUES(`is_system`), `created_by` = VALUES(`created_by`), `created_at` = VALUES(`created_at`), `updated_at` = VALUES(`updated_at`), `deleted_at` = VALUES(`deleted_at`);


-- BRANCHES
INSERT INTO `branches` (`id`, `uuid`, `code`, `name`, `city`, `address`, `manager_id`, `allow_registrations`, `allow_collections`, `status`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'c0da5f07-73a2-11f1-9bd3-00155df136a0', 'AZ-LAL-01', 'Main Branch - Lalganj', 'Lalganj', 'Lalganj', 3, 1, 1, 'Active', '2026-06-29 15:40:28', '2026-06-29 16:10:55', NULL)
ON DUPLICATE KEY UPDATE `uuid` = VALUES(`uuid`), `code` = VALUES(`code`), `name` = VALUES(`name`), `city` = VALUES(`city`), `address` = VALUES(`address`), `manager_id` = VALUES(`manager_id`), `allow_registrations` = VALUES(`allow_registrations`), `allow_collections` = VALUES(`allow_collections`), `status` = VALUES(`status`), `created_at` = VALUES(`created_at`), `updated_at` = VALUES(`updated_at`), `deleted_at` = VALUES(`deleted_at`);


-- AREAS
INSERT INTO `areas` (`id`, `uuid`, `code`, `name`, `branch_id`, `manager_id`, `status`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'c0db3282-73a2-11f1-9bd3-00155df136a0', 'Lal', 'Lalganj', 1, NULL, 'Active', '2026-06-29 15:40:28', '2026-06-29 17:51:31', NULL),
(2, 'c0dba0fd-73a2-11f1-9bd3-00155df136a0', 'Dev', 'Devgaon', 1, NULL, 'Active', '2026-06-29 15:40:28', '2026-06-29 17:51:48', NULL)
ON DUPLICATE KEY UPDATE `uuid` = VALUES(`uuid`), `code` = VALUES(`code`), `name` = VALUES(`name`), `branch_id` = VALUES(`branch_id`), `manager_id` = VALUES(`manager_id`), `status` = VALUES(`status`), `created_at` = VALUES(`created_at`), `updated_at` = VALUES(`updated_at`), `deleted_at` = VALUES(`deleted_at`);


-- USERS
INSERT INTO `users` (`id`, `uuid`, `name`, `email`, `mobile`, `password_hash`, `pin_hash`, `role_id`, `branch_id`, `area_id`, `agent_id`, `policy_id`, `photo_path`, `status`, `last_login_at`, `auth_token`, `token_expires_at`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'c0dd2c9f-73a2-11f1-9bd3-00155df136a0', 'Sandeep Kumar', 'sandeep@umbrellafinance.in', '9628717175', '$2y$10$mts0HSTksjGK2D5sA3rA.OXXxX7iMJJ1dpSxbGOEtcQNbCZAEqRlm', '$2y$10$Jhx5pmZj2j1K3sTIUZ/5tuIGWxjAHk9vj/ygl8zy9.7ax8LAS8xGO', 1, NULL, NULL, NULL, 1, NULL, 'Active', NULL, NULL, NULL, '2026-06-29 15:40:28', '2026-07-04 20:00:23', NULL),
(3, 'c0ddafc0-73a2-11f1-9bd3-00155df136a0', 'Abhishek Rai', 'aditya@umbrellafinance.in', '9876543226', '$2y$10$47I6xZRVjrjRoFFJPrp7iOqgUqSHMbqtfb7JQEGiw66tlxT8uMdrG', '$2y$10$ex/39LcyNbh35L9GSC3LY.iEYfT4aHGS9IPBHnPD7tReEj8GcEIuC', 2, 1, NULL, NULL, 2, NULL, 'Active', NULL, NULL, NULL, '2026-06-29 15:40:28', '2026-06-29 17:22:07', NULL),
(4, 'c0ddb064-73a2-11f1-9bd3-00155df136a0', 'Amit Verma', 'amit@umbrellafinance.in', '9876543221', '$2y$10$47I6xZRVjrjRoFFJPrp7iOqgUqSHMbqtfb7JQEGiw66tlxT8uMdrG', '$2y$10$ex/39LcyNbh35L9GSC3LY.iEYfT4aHGS9IPBHnPD7tReEj8GcEIuC', 3, 1, 2, 1, 2, NULL, 'Active', NULL, NULL, NULL, '2026-06-29 15:40:28', '2026-07-05 12:40:49', NULL),
(5, 'c0ddb0f9-73a2-11f1-9bd3-00155df136a0', 'Shashank Rai', 'rahul@umbrellafinance.in', '9876543220', '$2y$10$/ITj5xEdYXZMP1.dR7UKoOn4Dw6/Fmjb/8UgdhVmbvsFmElg67F8y', '$2y$10$zIqpsonnrsxTKaitKGlNdO/TiHbhUQZ1qEJvj3vFWpOidg72eUAlW', 4, 1, 1, 1, 3, NULL, 'Active', NULL, NULL, NULL, '2026-06-29 15:40:28', '2026-06-29 17:39:52', NULL)
-- Users live/mutable data hai (agent ka profile admin UI se edit hota rehta
-- hai) — reseed sirf missing row banaye, kisi existing user ko purani seed
-- snapshot par wapas overwrite kabhi na kare.
ON DUPLICATE KEY UPDATE `id` = `id`;


-- AGENTS
INSERT INTO `agents` (`id`, `uuid`, `code`, `name`, `mobile`, `email`, `user_id`, `branch_id`, `area_id`, `policy_id`, `photo_path`, `father_name`, `dob`, `address`, `aadhaar_no`, `pan_no`, `bank_name`, `bank_account_no`, `bank_ifsc`, `joining_date`, `status`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'c0df361f-73a2-11f1-9bd3-00155df136a0', 'AG-01', 'Sashank Rai', '9876543220', 'shashank@umbrellafinance.in', 5, 1, 1, 3, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-29', 'Active', '2026-06-29 15:40:28', '2026-06-29 17:52:48', NULL)
-- Agent bhi live/mutable hai (Agent Management UI se edit hota hai) — same
-- reason, reseed par overwrite nahi hona chahiye.
ON DUPLICATE KEY UPDATE `id` = `id`;


-- LOAN PLANS
INSERT INTO `loan_plans` (`id`, `uuid`, `name`, `min_amount`, `max_amount`, `interest_rate`, `interest_type`, `duration_value`, `duration_unit`, `collection_frequency`, `processing_fee`, `penalty_per_day`, `penalty_per_month`, `status`, `created_by`, `created_at`, `updated_at`, `deleted_at`) VALUES
(4, '21998a22-c9bf-4288-a1e7-dfd2aa9e8a0c', '90D_3.5%', '5000.00', '200000.00', '3.50', 'Flat', 90, 'Days', 'Daily', '0.00', '0.00', '0.00', 'Active', 1, '2026-06-29 18:00:17', '2026-06-29 18:00:17', NULL),
(5, '4b24c457-73da-11f1-9bd3-00155df136a0', 'Custom Loan Plan', '0.00', '0.00', '0.00', 'Flat', 0, 'Days', 'Daily', '0.00', '0.00', '0.00', 'Active', 1, '2026-06-29 22:18:02', '2026-07-01 14:44:39', '2026-07-01 14:44:39'),
(6, '47d54feb-754b-11f1-9e5a-00155df136a0', 'Custom Loan Plan', '0.00', '0.00', '0.00', 'Flat', 0, 'Days', 'Daily', '0.00', '0.00', '0.00', 'Active', 1, '2026-07-01 18:19:21', '2026-07-01 18:19:21', NULL)
ON DUPLICATE KEY UPDATE `uuid` = VALUES(`uuid`), `name` = VALUES(`name`), `min_amount` = VALUES(`min_amount`), `max_amount` = VALUES(`max_amount`), `interest_rate` = VALUES(`interest_rate`), `interest_type` = VALUES(`interest_type`), `duration_value` = VALUES(`duration_value`), `duration_unit` = VALUES(`duration_unit`), `collection_frequency` = VALUES(`collection_frequency`), `processing_fee` = VALUES(`processing_fee`), `penalty_per_day` = VALUES(`penalty_per_day`), `penalty_per_month` = VALUES(`penalty_per_month`), `status` = VALUES(`status`), `created_by` = VALUES(`created_by`), `created_at` = VALUES(`created_at`), `updated_at` = VALUES(`updated_at`), `deleted_at` = VALUES(`deleted_at`);


-- SAVING PLANS
INSERT INTO `saving_plans` (`id`, `uuid`, `name`, `deposit_amount`, `interest_rate`, `duration_value`, `duration_unit`, `collection_frequency`, `maturity_amount`, `bonus_amount`, `status`, `created_by`, `created_at`, `updated_at`, `deleted_at`) VALUES
(4, '5e79c7a9-15ac-432f-8c6f-aaeb3ab4ab74', 'Saving18', '0.00', '7.00', 18, 'Months', 'Daily', '0.00', NULL, 'Active', 1, '2026-06-29 18:02:18', '2026-07-01 14:27:28', NULL),
(5, '954b6310-535d-449d-bb2a-67cee28aa0ea', 'Saving12', '0.00', '7.00', 12, 'Months', 'Daily', '0.00', '0.00', 'Active', 1, '2026-06-29 18:38:08', '2026-07-01 14:27:28', NULL),
(6, 'dd2701f9-42b9-4082-b5b6-aa6d7bf8d550', 'Saving36', '0.00', '7.00', 36, 'Months', 'Daily', '0.00', '0.00', 'Active', 1, '2026-06-29 18:38:43', '2026-07-01 14:27:28', NULL),
(7, '073aa1b3-7485-11f1-9bd3-00155df136a0', 'Custom Savings Plan', '0.00', '0.00', 0, 'Months', 'Daily', '0.00', '0.00', 'Active', 1, '2026-06-30 18:39:42', '2026-07-04 20:01:43', '2026-07-01 19:59:50'),
(8, 'fb2684e0-8438-4f8d-bc92-5c16fad76377', 'test', '100.00', '5.00', 18, 'Months', 'Daily', '58143.00', '0.00', 'Active', 1, '2026-07-04 20:12:30', '2026-07-04 20:12:30', NULL)
ON DUPLICATE KEY UPDATE `uuid` = VALUES(`uuid`), `name` = VALUES(`name`), `deposit_amount` = VALUES(`deposit_amount`), `interest_rate` = VALUES(`interest_rate`), `duration_value` = VALUES(`duration_value`), `duration_unit` = VALUES(`duration_unit`), `collection_frequency` = VALUES(`collection_frequency`), `maturity_amount` = VALUES(`maturity_amount`), `bonus_amount` = VALUES(`bonus_amount`), `status` = VALUES(`status`), `created_by` = VALUES(`created_by`), `created_at` = VALUES(`created_at`), `updated_at` = VALUES(`updated_at`), `deleted_at` = VALUES(`deleted_at`);


-- SETTINGS
INSERT INTO `settings` (`id`, `setting_key`, `setting_value`, `setting_type`, `description`, `updated_by`, `updated_at`) VALUES
(1, 'company_name', 'Umbrella Finance', 'string', 'Company display name', 1, '2026-06-29 16:01:54'),
(2, 'company_tagline', 'Chhote Kadam, Bade Sapne', 'string', 'Company tagline', NULL, '2026-06-29 15:40:28'),
(3, 'currency_symbol', '₹', 'string', 'Currency symbol', 1, '2026-06-29 16:02:17'),
(4, 'currency_code', 'INR', 'string', 'Currency code', NULL, '2026-06-29 15:40:28'),
(5, 'timezone', 'Asia/Kolkata', 'string', 'System timezone', 1, '2026-06-29 16:01:54'),
(6, 'allow_registrations', 'true', 'boolean', 'Allow new customer registrations', NULL, '2026-06-29 15:40:28'),
(7, 'mandatory_kyc', 'true', 'boolean', 'KYC mandatory for account opening', NULL, '2026-06-29 15:40:28'),
(8, 'allow_collections', 'true', 'boolean', 'Allow daily collections', NULL, '2026-06-29 15:40:28'),
(9, 'allow_sunday_collections', 'true', 'boolean', 'Allow collections on Sunday', NULL, '2026-06-29 15:40:28'),
(10, 'defaulter_days', '30', 'number', 'Days after which account is marked Defaulter', 1, '2026-06-29 16:03:43'),
(11, 'npa_days', '90', 'number', 'Days after which account is marked NPA', NULL, '2026-06-29 15:40:28'),
(12, 'disbursement_limit', '500000', 'number', 'Max single loan disbursement limit', 1, '2026-06-29 20:04:47'),
(13, 'custom_interest_rate', 'false', 'boolean', 'Allow custom interest rate per account', NULL, '2026-06-29 15:40:28'),
(14, 'sync_interval_seconds', '15', 'number', 'Dashboard sync polling interval in seconds', NULL, '2026-06-29 15:40:28'),
(22, 'terms_savings', '["This account is subject to regular deposits as per the selected savings plan frequency.","Withdrawals are subject to the policies of Umbrella Finance and lock-in periods where applicable.","Interest will be calculated and credited at the end of the maturity tenure.","Premature closure is subject to penalty charges as configured in the plan details.","Clients must provide valid identification and KYC updates when requested.","Verification test savings condition."]', 'json', 'Savings accounts terms and conditions list', 1, '2026-07-01 13:09:03'),
(23, 'terms_loan', '["The borrower agrees to repay the loan principal and interest in daily installments.","Processing fees and applicable taxes are deducted upfront at the time of disbursement.","Late payments will attract daily penalties as specified in the plan details.","Collateral or guarantor requirements must be maintained throughout the loan tenure.","In case of default, Umbrella Finance reserves the right to take legal recourse to recover outstanding dues."]', 'json', 'Loan accounts terms and conditions list', 1, '2026-07-01 13:09:03'),
(27, 'interest_calculation_period_loan', 'monthly', 'string', 'Interest calculation period for Loans (monthly or yearly)', 1, '2026-07-01 14:48:10'),
(28, 'interest_calculation_period_saving', 'yearly', 'string', 'Interest calculation period for Savings (monthly or yearly)', 1, '2026-07-01 14:48:10')
ON DUPLICATE KEY UPDATE `setting_key` = VALUES(`setting_key`), `setting_value` = VALUES(`setting_value`), `setting_type` = VALUES(`setting_type`), `description` = VALUES(`description`), `updated_by` = VALUES(`updated_by`), `updated_at` = VALUES(`updated_at`);


-- NUMBER SEQUENCES
INSERT INTO `number_sequences` (`id`, `prefix`, `last_number`, `updated_at`) VALUES
(1, 'CU', 0, CURRENT_TIMESTAMP),
(2, 'LN', 0, CURRENT_TIMESTAMP),
(3, 'SV', 0, CURRENT_TIMESTAMP),
(4, 'RC', 0, CURRENT_TIMESTAMP),
(5, 'TX', 0, CURRENT_TIMESTAMP),
(108, 'EX', 0, CURRENT_TIMESTAMP),
(109, 'EX-LN', 0, CURRENT_TIMESTAMP),
(111, 'EX-IND', 0, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE `prefix` = VALUES(`prefix`), `last_number` = 0, `updated_at` = CURRENT_TIMESTAMP;


-- FUND SOURCES (default pools only)
UPDATE `fund_sources` SET `uuid` = '95766b2e-7849-11f1-9d60-00155df136a0', `source_name` = 'Loan Fund Pool', `contact_info` = NULL, `total_invested` = '0.00', `available_amount` = '0.00', `total_received` = '0.00', `distribute` = '0.00', `withdraw` = '0.00', `status` = 'Active', `updated_at` = CURRENT_TIMESTAMP, `deleted_at` = NULL WHERE `source_type` = 'loan_fund';
INSERT INTO `fund_sources` (`id`, `uuid`, `source_type`, `source_name`, `contact_info`, `total_invested`, `available_amount`, `total_received`, `distribute`, `withdraw`, `status`, `created_at`, `updated_at`, `deleted_at`)
SELECT 6, '95766b2e-7849-11f1-9d60-00155df136a0', 'loan_fund', 'Loan Fund Pool', NULL, '0.00', '0.00', '0.00', '0.00', '0.00', 'Active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `fund_sources` WHERE `source_type` = 'loan_fund');
UPDATE `fund_sources` SET `uuid` = '95768cec-7849-11f1-9d60-00155df136a0', `source_name` = 'Saving Fund Pool', `contact_info` = NULL, `total_invested` = '0.00', `available_amount` = '0.00', `total_received` = '0.00', `distribute` = '0.00', `withdraw` = '0.00', `status` = 'Active', `updated_at` = CURRENT_TIMESTAMP, `deleted_at` = NULL WHERE `source_type` = 'saving_fund';
INSERT INTO `fund_sources` (`id`, `uuid`, `source_type`, `source_name`, `contact_info`, `total_invested`, `available_amount`, `total_received`, `distribute`, `withdraw`, `status`, `created_at`, `updated_at`, `deleted_at`)
SELECT 7, '95768cec-7849-11f1-9d60-00155df136a0', 'saving_fund', 'Saving Fund Pool', NULL, '0.00', '0.00', '0.00', '0.00', '0.00', 'Active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `fund_sources` WHERE `source_type` = 'saving_fund');

SET FOREIGN_KEY_CHECKS = 1;

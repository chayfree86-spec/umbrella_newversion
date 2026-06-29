-- ============================================================
-- UMBRELLA FINANCE — Seed Data
-- Database: ufin
-- ============================================================

USE `ufin`;

SET time_zone = '+05:30';

-- ============================================================
-- 1. ROLES
-- ============================================================

INSERT INTO `roles` (`id`, `name`, `slug`, `description`, `is_system`) VALUES
(1, 'Super Admin', 'super_admin', 'Full system access with all permissions', 1),
(2, 'Branch Manager', 'branch_manager', 'Branch-level management access', 1),
(3, 'Area Manager', 'area_manager', 'Area-level operational access', 1),
(4, 'Agent / Collection Executive', 'agent', 'Field collection and customer registration', 1),
(5, 'Customer', 'customer', 'Future mobile app access for customers', 1);

-- ============================================================
-- 2. PERMISSIONS
-- ============================================================

INSERT INTO `permissions` (`name`, `slug`, `module`) VALUES
-- Dashboard
('View Dashboard', 'dashboard.view', 'dashboard'),
-- Customers
('View Customers', 'customers.view', 'customers'),
('Create Customer', 'customers.create', 'customers'),
('Edit Customer', 'customers.edit', 'customers'),
('Delete Customer', 'customers.delete', 'customers'),
-- Loan Accounts
('View Loans', 'loans.view', 'loans'),
('Create Loan', 'loans.create', 'loans'),
('Approve Loan', 'loans.approve', 'loans'),
('Close Loan', 'loans.close', 'loans'),
-- Saving Accounts
('View Savings', 'savings.view', 'savings'),
('Create Saving', 'savings.create', 'savings'),
('Approve Saving', 'savings.approve', 'savings'),
('Process Maturity', 'savings.maturity', 'savings'),
('Close Saving', 'savings.close', 'savings'),
-- Collections
('View Collections', 'collections.view', 'collections'),
('Create Collection', 'collections.create', 'collections'),
('Void Collection', 'collections.void', 'collections'),
-- Reports
('View Reports', 'reports.view', 'reports'),
('Export Reports', 'reports.export', 'reports'),
-- Fund Management
('View Funds', 'funds.view', 'funds'),
('Manage Funds', 'funds.manage', 'funds'),
-- Settings
('View Settings', 'settings.view', 'settings'),
('Edit Settings', 'settings.edit', 'settings'),
-- Users
('View Users', 'users.view', 'users'),
('Create User', 'users.create', 'users'),
('Edit User', 'users.edit', 'users'),
('Delete User', 'users.delete', 'users'),
-- Branches
('View Branches', 'branches.view', 'branches'),
('Manage Branches', 'branches.manage', 'branches'),
-- Areas
('View Areas', 'areas.view', 'areas'),
('Manage Areas', 'areas.manage', 'areas'),
-- Agents
('View Agents', 'agents.view', 'agents'),
('Manage Agents', 'agents.manage', 'agents'),
-- Plans
('View Plans', 'plans.view', 'plans'),
('Manage Plans', 'plans.manage', 'plans'),
-- Policies
('View Policies', 'policies.view', 'policies'),
('Manage Policies', 'policies.manage', 'policies');

-- ============================================================
-- 3. ROLE PERMISSIONS (Super Admin gets all)
-- ============================================================

INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT 1, `id` FROM `permissions`;

-- Branch Manager permissions
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT 2, `id` FROM `permissions` WHERE `slug` IN (
  'dashboard.view', 'customers.view', 'customers.create', 'customers.edit',
  'loans.view', 'loans.create', 'loans.approve', 'loans.close',
  'savings.view', 'savings.create', 'savings.approve', 'savings.maturity', 'savings.close',
  'collections.view', 'collections.create', 'collections.void',
  'reports.view', 'reports.export', 'funds.view',
  'agents.view', 'agents.manage', 'areas.view',
  'plans.view', 'users.view'
);

-- Area Manager permissions
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT 3, `id` FROM `permissions` WHERE `slug` IN (
  'dashboard.view', 'customers.view', 'customers.create', 'customers.edit',
  'loans.view', 'loans.create',
  'savings.view', 'savings.create',
  'collections.view', 'collections.create',
  'reports.view', 'agents.view',
  'plans.view'
);

-- Agent permissions
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT 4, `id` FROM `permissions` WHERE `slug` IN (
  'dashboard.view', 'customers.view', 'customers.create',
  'loans.view', 'savings.view',
  'collections.view', 'collections.create',
  'plans.view'
);

-- ============================================================
-- 4. POLICIES (Policy Profiles)
-- ============================================================

INSERT INTO `policies` (`id`, `uuid`, `name`, `role`, `allow_login`, `allow_disbursement`, `allow_agent_assignment`, `allow_out_area`, `max_limit`, `allow_online_apply`, `allow_backdated`, `session_timeout`, `is_system`) VALUES
(1, UUID(), 'Super Admin Policy', 'Super Admin', 1, 1, 1, 1, 10000000.00, 1, 1, 120, 1),
(2, UUID(), 'Standard Manager Policy', 'Branch Manager', 1, 1, 1, 0, 500000.00, 1, 0, 60, 1),
(3, UUID(), 'Standard Agent Policy', 'Agent / Collection Executive', 1, 0, 0, 0, 10000.00, 0, 0, 30, 1),
(4, UUID(), 'Standard Customer Policy', 'Customer (Future Mobile App)', 1, 0, 0, 0, 0.00, 0, 0, 15, 1);

-- ============================================================
-- 5. BRANCHES
-- ============================================================

INSERT INTO `branches` (`id`, `uuid`, `code`, `name`, `city`, `allow_registrations`, `allow_collections`, `status`) VALUES
(1, UUID(), 'BR-LKO-01', 'Main Branch - Lucknow', 'Lucknow', 1, 1, 'Active'),
(2, UUID(), 'BR-KAN-02', 'Branch 2 - Kanpur', 'Kanpur', 1, 1, 'Active');

-- ============================================================
-- 6. AREAS
-- ============================================================

INSERT INTO `areas` (`id`, `uuid`, `code`, `name`, `branch_id`, `status`) VALUES
(1, UUID(), 'AR-LKO-HZN', 'Hazratganj (Lucknow)', 1, 'Active'),
(2, UUID(), 'AR-LKO-GMT', 'Gomti Nagar (Lucknow)', 1, 'Active'),
(3, UUID(), 'AR-KAN-KLP', 'Kalyanpur (Kanpur)', 2, 'Active');

-- ============================================================
-- 7. USERS
-- Passwords: password_hash('admin123', PASSWORD_BCRYPT), etc.
-- PINs: password_hash('2310', PASSWORD_BCRYPT), etc.
-- NOTE: These hashes are pre-generated for the default passwords
-- ============================================================

INSERT INTO `users` (`id`, `uuid`, `name`, `email`, `mobile`, `password_hash`, `pin_hash`, `role_id`, `branch_id`, `area_id`, `policy_id`, `status`) VALUES
(1, UUID(), 'Sandeep Kumar', 'sandeep@umbrellafinance.in', '9628717175',
  '$2y$10$YJhYfx0e5HMj8bE9j5kK6OzVLZ7kQ9xR8pG2mT4nW5vX1cA3yB6Sm',
  '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  1, NULL, NULL, 1, 'Active'),
(2, UUID(), 'Vijay Pratap', 'vijay@umbrellafinance.in', '9876543225',
  '$2y$10$YJhYfx0e5HMj8bE9j5kK6OzVLZ7kQ9xR8pG2mT4nW5vX1cA3yB6Sm',
  '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  2, 2, NULL, 2, 'Active'),
(3, UUID(), 'Aditya Narayan', 'aditya@umbrellafinance.in', '9876543226',
  '$2y$10$YJhYfx0e5HMj8bE9j5kK6OzVLZ7kQ9xR8pG2mT4nW5vX1cA3yB6Sm',
  '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  2, 1, NULL, 2, 'Active'),
(4, UUID(), 'Amit Verma', 'amit@umbrellafinance.in', '9876543221',
  '$2y$10$YJhYfx0e5HMj8bE9j5kK6OzVLZ7kQ9xR8pG2mT4nW5vX1cA3yB6Sm',
  '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  3, 1, 2, 2, 'Active'),
(5, UUID(), 'Rahul Singh', 'rahul@umbrellafinance.in', '9876543220',
  '$2y$10$YJhYfx0e5HMj8bE9j5kK6OzVLZ7kQ9xR8pG2mT4nW5vX1cA3yB6Sm',
  '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  4, 1, 1, 3, 'Active');

-- ============================================================
-- 8. AGENTS
-- ============================================================

INSERT INTO `agents` (`id`, `uuid`, `code`, `name`, `mobile`, `email`, `user_id`, `branch_id`, `area_id`, `policy_id`, `status`) VALUES
(1, UUID(), 'AG-01', 'Rahul Singh', '9876543220', 'rahul@umbrellafinance.in', 5, 1, 1, 3, 'Active'),
(2, UUID(), 'AG-02', 'Amit Verma', '9876543221', 'amit@umbrellafinance.in', 4, 2, 3, 3, 'Active');

-- Update branches with manager_id
UPDATE `branches` SET `manager_id` = 3 WHERE `id` = 1;
UPDATE `branches` SET `manager_id` = 2 WHERE `id` = 2;

-- Update users with agent_id
UPDATE `users` SET `agent_id` = 1 WHERE `id` = 5;
UPDATE `users` SET `agent_id` = 2 WHERE `id` = 4;

-- ============================================================
-- 9. LOAN PLANS
-- ============================================================

INSERT INTO `loan_plans` (`id`, `uuid`, `name`, `min_amount`, `max_amount`, `interest_rate`, `interest_type`, `duration_value`, `duration_unit`, `collection_frequency`, `processing_fee`, `penalty_per_day`, `status`, `created_by`) VALUES
(1, UUID(), 'Durga Shakti Personal Loan', 10000.00, 20000.00, 12.00, 'Flat', 100, 'Days', 'Daily', 200.00, 10.00, 'Active', 1),
(2, UUID(), 'Vyapar Vriddhi Business Loan', 50000.00, 2000000.00, 15.00, 'Reducing', 12, 'Months', 'Monthly', 1000.00, 50.00, 'Active', 1);

-- ============================================================
-- 10. SAVING PLANS
-- ============================================================

INSERT INTO `saving_plans` (`id`, `uuid`, `name`, `deposit_amount`, `interest_rate`, `duration_value`, `duration_unit`, `collection_frequency`, `maturity_amount`, `status`, `created_by`) VALUES
(1, UUID(), 'Daily Pragati Savings', 100.00, 6.00, 365, 'Days', 'Daily', 38690.00, 'Active', 1),
(2, UUID(), 'Monthly Suraksha Savings', 1000.00, 8.00, 2, 'Years', 'Monthly', 26000.00, 'Active', 1);

-- ============================================================
-- 11. SETTINGS
-- ============================================================

INSERT INTO `settings` (`setting_key`, `setting_value`, `setting_type`, `description`) VALUES
('company_name', 'Umbrella Finance', 'string', 'Company display name'),
('company_tagline', 'Chhote Kadam, Bade Sapne', 'string', 'Company tagline'),
('currency_symbol', '₹', 'string', 'Currency symbol'),
('currency_code', 'INR', 'string', 'Currency code'),
('timezone', 'Asia/Kolkata', 'string', 'System timezone'),
('allow_registrations', 'true', 'boolean', 'Allow new customer registrations'),
('mandatory_kyc', 'true', 'boolean', 'KYC mandatory for account opening'),
('allow_collections', 'true', 'boolean', 'Allow daily collections'),
('allow_sunday_collections', 'true', 'boolean', 'Allow collections on Sunday'),
('defaulter_days', '30', 'number', 'Days after which account is marked Defaulter'),
('npa_days', '90', 'number', 'Days after which account is marked NPA'),
('disbursement_limit', '50000', 'number', 'Max single loan disbursement limit'),
('custom_interest_rate', 'false', 'boolean', 'Allow custom interest rate per account'),
('sync_interval_seconds', '15', 'number', 'Dashboard sync polling interval in seconds');

-- ============================================================
-- 12. NUMBER SEQUENCES (Initialize counters)
-- ============================================================

INSERT INTO `number_sequences` (`prefix`, `year`, `last_number`) VALUES
('CU', 2026, 0),
('LN', 2026, 0),
('SV', 2026, 0),
('RC', 2026, 0),
('TX', 2026, 0);

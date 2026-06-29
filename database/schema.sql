-- ============================================================
-- UMBRELLA FINANCE — Complete Database Schema
-- Database: ufin
-- Timezone: Asia/Kolkata (IST)
-- ============================================================

CREATE DATABASE IF NOT EXISTS `ufin` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `ufin`;

SET time_zone = '+05:30';

-- ============================================================
-- 1. ROLES & PERMISSIONS (RBAC)
-- ============================================================

CREATE TABLE `roles` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(50) NOT NULL UNIQUE,
  `description` VARCHAR(255) DEFAULT NULL,
  `is_system` TINYINT(1) DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE `permissions` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(100) NOT NULL UNIQUE,
  `module` VARCHAR(50) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE `role_permissions` (
  `role_id` INT UNSIGNED NOT NULL,
  `permission_id` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`role_id`, `permission_id`),
  FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 2. USERS
-- ============================================================

CREATE TABLE `users` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` CHAR(36) NOT NULL UNIQUE,
  `name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(150) DEFAULT NULL UNIQUE,
  `mobile` VARCHAR(15) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `pin_hash` VARCHAR(255) DEFAULT NULL,
  `role_id` INT UNSIGNED NOT NULL,
  `branch_id` INT UNSIGNED DEFAULT NULL,
  `area_id` INT UNSIGNED DEFAULT NULL,
  `agent_id` INT UNSIGNED DEFAULT NULL,
  `policy_id` INT UNSIGNED DEFAULT NULL,
  `photo_path` VARCHAR(500) DEFAULT NULL,
  `status` ENUM('Active','Inactive','Suspended') DEFAULT 'Active',
  `last_login_at` DATETIME DEFAULT NULL,
  `auth_token` VARCHAR(500) DEFAULT NULL,
  `token_expires_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME DEFAULT NULL,
  FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`),
  INDEX `idx_users_mobile` (`mobile`),
  INDEX `idx_users_email` (`email`),
  INDEX `idx_users_role` (`role_id`),
  INDEX `idx_users_branch` (`branch_id`),
  INDEX `idx_users_status` (`status`)
) ENGINE=InnoDB;

-- ============================================================
-- 3. BRANCHES
-- ============================================================

CREATE TABLE `branches` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` CHAR(36) NOT NULL UNIQUE,
  `code` VARCHAR(20) NOT NULL UNIQUE,
  `name` VARCHAR(200) NOT NULL,
  `city` VARCHAR(100) DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `manager_id` INT UNSIGNED DEFAULT NULL,
  `allow_registrations` TINYINT(1) DEFAULT 1,
  `allow_collections` TINYINT(1) DEFAULT 1,
  `status` ENUM('Active','Inactive') DEFAULT 'Active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME DEFAULT NULL,
  INDEX `idx_branches_code` (`code`),
  INDEX `idx_branches_status` (`status`)
) ENGINE=InnoDB;

-- ============================================================
-- 4. AREAS
-- ============================================================

CREATE TABLE `areas` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` CHAR(36) NOT NULL UNIQUE,
  `code` VARCHAR(20) NOT NULL UNIQUE,
  `name` VARCHAR(200) NOT NULL,
  `branch_id` INT UNSIGNED NOT NULL,
  `manager_id` INT UNSIGNED DEFAULT NULL,
  `status` ENUM('Active','Inactive') DEFAULT 'Active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME DEFAULT NULL,
  FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`),
  INDEX `idx_areas_branch` (`branch_id`),
  INDEX `idx_areas_code` (`code`),
  INDEX `idx_areas_status` (`status`)
) ENGINE=InnoDB;

-- ============================================================
-- 5. POLICIES (Policy Profiles)
-- ============================================================

CREATE TABLE `policies` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` CHAR(36) NOT NULL UNIQUE,
  `name` VARCHAR(200) NOT NULL,
  `role` VARCHAR(100) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `allow_login` TINYINT(1) DEFAULT 1,
  `allow_disbursement` TINYINT(1) DEFAULT 0,
  `allow_agent_assignment` TINYINT(1) DEFAULT 0,
  `allow_out_area` TINYINT(1) DEFAULT 0,
  `max_limit` DECIMAL(18,2) DEFAULT 10000.00,
  `allow_online_apply` TINYINT(1) DEFAULT 0,
  `allow_backdated` TINYINT(1) DEFAULT 0,
  `session_timeout` INT DEFAULT 30,
  `is_system` TINYINT(1) DEFAULT 0,
  `created_by` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME DEFAULT NULL
) ENGINE=InnoDB;

-- ============================================================
-- 6. AGENTS
-- ============================================================

CREATE TABLE `agents` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` CHAR(36) NOT NULL UNIQUE,
  `code` VARCHAR(20) NOT NULL UNIQUE,
  `name` VARCHAR(150) NOT NULL,
  `mobile` VARCHAR(15) NOT NULL,
  `email` VARCHAR(150) DEFAULT NULL,
  `user_id` INT UNSIGNED DEFAULT NULL,
  `branch_id` INT UNSIGNED NOT NULL,
  `area_id` INT UNSIGNED NOT NULL,
  `policy_id` INT UNSIGNED DEFAULT NULL,
  `photo_path` VARCHAR(500) DEFAULT NULL,
  `father_name` VARCHAR(150) DEFAULT NULL,
  `dob` DATE DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `aadhaar_no` VARCHAR(20) DEFAULT NULL,
  `pan_no` VARCHAR(15) DEFAULT NULL,
  `bank_name` VARCHAR(100) DEFAULT NULL,
  `bank_account_no` VARCHAR(30) DEFAULT NULL,
  `bank_ifsc` VARCHAR(15) DEFAULT NULL,
  `joining_date` DATE DEFAULT NULL,
  `status` ENUM('Active','Inactive','Suspended') DEFAULT 'Active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME DEFAULT NULL,
  FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`),
  FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`),
  FOREIGN KEY (`policy_id`) REFERENCES `policies`(`id`),
  INDEX `idx_agents_branch` (`branch_id`),
  INDEX `idx_agents_area` (`area_id`),
  INDEX `idx_agents_mobile` (`mobile`),
  INDEX `idx_agents_code` (`code`),
  INDEX `idx_agents_status` (`status`)
) ENGINE=InnoDB;

-- ============================================================
-- 7. CUSTOMERS
-- ============================================================

CREATE TABLE `customers` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` CHAR(36) NOT NULL UNIQUE,
  `customer_code` VARCHAR(25) NOT NULL UNIQUE,
  `full_name` VARCHAR(200) NOT NULL,
  `mobile` VARCHAR(15) NOT NULL,
  `alternate_mobile` VARCHAR(15) DEFAULT NULL,
  `dob` DATE DEFAULT NULL,
  `gender` ENUM('Male','Female','Other') DEFAULT 'Male',
  `father_or_husband_name` VARCHAR(200) DEFAULT NULL,
  `occupation` VARCHAR(150) DEFAULT NULL,
  `monthly_income` DECIMAL(18,2) DEFAULT 0.00,
  `photo_path` VARCHAR(500) DEFAULT NULL,
  `branch_id` INT UNSIGNED NOT NULL,
  `area_id` INT UNSIGNED NOT NULL,
  `agent_id` INT UNSIGNED NOT NULL,
  `status` ENUM('Active','Inactive','Blocked') DEFAULT 'Active',
  `created_by` INT UNSIGNED DEFAULT NULL,
  `updated_by` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME DEFAULT NULL,
  INDEX `idx_customers_mobile` (`mobile`),
  INDEX `idx_customers_code` (`customer_code`),
  INDEX `idx_customers_branch` (`branch_id`),
  INDEX `idx_customers_area` (`area_id`),
  INDEX `idx_customers_agent` (`agent_id`),
  INDEX `idx_customers_status` (`status`),
  INDEX `idx_customers_created` (`created_at`),
  FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`),
  FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`),
  FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`)
) ENGINE=InnoDB;

-- ============================================================
-- 8. CUSTOMER ADDRESSES
-- ============================================================

CREATE TABLE `customer_addresses` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `customer_id` INT UNSIGNED NOT NULL,
  `address_type` ENUM('Permanent','Current','Office') DEFAULT 'Permanent',
  `address_line1` VARCHAR(300) NOT NULL,
  `address_line2` VARCHAR(300) DEFAULT NULL,
  `city` VARCHAR(100) DEFAULT NULL,
  `state` VARCHAR(100) DEFAULT NULL,
  `pincode` VARCHAR(10) DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE,
  INDEX `idx_cust_addr_customer` (`customer_id`)
) ENGINE=InnoDB;

-- ============================================================
-- 9. CUSTOMER KYC
-- ============================================================

CREATE TABLE `customer_kyc` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `customer_id` INT UNSIGNED NOT NULL UNIQUE,
  `aadhaar_no` VARCHAR(20) DEFAULT NULL,
  `pan_no` VARCHAR(15) DEFAULT NULL,
  `voter_id` VARCHAR(20) DEFAULT NULL,
  `bank_name` VARCHAR(100) DEFAULT NULL,
  `bank_account_no` VARCHAR(30) DEFAULT NULL,
  `bank_ifsc` VARCHAR(15) DEFAULT NULL,
  `aadhaar_front_path` VARCHAR(500) DEFAULT NULL,
  `aadhaar_back_path` VARCHAR(500) DEFAULT NULL,
  `pan_path` VARCHAR(500) DEFAULT NULL,
  `cheque_path` VARCHAR(500) DEFAULT NULL,
  `verified` TINYINT(1) DEFAULT 0,
  `verified_by` INT UNSIGNED DEFAULT NULL,
  `verified_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 10. CUSTOMER DOCUMENTS
-- ============================================================

CREATE TABLE `customer_documents` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `customer_id` INT UNSIGNED NOT NULL,
  `document_type` VARCHAR(50) NOT NULL,
  `document_name` VARCHAR(200) DEFAULT NULL,
  `file_path` VARCHAR(500) NOT NULL,
  `uploaded_by` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE,
  INDEX `idx_cust_docs_customer` (`customer_id`)
) ENGINE=InnoDB;

-- ============================================================
-- 11. GUARANTORS
-- ============================================================

CREATE TABLE `guarantors` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `customer_id` INT UNSIGNED NOT NULL,
  `loan_account_id` INT UNSIGNED DEFAULT NULL,
  `name` VARCHAR(200) NOT NULL,
  `mobile` VARCHAR(15) DEFAULT NULL,
  `relation` VARCHAR(50) DEFAULT NULL,
  `aadhaar_no` VARCHAR(20) DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `monthly_income` DECIMAL(18,2) DEFAULT 0.00,
  `photo_path` VARCHAR(500) DEFAULT NULL,
  `aadhaar_front_path` VARCHAR(500) DEFAULT NULL,
  `aadhaar_back_path` VARCHAR(500) DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE,
  INDEX `idx_guarantors_customer` (`customer_id`)
) ENGINE=InnoDB;

-- ============================================================
-- 12. LOAN PLANS (Plan Master)
-- ============================================================

CREATE TABLE `loan_plans` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` CHAR(36) NOT NULL UNIQUE,
  `name` VARCHAR(200) NOT NULL,
  `min_amount` DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  `max_amount` DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  `interest_rate` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `interest_type` ENUM('Flat','Reducing') DEFAULT 'Flat',
  `duration_value` INT NOT NULL DEFAULT 100,
  `duration_unit` ENUM('Days','Months','Years') DEFAULT 'Days',
  `collection_frequency` ENUM('Daily','Weekly','Monthly') DEFAULT 'Daily',
  `processing_fee` DECIMAL(18,2) DEFAULT 0.00,
  `penalty_per_day` DECIMAL(18,2) DEFAULT 0.00,
  `penalty_per_month` DECIMAL(18,2) DEFAULT 0.00,
  `status` ENUM('Active','Inactive') DEFAULT 'Active',
  `created_by` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME DEFAULT NULL,
  INDEX `idx_loan_plans_status` (`status`)
) ENGINE=InnoDB;

-- ============================================================
-- 13. SAVING PLANS (Plan Master)
-- ============================================================

CREATE TABLE `saving_plans` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` CHAR(36) NOT NULL UNIQUE,
  `name` VARCHAR(200) NOT NULL,
  `deposit_amount` DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  `interest_rate` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `duration_value` INT NOT NULL DEFAULT 365,
  `duration_unit` ENUM('Days','Months','Years') DEFAULT 'Days',
  `collection_frequency` ENUM('Daily','Weekly','Monthly') DEFAULT 'Daily',
  `maturity_amount` DECIMAL(18,2) DEFAULT 0.00,
  `bonus_amount` DECIMAL(18,2) DEFAULT 0.00,
  `status` ENUM('Active','Inactive') DEFAULT 'Active',
  `created_by` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME DEFAULT NULL,
  INDEX `idx_saving_plans_status` (`status`)
) ENGINE=InnoDB;

-- ============================================================
-- 14. LOAN ACCOUNTS
-- ============================================================

CREATE TABLE `loan_accounts` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` CHAR(36) NOT NULL UNIQUE,
  `loan_account_no` VARCHAR(25) NOT NULL UNIQUE,
  `customer_id` INT UNSIGNED NOT NULL,
  `loan_plan_id` INT UNSIGNED NOT NULL,
  `branch_id` INT UNSIGNED NOT NULL,
  `area_id` INT UNSIGNED NOT NULL,
  `agent_id` INT UNSIGNED NOT NULL,
  `principal_amount` DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  `interest_rate` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `interest_type` ENUM('Flat','Reducing') DEFAULT 'Flat',
  `interest_amount` DECIMAL(18,2) DEFAULT 0.00,
  `processing_fee` DECIMAL(18,2) DEFAULT 0.00,
  `penalty_amount` DECIMAL(18,2) DEFAULT 0.00,
  `total_payable` DECIMAL(18,2) DEFAULT 0.00,
  `emi_amount` DECIMAL(18,2) DEFAULT 0.00,
  `duration_days` INT DEFAULT 0,
  `duration_months` INT DEFAULT 0,
  `collection_frequency` ENUM('Daily','Weekly','Monthly') DEFAULT 'Daily',
  `start_date` DATE DEFAULT NULL,
  `end_date` DATE DEFAULT NULL,
  `total_paid` DECIMAL(18,2) DEFAULT 0.00,
  `outstanding_amount` DECIMAL(18,2) DEFAULT 0.00,
  `account_status` ENUM('Processing','Approved','Active','Defaulter','NPA','Closed','Rejected') DEFAULT 'Processing',
  `approved_by` INT UNSIGNED DEFAULT NULL,
  `approved_at` DATETIME DEFAULT NULL,
  `closed_at` DATETIME DEFAULT NULL,
  `closed_by` INT UNSIGNED DEFAULT NULL,
  `created_by` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME DEFAULT NULL,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`),
  FOREIGN KEY (`loan_plan_id`) REFERENCES `loan_plans`(`id`),
  FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`),
  FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`),
  FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`),
  INDEX `idx_loan_acc_no` (`loan_account_no`),
  INDEX `idx_loan_acc_customer` (`customer_id`),
  INDEX `idx_loan_acc_branch` (`branch_id`),
  INDEX `idx_loan_acc_area` (`area_id`),
  INDEX `idx_loan_acc_agent` (`agent_id`),
  INDEX `idx_loan_acc_status` (`account_status`),
  INDEX `idx_loan_acc_created` (`created_at`)
) ENGINE=InnoDB;

-- ============================================================
-- 15. LOAN INSTALLMENTS (EMI Schedule)
-- ============================================================

CREATE TABLE `loan_installments` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `loan_account_id` INT UNSIGNED NOT NULL,
  `installment_no` INT NOT NULL,
  `due_date` DATE NOT NULL,
  `principal_component` DECIMAL(18,2) DEFAULT 0.00,
  `interest_component` DECIMAL(18,2) DEFAULT 0.00,
  `total_due` DECIMAL(18,2) DEFAULT 0.00,
  `paid_amount` DECIMAL(18,2) DEFAULT 0.00,
  `penalty_amount` DECIMAL(18,2) DEFAULT 0.00,
  `status` ENUM('Pending','Paid','Partial','Overdue','Schedule') DEFAULT 'Pending',
  `paid_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`loan_account_id`) REFERENCES `loan_accounts`(`id`) ON DELETE CASCADE,
  INDEX `idx_installment_loan` (`loan_account_id`),
  INDEX `idx_installment_due` (`due_date`),
  INDEX `idx_installment_status` (`status`)
) ENGINE=InnoDB;

-- ============================================================
-- 16. LOAN COLLECTIONS
-- ============================================================

CREATE TABLE `loan_collections` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` CHAR(36) NOT NULL UNIQUE,
  `receipt_no` VARCHAR(25) NOT NULL UNIQUE,
  `loan_account_id` INT UNSIGNED NOT NULL,
  `customer_id` INT UNSIGNED NOT NULL,
  `installment_id` INT UNSIGNED DEFAULT NULL,
  `branch_id` INT UNSIGNED NOT NULL,
  `area_id` INT UNSIGNED NOT NULL,
  `agent_id` INT UNSIGNED NOT NULL,
  `collection_date` DATE NOT NULL,
  `collected_amount` DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  `principal_amount` DECIMAL(18,2) DEFAULT 0.00,
  `interest_amount` DECIMAL(18,2) DEFAULT 0.00,
  `penalty_amount` DECIMAL(18,2) DEFAULT 0.00,
  `payment_mode` ENUM('Cash','UPI','Bank Transfer','Cheque','Online') DEFAULT 'Cash',
  `remarks` TEXT DEFAULT NULL,
  `collected_by` INT UNSIGNED NOT NULL,
  `is_reversal` TINYINT(1) DEFAULT 0,
  `reversal_of` INT UNSIGNED DEFAULT NULL,
  `is_advance` TINYINT(1) DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`loan_account_id`) REFERENCES `loan_accounts`(`id`),
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`),
  INDEX `idx_loan_coll_receipt` (`receipt_no`),
  INDEX `idx_loan_coll_account` (`loan_account_id`),
  INDEX `idx_loan_coll_customer` (`customer_id`),
  INDEX `idx_loan_coll_branch` (`branch_id`),
  INDEX `idx_loan_coll_area` (`area_id`),
  INDEX `idx_loan_coll_agent` (`agent_id`),
  INDEX `idx_loan_coll_date` (`collection_date`),
  INDEX `idx_loan_coll_created` (`created_at`)
) ENGINE=InnoDB;

-- ============================================================
-- 17. SAVING ACCOUNTS
-- ============================================================

CREATE TABLE `saving_accounts` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` CHAR(36) NOT NULL UNIQUE,
  `saving_account_no` VARCHAR(25) NOT NULL UNIQUE,
  `customer_id` INT UNSIGNED NOT NULL,
  `saving_plan_id` INT UNSIGNED NOT NULL,
  `branch_id` INT UNSIGNED NOT NULL,
  `area_id` INT UNSIGNED NOT NULL,
  `agent_id` INT UNSIGNED NOT NULL,
  `deposit_amount` DECIMAL(18,2) DEFAULT 0.00,
  `interest_rate` DECIMAL(6,2) DEFAULT 0.00,
  `duration_months` INT DEFAULT 12,
  `maturity_amount` DECIMAL(18,2) DEFAULT 0.00,
  `collection_frequency` ENUM('Daily','Weekly','Monthly') DEFAULT 'Daily',
  `total_deposited` DECIMAL(18,2) DEFAULT 0.00,
  `start_date` DATE DEFAULT NULL,
  `maturity_date` DATE DEFAULT NULL,
  `account_status` ENUM('Processing','Approved','Active','Matured','Closed','Rejected') DEFAULT 'Processing',
  `approved_by` INT UNSIGNED DEFAULT NULL,
  `approved_at` DATETIME DEFAULT NULL,
  `matured_at` DATETIME DEFAULT NULL,
  `closed_at` DATETIME DEFAULT NULL,
  `closed_by` INT UNSIGNED DEFAULT NULL,
  `created_by` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME DEFAULT NULL,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`),
  FOREIGN KEY (`saving_plan_id`) REFERENCES `saving_plans`(`id`),
  FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`),
  FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`),
  FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`),
  INDEX `idx_saving_acc_no` (`saving_account_no`),
  INDEX `idx_saving_acc_customer` (`customer_id`),
  INDEX `idx_saving_acc_branch` (`branch_id`),
  INDEX `idx_saving_acc_area` (`area_id`),
  INDEX `idx_saving_acc_agent` (`agent_id`),
  INDEX `idx_saving_acc_status` (`account_status`),
  INDEX `idx_saving_acc_maturity` (`maturity_date`),
  INDEX `idx_saving_acc_created` (`created_at`)
) ENGINE=InnoDB;

-- ============================================================
-- 17B. SAVING INSTALLMENTS (Schedule for daily/weekly/monthly RD style)
-- ============================================================

CREATE TABLE `saving_installments` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `saving_account_id` INT UNSIGNED NOT NULL,
  `installment_no` INT NOT NULL,
  `due_date` DATE NOT NULL,
  `total_due` DECIMAL(18,2) DEFAULT 0.00,
  `paid_amount` DECIMAL(18,2) DEFAULT 0.00,
  `status` ENUM('Pending','Paid','Partial') DEFAULT 'Pending',
  `paid_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`saving_account_id`) REFERENCES `saving_accounts`(`id`) ON DELETE CASCADE,
  INDEX `idx_saving_inst_account` (`saving_account_id`),
  INDEX `idx_saving_inst_due` (`due_date`),
  INDEX `idx_saving_inst_status` (`status`)
) ENGINE=InnoDB;

-- ============================================================
-- 18. SAVING DEPOSITS
-- ============================================================

CREATE TABLE `saving_deposits` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` CHAR(36) NOT NULL UNIQUE,
  `receipt_no` VARCHAR(25) NOT NULL UNIQUE,
  `saving_account_id` INT UNSIGNED NOT NULL,
  `customer_id` INT UNSIGNED NOT NULL,
  `branch_id` INT UNSIGNED NOT NULL,
  `area_id` INT UNSIGNED NOT NULL,
  `agent_id` INT UNSIGNED NOT NULL,
  `deposit_date` DATE NOT NULL,
  `deposit_amount` DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  `payment_mode` ENUM('Cash','UPI','Bank Transfer','Cheque','Online') DEFAULT 'Cash',
  `remarks` TEXT DEFAULT NULL,
  `collected_by` INT UNSIGNED NOT NULL,
  `is_reversal` TINYINT(1) DEFAULT 0,
  `reversal_of` INT UNSIGNED DEFAULT NULL,
  `is_advance` TINYINT(1) DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`saving_account_id`) REFERENCES `saving_accounts`(`id`),
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`),
  INDEX `idx_saving_dep_receipt` (`receipt_no`),
  INDEX `idx_saving_dep_account` (`saving_account_id`),
  INDEX `idx_saving_dep_customer` (`customer_id`),
  INDEX `idx_saving_dep_branch` (`branch_id`),
  INDEX `idx_saving_dep_area` (`area_id`),
  INDEX `idx_saving_dep_agent` (`agent_id`),
  INDEX `idx_saving_dep_date` (`deposit_date`),
  INDEX `idx_saving_dep_created` (`created_at`)
) ENGINE=InnoDB;

-- ============================================================
-- 19. SAVING MATURITY
-- ============================================================

CREATE TABLE `saving_maturity` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `saving_account_id` INT UNSIGNED NOT NULL,
  `maturity_date` DATE NOT NULL,
  `total_deposited` DECIMAL(18,2) DEFAULT 0.00,
  `interest_earned` DECIMAL(18,2) DEFAULT 0.00,
  `bonus_amount` DECIMAL(18,2) DEFAULT 0.00,
  `total_payout` DECIMAL(18,2) DEFAULT 0.00,
  `payout_mode` ENUM('Cash','Bank Transfer','Cheque') DEFAULT 'Cash',
  `payout_date` DATE DEFAULT NULL,
  `processed_by` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`saving_account_id`) REFERENCES `saving_accounts`(`id`)
) ENGINE=InnoDB;

-- ============================================================
-- 20. RECEIPTS (Master Receipt Register)
-- ============================================================

CREATE TABLE `receipts` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `receipt_no` VARCHAR(25) NOT NULL UNIQUE,
  `receipt_type` ENUM('loan_collection','saving_deposit','maturity_payout','fund_transaction') NOT NULL,
  `reference_id` INT UNSIGNED NOT NULL,
  `customer_id` INT UNSIGNED DEFAULT NULL,
  `account_no` VARCHAR(25) DEFAULT NULL,
  `amount` DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  `payment_mode` ENUM('Cash','UPI','Bank Transfer','Cheque','Online') DEFAULT 'Cash',
  `branch_id` INT UNSIGNED DEFAULT NULL,
  `area_id` INT UNSIGNED DEFAULT NULL,
  `agent_id` INT UNSIGNED DEFAULT NULL,
  `generated_by` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_receipts_no` (`receipt_no`),
  INDEX `idx_receipts_type` (`receipt_type`),
  INDEX `idx_receipts_customer` (`customer_id`),
  INDEX `idx_receipts_created` (`created_at`)
) ENGINE=InnoDB;

-- ============================================================
-- 21. FUND SOURCES
-- ============================================================

CREATE TABLE `fund_sources` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` CHAR(36) NOT NULL UNIQUE,
  `source_type` ENUM('owner_capital','investor','loan_repayment','interest','savings_collection','other') NOT NULL,
  `source_name` VARCHAR(200) NOT NULL,
  `contact_info` VARCHAR(200) DEFAULT NULL,
  `total_invested` DECIMAL(18,2) DEFAULT 0.00,
  `status` ENUM('Active','Inactive') DEFAULT 'Active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME DEFAULT NULL
) ENGINE=InnoDB;

-- ============================================================
-- 22. CAPITAL ENTRIES
-- ============================================================

CREATE TABLE `capital_entries` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` CHAR(36) NOT NULL UNIQUE,
  `transaction_no` VARCHAR(25) NOT NULL UNIQUE,
  `fund_source_id` INT UNSIGNED DEFAULT NULL,
  `entry_type` ENUM('credit','debit') NOT NULL,
  `amount` DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  `description` TEXT DEFAULT NULL,
  `reference_no` VARCHAR(50) DEFAULT NULL,
  `entry_date` DATE NOT NULL,
  `entered_by` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`fund_source_id`) REFERENCES `fund_sources`(`id`),
  INDEX `idx_capital_txn` (`transaction_no`),
  INDEX `idx_capital_date` (`entry_date`),
  INDEX `idx_capital_type` (`entry_type`)
) ENGINE=InnoDB;

-- ============================================================
-- 23. CASH BOOK
-- ============================================================

CREATE TABLE `cash_book` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` CHAR(36) NOT NULL UNIQUE,
  `entry_date` DATE NOT NULL,
  `entry_type` ENUM('credit','debit') NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `reference_no` VARCHAR(50) DEFAULT NULL,
  `reference_type` VARCHAR(50) DEFAULT NULL,
  `amount` DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  `balance_after` DECIMAL(18,2) DEFAULT 0.00,
  `branch_id` INT UNSIGNED DEFAULT NULL,
  `entered_by` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_cashbook_date` (`entry_date`),
  INDEX `idx_cashbook_type` (`entry_type`),
  INDEX `idx_cashbook_branch` (`branch_id`)
) ENGINE=InnoDB;

-- ============================================================
-- 24. SETTINGS
-- ============================================================

CREATE TABLE `settings` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `setting_key` VARCHAR(100) NOT NULL UNIQUE,
  `setting_value` TEXT DEFAULT NULL,
  `setting_type` ENUM('string','number','boolean','json') DEFAULT 'string',
  `description` VARCHAR(255) DEFAULT NULL,
  `updated_by` INT UNSIGNED DEFAULT NULL,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- 25. NOTIFICATIONS
-- ============================================================

CREATE TABLE `notifications` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` CHAR(36) NOT NULL UNIQUE,
  `user_id` INT UNSIGNED DEFAULT NULL,
  `title` VARCHAR(200) NOT NULL,
  `message` TEXT DEFAULT NULL,
  `type` ENUM('info','success','warning','danger') DEFAULT 'info',
  `reference_module` VARCHAR(50) DEFAULT NULL,
  `reference_id` INT UNSIGNED DEFAULT NULL,
  `is_read` TINYINT(1) DEFAULT 0,
  `read_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_notif_user` (`user_id`),
  INDEX `idx_notif_read` (`is_read`),
  INDEX `idx_notif_created` (`created_at`)
) ENGINE=InnoDB;

-- ============================================================
-- 26. AUDIT LOGS
-- ============================================================

CREATE TABLE `audit_logs` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED DEFAULT NULL,
  `action` VARCHAR(50) NOT NULL,
  `module` VARCHAR(50) NOT NULL,
  `reference_id` INT UNSIGNED DEFAULT NULL,
  `old_values` JSON DEFAULT NULL,
  `new_values` JSON DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `user_agent` VARCHAR(500) DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_audit_user` (`user_id`),
  INDEX `idx_audit_module` (`module`),
  INDEX `idx_audit_action` (`action`),
  INDEX `idx_audit_created` (`created_at`)
) ENGINE=InnoDB;

-- ============================================================
-- 27. SYNC EVENTS (Near Real-time Polling)
-- ============================================================

CREATE TABLE `sync_events` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `event_type` VARCHAR(50) NOT NULL,
  `module` VARCHAR(50) NOT NULL,
  `reference_id` INT UNSIGNED DEFAULT NULL,
  `branch_id` INT UNSIGNED DEFAULT NULL,
  `area_id` INT UNSIGNED DEFAULT NULL,
  `agent_id` INT UNSIGNED DEFAULT NULL,
  `user_id` INT UNSIGNED DEFAULT NULL,
  `title` VARCHAR(200) DEFAULT NULL,
  `message` TEXT DEFAULT NULL,
  `payload` JSON DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_sync_type` (`event_type`),
  INDEX `idx_sync_module` (`module`),
  INDEX `idx_sync_created` (`created_at`),
  INDEX `idx_sync_branch` (`branch_id`),
  INDEX `idx_sync_user` (`user_id`)
) ENGINE=InnoDB;

-- ============================================================
-- 28. NUMBER SEQUENCES (Auto Increment for formatted codes)
-- ============================================================

CREATE TABLE `number_sequences` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `prefix` VARCHAR(10) NOT NULL,
  `year` YEAR NOT NULL,
  `last_number` INT UNSIGNED NOT NULL DEFAULT 0,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_prefix_year` (`prefix`, `year`)
) ENGINE=InnoDB;

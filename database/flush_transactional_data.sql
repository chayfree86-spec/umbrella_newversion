-- ============================================================
-- FLUSH: saara transactional data delete
-- RAHEGA (master data): roles, permissions, role_permissions,
--   users, policies, branches, areas, agents,
--   loan_plans, saving_plans, settings
-- UDEGA (data): customers + unke sab records, loan/saving
--   accounts + installments + collections/deposits + maturity,
--   receipts, fund histories, capital entries, expenses,
--   notifications, audit logs, sync events, number counters
--
-- !! WARNING: PERMANENT DELETE — run karne se pehle backup/export
--    le lena ho to le lijiye (phpMyAdmin > Export).
-- ============================================================

USE `ufin`;

SET FOREIGN_KEY_CHECKS = 0;

-- Customer side
TRUNCATE TABLE `guarantors`;
TRUNCATE TABLE `customer_documents`;
TRUNCATE TABLE `customer_kyc`;
TRUNCATE TABLE `customer_addresses`;
TRUNCATE TABLE `customers`;

-- Loan side
TRUNCATE TABLE `loan_collections`;
TRUNCATE TABLE `loan_installments`;
TRUNCATE TABLE `loan_accounts`;

-- Saving side
TRUNCATE TABLE `saving_maturity`;
TRUNCATE TABLE `saving_deposits`;
TRUNCATE TABLE `saving_installments`;
TRUNCATE TABLE `saving_accounts`;

-- Money / ledger
TRUNCATE TABLE `receipts`;
TRUNCATE TABLE `capital_entries`;
TRUNCATE TABLE `fund_loan_history`;
TRUNCATE TABLE `fund_saving_history`;
TRUNCATE TABLE `expenses`;

-- System logs / counters
TRUNCATE TABLE `notifications`;
TRUNCATE TABLE `audit_logs`;
TRUNCATE TABLE `sync_events`;
TRUNCATE TABLE `number_sequences`;

SET FOREIGN_KEY_CHECKS = 1;

-- Fund sources: investor rows transaction se bante hain → delete;
-- owner + pool rows master hain → amounts zero
DELETE FROM `fund_sources` WHERE `source_type` = 'investor';
UPDATE `fund_sources`
   SET `total_invested`   = 0.00,
       `available_amount` = 0.00,
       `total_received`   = 0.00,
       `distribute`       = 0.00,
       `withdraw`         = 0.00;

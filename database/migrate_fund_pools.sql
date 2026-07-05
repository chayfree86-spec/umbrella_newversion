-- ============================================================
-- Migration: Fund pools + history tables
--   1. fund_sources me loan_fund / saving_fund rows + naye columns
--   2. fund_loan_history + fund_saving_history tables
--   3. Existing data se pool balances initialize
--   4. Purani capital_entries ko history me copy (balance NULL —
--      proper balance_before/after migration ke BAAD ki entries se)
-- Run once on live `ufin` (phpMyAdmin > SQL tab)
-- ============================================================

USE `ufin`;

-- ---------- 1. fund_sources upgrade ----------
ALTER TABLE `fund_sources`
  MODIFY COLUMN `source_type` ENUM('owner_capital','investor','loan_repayment','interest','savings_collection','other','loan_fund','saving_fund') NOT NULL,
  ADD COLUMN `available_amount` DECIMAL(18,2) DEFAULT 0.00 AFTER `total_invested`,
  ADD COLUMN `total_received` DECIMAL(18,2) DEFAULT 0.00 AFTER `available_amount`,
  ADD COLUMN `distribute` DECIMAL(18,2) DEFAULT 0.00 AFTER `total_received`,
  ADD COLUMN `withdraw` DECIMAL(18,2) DEFAULT 0.00 AFTER `distribute`;

-- ---------- 2. History tables ----------
CREATE TABLE IF NOT EXISTS `fund_loan_history` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` CHAR(36) NOT NULL UNIQUE,
  `transaction_no` VARCHAR(25) NOT NULL,
  `fund_source_id` INT UNSIGNED DEFAULT NULL,
  `entry_type` ENUM('credit','debit') NOT NULL,
  `category` VARCHAR(50) NOT NULL,
  `amount` DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  `balance_before` DECIMAL(18,2) DEFAULT NULL,
  `balance_after` DECIMAL(18,2) DEFAULT NULL,
  `reference_no` VARCHAR(50) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `entry_date` DATE NOT NULL,
  `entered_by` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`fund_source_id`) REFERENCES `fund_sources`(`id`),
  INDEX `idx_flh_txn` (`transaction_no`),
  INDEX `idx_flh_date` (`entry_date`),
  INDEX `idx_flh_category` (`category`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `fund_saving_history` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` CHAR(36) NOT NULL UNIQUE,
  `transaction_no` VARCHAR(25) NOT NULL,
  `fund_source_id` INT UNSIGNED DEFAULT NULL,
  `entry_type` ENUM('credit','debit') NOT NULL,
  `category` VARCHAR(50) NOT NULL,
  `amount` DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  `balance_before` DECIMAL(18,2) DEFAULT NULL,
  `balance_after` DECIMAL(18,2) DEFAULT NULL,
  `reference_no` VARCHAR(50) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `entry_date` DATE NOT NULL,
  `entered_by` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`fund_source_id`) REFERENCES `fund_sources`(`id`),
  INDEX `idx_fsh_txn` (`transaction_no`),
  INDEX `idx_fsh_date` (`entry_date`),
  INDEX `idx_fsh_category` (`category`)
) ENGINE=InnoDB;

-- ---------- 3. Existing data se figures nikaalo ----------
SET @savings_to_loan := (SELECT COALESCE(SUM(amount),0) FROM capital_entries WHERE description LIKE '%Savings to Loan%');
SET @loan_to_savings := (SELECT COALESCE(SUM(amount),0) FROM capital_entries WHERE description LIKE '%Loan to Savings%');
SET @net_transfer    := @savings_to_loan - @loan_to_savings;

-- Purane system me transfer owner_capital ke total_invested me judta tha —
-- ab pools me track hota hai, isliye legacy adjustment undo karo
UPDATE `fund_sources`
   SET `total_invested` = `total_invested` - @net_transfer
 WHERE `source_type` = 'owner_capital'
 LIMIT 1;

SET @raw_capital     := (SELECT COALESCE(SUM(total_invested),0) FROM fund_sources WHERE source_type IN ('owner_capital','investor') AND status='Active');
SET @total_disbursed := (SELECT COALESCE(SUM(principal_amount),0) FROM loan_accounts WHERE account_status NOT IN ('Processing','Rejected') AND deleted_at IS NULL);
SET @principal_rcvd  := (SELECT COALESCE(SUM(principal_amount),0) FROM loan_collections WHERE is_reversal=0);
SET @interest_rcvd   := (SELECT COALESCE(SUM(interest_amount),0)  FROM loan_collections WHERE is_reversal=0);
SET @penalty_rcvd    := (SELECT COALESCE(SUM(penalty_amount),0)   FROM loan_collections WHERE is_reversal=0);
SET @deposits_rcvd   := (SELECT COALESCE(SUM(deposit_amount),0)   FROM saving_deposits  WHERE is_reversal=0);
SET @maturity_paid   := (SELECT COALESCE(SUM(total_payout),0)     FROM saving_maturity);

-- ---------- 4. Pool rows insert (initialized values ke saath) ----------
INSERT INTO `fund_sources`
  (`uuid`, `source_type`, `source_name`, `available_amount`, `total_received`, `distribute`, `withdraw`, `status`)
VALUES
  (UUID(), 'loan_fund', 'Loan Fund Pool',
    GREATEST(0, (@raw_capital + @net_transfer) - @total_disbursed + @principal_rcvd + @interest_rcvd + @penalty_rcvd),
    @raw_capital + @savings_to_loan + @principal_rcvd + @interest_rcvd + @penalty_rcvd,
    @total_disbursed,
    @loan_to_savings,
    'Active'),
  (UUID(), 'saving_fund', 'Saving Fund Pool',
    GREATEST(0, (@deposits_rcvd + @loan_to_savings) - @maturity_paid - @savings_to_loan),
    @deposits_rcvd + @loan_to_savings,
    0,
    @maturity_paid + @savings_to_loan,
    'Active');

-- ---------- 5. Purani capital_entries ko history me copy ----------
-- (balance_before/after NULL — running balance migration ke baad se sahi)

-- Loan-side: capital / investor / withdrawals / transfers
INSERT INTO `fund_loan_history`
  (`uuid`, `transaction_no`, `fund_source_id`, `entry_type`, `category`, `amount`,
   `reference_no`, `description`, `entry_date`, `entered_by`, `created_at`)
SELECT UUID(), ce.transaction_no, ce.fund_source_id, ce.entry_type,
  CASE
    WHEN ce.description LIKE '%Savings to Loan%' THEN 'transfer_from_saving'
    WHEN ce.description LIKE '%Loan to Savings%' THEN 'transfer_to_saving'
    WHEN fs.source_type = 'investor'             THEN 'investor_funding'
    WHEN ce.entry_type = 'debit'                 THEN 'withdraw'
    ELSE 'capital_added'
  END,
  ce.amount, ce.reference_no, ce.description, ce.entry_date, ce.entered_by, ce.created_at
FROM capital_entries ce
LEFT JOIN fund_sources fs ON ce.fund_source_id = fs.id;

-- Saving-side: sirf transfers ka doosra paira (twin entries)
INSERT INTO `fund_saving_history`
  (`uuid`, `transaction_no`, `fund_source_id`, `entry_type`, `category`, `amount`,
   `reference_no`, `description`, `entry_date`, `entered_by`, `created_at`)
SELECT UUID(), ce.transaction_no, NULL,
  CASE WHEN ce.description LIKE '%Savings to Loan%' THEN 'debit' ELSE 'credit' END,
  CASE WHEN ce.description LIKE '%Savings to Loan%' THEN 'transfer_to_loan' ELSE 'transfer_from_loan' END,
  ce.amount, ce.reference_no, ce.description, ce.entry_date, ce.entered_by, ce.created_at
FROM capital_entries ce
WHERE ce.description LIKE '%Savings to Loan%' OR ce.description LIKE '%Loan to Savings%';

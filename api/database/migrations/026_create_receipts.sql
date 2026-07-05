CREATE TABLE IF NOT EXISTS `receipts` (
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

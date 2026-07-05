CREATE TABLE IF NOT EXISTS `capital_entries` (
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

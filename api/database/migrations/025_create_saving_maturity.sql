CREATE TABLE IF NOT EXISTS `saving_maturity` (
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
  FOREIGN KEY (`saving_account_id`) REFERENCES `saving_accounts`(`id`),
  INDEX `idx_saving_maturity_account` (`saving_account_id`),
  INDEX `idx_saving_maturity_date` (`maturity_date`)
) ENGINE=InnoDB;

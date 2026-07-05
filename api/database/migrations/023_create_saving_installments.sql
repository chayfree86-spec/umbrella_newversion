CREATE TABLE IF NOT EXISTS `saving_installments` (
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

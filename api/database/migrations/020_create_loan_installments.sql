CREATE TABLE IF NOT EXISTS `loan_installments` (
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

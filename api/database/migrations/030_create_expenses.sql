CREATE TABLE IF NOT EXISTS `expenses` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` CHAR(36) NOT NULL UNIQUE,
  `expense_no` VARCHAR(25) NOT NULL UNIQUE,
  `expense_type` ENUM('Saving Balance','Loan Balance','Individual') NOT NULL,
  `amount` DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  `entry_date` DATE NOT NULL,
  `remarks` TEXT DEFAULT NULL,
  `branch_id` INT UNSIGNED DEFAULT NULL,
  `entered_by` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`entered_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  INDEX `idx_expenses_no` (`expense_no`),
  INDEX `idx_expenses_type` (`expense_type`),
  INDEX `idx_expenses_date` (`entry_date`),
  INDEX `idx_expenses_branch` (`branch_id`)
) ENGINE=InnoDB;

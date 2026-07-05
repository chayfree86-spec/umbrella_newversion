CREATE TABLE IF NOT EXISTS `saving_plans` (
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

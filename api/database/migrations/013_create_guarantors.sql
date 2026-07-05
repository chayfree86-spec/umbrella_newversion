CREATE TABLE IF NOT EXISTS `guarantors` (
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

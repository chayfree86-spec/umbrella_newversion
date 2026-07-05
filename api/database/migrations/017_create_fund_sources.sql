CREATE TABLE IF NOT EXISTS `fund_sources` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` CHAR(36) NOT NULL UNIQUE,
  `source_type` ENUM('owner_capital','investor','loan_repayment','interest','savings_collection','other','loan_fund','saving_fund') NOT NULL,
  `source_name` VARCHAR(200) NOT NULL,
  `contact_info` VARCHAR(200) DEFAULT NULL,
  `total_invested` DECIMAL(18,2) DEFAULT 0.00,
  `available_amount` DECIMAL(18,2) DEFAULT 0.00,
  `total_received` DECIMAL(18,2) DEFAULT 0.00,
  `distribute` DECIMAL(18,2) DEFAULT 0.00,
  `withdraw` DECIMAL(18,2) DEFAULT 0.00,
  `status` ENUM('Active','Inactive') DEFAULT 'Active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME DEFAULT NULL
) ENGINE=InnoDB;

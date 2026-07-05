CREATE TABLE IF NOT EXISTS `branches` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` CHAR(36) NOT NULL UNIQUE,
  `code` VARCHAR(20) NOT NULL UNIQUE,
  `name` VARCHAR(200) NOT NULL,
  `city` VARCHAR(100) DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `manager_id` INT UNSIGNED DEFAULT NULL,
  `allow_registrations` TINYINT(1) DEFAULT 1,
  `allow_collections` TINYINT(1) DEFAULT 1,
  `status` ENUM('Active','Inactive') DEFAULT 'Active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME DEFAULT NULL,
  INDEX `idx_branches_code` (`code`),
  INDEX `idx_branches_status` (`status`)
) ENGINE=InnoDB;

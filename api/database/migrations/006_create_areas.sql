CREATE TABLE IF NOT EXISTS `areas` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` CHAR(36) NOT NULL UNIQUE,
  `code` VARCHAR(20) NOT NULL UNIQUE,
  `name` VARCHAR(200) NOT NULL,
  `branch_id` INT UNSIGNED NOT NULL,
  `manager_id` INT UNSIGNED DEFAULT NULL,
  `status` ENUM('Active','Inactive') DEFAULT 'Active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME DEFAULT NULL,
  FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`),
  INDEX `idx_areas_branch` (`branch_id`),
  INDEX `idx_areas_code` (`code`),
  INDEX `idx_areas_status` (`status`)
) ENGINE=InnoDB;

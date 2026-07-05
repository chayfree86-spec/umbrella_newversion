CREATE TABLE IF NOT EXISTS `customer_addresses` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `customer_id` INT UNSIGNED NOT NULL,
  `address_type` ENUM('Permanent','Current','Office') DEFAULT 'Permanent',
  `address_line1` VARCHAR(300) NOT NULL,
  `address_line2` VARCHAR(300) DEFAULT NULL,
  `city` VARCHAR(100) DEFAULT NULL,
  `state` VARCHAR(100) DEFAULT NULL,
  `pincode` VARCHAR(10) DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE,
  INDEX `idx_cust_addr_customer` (`customer_id`)
) ENGINE=InnoDB;

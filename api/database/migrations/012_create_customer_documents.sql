CREATE TABLE IF NOT EXISTS `customer_documents` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `customer_id` INT UNSIGNED NOT NULL,
  `document_type` VARCHAR(50) NOT NULL,
  `document_name` VARCHAR(200) DEFAULT NULL,
  `file_path` VARCHAR(500) NOT NULL,
  `uploaded_by` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE,
  INDEX `idx_cust_docs_customer` (`customer_id`)
) ENGINE=InnoDB;

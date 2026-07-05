CREATE TABLE IF NOT EXISTS `sync_events` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `event_type` VARCHAR(50) NOT NULL,
  `module` VARCHAR(50) NOT NULL,
  `reference_id` INT UNSIGNED DEFAULT NULL,
  `branch_id` INT UNSIGNED DEFAULT NULL,
  `area_id` INT UNSIGNED DEFAULT NULL,
  `agent_id` INT UNSIGNED DEFAULT NULL,
  `user_id` INT UNSIGNED DEFAULT NULL,
  `title` VARCHAR(200) DEFAULT NULL,
  `message` TEXT DEFAULT NULL,
  `payload` JSON DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_sync_type` (`event_type`),
  INDEX `idx_sync_module` (`module`),
  INDEX `idx_sync_created` (`created_at`),
  INDEX `idx_sync_branch` (`branch_id`),
  INDEX `idx_sync_user` (`user_id`)
) ENGINE=InnoDB;

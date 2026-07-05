CREATE TABLE IF NOT EXISTS `number_sequences` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `prefix` VARCHAR(20) NOT NULL,
  `last_number` INT UNSIGNED NOT NULL DEFAULT 0,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_prefix` (`prefix`)
) ENGINE=InnoDB;

SET @drop_old_sequence_index := (
  SELECT IF(COUNT(*) > 0, 'ALTER TABLE `number_sequences` DROP INDEX `uniq_prefix_year`', 'DO 0')
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'number_sequences'
    AND index_name = 'uniq_prefix_year'
);
PREPARE stmt FROM @drop_old_sequence_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @drop_sequence_year := (
  SELECT IF(COUNT(*) > 0, 'ALTER TABLE `number_sequences` DROP COLUMN `year`', 'DO 0')
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'number_sequences'
    AND column_name = 'year'
);
PREPARE stmt FROM @drop_sequence_year;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_sequence_prefix_index := (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE `number_sequences` ADD UNIQUE KEY `uniq_prefix` (`prefix`)', 'DO 0')
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'number_sequences'
    AND index_name = 'uniq_prefix'
);
PREPARE stmt FROM @add_sequence_prefix_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

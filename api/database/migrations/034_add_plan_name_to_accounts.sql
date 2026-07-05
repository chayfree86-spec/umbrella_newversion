SET @add_loan_plan_name := (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE `loan_accounts` ADD COLUMN `plan_name` VARCHAR(200) DEFAULT NULL AFTER `loan_plan_id`', 'DO 0')
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'loan_accounts'
    AND column_name = 'plan_name'
);
PREPARE stmt FROM @add_loan_plan_name;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_saving_plan_name := (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE `saving_accounts` ADD COLUMN `plan_name` VARCHAR(200) DEFAULT NULL AFTER `saving_plan_id`', 'DO 0')
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'saving_accounts'
    AND column_name = 'plan_name'
);
PREPARE stmt FROM @add_saving_plan_name;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

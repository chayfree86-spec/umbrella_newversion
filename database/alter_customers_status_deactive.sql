-- ============================================================
-- Migration: customers.status ENUM
--   'Deactive' add  +  'Inactive' remove
-- Final ENUM: ('Active','Blocked','Deactive')
-- Run once on the live `ufin` database (phpMyAdmin > SQL tab)
-- ============================================================

USE `ufin`;

-- Step 1: Pehle dono values allow karo (safe transition —
-- Inactive rows abhi bhi valid rahengi)
ALTER TABLE `customers`
  MODIFY COLUMN `status` ENUM('Active','Inactive','Blocked','Deactive') DEFAULT 'Active';

-- Step 2: Purane 'Inactive' customers ko 'Deactive' me convert karo
UPDATE `customers` SET `status` = 'Deactive' WHERE `status` = 'Inactive';

-- Step 3: Ab 'Inactive' ko ENUM se hata do
ALTER TABLE `customers`
  MODIFY COLUMN `status` ENUM('Active','Blocked','Deactive') DEFAULT 'Active';

-- ============================================================
-- Migration: cash_book table remove
-- Ledger ab fund_loan_history / fund_saving_history me maintain
-- hota hai (balance_before / balance_after ke saath).
--
-- NOTE: migrate_fund_pools.sql PEHLE chalana zaroori hai,
-- taaki pools/history tables ban chuki hon.
-- ============================================================

USE `ufin`;

DROP TABLE IF EXISTS `cash_book`;

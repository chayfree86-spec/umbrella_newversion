<?php
/**
 * Dashboard API Controller
 */
class DashboardController {

    public static function summary($db, $authUser) {
        $branchId = $_GET['branch_id'] ?? null;
        if ($authUser['role_slug'] === 'branch_manager') {
            $branchId = $authUser['branch_id'];
        }

        // 1. Total Customers
        $q = "SELECT COUNT(*) FROM customers WHERE deleted_at IS NULL";
        if ($branchId) $q .= " AND branch_id = " . (int)$branchId;
        $totalCustomers = $db->query($q)->fetchColumn();

        // 2. Active Loans
        $q = "SELECT COUNT(*), COALESCE(SUM(principal_amount), 0) FROM loan_accounts WHERE account_status IN ('Approved', 'Active', 'Defaulter') AND deleted_at IS NULL";
        if ($branchId) $q .= " AND branch_id = " . (int)$branchId;
        [$activeLoans, $loanValue] = $db->query($q)->fetch(PDO::FETCH_NUM);

        // 3. Active Savings
        $q = "SELECT COUNT(*), COALESCE(SUM(total_deposited), 0) FROM saving_accounts WHERE account_status IN ('Approved', 'Active') AND deleted_at IS NULL";
        if ($branchId) $q .= " AND branch_id = " . (int)$branchId;
        [$activeSavings, $savingValue] = $db->query($q)->fetch(PDO::FETCH_NUM);

        // 4. Today's Collections
        $qLoan = "SELECT COALESCE(SUM(collected_amount), 0) FROM loan_collections WHERE collection_date = CURRENT_DATE() AND is_reversal = 0";
        if ($branchId) $qLoan .= " AND branch_id = " . (int)$branchId;
        $todayLoan = $db->query($qLoan)->fetchColumn();

        $qSaving = "SELECT COALESCE(SUM(deposit_amount), 0) FROM saving_deposits WHERE deposit_date = CURRENT_DATE() AND is_reversal = 0";
        if ($branchId) $qSaving .= " AND branch_id = " . (int)$branchId;
        $todaySaving = $db->query($qSaving)->fetchColumn();

        $todayCollection = $todayLoan + $todaySaving;

        // 5. Monthly Collections
        $qLoanMon = "SELECT COALESCE(SUM(collected_amount), 0) FROM loan_collections WHERE MONTH(collection_date) = MONTH(CURRENT_DATE()) AND YEAR(collection_date) = YEAR(CURRENT_DATE()) AND is_reversal = 0";
        if ($branchId) $qLoanMon .= " AND branch_id = " . (int)$branchId;
        $monLoan = $db->query($qLoanMon)->fetchColumn();

        $qSavingMon = "SELECT COALESCE(SUM(deposit_amount), 0) FROM saving_deposits WHERE MONTH(deposit_date) = MONTH(CURRENT_DATE()) AND YEAR(deposit_date) = YEAR(CURRENT_DATE()) AND is_reversal = 0";
        if ($branchId) $qSavingMon .= " AND branch_id = " . (int)$branchId;
        $monSaving = $db->query($qSavingMon)->fetchColumn();

        $monthlyCollection = $monLoan + $monSaving;

        // 6. Today's Due
        $qDue = "SELECT COALESCE(SUM(total_due - paid_amount), 0) FROM loan_installments li 
                 JOIN loan_accounts la ON li.loan_account_id = la.id
                 WHERE li.due_date = CURRENT_DATE() AND li.status != 'Paid' AND la.account_status IN ('Approved', 'Active', 'Defaulter') AND la.deleted_at IS NULL";
        if ($branchId) $qDue .= " AND la.branch_id = " . (int)$branchId;
        $todayDue = $db->query($qDue)->fetchColumn();

        // 7. Today's Maturity
        $qMat = "SELECT COUNT(*) FROM saving_accounts WHERE maturity_date = CURRENT_DATE() AND account_status IN ('Approved', 'Active') AND deleted_at IS NULL";
        if ($branchId) $qMat .= " AND branch_id = " . (int)$branchId;
        $todayMaturity = $db->query($qMat)->fetchColumn();

        // 8. Outstanding amount
        $qOut = "SELECT COALESCE(SUM(outstanding_amount), 0) FROM loan_accounts WHERE account_status IN ('Approved', 'Active', 'Defaulter') AND deleted_at IS NULL";
        if ($branchId) $qOut .= " AND branch_id = " . (int)$branchId;
        $outstandingAmount = $db->query($qOut)->fetchColumn();

        // 9. Hand Cash Balance
        $summaryFunds = Fund::getSummary($db);
        $overallCash = $summaryFunds['overallCashBalance'];
        $availableLoanFund = $summaryFunds['availableLoanFund'];

        // 10. Branches count & Agents count
        $totalBranches = $db->query("SELECT COUNT(*) FROM branches WHERE deleted_at IS NULL")->fetchColumn();
        $totalAgents = $db->query("SELECT COUNT(*) FROM agents WHERE deleted_at IS NULL")->fetchColumn();

        // 11. Recent Collections
        $qRec = "
            SELECT 'Loan' as type, lc.receipt_no, lc.collected_amount as amount, c.full_name as customer_name, ag.name as agent_name, lc.created_at
            FROM loan_collections lc
            JOIN customers c ON lc.customer_id = c.id
            JOIN agents ag ON lc.agent_id = ag.id
            WHERE lc.is_reversal = 0
            
            UNION ALL
            
            SELECT 'Saving' as type, sd.receipt_no, sd.deposit_amount as amount, c.full_name as customer_name, ag.name as agent_name, sd.created_at
            FROM saving_deposits sd
            JOIN customers c ON sd.customer_id = c.id
            JOIN agents ag ON sd.agent_id = ag.id
            WHERE sd.is_reversal = 0
            
            ORDER BY created_at DESC LIMIT 5
        ";
        $recentCollections = $db->query($qRec)->fetchAll();

        // 12. Recent Registrations
        $qReg = "
            SELECT c.id, c.customer_code, c.full_name, c.mobile, c.created_at, b.name as branch_name
            FROM customers c
            JOIN branches b ON c.branch_id = b.id
            WHERE c.deleted_at IS NULL
            ORDER BY c.id DESC LIMIT 5
        ";
        $recentRegistrations = $db->query($qReg)->fetchAll();

        // 13. Active Loan rows (drill-down)
        $qActiveLoans = "
            SELECT la.loan_account_no, la.principal_amount, la.total_paid, la.outstanding_amount, c.full_name
            FROM loan_accounts la
            JOIN customers c ON la.customer_id = c.id
            WHERE la.account_status IN ('Approved','Active','Defaulter') AND la.deleted_at IS NULL
        ";
        if ($branchId) $qActiveLoans .= " AND la.branch_id = " . (int)$branchId;
        $qActiveLoans .= " ORDER BY la.id DESC LIMIT 10";
        $activeLoanRows = $db->query($qActiveLoans)->fetchAll();

        // 14. Active Saving rows
        $qActiveSavings = "
            SELECT sa.saving_account_no, sa.total_deposited, sa.interest_rate, sa.maturity_date, c.full_name, sp.name as plan_name
            FROM saving_accounts sa
            JOIN customers c ON sa.customer_id = c.id
            LEFT JOIN saving_plans sp ON sa.saving_plan_id = sp.id
            WHERE sa.account_status IN ('Approved','Active') AND sa.deleted_at IS NULL
        ";
        if ($branchId) $qActiveSavings .= " AND sa.branch_id = " . (int)$branchId;
        $qActiveSavings .= " ORDER BY sa.id DESC LIMIT 10";
        $activeSavingRows = $db->query($qActiveSavings)->fetchAll();

        // 15. Today's Due rows
        $qDueRows = "
            SELECT la.loan_account_no, (li.total_due - li.paid_amount) as due_amount, c.full_name, c.mobile, ag.name as agent_name
            FROM loan_installments li
            JOIN loan_accounts la ON li.loan_account_id = la.id
            JOIN customers c ON la.customer_id = c.id
            JOIN agents ag ON la.agent_id = ag.id
            WHERE li.due_date = CURRENT_DATE() AND li.status != 'Paid' AND la.account_status IN ('Approved','Active','Defaulter') AND la.deleted_at IS NULL
        ";
        if ($branchId) $qDueRows .= " AND la.branch_id = " . (int)$branchId;
        $qDueRows .= " ORDER BY due_amount DESC LIMIT 10";
        $todayDueRows = $db->query($qDueRows)->fetchAll();

        // 16. Today's Maturity rows
        $qMatRows = "
            SELECT sa.saving_account_no, sa.maturity_amount, c.full_name, sp.name as plan_name, sa.account_status
            FROM saving_accounts sa
            JOIN customers c ON sa.customer_id = c.id
            LEFT JOIN saving_plans sp ON sa.saving_plan_id = sp.id
            WHERE sa.maturity_date = CURRENT_DATE() AND sa.account_status IN ('Approved','Active') AND sa.deleted_at IS NULL
        ";
        if ($branchId) $qMatRows .= " AND sa.branch_id = " . (int)$branchId;
        $qMatRows .= " LIMIT 10";
        $todayMaturityRows = $db->query($qMatRows)->fetchAll();

        // 17. Outstanding rows (highest overdue)
        $qOutRows = "
            SELECT la.loan_account_no, la.outstanding_amount, c.full_name,
                   DATEDIFF(CURRENT_DATE(), MIN(li.due_date)) as overdue_days
            FROM loan_accounts la
            JOIN customers c ON la.customer_id = c.id
            LEFT JOIN loan_installments li ON li.loan_account_id = la.id AND li.status != 'Paid' AND li.due_date < CURRENT_DATE()
            WHERE la.account_status IN ('Approved','Active','Defaulter','NPA') AND la.deleted_at IS NULL AND la.outstanding_amount > 0
        ";
        if ($branchId) $qOutRows .= " AND la.branch_id = " . (int)$branchId;
        $qOutRows .= " GROUP BY la.id ORDER BY la.outstanding_amount DESC LIMIT 10";
        $outstandingRows = $db->query($qOutRows)->fetchAll();

        // 18. Cash Book rows (recent ledger entries)
        $qCashRows = "
            SELECT entry_date, entry_type, description, reference_no, amount
            FROM cash_book
            ORDER BY id DESC LIMIT 10
        ";
        $cashBookRows = $db->query($qCashRows)->fetchAll();

        // 19. Loan Fund / Capital pool entries
        $qFundRows = "
            SELECT ce.entry_date, ce.entry_type, ce.description, ce.transaction_no, ce.amount, fs.source_name
            FROM capital_entries ce
            LEFT JOIN fund_sources fs ON ce.fund_source_id = fs.id
            ORDER BY ce.id DESC LIMIT 10
        ";
        $fundEntryRows = $db->query($qFundRows)->fetchAll();

        // 20. Weekly Collection Trend (last 7 days)
        $qTrend = "
            SELECT DATE(d.day) as day, COALESCE(SUM(amt), 0) as total
            FROM (
                SELECT CURRENT_DATE() - INTERVAL n DAY as day
                FROM (SELECT 0 AS n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6) days
            ) d
            LEFT JOIN (
                SELECT collection_date as cd, collected_amount as amt FROM loan_collections WHERE is_reversal = 0
                UNION ALL
                SELECT deposit_date as cd, deposit_amount as amt FROM saving_deposits WHERE is_reversal = 0
            ) c ON c.cd = d.day
            GROUP BY d.day
            ORDER BY d.day ASC
        ";
        $collectionTrend = $db->query($qTrend)->fetchAll();

        // 21. Portfolio split (Loan vs Saving outstanding)
        $totalLoanPortfolio = (float)$db->query("SELECT COALESCE(SUM(outstanding_amount), 0) FROM loan_accounts WHERE account_status IN ('Approved','Active','Defaulter','NPA') AND deleted_at IS NULL")->fetchColumn();
        $totalSavingPortfolio = (float)$db->query("SELECT COALESCE(SUM(total_deposited), 0) FROM saving_accounts WHERE account_status IN ('Approved','Active') AND deleted_at IS NULL")->fetchColumn();

        Response::success([
            'total_customers' => (int)$totalCustomers,
            'active_loans' => (int)$activeLoans,
            'loan_value' => (float)$loanValue,
            'active_savings' => (int)$activeSavings,
            'saving_value' => (float)$savingValue,
            'today_collection' => (float)$todayCollection,
            'monthly_collection' => (float)$monthlyCollection,
            'today_due' => (float)$todayDue,
            'today_maturity' => (int)$todayMaturity,
            'outstanding_amount' => (float)$outstandingAmount,
            'overall_cash_balance' => (float)$overallCash,
            'available_loan_fund' => (float)$availableLoanFund,
            'total_branches' => (int)$totalBranches,
            'total_agents' => (int)$totalAgents,
            'recent_collections' => $recentCollections,
            'recent_registrations' => $recentRegistrations,
            'active_loan_rows' => $activeLoanRows,
            'active_saving_rows' => $activeSavingRows,
            'today_due_rows' => $todayDueRows,
            'today_maturity_rows' => $todayMaturityRows,
            'outstanding_rows' => $outstandingRows,
            'cash_book_rows' => $cashBookRows,
            'fund_entry_rows' => $fundEntryRows,
            'collection_trend' => $collectionTrend,
            'portfolio_loan' => $totalLoanPortfolio,
            'portfolio_saving' => $totalSavingPortfolio
        ]);
    }
}
?>

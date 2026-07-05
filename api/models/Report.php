<?php
/**
 * Financial Reports Database Model
 */
class Report {

    public static function dailyCollection($db, $startDate, $endDate, $branchId = null, $agentId = null) {
        $whereL = ["lc.is_reversal = 0"];
        $bindL = [];
        if ($startDate) {
            $whereL[] = "lc.collection_date >= :start_date";
            $bindL['start_date'] = $startDate;
        }
        if ($endDate) {
            $whereL[] = "lc.collection_date <= :end_date";
            $bindL['end_date'] = $endDate;
        }
        if ($branchId) {
            $whereL[] = "lc.branch_id = :branch_id";
            $bindL['branch_id'] = $branchId;
        }
        if ($agentId) {
            $whereL[] = "lc.agent_id = :agent_id";
            $bindL['agent_id'] = $agentId;
        }
        $whereSqlL = implode(" AND ", $whereL);
        $stmtL = $db->prepare("
            SELECT lc.collection_date as Date, lc.created_at as SortKey,
            la.loan_account_no as AccountNo, c.full_name as CustomerName,
            lc.collected_amount as AmountCollected, ag.name as AgentName, lc.payment_mode as PaymentMode,
            lc.receipt_no as ReceiptNo, lc.penalty_amount as PenaltyAmount, 'Loan' as type
            FROM loan_collections lc
            JOIN customers c ON lc.customer_id = c.id
            JOIN loan_accounts la ON lc.loan_account_id = la.id
            JOIN agents ag ON lc.agent_id = ag.id
            WHERE $whereSqlL
        ");
        $stmtL->execute($bindL);
        $loans = $stmtL->fetchAll();

        $whereS = ["sd.is_reversal = 0"];
        $bindS = [];
        if ($startDate) {
            $whereS[] = "sd.deposit_date >= :start_date";
            $bindS['start_date'] = $startDate;
        }
        if ($endDate) {
            $whereS[] = "sd.deposit_date <= :end_date";
            $bindS['end_date'] = $endDate;
        }
        if ($branchId) {
            $whereS[] = "sd.branch_id = :branch_id";
            $bindS['branch_id'] = $branchId;
        }
        if ($agentId) {
            $whereS[] = "sd.agent_id = :agent_id";
            $bindS['agent_id'] = $agentId;
        }
        $whereSqlS = implode(" AND ", $whereS);
        $stmtS = $db->prepare("
            SELECT sd.deposit_date as Date, sd.created_at as SortKey,
            sa.saving_account_no as AccountNo, c.full_name as CustomerName,
            sd.deposit_amount as AmountCollected, ag.name as AgentName, sd.payment_mode as PaymentMode,
            sd.receipt_no as ReceiptNo, 0 as PenaltyAmount, 'Saving' as type
            FROM saving_deposits sd
            JOIN customers c ON sd.customer_id = c.id
            JOIN saving_accounts sa ON sd.saving_account_id = sa.id
            JOIN agents ag ON sd.agent_id = ag.id
            WHERE $whereSqlS
        ");
        $stmtS->execute($bindS);
        $savings = $stmtS->fetchAll();

        $merged = array_merge($loans, $savings);
        // Newest first using full created_at timestamp
        usort($merged, function($a, $b) {
            return strcmp($b['SortKey'] ?? $b['Date'], $a['SortKey'] ?? $a['Date']);
        });
        // Drop helper SortKey from response
        $merged = array_map(function($row) {
            unset($row['SortKey']);
            return $row;
        }, $merged);

        return $merged;
    }

    public static function branchWise($db, $startDate = null, $endDate = null) {
        $stmt = $db->prepare("
            SELECT b.code as BranchCode, b.name as BranchName, b.city as City,
            (SELECT COUNT(*) FROM customers WHERE branch_id = b.id AND deleted_at IS NULL) as TotalCustomers,
            (SELECT COALESCE(SUM(principal_amount), 0) FROM loan_accounts WHERE branch_id = b.id AND account_status NOT IN ('Processing', 'Rejected') AND deleted_at IS NULL) as DisbursedLoans,
            (SELECT COALESCE(SUM(total_deposited), 0) FROM saving_accounts WHERE branch_id = b.id AND deleted_at IS NULL) as TotalSavings,
            (SELECT COALESCE(SUM(collected_amount), 0) FROM loan_collections WHERE branch_id = b.id AND is_reversal = 0) as LoanCollections
            FROM branches b
            WHERE b.deleted_at IS NULL
        ");
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function agentWise($db, $startDate = null, $endDate = null) {
        // For each agent, compute:
        //   TargetCollection = SUM of total_due across installments due today or earlier (loan + saving)
        //   ActualCollected  = SUM of collections / deposits actually paid
        //   PerformanceRate  = ActualCollected / TargetCollection * 100 (capped at 100%)
        $stmt = $db->prepare("
            SELECT ag.code as AgentCode, ag.name as AgentName, ar.name as AreaName,
            b.name as BranchName,
            CURRENT_DATE() as LogDate,
            (SELECT COUNT(*) FROM customers WHERE agent_id = ag.id AND deleted_at IS NULL) as AssignedCustomers,
            (
                (SELECT COALESCE(SUM(li.total_due), 0)
                    FROM loan_installments li
                    JOIN loan_accounts la ON li.loan_account_id = la.id
                    WHERE la.agent_id = ag.id AND li.due_date <= CURRENT_DATE() AND la.deleted_at IS NULL)
                +
                (SELECT COALESCE(SUM(si.total_due), 0)
                    FROM saving_installments si
                    JOIN saving_accounts sa ON si.saving_account_id = sa.id
                    WHERE sa.agent_id = ag.id AND si.due_date <= CURRENT_DATE() AND sa.deleted_at IS NULL)
            ) as TargetCollection,
            (
                (SELECT COALESCE(SUM(collected_amount), 0) FROM loan_collections WHERE agent_id = ag.id AND is_reversal = 0)
                +
                (SELECT COALESCE(SUM(deposit_amount), 0) FROM saving_deposits WHERE agent_id = ag.id AND is_reversal = 0)
            ) as ActualCollected
            FROM agents ag
            JOIN areas ar ON ag.area_id = ar.id
            JOIN branches b ON ag.branch_id = b.id
            WHERE ag.deleted_at IS NULL
        ");
        $stmt->execute();
        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $target = (float)$row['TargetCollection'];
            $actual = (float)$row['ActualCollected'];
            $rate = $target > 0 ? min(100, ($actual / $target) * 100) : ($actual > 0 ? 100 : 0);
            $row['PerformanceRate'] = number_format($rate, 1) . '%';
        }
        return $rows;
    }

    public static function cashBook($db, $startDate = null, $endDate = null, $branchId = null) {
        // Cash book ab fund_loan_history + fund_saving_history se banta hai
        // (fund pools global hain — branch filter yahan lagoo nahi hota).
        // Internal transfers ki twin credit/debit entries running balance me
        // net-zero hoti hain — overall cash sahi rehta hai.
        // Date filter/sort created_at par chalta hai (entry kab BANI) —
        // entry_date backdated ho sakti hai (jaise purani approved_date wala
        // loan disbursal), jisse wo month-filter se gayab ho jati thi aur
        // running-balance ka order bhi bigad jata tha.
        $where = ["1=1"];
        $bind = [];

        if ($startDate) {
            $where[] = "DATE(created_at) >= :start_date";
            $bind['start_date'] = $startDate;
        }
        if ($endDate) {
            $where[] = "DATE(created_at) <= :end_date";
            $bind['end_date'] = $endDate;
        }

        $whereSql = implode(" AND ", $where);

        $stmt = $db->prepare("
            SELECT * FROM (
                SELECT h.id, h.entry_date, h.entry_type, h.category, h.description,
                       COALESCE(h.reference_no, h.transaction_no) AS ref_no, h.amount,
                       h.balance_before, h.balance_after, h.created_at, 'Loan Fund' AS fund_side
                FROM fund_loan_history h
                UNION ALL
                SELECT h.id, h.entry_date, h.entry_type, h.category, h.description,
                       COALESCE(h.reference_no, h.transaction_no) AS ref_no, h.amount,
                       h.balance_before, h.balance_after, h.created_at, 'Saving Fund' AS fund_side
                FROM fund_saving_history h
            ) t
            WHERE $whereSql
            ORDER BY created_at ASC, id ASC
        ");
        $stmt->execute($bind);
        $raw = $stmt->fetchAll();

        $rows = [];
        foreach ($raw as $r) {
            $rows[] = [
                'id' => $r['id'],
                'Date' => substr($r['created_at'], 0, 10),
                'Type' => $r['entry_type'],
                'FundType' => $r['fund_side'],
                'Category' => $r['category'],
                'Particulars' => $r['description'],
                'RefNo' => $r['ref_no'],
                'Amount' => $r['amount'],
                'BranchId' => null,
                'BalanceBefore' => number_format((float)$r['balance_before'], 2, '.', ''),
                'Balance' => number_format((float)$r['balance_after'], 2, '.', '')
            ];
        }
        // Show latest first
        return array_reverse($rows);
    }

    public static function branchWiseLive($db) {
        // Branch metrics with live values (collections, dues, outstanding)
        $stmt = $db->prepare("
            SELECT b.id, b.code as BranchCode, b.name as BranchName, b.city as City,
            (SELECT COUNT(*) FROM customers WHERE branch_id = b.id AND deleted_at IS NULL) as TotalCustomers,
            (SELECT COALESCE(SUM(principal_amount), 0) FROM loan_accounts WHERE branch_id = b.id AND account_status NOT IN ('Processing','Rejected') AND deleted_at IS NULL) as DisbursedLoans,
            (SELECT COALESCE(SUM(outstanding_amount), 0) FROM loan_accounts WHERE branch_id = b.id AND account_status NOT IN ('Processing','Rejected','Closed') AND deleted_at IS NULL) as OutstandingLoans,
            (SELECT COALESCE(SUM(total_deposited), 0) FROM saving_accounts WHERE branch_id = b.id AND deleted_at IS NULL) as TotalSavings,
            (SELECT COALESCE(SUM(collected_amount), 0) FROM loan_collections WHERE branch_id = b.id AND is_reversal = 0) as LoanCollections,
            (SELECT COALESCE(SUM(deposit_amount), 0) FROM saving_deposits WHERE branch_id = b.id AND is_reversal = 0) as SavingsCollections
            FROM branches b
            WHERE b.deleted_at IS NULL
        ");
        $stmt->execute();
        return $stmt->fetchAll();
    }
}

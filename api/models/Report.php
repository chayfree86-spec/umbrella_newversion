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
        $where = ["1=1"];
        $bind = [];

        if ($startDate) {
            $where[] = "entry_date >= :start_date";
            $bind['start_date'] = $startDate;
        }
        if ($endDate) {
            $where[] = "entry_date <= :end_date";
            $bind['end_date'] = $endDate;
        }
        if ($branchId) {
            $where[] = "branch_id = :branch_id";
            $bind['branch_id'] = $branchId;
        }

        $whereSql = implode(" AND ", $where);
        // Recompute a global running balance (ignoring stored balance_after which is per-branch)
        // so the report shows a coherent running total across the filtered window.
        $stmt = $db->prepare("
            SELECT id, entry_date as Date, entry_type as Type, category as Category,
            description as Particulars, reference_no as RefNo, amount as Amount, branch_id as BranchId
            FROM cash_book
            WHERE $whereSql
            ORDER BY entry_date ASC, id ASC
        ");
        $stmt->execute($bind);
        $rows = $stmt->fetchAll();

        $running = 0;
        foreach ($rows as &$r) {
            $amt = (float)$r['Amount'];
            $running += strtolower($r['Type']) === 'credit' ? $amt : -$amt;
            $r['Balance'] = number_format($running, 2, '.', '');
        }
        // Show latest first
        $rows = array_reverse($rows);
        return $rows;
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

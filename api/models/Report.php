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
            SELECT lc.collection_date as Date, la.loan_account_no as AccountNo, c.full_name as CustomerName,
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
            SELECT sd.deposit_date as Date, sa.saving_account_no as AccountNo, c.full_name as CustomerName,
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
        usort($merged, function($a, $b) {
            return strcmp($b['Date'], $a['Date']);
        });

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
        $stmt = $db->prepare("
            SELECT ag.code as AgentCode, ag.name as AgentName, ar.name as AreaName,
            (SELECT COUNT(*) FROM customers WHERE agent_id = ag.id AND deleted_at IS NULL) as AssignedCustomers,
            (SELECT COALESCE(SUM(collected_amount), 0) FROM loan_collections WHERE agent_id = ag.id AND is_reversal = 0) + 
            (SELECT COALESCE(SUM(deposit_amount), 0) FROM saving_deposits WHERE agent_id = ag.id AND is_reversal = 0) as ActualCollected,
            '95.2%' as PerformanceRate
            FROM agents ag
            JOIN areas ar ON ag.area_id = ar.id
            WHERE ag.deleted_at IS NULL
        ");
        $stmt->execute();
        return $stmt->fetchAll();
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
        $stmt = $db->prepare("
            SELECT entry_date as Date, entry_type as Type, category as Category, 
            description as Particulars, reference_no as RefNo, amount as Amount, balance_after as Balance
            FROM cash_book
            WHERE $whereSql
            ORDER BY id DESC
        ");
        $stmt->execute($bind);
        return $stmt->fetchAll();
    }
}

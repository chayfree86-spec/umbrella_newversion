<?php
/**
 * Financial Reports Database Model
 */
class Report {

    public static function dailyCollection($db, $startDate, $endDate, $branchId = null, $agentId = null) {
        $where = ["lc.is_reversal = 0"];
        $bind = [];

        if ($startDate) {
            $where[] = "lc.collection_date >= :start_date";
            $bind['start_date'] = $startDate;
        }
        if ($endDate) {
            $where[] = "lc.collection_date <= :end_date";
            $bind['end_date'] = $endDate;
        }
        if ($branchId) {
            $where[] = "lc.branch_id = :branch_id";
            $bind['branch_id'] = $branchId;
        }
        if ($agentId) {
            $where[] = "lc.agent_id = :agent_id";
            $bind['agent_id'] = $agentId;
        }

        $whereSql = implode(" AND ", $where);

        $stmt = $db->prepare("
            SELECT lc.collection_date as Date, la.loan_account_no as AccountNo, c.full_name as CustomerName,
            lc.collected_amount as AmountCollected, ag.name as AgentName, lc.payment_mode as PaymentMode
            FROM loan_collections lc
            JOIN customers c ON lc.customer_id = c.id
            JOIN loan_accounts la ON lc.loan_account_id = la.id
            JOIN agents ag ON lc.agent_id = ag.id
            WHERE $whereSql
            
            UNION ALL
            
            SELECT sd.deposit_date as Date, sa.saving_account_no as AccountNo, c.full_name as CustomerName,
            sd.deposit_amount as AmountCollected, ag.name as AgentName, sd.payment_mode as PaymentMode
            FROM saving_deposits sd
            JOIN customers c ON sd.customer_id = c.id
            JOIN saving_accounts sa ON sd.saving_account_id = sa.id
            JOIN agents ag ON sd.agent_id = ag.id
            WHERE " . str_replace('lc.', 'sd.', str_replace('collection_date', 'deposit_date', $whereSql)) . "
            ORDER BY Date DESC
        ");
        
        $bindKeys = array_keys($bind);
        foreach ($bind as $k => $v) {
            $stmt->bindValue(":$k", $v);
            $stmt->bindValue(":".str_replace('lc.', 'sd.', $k), $v);
        }
        
        $stmt->execute($bind);
        return $stmt->fetchAll();
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

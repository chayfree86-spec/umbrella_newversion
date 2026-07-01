<?php
/**
 * Reports API Controller
 */
class ReportController {

    public static function dailyCollection($db, $authUser) {
        $startDate = $_GET['start_date'] ?? null;
        $endDate = $_GET['end_date'] ?? null;
        $branchId = $_GET['branch_id'] ?? null;
        $agentId = $_GET['agent_id'] ?? null;

        if ($authUser['role_slug'] === 'agent') {
            $agentId = $authUser['agent_id'];
        }

        $data = Report::dailyCollection($db, $startDate, $endDate, $branchId, $agentId);
        Response::success($data);
    }

    public static function branchWise($db, $authUser) {
        $data = Report::branchWiseLive($db);
        Response::success($data);
    }

    public static function areaWise($db, $authUser) {
        // Simple area aggregation
        $stmt = $db->prepare("
            SELECT a.code as AreaCode, a.name as AreaName, b.name as BranchName,
            (SELECT COUNT(*) FROM customers WHERE area_id = a.id AND deleted_at IS NULL) as TotalCustomers,
            (SELECT COUNT(*) FROM agents WHERE area_id = a.id AND deleted_at IS NULL) as TotalAgents
            FROM areas a
            JOIN branches b ON a.branch_id = b.id
            WHERE a.deleted_at IS NULL
        ");
        $stmt->execute();
        $data = $stmt->fetchAll();
        Response::success($data);
    }

    public static function agentWise($db, $authUser) {
        $data = Report::agentWise($db);
        Response::success($data);
    }

    public static function loan($db, $authUser) {
        $branchId = $_GET['branch_id'] ?? null;
        $bind = [];
        $where = ["la.deleted_at IS NULL"];
        if ($authUser['role_slug'] === 'branch_manager') {
            $where[] = "la.branch_id = :branch_id";
            $bind['branch_id'] = $authUser['branch_id'];
        } elseif ($branchId) {
            $where[] = "la.branch_id = :branch_id";
            $bind['branch_id'] = $branchId;
        }
        $whereSql = implode(" AND ", $where);

        $stmt = $db->prepare("
            SELECT la.loan_account_no as AccountNo, c.full_name as CustomerName,
            la.start_date as DisbursalDate, la.principal_amount as ApprovedAmount,
            la.total_paid as PaidPrincipal, la.outstanding_amount as OutstandingBalance,
            la.interest_amount as InterestAmount,
            (SELECT COALESCE(SUM(interest_amount), 0) FROM loan_collections WHERE loan_account_id = la.id AND is_reversal = 0) as InterestCollected,
            (SELECT COALESCE(SUM(li.interest_component * (1 - li.paid_amount / li.total_due)), 0)
                FROM loan_installments li
                WHERE li.loan_account_id = la.id AND li.due_date <= CURRENT_DATE() AND li.status != 'Paid'
            ) as InterestOverdue,
            CONCAT(la.plan_name, ' (', la.interest_rate, '% ', la.interest_type, ')') as LoanPlan,
            la.account_status as Status,
            b.name as BranchName
            FROM loan_accounts la
            JOIN customers c ON la.customer_id = c.id
            LEFT JOIN loan_plans lp ON la.loan_plan_id = lp.id
            JOIN branches b ON la.branch_id = b.id
            WHERE $whereSql
            ORDER BY la.id DESC
        ");
        $stmt->execute($bind);
        $data = $stmt->fetchAll();
        Response::success($data);
    }

    public static function saving($db, $authUser) {
        $branchId = $_GET['branch_id'] ?? null;
        $bind = [];
        $where = ["sa.deleted_at IS NULL"];
        if ($authUser['role_slug'] === 'branch_manager') {
            $where[] = "sa.branch_id = :branch_id";
            $bind['branch_id'] = $authUser['branch_id'];
        } elseif ($branchId) {
            $where[] = "sa.branch_id = :branch_id";
            $bind['branch_id'] = $branchId;
        }
        $whereSql = implode(" AND ", $where);

        $stmt = $db->prepare("
            SELECT sa.saving_account_no as AccountNo, c.full_name as CustomerName,
            sa.total_deposited as DepositedAmount,
            sa.interest_rate as InterestRate,
            sa.start_date as StartDate, sa.maturity_date as MaturityDate,
            sa.maturity_amount as MaturityValue,
            CONCAT(sa.plan_name, ' (', sa.interest_rate, '%)') as PlanDetails,
            sa.plan_name as PlanName,
            ROUND(sa.total_deposited * sa.interest_rate / 100, 2) as InterestPaid,
            ROUND(sa.total_deposited + (sa.total_deposited * sa.interest_rate / 100), 2) as NetBalance,
            sa.account_status as Status,
            b.name as BranchName,
            COALESCE((SELECT MAX(deposit_date) FROM saving_deposits WHERE saving_account_id = sa.id AND is_reversal = 0), sa.start_date) as LastDepositDate
            FROM saving_accounts sa
            JOIN customers c ON sa.customer_id = c.id
            LEFT JOIN saving_plans sp ON sa.saving_plan_id = sp.id
            JOIN branches b ON sa.branch_id = b.id
            WHERE $whereSql
            ORDER BY sa.id DESC
        ");
        $stmt->execute($bind);
        $data = $stmt->fetchAll();
        Response::success($data);
    }

    public static function due($db, $authUser) {
        $date = $_GET['date'] ?? date('Y-m-d');
        
        $stmt = $db->prepare("
            SELECT la.loan_account_no as AccountNo, c.full_name as CustomerName,
            (SELECT SUM(total_due - paid_amount) FROM loan_installments WHERE loan_account_id = la.id AND due_date <= :date) as OverdueAmount,
            (SELECT MIN(due_date) FROM loan_installments WHERE loan_account_id = la.id AND status != 'Paid') as OverdueSince,
            ag.name as AgentName
            FROM loan_accounts la
            JOIN customers c ON la.customer_id = c.id
            JOIN agents ag ON la.agent_id = ag.id
            WHERE la.account_status IN ('Approved', 'Active', 'Defaulter') AND la.deleted_at IS NULL
        ");
        $stmt->execute(['date' => $date]);
        $rows = $stmt->fetchAll();
        
        // Filter those with overdue amount > 0
        $data = [];
        foreach ($rows as $row) {
            if ($row['OverdueAmount'] > 0) {
                $days = (time() - strtotime($row['OverdueSince'])) / 86400;
                $row['OverdueDays'] = round(max(0, $days));
                $data[] = $row;
            }
        }
        Response::success($data);
    }

    public static function maturity($db, $authUser) {
        $branchId = $_GET['branch_id'] ?? null;
        $bind = [];
        $where = ["sa.deleted_at IS NULL", "sa.maturity_date IS NOT NULL", "sa.account_status IN ('Active', 'Approved', 'Matured', 'Closed')"];
        if ($authUser['role_slug'] === 'branch_manager') {
            $where[] = "sa.branch_id = :branch_id";
            $bind['branch_id'] = $authUser['branch_id'];
        } elseif ($branchId) {
            $where[] = "sa.branch_id = :branch_id";
            $bind['branch_id'] = $branchId;
        }
        $whereSql = implode(" AND ", $where);

        // Include all accounts with a maturity_date — Matured/Closed and upcoming
        $stmt = $db->prepare("
            SELECT sa.saving_account_no as AccountNo, c.full_name as CustomerName,
            sa.maturity_date as MaturityDate,
            sa.maturity_amount as MaturityValue,
            sa.total_deposited as TotalDeposited,
            sa.plan_name as PlanName,
            CASE
                WHEN sa.account_status = 'Processing' THEN 'Processing'
                WHEN sa.account_status = 'Approved' THEN 'Approved'
                WHEN sa.account_status = 'Rejected' THEN 'Rejected'
                WHEN sa.account_status = 'Matured' THEN 'Completed'
                WHEN sa.account_status = 'Closed' THEN 'Closed'
                WHEN sa.maturity_date <= CURRENT_DATE() THEN 'Pending Pay Out'
                ELSE 'Active Account'
            END as Status,
            b.name as BranchName
            FROM saving_accounts sa
            JOIN customers c ON sa.customer_id = c.id
            LEFT JOIN saving_plans sp ON sa.saving_plan_id = sp.id
            JOIN branches b ON sa.branch_id = b.id
            WHERE $whereSql
            ORDER BY sa.id DESC
        ");
        $stmt->execute($bind);
        $data = $stmt->fetchAll();
        Response::success($data);
    }

    public static function customerLedger($db, $authUser) {
        $customerId = $_GET['customer_id'] ?? null;
        if (!$customerId) {
            Response::error('Customer ID required.', 422);
        }

        $stmt = $db->prepare("
            SELECT receipt_no as RefNo, receipt_type as Type, created_at as Date, 
            amount as Amount, payment_mode as Mode, account_no as AccountNo
            FROM receipts
            WHERE customer_id = :cust_id
            ORDER BY id DESC
        ");
        $stmt->execute(['cust_id' => $customerId]);
        $data = $stmt->fetchAll();
        Response::success($data);
    }

    public static function cashBook($db, $authUser) {
        $startDate = $_GET['start_date'] ?? null;
        $endDate = $_GET['end_date'] ?? null;
        $branchId = $_GET['branch_id'] ?? null;

        if ($authUser['role_slug'] === 'branch_manager') {
            $branchId = $authUser['branch_id'];
        }

        $data = Report::cashBook($db, $startDate, $endDate, $branchId);
        Response::success($data);
    }
}
?>

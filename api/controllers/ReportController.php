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
        $data = Report::branchWise($db);
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
        // Detailed loan accounts report
        $stmt = $db->prepare("
            SELECT la.loan_account_no as AccountNo, c.full_name as CustomerName,
            la.principal_amount as ApprovedAmount, la.total_paid as PaidPrincipal,
            la.outstanding_amount as OutstandingBalance, la.account_status as Status
            FROM loan_accounts la
            JOIN customers c ON la.customer_id = c.id
            WHERE la.deleted_at IS NULL
        ");
        $stmt->execute();
        $data = $stmt->fetchAll();
        Response::success($data);
    }

    public static function saving($db, $authUser) {
        // Detailed saving accounts report
        $stmt = $db->prepare("
            SELECT sa.saving_account_no as AccountNo, c.full_name as CustomerName,
            sa.total_deposited as DepositedAmount, sa.interest_rate as InterestRate,
            sa.maturity_date as MaturityDate, sa.account_status as Status
            FROM saving_accounts sa
            JOIN customers c ON sa.customer_id = c.id
            WHERE sa.deleted_at IS NULL
        ");
        $stmt->execute();
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
        $stmt = $db->prepare("
            SELECT sa.saving_account_no as AccountNo, c.full_name as CustomerName,
            sa.maturity_amount as MaturityValue, sp.name as PlanName, sa.account_status as Status
            FROM saving_accounts sa
            JOIN customers c ON sa.customer_id = c.id
            JOIN saving_plans sp ON sa.saving_plan_id = sp.id
            WHERE sa.account_status = 'Matured' AND sa.deleted_at IS NULL
        ");
        $stmt->execute();
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

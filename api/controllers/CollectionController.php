<?php
/**
 * Daily Collections and Receipts Controller
 */
class CollectionController {

    public static function today($db, $authUser) {
        $branchId = $_GET['branch_id'] ?? null;
        $agentId = $_GET['agent_id'] ?? null;
        $date = $_GET['date'] ?? date('Y-m-d');

        if ($authUser['role_slug'] === 'agent') {
            $agentId = $authUser['agent_id'];
        }

        $bind = ['date' => $date];
        $whereSql = "WHERE lc.collection_date = :date AND lc.is_reversal = 0";

        if ($branchId) {
            $whereSql .= " AND lc.branch_id = :branch_id";
            $bind['branch_id'] = $branchId;
        }
        if ($agentId) {
            $whereSql .= " AND lc.agent_id = :agent_id";
            $bind['agent_id'] = $agentId;
        }

        // Loan Collections
        $stmtLoans = $db->prepare("
            SELECT lc.*, c.full_name as customer_name, la.loan_account_no as account_no, 'Loan' as account_type, u.name as collector_name
            FROM loan_collections lc
            JOIN customers c ON lc.customer_id = c.id
            JOIN loan_accounts la ON lc.loan_account_id = la.id
            JOIN users u ON lc.collected_by = u.id
            $whereSql
        ");
        $stmtLoans->execute($bind);
        $loans = $stmtLoans->fetchAll();

        // Savings Deposits
        $whereSqlSavings = str_replace('lc.', 'sd.', $whereSql);
        $whereSqlSavings = str_replace('collection_date', 'deposit_date', $whereSqlSavings);

        $stmtSavings = $db->prepare("
            SELECT sd.*, c.full_name as customer_name, sa.saving_account_no as account_no, 'Saving' as account_type, u.name as collector_name
            FROM saving_deposits sd
            JOIN customers c ON sd.customer_id = c.id
            JOIN saving_accounts sa ON sd.saving_account_id = sa.id
            JOIN users u ON sd.collected_by = u.id
            $whereSqlSavings
        ");
        $stmtSavings->execute($bind);
        $savings = $stmtSavings->fetchAll();

        // Combine
        $list = [];
        foreach ($loans as $l) {
            $list[] = [
                'id' => 'L-' . $l['id'],
                'receipt_no' => $l['receipt_no'],
                'account_no' => $l['account_no'],
                'customer_name' => $l['customer_name'],
                'account_type' => 'Loan',
                'amount' => $l['collected_amount'],
                'penalty' => $l['penalty_amount'],
                'payment_mode' => $l['payment_mode'],
                'collector' => $l['collector_name'],
                'date' => $l['collection_date']
            ];
        }
        foreach ($savings as $s) {
            $list[] = [
                'id' => 'S-' . $s['id'],
                'receipt_no' => $s['receipt_no'],
                'account_no' => $s['account_no'],
                'customer_name' => $s['customer_name'],
                'account_type' => 'Saving',
                'amount' => $s['deposit_amount'],
                'penalty' => 0,
                'payment_mode' => $s['payment_mode'],
                'collector' => $s['collector_name'],
                'date' => $s['deposit_date']
            ];
        }

        Response::success($list);
    }

    public static function due($db, $authUser) {
        $branchId = $_GET['branch_id'] ?? null;
        $agentId = $_GET['agent_id'] ?? null;
        $date = $_GET['date'] ?? date('Y-m-d');

        if ($authUser['role_slug'] === 'agent') {
            $agentId = $authUser['agent_id'];
        }

        $bind = ['date' => $date];
        $where = ["la.account_status IN ('Approved', 'Active', 'Defaulter')"];

        if ($branchId) {
            $where[] = "la.branch_id = :branch_id";
            $bind['branch_id'] = $branchId;
        }
        if ($agentId) {
            $where[] = "la.agent_id = :agent_id";
            $bind['agent_id'] = $agentId;
        }

        $whereSql = implode(" AND ", $where);

        // Fetch accounts that have installments due on or before today and paid_amount < total_due
        $stmt = $db->prepare("
            SELECT DISTINCT la.id, la.loan_account_no, la.emi_amount, c.full_name as customer_name, c.mobile as customer_mobile,
            ag.name as agent_name,
            (SELECT SUM(total_due - paid_amount) FROM loan_installments WHERE loan_account_id = la.id AND due_date <= :date) as pending_due
            FROM loan_accounts la
            JOIN customers c ON la.customer_id = c.id
            JOIN agents ag ON la.agent_id = ag.id
            JOIN loan_installments li ON li.loan_account_id = la.id
            WHERE $whereSql AND li.due_date <= :date2 AND li.status != 'Paid'
        ");
        $bind['date2'] = $date;
        $stmt->execute($bind);
        $dues = $stmt->fetchAll();

        // Format
        $list = [];
        foreach ($dues as $d) {
            if ($d['pending_due'] > 0) {
                $list[] = [
                    'account_no' => $d['loan_account_no'],
                    'customer_name' => $d['customer_name'],
                    'mobile' => $d['customer_mobile'],
                    'due_amount' => $d['pending_due'],
                    'emi_amount' => $d['emi_amount'],
                    'agent_name' => $d['agent_name']
                ];
            }
        }

        Response::success($list);
    }

    public static function byAgent($db, $authUser, $agentId) {
        // Fetch accounts assigned to specific agent for daily collection checklist
        $stmt = $db->prepare("
            SELECT la.id, la.loan_account_no as accNo, 'Loan' as type, la.emi_amount as emiAmt,
            la.outstanding_amount as outstanding, c.full_name as customer_name, c.mobile as phone,
            b.name as branch, ar.name as area, ag.name as agent,
            (SELECT COUNT(*) FROM loan_collections WHERE loan_account_id = la.id AND collection_date = CURRENT_DATE() AND is_reversal = 0) as today_paid
            FROM loan_accounts la
            JOIN customers c ON la.customer_id = c.id
            JOIN branches b ON la.branch_id = b.id
            JOIN areas ar ON la.area_id = ar.id
            JOIN agents ag ON la.agent_id = ag.id
            WHERE la.agent_id = :agent_id AND la.account_status IN ('Approved', 'Active', 'Defaulter') AND la.deleted_at IS NULL
            
            UNION ALL
            
            SELECT sa.id, sa.saving_account_no as accNo, 'Saving' as type, sa.deposit_amount as emiAmt,
            sa.total_deposited as outstanding, c.full_name as customer_name, c.mobile as phone,
            b.name as branch, ar.name as area, ag.name as agent,
            (SELECT COUNT(*) FROM saving_deposits WHERE saving_account_id = sa.id AND deposit_date = CURRENT_DATE() AND is_reversal = 0) as today_paid
            FROM saving_accounts sa
            JOIN customers c ON sa.customer_id = c.id
            JOIN branches b ON sa.branch_id = b.id
            JOIN areas ar ON sa.area_id = ar.id
            JOIN agents ag ON sa.agent_id = ag.id
            WHERE sa.agent_id = :agent_id2 AND sa.account_status IN ('Approved', 'Active') AND sa.deleted_at IS NULL
        ");
        $stmt->execute(['agent_id' => $agentId, 'agent_id2' => $agentId]);
        $rows = $stmt->fetchAll();

        // Format to match old React mock schema
        $list = [];
        foreach ($rows as $row) {
            $list[] = [
                'id' => $row['id'],
                'accNo' => $row['accNo'],
                'type' => $row['type'],
                'emiAmt' => (float)$row['emiAmt'],
                'outstanding' => (float)$row['outstanding'],
                'todayStatus' => $row['today_paid'] > 0 ? 'Paid' : 'Pending',
                'customer' => [
                    'name' => $row['customer_name'],
                    'phone' => $row['phone']
                ],
                'branch' => $row['branch'],
                'area' => $row['area'],
                'agent' => $row['agent']
            ];
        }

        Response::success($list);
    }

    public static function collectLoan($db, $authUser, $input) {
        $errors = Validator::required($input, ['account_no', 'collected_amount']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        $account = LoanAccount::getByAccountNo($db, $input['account_no']);
        if (!$account) {
            Response::error('Loan account not found.', 404);
        }

        $input['loan_account_id'] = $account['id'];
        $input['collected_by'] = $authUser['id'];

        try {
            $receiptNo = LoanCollection::collect($db, $input);
            Response::success(['receipt_no' => $receiptNo], 'Loan payment collected successfully.');
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public static function collectSaving($db, $authUser, $input) {
        $errors = Validator::required($input, ['account_no', 'deposit_amount']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        $account = SavingAccount::getByAccountNo($db, $input['account_no']);
        if (!$account) {
            Response::error('Savings account not found.', 404);
        }

        $input['saving_account_id'] = $account['id'];
        $input['collected_by'] = $authUser['id'];

        try {
            $receiptNo = SavingDeposit::deposit($db, $input);
            Response::success(['receipt_no' => $receiptNo], 'Savings deposit recorded successfully.');
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public static function history($db, $authUser) {
        [$page, $perPage, $offset] = Validator::getPaginationParams();

        $where = [];
        $bind = [];

        if ($authUser['role_slug'] === 'agent') {
            $where[] = "r.agent_id = :agent_id";
            $bind['agent_id'] = $authUser['agent_id'];
        }

        $whereSql = !empty($where) ? "WHERE " . implode(" AND ", $where) : "";

        // Total count
        $stmtCount = $db->prepare("SELECT COUNT(*) FROM receipts r $whereSql");
        $stmtCount->execute($bind);
        $total = $stmtCount->fetchColumn();

        // List
        $stmt = $db->prepare("
            SELECT r.*, c.full_name as customer_name, u.name as generated_name
            FROM receipts r
            LEFT JOIN customers c ON r.customer_id = c.id
            LEFT JOIN users u ON r.generated_by = u.id
            $whereSql
            ORDER BY r.id DESC
            LIMIT :limit OFFSET :offset
        ");
        $stmt->bindValue(':limit', (int)$perPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', (int)$offset, PDO::PARAM_INT);
        foreach ($bind as $key => $val) {
            $stmt->bindValue(":$key", $val);
        }
        $stmt->execute();
        $receipts = $stmt->fetchAll();

        Response::paginated($receipts, $total, $page, $perPage);
    }

    public static function receipt($db, $authUser, $receiptNo) {
        $stmt = $db->prepare("SELECT * FROM receipts WHERE receipt_no = :receipt_no");
        $stmt->execute(['receipt_no' => $receiptNo]);
        $receipt = $stmt->fetch();

        if (!$receipt) {
            Response::error('Receipt not found.', 404);
        }

        // Fetch detail based on type
        if ($receipt['receipt_type'] === 'loan_collection') {
            $stmtDet = $db->prepare("
                SELECT lc.*, c.full_name as customer_name, la.loan_account_no as account_no, u.name as collector_name,
                b.name as branch_name, ar.name as area_name
                FROM loan_collections lc
                JOIN customers c ON lc.customer_id = c.id
                JOIN loan_accounts la ON lc.loan_account_id = la.id
                JOIN users u ON lc.collected_by = u.id
                JOIN branches b ON lc.branch_id = b.id
                JOIN areas ar ON lc.area_id = ar.id
                WHERE lc.id = :id
            ");
            $stmtDet->execute(['id' => $receipt['reference_id']]);
            $detail = $stmtDet->fetch();
            $receipt['detail'] = $detail;
        } elseif ($receipt['receipt_type'] === 'saving_deposit') {
            $stmtDet = $db->prepare("
                SELECT sd.*, c.full_name as customer_name, sa.saving_account_no as account_no, u.name as collector_name,
                b.name as branch_name, ar.name as area_name
                FROM saving_deposits sd
                JOIN customers c ON sd.customer_id = c.id
                JOIN saving_accounts sa ON sd.saving_account_id = sa.id
                JOIN users u ON sd.collected_by = u.id
                JOIN branches b ON sd.branch_id = b.id
                JOIN areas ar ON sd.area_id = ar.id
                WHERE sd.id = :id
            ");
            $stmtDet->execute(['id' => $receipt['reference_id']]);
            $detail = $stmtDet->fetch();
            $receipt['detail'] = $detail;
        }

        Response::success($receipt);
    }
}
?>

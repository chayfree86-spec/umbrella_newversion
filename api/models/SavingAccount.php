<?php
/**
 * Saving Account Database Model
 */
class SavingAccount {

    public static function getAll($db, $params = []) {
        $where = ["sa.deleted_at IS NULL"];
        $bind = [];

        if (!empty($params['branch_id'])) {
            $where[] = "sa.branch_id = :branch_id";
            $bind['branch_id'] = $params['branch_id'];
        }
        if (!empty($params['area_id'])) {
            $where[] = "sa.area_id = :area_id";
            $bind['area_id'] = $params['area_id'];
        }
        if (!empty($params['agent_id'])) {
            $where[] = "sa.agent_id = :agent_id";
            $bind['agent_id'] = $params['agent_id'];
        }
        if (!empty($params['status'])) {
            $where[] = "sa.account_status = :status";
            $bind['status'] = $params['status'];
        }
        if (!empty($params['search'])) {
            $where[] = "(c.full_name LIKE :search OR c.mobile LIKE :search OR sa.saving_account_no LIKE :search)";
            $bind['search'] = "%" . $params['search'] . "%";
        }

        $whereSql = implode(" AND ", $where);
        
        $limit = $params['limit'] ?? DEFAULT_PAGE_SIZE;
        $offset = $params['offset'] ?? 0;

        $stmtCount = $db->prepare("
            SELECT COUNT(*) FROM saving_accounts sa
            JOIN customers c ON sa.customer_id = c.id
            WHERE $whereSql
        ");
        $stmtCount->execute($bind);
        $total = $stmtCount->fetchColumn();

        $stmt = $db->prepare("
            SELECT sa.*, c.full_name as customer_name, c.mobile as customer_mobile,
            b.name as branch_name, ar.name as area_name, ag.name as agent_name,
            sa.plan_name as plan_name,
            (SELECT MAX(sd.deposit_date) FROM saving_deposits sd WHERE sd.saving_account_id = sa.id AND sd.is_reversal = 0) as last_deposit_date,
            (SELECT COALESCE(SUM(si.total_due - si.paid_amount), 0)
                FROM saving_installments si
                WHERE si.saving_account_id = sa.id AND si.due_date <= CURRENT_DATE() AND si.status != 'Paid') as today_due,
            (SELECT MIN(si2.due_date) FROM saving_installments si2 WHERE si2.saving_account_id = sa.id AND si2.status != 'Paid') as next_due_date,
            (SELECT COUNT(*) FROM saving_installments si3 WHERE si3.saving_account_id = sa.id AND si3.status = 'Paid') as paid_installments,
            (SELECT COUNT(*) FROM saving_installments si4 WHERE si4.saving_account_id = sa.id) as total_installments
            FROM saving_accounts sa
            JOIN customers c ON sa.customer_id = c.id
            JOIN branches b ON sa.branch_id = b.id
            JOIN areas ar ON sa.area_id = ar.id
            JOIN agents ag ON sa.agent_id = ag.id
            LEFT JOIN saving_plans sp ON sa.saving_plan_id = sp.id
            WHERE $whereSql
            ORDER BY sa.id DESC
            LIMIT :limit OFFSET :offset
        ");

        $stmt->bindValue(':limit', (int)$limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', (int)$offset, PDO::PARAM_INT);
        foreach ($bind as $key => $val) {
            $stmt->bindValue(":$key", $val);
        }
        $stmt->execute();
        $data = $stmt->fetchAll();

        return [$data, $total];
    }

    public static function getById($db, $id) {
        $stmt = $db->prepare("
            SELECT sa.*, c.full_name as customer_name, c.mobile as customer_mobile,
            b.name as branch_name, ar.name as area_name, ag.name as agent_name,
            sa.plan_name as plan_name,
            (SELECT MAX(sd.deposit_date) FROM saving_deposits sd WHERE sd.saving_account_id = sa.id AND sd.is_reversal = 0) as last_deposit_date,
            (SELECT COALESCE(SUM(si.total_due - si.paid_amount), 0)
                FROM saving_installments si
                WHERE si.saving_account_id = sa.id AND si.due_date <= CURRENT_DATE() AND si.status != 'Paid') as today_due,
            (SELECT MIN(si2.due_date) FROM saving_installments si2 WHERE si2.saving_account_id = sa.id AND si2.status != 'Paid') as next_due_date,
            (SELECT COUNT(*) FROM saving_installments si3 WHERE si3.saving_account_id = sa.id AND si3.status = 'Paid') as paid_installments,
            (SELECT COUNT(*) FROM saving_installments si4 WHERE si4.saving_account_id = sa.id) as total_installments
            FROM saving_accounts sa
            JOIN customers c ON sa.customer_id = c.id
            JOIN branches b ON sa.branch_id = b.id
            JOIN areas ar ON sa.area_id = ar.id
            JOIN agents ag ON sa.agent_id = ag.id
            LEFT JOIN saving_plans sp ON sa.saving_plan_id = sp.id
            WHERE sa.id = :id AND sa.deleted_at IS NULL
        ");
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public static function getByAccountNo($db, $accNo) {
        $stmt = $db->prepare("
            SELECT sa.*, c.full_name as customer_name, c.mobile as customer_mobile,
            b.name as branch_name, ar.name as area_name, ag.name as agent_name,
            sa.plan_name as plan_name,
            (SELECT MAX(sd.deposit_date) FROM saving_deposits sd WHERE sd.saving_account_id = sa.id AND sd.is_reversal = 0) as last_deposit_date,
            (SELECT COALESCE(SUM(si.total_due - si.paid_amount), 0)
                FROM saving_installments si
                WHERE si.saving_account_id = sa.id AND si.due_date <= CURRENT_DATE() AND si.status != 'Paid') as today_due,
            (SELECT MIN(si2.due_date) FROM saving_installments si2 WHERE si2.saving_account_id = sa.id AND si2.status != 'Paid') as next_due_date,
            (SELECT COUNT(*) FROM saving_installments si3 WHERE si3.saving_account_id = sa.id AND si3.status = 'Paid') as paid_installments,
            (SELECT COUNT(*) FROM saving_installments si4 WHERE si4.saving_account_id = sa.id) as total_installments
            FROM saving_accounts sa
            JOIN customers c ON sa.customer_id = c.id
            JOIN branches b ON sa.branch_id = b.id
            JOIN areas ar ON sa.area_id = ar.id
            JOIN agents ag ON sa.agent_id = ag.id
            LEFT JOIN saving_plans sp ON sa.saving_plan_id = sp.id
            WHERE sa.saving_account_no = :acc_no AND sa.deleted_at IS NULL
        ");
        $stmt->execute(['acc_no' => $accNo]);
        return $stmt->fetch();
    }

    public static function create($db, $data) {
        $accNo = NumberGenerator::generate($db, PREFIX_SAVING);

        $planName = 'Custom Savings Plan';
        if (!empty($data['saving_plan_id'])) {
            $planStmt = $db->prepare("SELECT name FROM saving_plans WHERE id = :id");
            $planStmt->execute(['id' => $data['saving_plan_id']]);
            $resName = $planStmt->fetchColumn();
            if ($resName) {
                $planName = $resName;
            }
        }

        $stmt = $db->prepare("
            INSERT INTO saving_accounts (
                uuid, saving_account_no, customer_id, saving_plan_id, plan_name, branch_id, area_id, agent_id,
                deposit_amount, interest_rate, duration_months, maturity_amount, collection_frequency,
                total_deposited, start_date, maturity_date, account_status, created_by
            ) VALUES (
                :uuid, :saving_account_no, :customer_id, :saving_plan_id, :plan_name, :branch_id, :area_id, :agent_id,
                :deposit_amount, :interest_rate, :duration_months, :maturity_amount, :collection_frequency,
                0.00, :start_date, :maturity_date, :account_status, :created_by
            )
        ");
        
        $uuid = Validator::uuid();
        $stmt->execute([
            'uuid' => $uuid,
            'saving_account_no' => $accNo,
            'customer_id' => $data['customer_id'],
            'saving_plan_id' => $data['saving_plan_id'],
            'plan_name' => $planName,
            'branch_id' => $data['branch_id'],
            'area_id' => $data['area_id'],
            'agent_id' => $data['agent_id'],
            'deposit_amount' => $data['deposit_amount'] ?? 0.00,
            'interest_rate' => $data['interest_rate'] ?? 0.00,
            'duration_months' => $data['duration_months'] ?? 12,
            'maturity_amount' => $data['maturity_amount'] ?? 0.00,
            'collection_frequency' => $data['collection_frequency'] ?? 'Daily',
            'start_date' => $data['start_date'] ?? null,
            'maturity_date' => $data['maturity_date'] ?? null,
            'account_status' => $data['account_status'] ?? 'Processing',
            'created_by' => $data['created_by']
        ]);

        return $db->lastInsertId();
    }

    public static function getStatement($db, $savingAccountId) {
        $stmt = $db->prepare("
            SELECT sd.receipt_no as refNo, sd.deposit_date as date, 'Savings Deposit' as type,
            sd.deposit_amount as amt, 0.00 as fine, u.name as collector,
            sd.installment_allocations as allocations, sd.payment_mode as paymentMode, sd.remarks,
            sd.is_advance as isAdvance
            FROM saving_deposits sd
            JOIN users u ON sd.collected_by = u.id
            WHERE sd.saving_account_id = :saving_id AND sd.is_reversal = 0
            ORDER BY sd.id DESC
        ");
        $stmt->execute(['saving_id' => $savingAccountId]);
        return $stmt->fetchAll();
    }

    public static function getInstallments($db, $savingAccountId) {
        $stmt = $db->prepare("
            SELECT * FROM saving_installments
            WHERE saving_account_id = :saving_id
            ORDER BY installment_no ASC
        ");
        $stmt->execute(['saving_id' => $savingAccountId]);
        return $stmt->fetchAll();
    }

    public static function generateInstallments($db, $savingAccountId, $data) {
        $startDate = $data['start_date'] ?? date('Y-m-d');
        $maturityDate = $data['maturity_date'] ?? date('Y-m-d', strtotime('+1 year'));
        $depositAmt = (float)($data['deposit_amount'] ?? 0);
        $frequency = $data['collection_frequency'] ?? 'Daily';

        $interval = $frequency === 'Daily' ? 'P1D' : ($frequency === 'Weekly' ? 'P7D' : 'P1M');

        $cur = new DateTime($startDate);
        $end = new DateTime($maturityDate);
        $i = 1;
        $stmt = $db->prepare("
            INSERT INTO saving_installments (saving_account_id, installment_no, due_date, total_due, paid_amount, status)
            VALUES (:saving_id, :inst_no, :due_date, :total_due, 0.00, 'Pending')
        ");
        while ($cur < $end && $i <= 2000) {
            $stmt->execute([
                'saving_id' => $savingAccountId,
                'inst_no' => $i,
                'due_date' => $cur->format('Y-m-d'),
                'total_due' => $depositAmt
            ]);
            $cur->add(new DateInterval($interval));
            $i++;
        }
    }
}

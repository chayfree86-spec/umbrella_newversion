<?php
/**
 * Loan Account Database Model
 */
class LoanAccount {

    public static function getAll($db, $params = []) {
        $where = ["la.deleted_at IS NULL"];
        $bind = [];

        if (!empty($params['branch_id'])) {
            $where[] = "la.branch_id = :branch_id";
            $bind['branch_id'] = $params['branch_id'];
        }
        if (!empty($params['area_id'])) {
            $where[] = "la.area_id = :area_id";
            $bind['area_id'] = $params['area_id'];
        }
        if (!empty($params['agent_id'])) {
            $where[] = "la.agent_id = :agent_id";
            $bind['agent_id'] = $params['agent_id'];
        }
        if (!empty($params['status'])) {
            $where[] = "la.account_status = :status";
            $bind['status'] = $params['status'];
        }
        if (!empty($params['search'])) {
            $where[] = "(c.full_name LIKE :search OR c.mobile LIKE :search OR la.loan_account_no LIKE :search)";
            $bind['search'] = "%" . $params['search'] . "%";
        }

        $whereSql = implode(" AND ", $where);
        
        $limit = $params['limit'] ?? DEFAULT_PAGE_SIZE;
        $offset = $params['offset'] ?? 0;

        $stmtCount = $db->prepare("
            SELECT COUNT(*) FROM loan_accounts la
            JOIN customers c ON la.customer_id = c.id
            WHERE $whereSql
        ");
        $stmtCount->execute($bind);
        $total = $stmtCount->fetchColumn();

        $stmt = $db->prepare("
            SELECT la.*, c.full_name as customer_name, c.mobile as customer_mobile,
            b.name as branch_name, ar.name as area_name, ag.name as agent_name,
            la.plan_name as plan_name,
            (SELECT COALESCE(SUM(li.total_due - li.paid_amount), 0)
                FROM loan_installments li
                WHERE li.loan_account_id = la.id AND li.due_date <= CURRENT_DATE() AND li.status != 'Paid') as today_due,
            (SELECT MIN(li2.due_date)
                FROM loan_installments li2
                WHERE li2.loan_account_id = la.id AND li2.status != 'Paid') as next_due_date,
            (SELECT COUNT(*) FROM loan_installments li3 WHERE li3.loan_account_id = la.id AND li3.status = 'Paid') as paid_installments,
            (SELECT COUNT(*) FROM loan_installments li4 WHERE li4.loan_account_id = la.id) as total_installments
            FROM loan_accounts la
            JOIN customers c ON la.customer_id = c.id
            JOIN branches b ON la.branch_id = b.id
            JOIN areas ar ON la.area_id = ar.id
            JOIN agents ag ON la.agent_id = ag.id
            LEFT JOIN loan_plans lp ON la.loan_plan_id = lp.id
            WHERE $whereSql
            ORDER BY la.id DESC
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
            SELECT la.*, c.full_name as customer_name, c.mobile as customer_mobile,
            b.name as branch_name, ar.name as area_name, ag.name as agent_name,
            la.plan_name as plan_name,
            (SELECT COALESCE(SUM(li.total_due - li.paid_amount), 0)
                FROM loan_installments li
                WHERE li.loan_account_id = la.id AND li.due_date <= CURRENT_DATE() AND li.status != 'Paid') as today_due,
            (SELECT MIN(li2.due_date)
                FROM loan_installments li2
                WHERE li2.loan_account_id = la.id AND li2.status != 'Paid') as next_due_date,
            (SELECT COUNT(*) FROM loan_installments li3 WHERE li3.loan_account_id = la.id AND li3.status = 'Paid') as paid_installments,
            (SELECT COUNT(*) FROM loan_installments li4 WHERE li4.loan_account_id = la.id) as total_installments
            FROM loan_accounts la
            JOIN customers c ON la.customer_id = c.id
            JOIN branches b ON la.branch_id = b.id
            JOIN areas ar ON la.area_id = ar.id
            JOIN agents ag ON la.agent_id = ag.id
            LEFT JOIN loan_plans lp ON la.loan_plan_id = lp.id
            WHERE la.id = :id AND la.deleted_at IS NULL
        ");
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public static function getByAccountNo($db, $accNo) {
        $stmt = $db->prepare("
            SELECT la.*, c.full_name as customer_name, c.mobile as customer_mobile,
            b.name as branch_name, ar.name as area_name, ag.name as agent_name,
            la.plan_name as plan_name,
            (SELECT COALESCE(SUM(li.total_due - li.paid_amount), 0)
                FROM loan_installments li
                WHERE li.loan_account_id = la.id AND li.due_date <= CURRENT_DATE() AND li.status != 'Paid') as today_due,
            (SELECT MIN(li2.due_date)
                FROM loan_installments li2
                WHERE li2.loan_account_id = la.id AND li2.status != 'Paid') as next_due_date,
            (SELECT COUNT(*) FROM loan_installments li3 WHERE li3.loan_account_id = la.id AND li3.status = 'Paid') as paid_installments,
            (SELECT COUNT(*) FROM loan_installments li4 WHERE li4.loan_account_id = la.id) as total_installments
            FROM loan_accounts la
            JOIN customers c ON la.customer_id = c.id
            JOIN branches b ON la.branch_id = b.id
            JOIN areas ar ON la.area_id = ar.id
            JOIN agents ag ON la.agent_id = ag.id
            LEFT JOIN loan_plans lp ON la.loan_plan_id = lp.id
            WHERE la.loan_account_no = :acc_no AND la.deleted_at IS NULL
        ");
        $stmt->execute(['acc_no' => $accNo]);
        return $stmt->fetch();
    }

    public static function create($db, $data) {
        $accNo = NumberGenerator::generate($db, PREFIX_LOAN);

        $planName = 'Custom Loan Plan';
        if (!empty($data['loan_plan_id'])) {
            $planStmt = $db->prepare("SELECT name FROM loan_plans WHERE id = :id");
            $planStmt->execute(['id' => $data['loan_plan_id']]);
            $resName = $planStmt->fetchColumn();
            if ($resName) {
                $planName = $resName;
            }
        }

        $stmt = $db->prepare("
            INSERT INTO loan_accounts (
                uuid, loan_account_no, customer_id, loan_plan_id, plan_name, branch_id, area_id, agent_id,
                principal_amount, interest_rate, interest_type, interest_amount, processing_fee,
                total_payable, emi_amount, duration_days, duration_months, collection_frequency,
                start_date, end_date, outstanding_amount, account_status, created_by
            ) VALUES (
                :uuid, :loan_account_no, :customer_id, :loan_plan_id, :plan_name, :branch_id, :area_id, :agent_id,
                :principal_amount, :interest_rate, :interest_type, :interest_amount, :processing_fee,
                :total_payable, :emi_amount, :duration_days, :duration_months, :collection_frequency,
                :start_date, :end_date, :outstanding_amount, :account_status, :created_by
            )
        ");
        
        $uuid = Validator::uuid();
        $stmt->execute([
            'uuid' => $uuid,
            'loan_account_no' => $accNo,
            'customer_id' => $data['customer_id'],
            'loan_plan_id' => $data['loan_plan_id'],
            'plan_name' => $planName,
            'branch_id' => $data['branch_id'],
            'area_id' => $data['area_id'],
            'agent_id' => $data['agent_id'],
            'principal_amount' => $data['principal_amount'],
            'interest_rate' => $data['interest_rate'],
            'interest_type' => $data['interest_type'] ?? 'Flat',
            'interest_amount' => $data['interest_amount'] ?? 0.00,
            'processing_fee' => $data['processing_fee'] ?? 0.00,
            'total_payable' => $data['total_payable'],
            'emi_amount' => $data['emi_amount'],
            'duration_days' => $data['duration_days'] ?? 0,
            'duration_months' => $data['duration_months'] ?? 0,
            'collection_frequency' => $data['collection_frequency'] ?? 'Daily',
            'start_date' => $data['start_date'] ?? null,
            'end_date' => $data['end_date'] ?? null,
            'outstanding_amount' => $data['total_payable'],
            'account_status' => $data['account_status'] ?? 'Processing',
            'created_by' => $data['created_by']
        ]);

        $id = $db->lastInsertId();

        // If approved instantly, pre-generate installments
        if (($data['account_status'] ?? '') === 'Approved' || ($data['account_status'] ?? '') === 'Active') {
            self::generateInstallments($db, $id, $data);
        }

        return $id;
    }

    public static function generateInstallments($db, $loanAccountId, $data) {
        $principal = $data['principal_amount'];
        $interest = $data['interest_amount'] ?? 0.00;
        $totalPayable = $data['total_payable'];
        $emiAmount = $data['emi_amount'];
        $frequency = $data['collection_frequency'] ?? 'Daily';
        $startDateStr = $data['start_date'] ?? date('Y-m-d');
        $durationDays = $data['duration_days'] ?? 0;
        $durationMonths = $data['duration_months'] ?? 0;

        // Calculate count of EMIs
        $totalDays = $durationDays;
        if ((!$totalDays || $totalDays <= 0) && $durationMonths > 0) {
            $startDateTime = new DateTime($startDateStr);
            $endDateTime = clone $startDateTime;
            $endDateTime->modify("+$durationMonths month");
            $totalDays = $endDateTime->diff($startDateTime)->days;
        }

        $installmentsCount = 0;
        $intervalSpec = '';
        if ($frequency === 'Daily') {
            $installmentsCount = $totalDays;
            $intervalSpec = 'P1D';
        } elseif ($frequency === 'Weekly') {
            $installmentsCount = round($totalDays / 7);
            $intervalSpec = 'P7D';
        } elseif ($frequency === 'Monthly') {
            $installmentsCount = $durationMonths ?: round($totalDays / 30.4375);
            $intervalSpec = 'P1M';
        }

        if ($installmentsCount <= 0) $installmentsCount = 1;

        $principalComponent = round($principal / $installmentsCount, 2);
        $interestComponent = round($interest / $installmentsCount, 2);
        $totalDue = $emiAmount;

        $currentDate = new DateTime($startDateStr);

        for ($i = 1; $i <= $installmentsCount; $i++) {
            $dueDate = $currentDate->format('Y-m-d');

            // Adjust final installment rounding
            if ($i == $installmentsCount) {
                $principalComponent = $principal - ($principalComponent * ($installmentsCount - 1));
                $interestComponent = $interest - ($interestComponent * ($installmentsCount - 1));
                $totalDue = $principalComponent + $interestComponent;
            }

            $stmt = $db->prepare("
                INSERT INTO loan_installments (
                    loan_account_id, installment_no, due_date, principal_component, interest_component, total_due, paid_amount, status
                ) VALUES (
                    :loan_account_id, :installment_no, :due_date, :principal_component, :interest_component, :total_due, 0.00, 'Pending'
                )
            ");
            $stmt->execute([
                'loan_account_id' => $loanAccountId,
                'installment_no' => $i,
                'due_date' => $dueDate,
                'principal_component' => $principalComponent,
                'interest_component' => $interestComponent,
                'total_due' => $totalDue
            ]);

            // Next due date for next iteration
            $currentDate->add(new DateInterval($intervalSpec));
        }
    }

    public static function getInstallments($db, $loanAccountId) {
        $stmt = $db->prepare("
            SELECT * FROM loan_installments 
            WHERE loan_account_id = :loan_id 
            ORDER BY installment_no ASC
        ");
        $stmt->execute(['loan_id' => $loanAccountId]);
        return $stmt->fetchAll();
    }

    public static function getStatement($db, $loanAccountId) {
        $stmt = $db->prepare("
            SELECT lc.receipt_no as refNo, lc.collection_date as date, 
            CASE 
                WHEN lc.remarks LIKE '%Settlement Payment%' THEN 'Loan Settlement'
                ELSE 'EMI Payment'
            END as type,
            lc.collected_amount as amt, lc.penalty_amount as fine, u.name as collector,
            lc.installment_allocations as allocations, lc.payment_mode as paymentMode, lc.remarks,
            lc.is_advance as isAdvance
            FROM loan_collections lc
            JOIN users u ON lc.collected_by = u.id
            WHERE lc.loan_account_id = :loan_id AND lc.is_reversal = 0
            ORDER BY lc.id DESC
        ");
        $stmt->execute(['loan_id' => $loanAccountId]);
        return $stmt->fetchAll();
    }
}

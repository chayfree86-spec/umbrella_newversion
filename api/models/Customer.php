<?php
/**
 * Customer Database Model
 */
class Customer {

    public static function getAll($db, $params = []) {
        $where = ["c.deleted_at IS NULL"];
        $bind = [];

        if (!empty($params['branch_id'])) {
            $where[] = "c.branch_id = :branch_id";
            $bind['branch_id'] = $params['branch_id'];
        }
        if (!empty($params['area_id'])) {
            $where[] = "c.area_id = :area_id";
            $bind['area_id'] = $params['area_id'];
        }
        if (!empty($params['agent_id'])) {
            $where[] = "c.agent_id = :agent_id";
            $bind['agent_id'] = $params['agent_id'];
        }
        if (!empty($params['search'])) {
            $where[] = "(c.full_name LIKE :search OR c.mobile LIKE :search OR c.customer_code LIKE :search)";
            $bind['search'] = "%" . $params['search'] . "%";
        }

        $whereSql = implode(" AND ", $where);
        
        // Pagination
        $limit = $params['limit'] ?? DEFAULT_PAGE_SIZE;
        $offset = $params['offset'] ?? 0;

        // Total count
        $stmtCount = $db->prepare("SELECT COUNT(*) FROM customers c WHERE $whereSql");
        $stmtCount->execute($bind);
        $total = $stmtCount->fetchColumn();

        // Data list
        $stmt = $db->prepare("
            SELECT c.*, b.name as branch_name, ar.name as area_name, ag.name as agent_name 
            FROM customers c
            JOIN branches b ON c.branch_id = b.id
            JOIN areas ar ON c.area_id = ar.id
            JOIN agents ag ON c.agent_id = ag.id
            WHERE $whereSql
            ORDER BY c.id DESC
            LIMIT :limit OFFSET :offset
        ");
        
        // Bind pagination parameters explicitly as integers
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
            SELECT c.*, b.name as branch_name, ar.name as area_name, ag.name as agent_name 
            FROM customers c
            JOIN branches b ON c.branch_id = b.id
            JOIN areas ar ON c.area_id = ar.id
            JOIN agents ag ON c.agent_id = ag.id
            WHERE c.id = :id AND c.deleted_at IS NULL
        ");
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public static function getByCodeOrMobile($db, $codeOrMobile) {
        $stmt = $db->prepare("
            SELECT * FROM customers 
            WHERE (customer_code = :code OR mobile = :mobile) AND deleted_at IS NULL
        ");
        $stmt->execute(['code' => $codeOrMobile, 'mobile' => $codeOrMobile]);
        return $stmt->fetch();
    }

    public static function getProfileDetails($db, $id) {
        $customer = self::getById($db, $id);
        if (!$customer) return null;

        // Addresses
        $stmt = $db->prepare("SELECT * FROM customer_addresses WHERE customer_id = :id");
        $stmt->execute(['id' => $id]);
        $customer['addresses'] = $stmt->fetchAll();

        // KYC
        $stmt = $db->prepare("SELECT * FROM customer_kyc WHERE customer_id = :id");
        $stmt->execute(['id' => $id]);
        $customer['kyc'] = $stmt->fetch() ?: null;

        // Documents
        $stmt = $db->prepare("SELECT * FROM customer_documents WHERE customer_id = :id");
        $stmt->execute(['id' => $id]);
        $customer['documents'] = $stmt->fetchAll();

        // Guarantors
        $stmt = $db->prepare("SELECT * FROM guarantors WHERE customer_id = :id");
        $stmt->execute(['id' => $id]);
        $customer['guarantors'] = $stmt->fetchAll();

        // Loan Accounts
        $stmt = $db->prepare("
            SELECT la.*, la.plan_name as plan_name 
            FROM loan_accounts la
            LEFT JOIN loan_plans lp ON la.loan_plan_id = lp.id
            WHERE la.customer_id = :id AND la.deleted_at IS NULL
        ");
        $stmt->execute(['id' => $id]);
        $customer['loans'] = $stmt->fetchAll();

        // Saving Accounts
        $stmt = $db->prepare("
            SELECT sa.*, sa.plan_name as plan_name 
            FROM saving_accounts sa
            LEFT JOIN saving_plans sp ON sa.saving_plan_id = sp.id
            WHERE sa.customer_id = :id AND sa.deleted_at IS NULL
        ");
        $stmt->execute(['id' => $id]);
        $customer['savings'] = $stmt->fetchAll();

        return $customer;
    }

    public static function create($db, $data) {
        $customerCode = NumberGenerator::generate($db, PREFIX_CUSTOMER);

        $stmt = $db->prepare("
            INSERT INTO customers (
                uuid, customer_code, full_name, mobile, alternate_mobile, dob, gender, 
                father_or_husband_name, occupation, monthly_income, photo_path, 
                branch_id, area_id, agent_id, status, created_by
            ) VALUES (
                :uuid, :customer_code, :full_name, :mobile, :alternate_mobile, :dob, :gender, 
                :father_or_husband_name, :occupation, :monthly_income, :photo_path, 
                :branch_id, :area_id, :agent_id, :status, :created_by
            )
        ");
        $stmt->execute([
            'uuid' => Validator::uuid(),
            'customer_code' => $customerCode,
            'full_name' => $data['full_name'],
            'mobile' => $data['mobile'],
            'alternate_mobile' => $data['alternate_mobile'] ?? null,
            'dob' => !empty($data['dob']) ? $data['dob'] : null,
            'gender' => $data['gender'] ?? 'Male',
            'father_or_husband_name' => $data['father_or_husband_name'] ?? null,
            'occupation' => $data['occupation'] ?? null,
            'monthly_income' => $data['monthly_income'] ?? 0.00,
            'photo_path' => $data['photo_path'] ?? null,
            'branch_id' => $data['branch_id'],
            'area_id' => $data['area_id'],
            'agent_id' => $data['agent_id'],
            'status' => $data['status'] ?? 'Active',
            'created_by' => $data['created_by']
        ]);
        return $db->lastInsertId();
    }

    public static function update($db, $id, $data) {
        $stmt = $db->prepare("
            UPDATE customers SET 
                full_name = :full_name,
                mobile = :mobile,
                alternate_mobile = :alternate_mobile,
                dob = :dob,
                gender = :gender,
                father_or_husband_name = :father_or_husband_name,
                occupation = :occupation,
                monthly_income = :monthly_income,
                photo_path = :photo_path,
                branch_id = :branch_id,
                area_id = :area_id,
                agent_id = :agent_id,
                status = :status,
                updated_by = :updated_by
            WHERE id = :id AND deleted_at IS NULL
        ");
        return $stmt->execute([
            'id' => $id,
            'full_name' => $data['full_name'],
            'mobile' => $data['mobile'],
            'alternate_mobile' => $data['alternate_mobile'] ?? null,
            'dob' => !empty($data['dob']) ? $data['dob'] : null,
            'gender' => $data['gender'] ?? 'Male',
            'father_or_husband_name' => $data['father_or_husband_name'] ?? null,
            'occupation' => $data['occupation'] ?? null,
            'monthly_income' => $data['monthly_income'] ?? 0.00,
            'photo_path' => $data['photo_path'] ?? null,
            'branch_id' => $data['branch_id'],
            'area_id' => $data['area_id'],
            'agent_id' => $data['agent_id'],
            'status' => $data['status'] ?? 'Active',
            'updated_by' => $data['updated_by']
        ]);
    }

    public static function delete($db, $id) {
        $stmt = $db->prepare("UPDATE customers SET deleted_at = NOW() WHERE id = :id");
        return $stmt->execute(['id' => $id]);
    }
}

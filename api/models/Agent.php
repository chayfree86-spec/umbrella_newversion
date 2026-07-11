<?php
/**
 * Agent Database Model
 */
class Agent {

    public static function getAll($db) {
        $stmt = $db->prepare("
            SELECT a.*, b.name as branch_name, ar.name as area_name, p.name as policy_name,
            (SELECT COUNT(*) FROM customers c WHERE c.agent_id = a.id AND c.deleted_at IS NULL) as customers_count
            FROM agents a
            JOIN branches b ON a.branch_id = b.id
            JOIN areas ar ON a.area_id = ar.id
            LEFT JOIN policies p ON a.policy_id = p.id
            WHERE a.deleted_at IS NULL
            ORDER BY a.id DESC
        ");
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function getById($db, $id) {
        $stmt = $db->prepare("
            SELECT a.*, b.name as branch_name, ar.name as area_name, p.name as policy_name,
            (SELECT COUNT(*) FROM customers c WHERE c.agent_id = a.id AND c.deleted_at IS NULL) as customers_count,
            (SELECT COUNT(*) FROM loan_accounts la WHERE la.agent_id = a.id AND la.account_status IN ('Approved','Active','Defaulter') AND la.deleted_at IS NULL) as active_loan_accounts,
            (SELECT COUNT(*) FROM saving_accounts sa WHERE sa.agent_id = a.id AND sa.account_status IN ('Approved','Active') AND sa.deleted_at IS NULL) as active_saving_accounts,
            (
                (SELECT COALESCE(SUM(lc.collected_amount + lc.penalty_amount), 0) FROM loan_collections lc WHERE lc.agent_id = a.id AND lc.collection_date = CURDATE() AND lc.is_reversal = 0)
                +
                (SELECT COALESCE(SUM(sd.deposit_amount), 0) FROM saving_deposits sd WHERE sd.agent_id = a.id AND sd.deposit_date = CURDATE() AND sd.is_reversal = 0)
            ) as today_collection,
            (
                (SELECT COALESCE(SUM(lc2.collected_amount + lc2.penalty_amount), 0) FROM loan_collections lc2 WHERE lc2.agent_id = a.id AND YEAR(lc2.collection_date) = YEAR(CURDATE()) AND MONTH(lc2.collection_date) = MONTH(CURDATE()) AND lc2.is_reversal = 0)
                +
                (SELECT COALESCE(SUM(sd2.deposit_amount), 0) FROM saving_deposits sd2 WHERE sd2.agent_id = a.id AND YEAR(sd2.deposit_date) = YEAR(CURDATE()) AND MONTH(sd2.deposit_date) = MONTH(CURDATE()) AND sd2.is_reversal = 0)
            ) as monthly_collection
            FROM agents a
            JOIN branches b ON a.branch_id = b.id
            JOIN areas ar ON a.area_id = ar.id
            LEFT JOIN policies p ON a.policy_id = p.id
            WHERE a.id = :id AND a.deleted_at IS NULL
        ");
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public static function getByArea($db, $areaId) {
        $stmt = $db->prepare("
            SELECT a.*, b.name as branch_name, ar.name as area_name, p.name as policy_name,
            (SELECT COUNT(*) FROM customers c WHERE c.agent_id = a.id AND c.deleted_at IS NULL) as customers_count
            FROM agents a
            JOIN branches b ON a.branch_id = b.id
            JOIN areas ar ON a.area_id = ar.id
            LEFT JOIN policies p ON a.policy_id = p.id
            WHERE a.area_id = :area_id AND a.deleted_at IS NULL
            ORDER BY a.name ASC
        ");
        $stmt->execute(['area_id' => $areaId]);
        return $stmt->fetchAll();
    }

    public static function getByCode($db, $code) {
        $stmt = $db->prepare("SELECT * FROM agents WHERE code = :code AND deleted_at IS NULL");
        $stmt->execute(['code' => $code]);
        return $stmt->fetch();
    }

    // Agent ka login user_id nikalta hai (notifications ke liye) — same
    // priority jo AgentController::show() me use hoti hai: agents.user_id
    // pehle, fallback sirf agent-role (role_id=4) users tak.
    public static function getLinkedUserId($db, $agentId) {
        if (empty($agentId)) return null;
        $agent = self::getById($db, $agentId);
        if (!$agent) return null;

        $stmt = $db->prepare("
            SELECT id
            FROM users
            WHERE deleted_at IS NULL
              AND (
                    id = :user_id
                 OR (role_id = 4 AND (agent_id = :agent_id OR mobile = :mobile))
              )
            ORDER BY (id = :user_id2) DESC, (role_id = 4) DESC, id ASC
            LIMIT 1
        ");
        $stmt->execute([
            'user_id' => !empty($agent['user_id']) ? $agent['user_id'] : 0,
            'user_id2' => !empty($agent['user_id']) ? $agent['user_id'] : 0,
            'agent_id' => $agentId,
            'mobile' => $agent['mobile']
        ]);
        $userId = $stmt->fetchColumn();
        return $userId ?: null;
    }

    public static function create($db, $data) {
        $stmt = $db->prepare("
            INSERT INTO agents (
                uuid, code, name, mobile, email, user_id, branch_id, area_id, policy_id, 
                photo_path, father_name, dob, address, aadhaar_no, pan_no, 
                bank_name, bank_account_no, bank_ifsc, joining_date, status
            ) VALUES (
                :uuid, :code, :name, :mobile, :email, :user_id, :branch_id, :area_id, :policy_id, 
                :photo_path, :father_name, :dob, :address, :aadhaar_no, :pan_no, 
                :bank_name, :bank_account_no, :bank_ifsc, :joining_date, :status
            )
        ");
        $stmt->execute([
            'uuid' => Validator::uuid(),
            'code' => $data['code'],
            'name' => $data['name'],
            'mobile' => $data['mobile'],
            'email' => $data['email'] ?? null,
            'user_id' => !empty($data['user_id']) ? $data['user_id'] : null,
            'branch_id' => $data['branch_id'],
            'area_id' => $data['area_id'],
            'policy_id' => !empty($data['policy_id']) ? $data['policy_id'] : null,
            'photo_path' => $data['photo_path'] ?? null,
            'father_name' => $data['father_name'] ?? null,
            'dob' => !empty($data['dob']) ? $data['dob'] : null,
            'address' => $data['address'] ?? null,
            'aadhaar_no' => $data['aadhaar_no'] ?? null,
            'pan_no' => $data['pan_no'] ?? null,
            'bank_name' => $data['bank_name'] ?? null,
            'bank_account_no' => $data['bank_account_no'] ?? null,
            'bank_ifsc' => $data['bank_ifsc'] ?? null,
            'joining_date' => $data['joining_date'] ?? date('Y-m-d'),
            'status' => $data['status'] ?? 'Active'
        ]);
        return $db->lastInsertId();
    }

    public static function update($db, $id, $data) {
        $stmt = $db->prepare("
            UPDATE agents SET 
                code = :code,
                name = :name,
                mobile = :mobile,
                email = :email,
                user_id = :user_id,
                branch_id = :branch_id,
                area_id = :area_id,
                policy_id = :policy_id,
                photo_path = :photo_path,
                father_name = :father_name,
                dob = :dob,
                address = :address,
                aadhaar_no = :aadhaar_no,
                pan_no = :pan_no,
                bank_name = :bank_name,
                bank_account_no = :bank_account_no,
                bank_ifsc = :bank_ifsc,
                joining_date = :joining_date,
                status = :status
            WHERE id = :id AND deleted_at IS NULL
        ");
        return $stmt->execute([
            'id' => $id,
            'code' => $data['code'],
            'name' => $data['name'],
            'mobile' => $data['mobile'],
            'email' => $data['email'] ?? null,
            'user_id' => !empty($data['user_id']) ? $data['user_id'] : null,
            'branch_id' => $data['branch_id'],
            'area_id' => $data['area_id'],
            'policy_id' => !empty($data['policy_id']) ? $data['policy_id'] : null,
            'photo_path' => $data['photo_path'] ?? null,
            'father_name' => $data['father_name'] ?? null,
            'dob' => !empty($data['dob']) ? $data['dob'] : null,
            'address' => $data['address'] ?? null,
            'aadhaar_no' => $data['aadhaar_no'] ?? null,
            'pan_no' => $data['pan_no'] ?? null,
            'bank_name' => $data['bank_name'] ?? null,
            'bank_account_no' => $data['bank_account_no'] ?? null,
            'bank_ifsc' => $data['bank_ifsc'] ?? null,
            'joining_date' => $data['joining_date'] ?? date('Y-m-d'),
            'status' => $data['status'] ?? 'Active'
        ]);
    }

    public static function delete($db, $id) {
        $stmt = $db->prepare("UPDATE agents SET deleted_at = NOW() WHERE id = :id");
        return $stmt->execute(['id' => $id]);
    }
}

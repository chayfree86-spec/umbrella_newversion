<?php
/**
 * Area Database Model
 */
class Area {

    public static function getAll($db) {
        $stmt = $db->prepare("
            SELECT a.*, b.name as branch_name, u.name as manager_name,
            (SELECT COUNT(*) FROM agents ag WHERE ag.area_id = a.id AND ag.deleted_at IS NULL) as agents_count,
            (SELECT COUNT(*) FROM customers c WHERE c.area_id = a.id AND c.deleted_at IS NULL) as customers_count
            FROM areas a
            JOIN branches b ON a.branch_id = b.id
            LEFT JOIN users u ON a.manager_id = u.id
            WHERE a.deleted_at IS NULL
            ORDER BY a.id DESC
        ");
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function getById($db, $id) {
        $stmt = $db->prepare("
            SELECT a.*, b.name as branch_name, u.name as manager_name
            FROM areas a
            JOIN branches b ON a.branch_id = b.id
            LEFT JOIN users u ON a.manager_id = u.id
            WHERE a.id = :id AND a.deleted_at IS NULL
        ");
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public static function getByBranch($db, $branchId) {
        $stmt = $db->prepare("
            SELECT a.*, b.name as branch_name, u.name as manager_name,
            (SELECT COUNT(*) FROM agents ag WHERE ag.area_id = a.id AND ag.deleted_at IS NULL) as agents_count,
            (SELECT COUNT(*) FROM customers c WHERE c.area_id = a.id AND c.deleted_at IS NULL) as customers_count
            FROM areas a
            JOIN branches b ON a.branch_id = b.id
            LEFT JOIN users u ON a.manager_id = u.id
            WHERE a.branch_id = :branch_id AND a.deleted_at IS NULL
            ORDER BY a.name ASC
        ");
        $stmt->execute(['branch_id' => $branchId]);
        return $stmt->fetchAll();
    }

    public static function getByCode($db, $code) {
        $stmt = $db->prepare("SELECT * FROM areas WHERE code = :code AND deleted_at IS NULL");
        $stmt->execute(['code' => $code]);
        return $stmt->fetch();
    }

    public static function create($db, $data) {
        $stmt = $db->prepare("
            INSERT INTO areas (
                uuid, code, name, branch_id, manager_id, status
            ) VALUES (
                :uuid, :code, :name, :branch_id, :manager_id, :status
            )
        ");
        $stmt->execute([
            'uuid' => Validator::uuid(),
            'code' => $data['code'],
            'name' => $data['name'],
            'branch_id' => $data['branch_id'],
            'manager_id' => !empty($data['manager_id']) ? $data['manager_id'] : null,
            'status' => $data['status'] ?? 'Active'
        ]);
        return $db->lastInsertId();
    }

    public static function update($db, $id, $data) {
        $stmt = $db->prepare("
            UPDATE areas SET 
                code = :code,
                name = :name,
                branch_id = :branch_id,
                manager_id = :manager_id,
                status = :status
            WHERE id = :id AND deleted_at IS NULL
        ");
        return $stmt->execute([
            'id' => $id,
            'code' => $data['code'],
            'name' => $data['name'],
            'branch_id' => $data['branch_id'],
            'manager_id' => !empty($data['manager_id']) ? $data['manager_id'] : null,
            'status' => $data['status'] ?? 'Active'
        ]);
    }

    public static function delete($db, $id) {
        $stmt = $db->prepare("UPDATE areas SET deleted_at = NOW() WHERE id = :id");
        return $stmt->execute(['id' => $id]);
    }
}

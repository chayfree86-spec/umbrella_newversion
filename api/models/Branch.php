<?php
/**
 * Branch Database Model
 */
class Branch {

    public static function getAll($db) {
        $stmt = $db->prepare("
            SELECT b.*, u.name as manager_name 
            FROM branches b
            LEFT JOIN users u ON b.manager_id = u.id
            WHERE b.deleted_at IS NULL 
            ORDER BY b.id DESC
        ");
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function getById($db, $id) {
        $stmt = $db->prepare("
            SELECT b.*, u.name as manager_name 
            FROM branches b
            LEFT JOIN users u ON b.manager_id = u.id
            WHERE b.id = :id AND b.deleted_at IS NULL
        ");
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public static function getByCode($db, $code) {
        $stmt = $db->prepare("SELECT * FROM branches WHERE code = :code AND deleted_at IS NULL");
        $stmt->execute(['code' => $code]);
        return $stmt->fetch();
    }

    public static function create($db, $data) {
        $stmt = $db->prepare("
            INSERT INTO branches (
                uuid, code, name, city, address, manager_id, allow_registrations, allow_collections, status
            ) VALUES (
                :uuid, :code, :name, :city, :address, :manager_id, :allow_registrations, :allow_collections, :status
            )
        ");
        $stmt->execute([
            'uuid' => Validator::uuid(),
            'code' => $data['code'],
            'name' => $data['name'],
            'city' => $data['city'] ?? null,
            'address' => $data['address'] ?? null,
            'manager_id' => !empty($data['manager_id']) ? $data['manager_id'] : null,
            'allow_registrations' => isset($data['allow_registrations']) ? ($data['allow_registrations'] ? 1 : 0) : 1,
            'allow_collections' => isset($data['allow_collections']) ? ($data['allow_collections'] ? 1 : 0) : 1,
            'status' => $data['status'] ?? 'Active'
        ]);
        return $db->lastInsertId();
    }

    public static function update($db, $id, $data) {
        $stmt = $db->prepare("
            UPDATE branches SET 
                code = :code,
                name = :name,
                city = :city,
                address = :address,
                manager_id = :manager_id,
                allow_registrations = :allow_registrations,
                allow_collections = :allow_collections,
                status = :status
            WHERE id = :id AND deleted_at IS NULL
        ");
        return $stmt->execute([
            'id' => $id,
            'code' => $data['code'],
            'name' => $data['name'],
            'city' => $data['city'] ?? null,
            'address' => $data['address'] ?? null,
            'manager_id' => !empty($data['manager_id']) ? $data['manager_id'] : null,
            'allow_registrations' => isset($data['allow_registrations']) ? ($data['allow_registrations'] ? 1 : 0) : 1,
            'allow_collections' => isset($data['allow_collections']) ? ($data['allow_collections'] ? 1 : 0) : 1,
            'status' => $data['status'] ?? 'Active'
        ]);
    }

    public static function delete($db, $id) {
        $stmt = $db->prepare("UPDATE branches SET deleted_at = NOW() WHERE id = :id");
        return $stmt->execute(['id' => $id]);
    }
}

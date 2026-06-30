<?php
/**
 * Policy Database Model
 */
class Policy {

    public static function getAll($db) {
        $stmt = $db->prepare("SELECT * FROM policies WHERE deleted_at IS NULL ORDER BY id DESC");
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function getById($db, $id) {
        $stmt = $db->prepare("SELECT * FROM policies WHERE id = :id AND deleted_at IS NULL");
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public static function create($db, $data) {
        $stmt = $db->prepare("
            INSERT INTO policies (
                uuid, name, role, description, allow_login, allow_disbursement, 
                allow_agent_assignment, allow_out_area, max_limit, allow_online_apply, 
                allow_backdated, session_timeout, created_by
            ) VALUES (
                :uuid, :name, :role, :description, :allow_login, :allow_disbursement, 
                :allow_agent_assignment, :allow_out_area, :max_limit, :allow_online_apply, 
                :allow_backdated, :session_timeout, :created_by
            )
        ");
        $stmt->execute([
            'uuid' => Validator::uuid(),
            'name' => $data['name'],
            'role' => $data['role'] ?? 'Agent / Collection Executive',
            'description' => $data['description'] ?? null,
            'allow_login' => $data['allow_login'] ? 1 : 0,
            'allow_disbursement' => $data['allow_disbursement'] ? 1 : 0,
            'allow_agent_assignment' => $data['allow_agent_assignment'] ? 1 : 0,
            'allow_out_area' => $data['allow_out_area'] ? 1 : 0,
            'max_limit' => $data['max_limit'] ?? 10000.00,
            'allow_online_apply' => $data['allow_online_apply'] ? 1 : 0,
            'allow_backdated' => $data['allow_backdated'] ? 1 : 0,
            'session_timeout' => $data['session_timeout'] ?? 30,
            'created_by' => $data['created_by']
        ]);
        return $db->lastInsertId();
    }

    public static function update($db, $id, $data) {
        $stmt = $db->prepare("
            UPDATE policies SET 
                name = :name,
                role = :role,
                description = :description,
                allow_login = :allow_login,
                allow_disbursement = :allow_disbursement,
                allow_agent_assignment = :allow_agent_assignment,
                allow_out_area = :allow_out_area,
                max_limit = :max_limit,
                allow_online_apply = :allow_online_apply,
                allow_backdated = :allow_backdated,
                session_timeout = :session_timeout
            WHERE id = :id AND is_system = 0 AND deleted_at IS NULL
        ");
        return $stmt->execute([
            'id' => $id,
            'name' => $data['name'],
            'role' => $data['role'],
            'description' => $data['description'] ?? null,
            'allow_login' => $data['allow_login'] ? 1 : 0,
            'allow_disbursement' => $data['allow_disbursement'] ? 1 : 0,
            'allow_agent_assignment' => $data['allow_agent_assignment'] ? 1 : 0,
            'allow_out_area' => $data['allow_out_area'] ? 1 : 0,
            'max_limit' => $data['max_limit'],
            'allow_online_apply' => $data['allow_online_apply'] ? 1 : 0,
            'allow_backdated' => $data['allow_backdated'] ? 1 : 0,
            'session_timeout' => $data['session_timeout']
        ]);
    }

    public static function delete($db, $id) {
        $stmt = $db->prepare("UPDATE policies SET deleted_at = NOW() WHERE id = :id AND is_system = 0");
        return $stmt->execute(['id' => $id]);
    }
}

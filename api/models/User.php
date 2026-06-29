<?php
/**
 * User Database Model
 */
class User {
    
    public static function getById($db, $id) {
        $stmt = $db->prepare("
            SELECT u.*, r.name as role_name, r.slug as role_slug 
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.id = :id AND u.deleted_at IS NULL
        ");
        $stmt->execute(['id' => $id]);
        $user = $stmt->fetch();

        if ($user) {
            $user['permissions'] = self::getPermissions($db, $user['role_id']);
        }
        return $user;
    }

    public static function getByMobileOrEmail($db, $login) {
        $stmt = $db->prepare("
            SELECT u.*, r.name as role_name, r.slug as role_slug 
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE (u.mobile = :mobile OR u.email = :email) AND u.deleted_at IS NULL
        ");
        $stmt->execute(['mobile' => $login, 'email' => $login]);
        $user = $stmt->fetch();

        if ($user) {
            $user['permissions'] = self::getPermissions($db, $user['role_id']);
        }
        return $user;
    }

    public static function getPermissions($db, $roleId) {
        $stmt = $db->prepare("
            SELECT p.slug 
            FROM role_permissions rp
            JOIN permissions p ON rp.permission_id = p.id
            WHERE rp.role_id = :role_id
        ");
        $stmt->execute(['role_id' => $roleId]);
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    public static function updateLoginTime($db, $id) {
        $stmt = $db->prepare("UPDATE users SET last_login_at = NOW() WHERE id = :id");
        $stmt->execute(['id' => $id]);
    }

    public static function changePasswordOrPin($db, $id, $newPassword = null, $newPin = null) {
        $sets = [];
        $params = ['id' => $id];
        
        if ($newPassword !== null) {
            $sets[] = "password_hash = :password_hash";
            $params['password_hash'] = password_hash($newPassword, PASSWORD_BCRYPT);
        }
        if ($newPin !== null) {
            $sets[] = "pin_hash = :pin_hash";
            $params['pin_hash'] = password_hash($newPin, PASSWORD_BCRYPT);
        }

        if (empty($sets)) return false;

        $sql = "UPDATE users SET " . implode(", ", $sets) . " WHERE id = :id";
        $stmt = $db->prepare($sql);
        return $stmt->execute($params);
    }
}

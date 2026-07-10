<?php
/**
 * Notification Database Model
 */
class Notification {

    public static function create($db, $userId, $title, $message, $type = 'info', $module = null, $refId = null) {
        $stmt = $db->prepare("
            INSERT INTO notifications (
                uuid, user_id, title, message, type, reference_module, reference_id, is_read
            ) VALUES (
                :uuid, :user_id, :title, :message, :type, :module, :ref_id, 0
            )
        ");
        return $stmt->execute([
            'uuid' => Validator::uuid(),
            'user_id' => $userId,
            'title' => $title,
            'message' => $message,
            'type' => $type,
            'module' => $module,
            'ref_id' => $refId
        ]);
    }

    public static function getUnread($db, $userId) {
        $stmt = $db->prepare("
            SELECT * FROM notifications 
            WHERE user_id = :user_id AND is_read = 0 
            ORDER BY id DESC 
            LIMIT 50
        ");
        $stmt->execute(['user_id' => $userId]);
        return $stmt->fetchAll();
    }

    public static function markRead($db, $id, $userId) {
        $stmt = $db->prepare("
            UPDATE notifications 
            SET is_read = 1, read_at = NOW() 
            WHERE id = :id AND user_id = :user_id
        ");
        return $stmt->execute(['id' => $id, 'user_id' => $userId]);
    }

    public static function markAllRead($db, $userId) {
        $stmt = $db->prepare("
            UPDATE notifications
            SET is_read = 1, read_at = NOW()
            WHERE user_id = :user_id AND is_read = 0
        ");
        return $stmt->execute(['user_id' => $userId]);
    }

    // Super Admin ko hamesha, aur us branch/area ke Branch/Area Manager ko
    // notify karta hai — agent activity (registration/collection) ke liye.
    public static function notifyAdmins($db, $opts) {
        $branchId = $opts['branch_id'] ?? null;
        $areaId = $opts['area_id'] ?? null;
        $excludeUserId = $opts['exclude_user_id'] ?? null;

        $conditions = ["r.slug = 'super_admin'"];
        $params = [];
        if ($branchId) {
            $conditions[] = "(r.slug = 'branch_manager' AND u.branch_id = :branch_id)";
            $params['branch_id'] = $branchId;
        }
        if ($areaId) {
            $conditions[] = "(r.slug = 'area_manager' AND u.area_id = :area_id)";
            $params['area_id'] = $areaId;
        }

        $sql = "
            SELECT DISTINCT u.id FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.deleted_at IS NULL AND (" . implode(' OR ', $conditions) . ")
        ";
        if ($excludeUserId) {
            $sql .= " AND u.id != :exclude_user_id";
            $params['exclude_user_id'] = $excludeUserId;
        }

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $userIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

        foreach ($userIds as $uid) {
            self::create(
                $db,
                $uid,
                $opts['title'],
                $opts['message'],
                $opts['type'] ?? 'info',
                $opts['module'] ?? null,
                $opts['ref_id'] ?? null
            );
        }
    }
}

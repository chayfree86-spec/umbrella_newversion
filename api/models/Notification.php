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
}

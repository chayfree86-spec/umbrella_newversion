<?php
/**
 * Sync and Notification Controller
 */
class SyncController {

    public static function events($db, $authUser) {
        $sinceId = max(0, (int)($_GET['since_id'] ?? 0));
        
        $branchId = null;
        if ($authUser['role_slug'] === 'branch_manager') {
            $branchId = $authUser['branch_id'];
        }

        $events = SyncEvent::getEvents($db, $sinceId, $branchId);
        Response::success($events);
    }

    public static function notifications($db, $authUser) {
        $notifications = Notification::getUnread($db, $authUser['id']);
        Response::success($notifications);
    }

    public static function markRead($db, $authUser, $id) {
        Notification::markRead($db, $id, $authUser['id']);
        Response::success(null, 'Notification marked as read.');
    }

    public static function markAllRead($db, $authUser) {
        Notification::markAllRead($db, $authUser['id']);
        Response::success(null, 'All notifications marked as read.');
    }
}
?>

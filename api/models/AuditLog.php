<?php
/**
 * AuditLog Database Model
 */
class AuditLog {

    public static function log($db, $userId, $action, $module, $referenceId = null, $oldValues = null, $newValues = null) {
        try {
            $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
            $ua = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown';

            $stmt = $db->prepare("
                INSERT INTO audit_logs (
                    user_id, action, module, reference_id, old_values, new_values, ip_address, user_agent
                ) VALUES (
                    :user_id, :action, :module, :reference_id, :old_values, :new_values, :ip_address, :user_agent
                )
            ");
            return $stmt->execute([
                'user_id' => $userId,
                'action' => $action,
                'module' => $module,
                'reference_id' => $referenceId,
                'old_values' => $oldValues ? json_encode($oldValues) : null,
                'new_values' => $newValues ? json_encode($newValues) : null,
                'ip_address' => $ip,
                'user_agent' => substr($ua, 0, 500)
            ]);
        } catch (Exception $e) {
            // Silently ignore log insertion failures to prevent breaking core operations
            error_log('AuditLog failed: ' . $e->getMessage());
            return false;
        }
    }
}

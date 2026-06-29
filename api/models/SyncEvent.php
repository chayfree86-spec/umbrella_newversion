<?php
/**
 * SyncEvent Database Model
 */
class SyncEvent {

    public static function create($db, $type, $module, $refId, $branchId, $areaId, $agentId, $userId, $title, $message, $payload = null) {
        $stmt = $db->prepare("
            INSERT INTO sync_events (
                event_type, module, reference_id, branch_id, area_id, agent_id, user_id, title, message, payload
            ) VALUES (
                :type, :module, :ref_id, :branch_id, :area_id, :agent_id, :user_id, :title, :message, :payload
            )
        ");
        return $stmt->execute([
            'type' => $type,
            'module' => $module,
            'ref_id' => $refId,
            'branch_id' => $branchId,
            'area_id' => $areaId,
            'agent_id' => $agentId,
            'user_id' => $userId,
            'title' => $title,
            'message' => $message,
            'payload' => $payload ? json_encode($payload) : null
        ]);
    }

    public static function getEvents($db, $sinceId, $branchId = null) {
        $where = ["id > :since_id"];
        $bind = ['since_id' => $sinceId];

        if ($branchId) {
            $where[] = "(branch_id = :branch_id OR branch_id IS NULL)";
            $bind['branch_id'] = $branchId;
        }

        $whereSql = implode(" AND ", $where);
        $stmt = $db->prepare("
            SELECT * FROM sync_events 
            WHERE $whereSql 
            ORDER BY id ASC 
            LIMIT 50
        ");
        $stmt->execute($bind);
        return $stmt->fetchAll();
    }
}

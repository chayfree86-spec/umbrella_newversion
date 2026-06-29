<?php
/**
 * Setting Database Model
 */
class Setting {

    public static function getAll($db) {
        $stmt = $db->prepare("SELECT * FROM settings");
        $stmt->execute();
        $rows = $stmt->fetchAll();
        $settings = [];
        foreach ($rows as $row) {
            $val = $row['setting_value'];
            if ($row['setting_type'] === 'boolean') {
                $val = ($val === 'true' || $val === '1');
            } elseif ($row['setting_type'] === 'number') {
                $val = (float)$val;
            } elseif ($row['setting_type'] === 'json') {
                $val = json_decode($val, true);
            }
            $settings[$row['setting_key']] = $val;
        }
        return $settings;
    }

    public static function getVal($db, $key, $default = null) {
        $stmt = $db->prepare("SELECT setting_value, setting_type FROM settings WHERE setting_key = :key");
        $stmt->execute(['key' => $key]);
        $row = $stmt->fetch();
        if (!$row) return $default;

        $val = $row['setting_value'];
        if ($row['setting_type'] === 'boolean') {
            return ($val === 'true' || $val === '1');
        } elseif ($row['setting_type'] === 'number') {
            return (float)$val;
        } elseif ($row['setting_type'] === 'json') {
            return json_decode($val, true);
        }
        return $val;
    }

    public static function update($db, $key, $value, $updatedBy = null) {
        $type = 'string';
        if (is_bool($value)) {
            $type = 'boolean';
            $value = $value ? 'true' : 'false';
        } elseif (is_numeric($value)) {
            $type = 'number';
            $value = (string)$value;
        } elseif (is_array($value) || is_object($value)) {
            $type = 'json';
            $value = json_encode($value);
        }

        $stmt = $db->prepare("
            INSERT INTO settings (setting_key, setting_value, setting_type, updated_by)
            VALUES (:key, :value, :type, :updated_by)
            ON DUPLICATE KEY UPDATE 
                setting_value = :value2,
                setting_type = :type2,
                updated_by = :updated_by2
        ");
        return $stmt->execute([
            'key' => $key,
            'value' => $value,
            'type' => $type,
            'updated_by' => $updatedBy,
            'value2' => $value,
            'type2' => $type,
            'updated_by2' => $updatedBy
        ]);
    }
}

<?php
/**
 * SavingPlan Database Model
 */
class SavingPlan {

    public static function getAll($db) {
        $stmt = $db->prepare("SELECT * FROM saving_plans WHERE deleted_at IS NULL ORDER BY id DESC");
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function getById($db, $id) {
        $stmt = $db->prepare("SELECT * FROM saving_plans WHERE id = :id AND deleted_at IS NULL");
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public static function create($db, $data) {
        $stmt = $db->prepare("
            INSERT INTO saving_plans (
                uuid, name, deposit_amount, interest_rate, duration_value, duration_unit, 
                collection_frequency, maturity_amount, bonus_amount, status, created_by
            ) VALUES (
                :uuid, :name, :deposit_amount, :interest_rate, :duration_value, :duration_unit, 
                :collection_frequency, :maturity_amount, :bonus_amount, :status, :created_by
            )
        ");
        $stmt->execute([
            'uuid' => Validator::uuid(),
            'name' => $data['name'],
            'deposit_amount' => $data['deposit_amount'],
            'interest_rate' => $data['interest_rate'],
            'duration_value' => $data['duration_value'],
            'duration_unit' => $data['duration_unit'] ?? 'Days',
            'collection_frequency' => $data['collection_frequency'] ?? 'Daily',
            'maturity_amount' => $data['maturity_amount'] ?? 0.00,
            'bonus_amount' => $data['bonus_amount'] ?? 0.00,
            'status' => $data['status'] ?? 'Active',
            'created_by' => $data['created_by']
        ]);
        return $db->lastInsertId();
    }

    public static function update($db, $id, $data) {
        $stmt = $db->prepare("
            UPDATE saving_plans SET 
                name = :name,
                deposit_amount = :deposit_amount,
                interest_rate = :interest_rate,
                duration_value = :duration_value,
                duration_unit = :duration_unit,
                collection_frequency = :collection_frequency,
                maturity_amount = :maturity_amount,
                bonus_amount = :bonus_amount,
                status = :status
            WHERE id = :id AND deleted_at IS NULL
        ");
        return $stmt->execute([
            'id' => $id,
            'name' => $data['name'],
            'deposit_amount' => $data['deposit_amount'],
            'interest_rate' => $data['interest_rate'],
            'duration_value' => $data['duration_value'],
            'duration_unit' => $data['duration_unit'],
            'collection_frequency' => $data['collection_frequency'],
            'maturity_amount' => $data['maturity_amount'],
            'bonus_amount' => $data['bonus_amount'],
            'status' => $data['status']
        ]);
    }

    public static function delete($db, $id) {
        $stmt = $db->prepare("UPDATE saving_plans SET deleted_at = NOW() WHERE id = :id");
        return $stmt->execute(['id' => $id]);
    }
}

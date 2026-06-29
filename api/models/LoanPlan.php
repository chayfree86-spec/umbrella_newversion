<?php
/**
 * LoanPlan Database Model
 */
class LoanPlan {

    public static function getAll($db) {
        $stmt = $db->prepare("SELECT * FROM loan_plans WHERE deleted_at IS NULL ORDER BY id DESC");
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function getById($db, $id) {
        $stmt = $db->prepare("SELECT * FROM loan_plans WHERE id = :id AND deleted_at IS NULL");
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public static function create($db, $data) {
        $stmt = $db->prepare("
            INSERT INTO loan_plans (
                uuid, name, min_amount, max_amount, interest_rate, interest_type, 
                duration_value, duration_unit, collection_frequency, processing_fee, 
                penalty_per_day, penalty_per_month, status, created_by
            ) VALUES (
                :uuid, :name, :min_amount, :max_amount, :interest_rate, :interest_type, 
                :duration_value, :duration_unit, :collection_frequency, :processing_fee, 
                :penalty_per_day, :penalty_per_month, :status, :created_by
            )
        ");
        $stmt->execute([
            'uuid' => Validator::uuid(),
            'name' => $data['name'],
            'min_amount' => $data['min_amount'],
            'max_amount' => $data['max_amount'],
            'interest_rate' => $data['interest_rate'],
            'interest_type' => $data['interest_type'] ?? 'Flat',
            'duration_value' => $data['duration_value'],
            'duration_unit' => $data['duration_unit'] ?? 'Days',
            'collection_frequency' => $data['collection_frequency'] ?? 'Daily',
            'processing_fee' => $data['processing_fee'] ?? 0.00,
            'penalty_per_day' => $data['penalty_per_day'] ?? 0.00,
            'penalty_per_month' => $data['penalty_per_month'] ?? 0.00,
            'status' => $data['status'] ?? 'Active',
            'created_by' => $data['created_by']
        ]);
        return $db->lastInsertId();
    }

    public static function update($db, $id, $data) {
        $stmt = $db->prepare("
            UPDATE loan_plans SET 
                name = :name,
                min_amount = :min_amount,
                max_amount = :max_amount,
                interest_rate = :interest_rate,
                interest_type = :interest_type,
                duration_value = :duration_value,
                duration_unit = :duration_unit,
                collection_frequency = :collection_frequency,
                processing_fee = :processing_fee,
                penalty_per_day = :penalty_per_day,
                penalty_per_month = :penalty_per_month,
                status = :status
            WHERE id = :id AND deleted_at IS NULL
        ");
        return $stmt->execute([
            'id' => $id,
            'name' => $data['name'],
            'min_amount' => $data['min_amount'],
            'max_amount' => $data['max_amount'],
            'interest_rate' => $data['interest_rate'],
            'interest_type' => $data['interest_type'],
            'duration_value' => $data['duration_value'],
            'duration_unit' => $data['duration_unit'],
            'collection_frequency' => $data['collection_frequency'],
            'processing_fee' => $data['processing_fee'],
            'penalty_per_day' => $data['penalty_per_day'],
            'penalty_per_month' => $data['penalty_per_month'],
            'status' => $data['status']
        ]);
    }

    public static function delete($db, $id) {
        $stmt = $db->prepare("UPDATE loan_plans SET deleted_at = NOW() WHERE id = :id");
        return $stmt->execute(['id' => $id]);
    }
}

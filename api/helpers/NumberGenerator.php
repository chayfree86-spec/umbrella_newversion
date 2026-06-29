<?php
/**
 * Formatted Number Generator
 * Format: UF-{PREFIX}-{YEAR}-{PADDED_NUMBER}
 * Example: UF-CU-2026-000001
 */
class NumberGenerator {

    public static function generate($db, $prefix) {
        $year = date('Y');

        // Atomic increment using MySQL
        $stmt = $db->prepare("
            INSERT INTO number_sequences (prefix, year, last_number) 
            VALUES (:prefix, :year, 1)
            ON DUPLICATE KEY UPDATE last_number = last_number + 1
        ");
        $stmt->execute(['prefix' => $prefix, 'year' => $year]);

        // Get the new number
        $stmt = $db->prepare("
            SELECT last_number FROM number_sequences 
            WHERE prefix = :prefix AND year = :year
        ");
        $stmt->execute(['prefix' => $prefix, 'year' => $year]);
        $row = $stmt->fetch();
        $number = $row['last_number'];

        return NUMBER_PREFIX . '-' . $prefix . '-' . $year . '-' . str_pad($number, 6, '0', STR_PAD_LEFT);
    }
}

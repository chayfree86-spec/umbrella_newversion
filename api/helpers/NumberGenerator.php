<?php
/**
 * Formatted Number Generator
 * Format: UF-{PREFIX}-{YEAR}-{PADDED_NUMBER}
 * Example: UF-CU-2026-000001
 *
 * The display year comes from the current server datetime. The sequence table
 * tracks only one running counter per prefix.
 */
class NumberGenerator {

    public static function generate($db, $prefix) {
        $year = date('Y');

        // Atomic increment — LAST_INSERT_ID(expr) session-scoped trick.
        // Purana version UPDATE ke baad ek alag SELECT karta tha, jo do
        // connections ke beech race create karta tha: agent/branch/admin
        // agar bilkul saath me register karein to dono ko wahi last_number
        // mil sakta tha (duplicate account_no crash). Ab UPDATE khud hi
        // apni session ke liye number capture kar leta hai, koi race nahi.
        // UPDATE hamesha pehle try karo — LAST_INSERT_ID(expr) ek plain
        // UPDATE me bharosemand hai (koi AUTO_INCREMENT column beech me
        // hijack nahi karta, jo INSERT...ON DUPLICATE KEY UPDATE ke fresh-row
        // path me hota tha).
        $stmt = $db->prepare("
            UPDATE number_sequences
            SET last_number = LAST_INSERT_ID(last_number + 1)
            WHERE prefix = :prefix
        ");
        $stmt->execute(['prefix' => $prefix]);

        if ($stmt->rowCount() === 0) {
            // Prefix pehli baar dikha (jaise flush/reseed ke baad) — base
            // row bana ke UPDATE dobara try karo, taaki LAST_INSERT_ID()
            // sahi se capture ho.
            $db->prepare("INSERT IGNORE INTO number_sequences (prefix, last_number) VALUES (:prefix, 0)")
               ->execute(['prefix' => $prefix]);
            $stmt->execute(['prefix' => $prefix]);
        }

        $number = (int)$db->query("SELECT LAST_INSERT_ID()")->fetchColumn();

        return NUMBER_PREFIX . '-' . $prefix . '-' . $year . '-' . str_pad($number, 6, '0', STR_PAD_LEFT);
    }
}

<?php
require 'api/config/database.php';
try {
    $db = Database::connect();
    $p = password_hash('admin123', PASSWORD_BCRYPT);
    $pin = password_hash('1234', PASSWORD_BCRYPT);
    $stmt = $db->prepare("UPDATE users SET password_hash = ?, pin_hash = ? WHERE id = 1");
    $stmt->execute([$p, $pin]);
    echo "SUCCESSFULLY UPDATED ADMIN PASSWORD AND PIN\n";
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}

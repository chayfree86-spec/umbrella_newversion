<?php
require_once __DIR__ . '/api/config/database.php';
$db = Database::connect();

$rows = $db->query("SELECT id, entry_date, entry_type, category, description, reference_no, amount, balance_after FROM cash_book ORDER BY id ASC")->fetchAll(PDO::FETCH_ASSOC);
echo "CASH BOOK ENTRIES IN DB:\n";
foreach ($rows as $r) {
    echo "ID: {$r['id']} | Date: {$r['entry_date']} | Type: {$r['entry_type']} | Cat: {$r['category']} | Ref: {$r['reference_no']} | Amt: {$r['amount']} | Bal: {$r['balance_after']}\n";
}
?>

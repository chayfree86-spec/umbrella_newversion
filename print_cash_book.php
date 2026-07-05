<?php
require_once __DIR__ . '/api/config/database.php';
$db = Database::connect();

$q = $db->query("SELECT * FROM cash_book ORDER BY id DESC LIMIT 5");
print_r($q->fetchAll());

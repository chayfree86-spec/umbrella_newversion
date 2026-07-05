<?php
/**
 * Simple SQL Migration Runner
 *
 * Usage (CLI):
 *   php api/database/migrate.php            -> pending migrations chalao
 *   php api/database/migrate.php --seed     -> migrations + master data seed
 *   php api/database/migrate.php --status   -> applied / pending list dikhao
 *
 * - Har migration ek hi baar chalti hai (`migrations` table me track hoti hai)
 * - Seeds bhi track hote hain ('seed:' prefix ke saath) — dobara nahi chalte
 * - Sabhi migrations CREATE TABLE IF NOT EXISTS use karti hain, isliye
 *   pehle se bane DB par bhi safe hain
 */

if (php_sapi_name() !== 'cli') {
    die("CLI se chalaiye: php api/database/migrate.php\n");
}

require_once __DIR__ . '/../config/database.php';

$db = Database::connect();

$db->exec("CREATE TABLE IF NOT EXISTS `migrations` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `migration` VARCHAR(255) NOT NULL UNIQUE,
    `applied_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB");

$applied = $db->query("SELECT migration FROM migrations")->fetchAll(PDO::FETCH_COLUMN);

function runSqlFile($db, $path) {
    $sql = file_get_contents($path);
    // Statements ';' + newline (ya file end) par todo
    $statements = preg_split('/;\s*(?:\r?\n|$)/', $sql);
    foreach ($statements as $stmt) {
        // Pure comment / khali chunks chhodo
        $clean = trim(preg_replace('/^\s*--.*$/m', '', $stmt));
        if ($clean === '') continue;
        $db->exec($stmt);
    }
}

$args = array_slice($argv, 1);
$withSeed   = in_array('--seed', $args);
$statusOnly = in_array('--status', $args);

$migrationFiles = glob(__DIR__ . '/migrations/*.sql');
sort($migrationFiles);
$seedFiles = glob(__DIR__ . '/seeds/*.sql');
sort($seedFiles);

if ($statusOnly) {
    echo "== Migrations ==\n";
    foreach ($migrationFiles as $file) {
        $name = basename($file);
        echo (in_array($name, $applied) ? '[applied] ' : '[pending] ') . $name . "\n";
    }
    echo "== Seeds ==\n";
    foreach ($seedFiles as $file) {
        $name = basename($file);
        echo (in_array('seed:' . $name, $applied) ? '[applied] ' : '[pending] ') . 'seed:' . $name . "\n";
    }
    exit(0);
}

$ins = $db->prepare("INSERT INTO migrations (migration) VALUES (:m)");
$ran = 0;

foreach ($migrationFiles as $file) {
    $name = basename($file);
    if (in_array($name, $applied)) continue;
    echo "Migrating: {$name}\n";
    runSqlFile($db, $file);
    $ins->execute(['m' => $name]);
    $ran++;
}
echo $ran > 0 ? "{$ran} migration(s) applied.\n" : "Nothing to migrate — sab up to date.\n";

if ($withSeed) {
    $seeded = 0;
    foreach ($seedFiles as $file) {
        $name = 'seed:' . basename($file);
        if (in_array($name, $applied)) {
            echo "Seed already applied: {$name}\n";
            continue;
        }
        echo "Seeding: {$name}\n";
        runSqlFile($db, $file);
        $ins->execute(['m' => $name]);
        $seeded++;
    }
    echo $seeded > 0 ? "{$seeded} seed(s) applied.\n" : "";
}

<?php
/**
 * Database Connection — PDO with MySQL
 * XAMPP location: c:/webproject
 * Database: ufin
 */
class Database {
    private static $instance = null;

    public static function connect() {
        if (self::$instance === null) {
            try {
                $host = Env::get('DB_HOST', 'localhost');
                $dbName = Env::get('DB_NAME', 'ufin');
                $username = Env::get('DB_USER', 'root');
                $password = Env::get('DB_PASS', '');
                $charset = Env::get('DB_CHARSET', 'utf8mb4');

                $dsn = "mysql:host=" . $host . ";dbname=" . $dbName . ";charset=" . $charset;
                self::$instance = new PDO($dsn, $username, $password, [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                    PDO::MYSQL_ATTR_INIT_COMMAND => "SET time_zone = '+05:30'"
                ]);
            } catch (PDOException $e) {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Database connection failed. Please check configuration.'
                ]);
                exit;
            }
        }
        return self::$instance;
    }
}

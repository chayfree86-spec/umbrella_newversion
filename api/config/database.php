<?php
/**
 * Database Connection — PDO with MySQL
 * XAMPP location: c:/webproject
 * Database: ufin
 */
class Database {
    private static $instance = null;
    
    private const HOST = 'localhost';
    private const DB_NAME = 'ufin';
    private const USERNAME = 'root';
    private const PASSWORD = '';
    private const CHARSET = 'utf8mb4';

    public static function connect() {
        if (self::$instance === null) {
            try {
                $dsn = "mysql:host=" . self::HOST . ";dbname=" . self::DB_NAME . ";charset=" . self::CHARSET;
                self::$instance = new PDO($dsn, self::USERNAME, self::PASSWORD, [
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

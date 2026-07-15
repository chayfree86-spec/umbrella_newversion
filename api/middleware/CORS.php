<?php
/**
 * CORS Middleware
 */
class CORS {
    public static function handle() {
        // Allow dynamic origin matching ONLY if it matches trusted local origins or host subdomains
        if (isset($_SERVER['HTTP_ORIGIN'])) {
            $origin = $_SERVER['HTTP_ORIGIN'];
            $allowed = false;

            // Allow localhost / 127.0.0.1 on any port for development
            if (preg_match('/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/', $origin)) {
                $allowed = true;
            } else {
                // Check if origin host matches current host domain or its subdomains
                $host = $_SERVER['HTTP_HOST'] ?? '';
                $hostName = explode(':', $host)[0];
                $parsedOrigin = parse_url($origin, PHP_URL_HOST);

                if ($parsedOrigin && ($parsedOrigin === $hostName || str_ends_with($parsedOrigin, '.' . $hostName))) {
                    $allowed = true;
                }
            }

            if ($allowed) {
                header("Access-Control-Allow-Origin: {$origin}");
                header('Access-Control-Allow-Credentials: true');
                header('Access-Control-Max-Age: 86400'); // Cache for 1 day
            }
        }

        // Access-Control headers are received during OPTIONS requests
        if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
            if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD'])) {
                header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
            }
            if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'])) {
                header("Access-Control-Allow-Headers: {$_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']}");
            }
            exit(0);
        }
    }
}

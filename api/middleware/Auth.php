<?php
/**
 * Authentication Middleware
 */
class Auth {
    public static function authenticate($db) {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';

        if (empty($authHeader) || !preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            throw new Exception('Access Denied. Authorization token missing.', 401);
        }

        $token = $matches[1];

        try {
            $payload = JWT::decode($token);
            $userId = $payload['user_id'];

            // Fetch user details from database
            $user = User::getById($db, $userId);

            if (!$user) {
                throw new Exception('User account not found.', 401);
            }

            if ($user['status'] !== 'Active') {
                throw new Exception('Your account is currently ' . $user['status'] . '.', 401);
            }

            return $user;
        } catch (Exception $e) {
            throw new Exception($e->getMessage(), 401);
        }
    }
}

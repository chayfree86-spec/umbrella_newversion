<?php
/**
 * Authentication Controller
 */
class AuthController {

    public static function login($db, $input) {
        $errors = Validator::required($input, ['username']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        $login = trim($input['username']);
        $user = User::getByMobileOrEmail($db, $login);

        if (!$user) {
            Response::error('No account registered with this email or mobile number.', 401);
        }

        if ($user['status'] !== 'Active') {
            Response::error('Your account is currently ' . $user['status'] . '.', 403);
        }

        // Determine if logging in using PIN (numeric only username) or Password
        $isMobile = preg_match('/^[0-9+\s-]*$/', $login) && strlen($login) > 0;

        if ($isMobile) {
            if (empty($input['pin'])) {
                Response::error('Validation error', 422, ['pin' => 'PIN is required for mobile login.']);
            }
            $pin = trim($input['pin']);
            
            if (empty($user['pin_hash'])) {
                // Default-PIN fallback is a super-admin-only bypass (fresh seed).
                // Every other role must have a proper hashed PIN set in the backend.
                if ($user['role_slug'] !== 'super_admin') {
                    Response::error('Security PIN is not set for this account. Please contact the administrator.', 403);
                }
                if ($pin !== '2310' && $pin !== '1234') {
                    Response::error('Incorrect Security PIN.', 401);
                }
            } else {
                if (!password_verify($pin, $user['pin_hash'])) {
                    Response::error('Incorrect Security PIN.', 401);
                }
            }
        } else {
            if (empty($input['password'])) {
                Response::error('Validation error', 422, ['password' => 'Password is required.']);
            }
            $password = trim($input['password']);

            if (!password_verify($password, $user['password_hash'])) {
                Response::error('Incorrect Password.', 401);
            }
        }

        // Update login stats
        User::updateLoginTime($db, $user['id']);

        // Generate Token
        $tokenPayload = [
            'user_id' => $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'mobile' => $user['mobile'],
            'role' => $user['role_name'],
            'role_slug' => $user['role_slug'],
            'branch_id' => $user['branch_id'],
            'area_id' => $user['area_id'],
            'agent_id' => $user['agent_id']
        ];
        $token = JWT::encode($tokenPayload);

        // Update user token in database
        $stmt = $db->prepare("UPDATE users SET auth_token = :token, token_expires_at = DATE_ADD(NOW(), INTERVAL :hours HOUR) WHERE id = :id");
        $stmt->execute([
            'token' => $token,
            'hours' => JWT_EXPIRY_HOURS,
            'id' => $user['id']
        ]);

        // Audit Log
        AuditLog::log($db, $user['id'], 'login', 'auth', $user['id']);

        Response::success([
            'token' => $token,
            'user' => [
                'user_id' => $user['id'],
                'name' => $user['name'],
                'mobile' => $user['mobile'],
                'email' => $user['email'],
                'role' => $user['role_name'],
                'role_slug' => $user['role_slug'],
                'branch_id' => $user['branch_id'],
                'area_id' => $user['area_id'],
                'agent_id' => $user['agent_id'],
                'permissions' => $user['permissions'],
                'can_approve_accounts' => Policy::canApprove($db, $user['policy_id'] ?? null)
            ]
        ], 'Logged in successfully.');
    }

    public static function logout($db, $authUser) {
        $stmt = $db->prepare("UPDATE users SET auth_token = NULL, token_expires_at = NULL WHERE id = :id");
        $stmt->execute(['id' => $authUser['id']]);

        AuditLog::log($db, $authUser['id'], 'logout', 'auth', $authUser['id']);
        Response::success(null, 'Logged out successfully.');
    }

    public static function profile($db, $authUser) {
        Response::success([
            'user_id' => $authUser['id'],
            'name' => $authUser['name'],
            'mobile' => $authUser['mobile'],
            'email' => $authUser['email'],
            'role' => $authUser['role_name'],
            'role_slug' => $authUser['role_slug'],
            'branch_id' => $authUser['branch_id'],
            'area_id' => $authUser['area_id'],
            'agent_id' => $authUser['agent_id'],
            'permissions' => $authUser['permissions'],
            'can_approve_accounts' => Policy::canApprove($db, $authUser['policy_id'] ?? null)
        ]);
    }

    public static function changePassword($db, $authUser, $input) {
        $errors = [];
        if (isset($input['password'])) {
            if (strlen($input['password']) < 6) {
                $errors['password'] = 'Password must be at least 6 characters.';
            }
        }
        if (isset($input['pin'])) {
            if (!preg_match('/^\d{4}$/', $input['pin'])) {
                $errors['pin'] = 'PIN must be exactly 4 digits.';
            }
        }

        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        $password = isset($input['password']) ? trim($input['password']) : null;
        $pin = isset($input['pin']) ? trim($input['pin']) : null;

        if ($password === null && $pin === null) {
            Response::error('No new password or PIN provided.', 400);
        }

        User::changePasswordOrPin($db, $authUser['id'], $password, $pin);
        AuditLog::log($db, $authUser['id'], 'change_credentials', 'auth', $authUser['id']);

        Response::success(null, 'Credentials updated successfully.');
    }

    public static function resetCredentials($db, $input) {
        $errors = Validator::required($input, ['username', 'password', 'pin']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        $user = User::getByMobileOrEmail($db, trim($input['username']));
        if (!$user) {
            Response::error('No account registered with this email or mobile number.', 404);
        }

        $password = trim($input['password']);
        $pin = trim($input['pin']);

        if (strlen($password) < 6) {
            Response::error('Password must be at least 6 characters.', 422);
        }
        if (!preg_match('/^\d{4}$/', $pin)) {
            Response::error('PIN must be exactly 4 digits.', 422);
        }

        User::changePasswordOrPin($db, $user['id'], $password, $pin);
        AuditLog::log($db, $user['id'], 'reset_credentials_anonymous', 'auth', $user['id']);

        Response::success(null, 'Credentials updated successfully.');
    }
}
?>

<?php
/**
 * User Management Controller
 */
class UserController {

    public static function index($db, $authUser) {
        $stmt = $db->prepare("
            SELECT u.id, u.uuid, u.name, u.email, u.mobile, u.status, u.last_login_at, u.created_at,
            u.role_id, u.branch_id, u.area_id, u.agent_id, u.policy_id,
            r.name as role_name, r.slug as role_slug,
            b.name as branch_name, ar.name as area_name,
            p.name as policy_name
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN branches b ON u.branch_id = b.id
            LEFT JOIN areas ar ON u.area_id = ar.id
            LEFT JOIN policies p ON u.policy_id = p.id
            WHERE u.deleted_at IS NULL
            ORDER BY u.id DESC
        ");
        $stmt->execute();
        $users = $stmt->fetchAll();
        Response::success($users);
    }

    public static function show($db, $authUser, $id) {
        $user = User::getById($db, $id);
        if (!$user) {
            Response::error('User not found.', 404);
        }
        unset($user['password_hash'], $user['pin_hash'], $user['auth_token']);
        Response::success($user);
    }

    public static function store($db, $authUser, $input) {
        $errors = Validator::required($input, ['name', 'mobile', 'role_id']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        // Check uniqueness of mobile/email
        $stmt = $db->prepare("SELECT id FROM users WHERE (mobile = :mobile OR (email = :email AND email IS NOT NULL)) AND deleted_at IS NULL");
        $stmt->execute([
            'mobile' => $input['mobile'],
            'email' => $input['email'] ?? null
        ]);
        if ($stmt->fetch()) {
            Response::error('User with this email or mobile number already exists.', 409);
        }

        // Default password (admin123) and PIN (1234) for new users
        $passwordHash = password_hash($input['password'] ?? 'admin123', PASSWORD_BCRYPT);
        $pinHash = password_hash($input['pin'] ?? '1234', PASSWORD_BCRYPT);

        $stmt = $db->prepare("
            INSERT INTO users (
                uuid, name, email, mobile, password_hash, pin_hash, role_id, 
                branch_id, area_id, agent_id, policy_id, photo_path, status
            ) VALUES (
                :uuid, :name, :email, :mobile, :password_hash, :pin_hash, :role_id, 
                :branch_id, :area_id, :agent_id, :policy_id, :photo_path, :status
            )
        ");

        $uuid = Validator::uuid();
        $stmt->execute([
            'uuid' => $uuid,
            'name' => $input['name'],
            'email' => !empty($input['email']) ? $input['email'] : null,
            'mobile' => $input['mobile'],
            'password_hash' => $passwordHash,
            'pin_hash' => $pinHash,
            'role_id' => $input['role_id'],
            'branch_id' => !empty($input['branch_id']) ? $input['branch_id'] : null,
            'area_id' => !empty($input['area_id']) ? $input['area_id'] : null,
            'agent_id' => !empty($input['agent_id']) ? $input['agent_id'] : null,
            'policy_id' => !empty($input['policy_id']) ? $input['policy_id'] : null,
            'photo_path' => $input['photo_path'] ?? null,
            'status' => $input['status'] ?? 'Active'
        ]);

        $id = $db->lastInsertId();
        $user = User::getById($db, $id);
        unset($user['password_hash'], $user['pin_hash'], $user['auth_token']);

        AuditLog::log($db, $authUser['id'], 'create_user', 'users', $id, null, $user);
        Response::success($user, 'System user created successfully.', 201);
    }

    public static function update($db, $authUser, $id, $input) {
        $user = User::getById($db, $id);
        if (!$user) {
            Response::error('User not found.', 404);
        }

        $errors = Validator::required($input, ['name', 'mobile', 'role_id']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        // Check unique mobile/email if updated
        $stmt = $db->prepare("SELECT id FROM users WHERE (mobile = :mobile OR (email = :email AND email IS NOT NULL)) AND id != :id AND deleted_at IS NULL");
        $stmt->execute([
            'mobile' => $input['mobile'],
            'email' => $input['email'] ?? null,
            'id' => $id
        ]);
        if ($stmt->fetch()) {
            Response::error('User with this email or mobile number already exists.', 409);
        }

        $stmt = $db->prepare("
            UPDATE users SET 
                name = :name,
                email = :email,
                mobile = :mobile,
                role_id = :role_id,
                branch_id = :branch_id,
                area_id = :area_id,
                agent_id = :agent_id,
                policy_id = :policy_id,
                status = :status
            WHERE id = :id AND deleted_at IS NULL
        ");
        $stmt->execute([
            'id' => $id,
            'name' => $input['name'],
            'email' => !empty($input['email']) ? $input['email'] : null,
            'mobile' => $input['mobile'],
            'role_id' => $input['role_id'],
            'branch_id' => !empty($input['branch_id']) ? $input['branch_id'] : null,
            'area_id' => !empty($input['area_id']) ? $input['area_id'] : null,
            'agent_id' => !empty($input['agent_id']) ? $input['agent_id'] : null,
            'policy_id' => !empty($input['policy_id']) ? $input['policy_id'] : null,
            'status' => $input['status'] ?? 'Active'
        ]);

        $updated = User::getById($db, $id);
        unset($updated['password_hash'], $updated['pin_hash'], $updated['auth_token']);

        AuditLog::log($db, $authUser['id'], 'update_user', 'users', $id, $user, $updated);
        Response::success($updated, 'System user updated successfully.');
    }

    public static function destroy($db, $authUser, $id) {
        if ($authUser['id'] == $id) {
            Response::error('Self deletion is prohibited.', 400);
        }

        $user = User::getById($db, $id);
        if (!$user) {
            Response::error('User not found.', 404);
        }

        $stmt = $db->prepare("UPDATE users SET deleted_at = NOW() WHERE id = :id");
        $stmt->execute(['id' => $id]);

        AuditLog::log($db, $authUser['id'], 'delete_user', 'users', $id, $user);
        Response::success(null, 'System user deleted successfully.');
    }

    public static function resetPassword($db, $authUser, $id, $input) {
        $user = User::getById($db, $id);
        if (!$user) {
            Response::error('User not found.', 404);
        }

        $password = !empty($input['password']) ? trim($input['password']) : null;
        $pin = !empty($input['pin']) ? trim($input['pin']) : null;

        if ($password === null && $pin === null) {
            Response::error('Please provide a new password or PIN to reset.', 422);
        }

        $errors = [];
        if ($password !== null && strlen($password) < 6) {
            $errors['password'] = 'Password must be at least 6 characters.';
        }
        if ($pin !== null && !preg_match('/^\d{4}$/', $pin)) {
            $errors['pin'] = 'PIN must be exactly 4 digits.';
        }
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        User::changePasswordOrPin($db, $id, $password, $pin);

        AuditLog::log($db, $authUser['id'], 'reset_password', 'users', $id);
        $msg = ($password && $pin) ? 'Password and PIN reset successfully.'
            : ($password ? 'Password reset successfully.' : 'PIN reset successfully.');
        Response::success(null, $msg);
    }
}
?>

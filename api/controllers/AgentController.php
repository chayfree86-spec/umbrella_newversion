<?php
/**
 * Agent Controller
 */
class AgentController {

    public static function index($db, $authUser) {
        $agents = Agent::getAll($db);
        Response::success($agents);
    }

    public static function show($db, $authUser, $id) {
        $agent = Agent::getById($db, $id);
        if (!$agent) {
            Response::error('Agent profile not found.', 404);
        }
        
        // Find linked system user.
        // Priority: agents.user_id ka explicit link sabse pehle. Uske baad
        // fallback SIRF agent-role (role_id = 4) users tak — warna area/branch
        // manager (jinka galti se agent_id set ho) yahan aa jata tha.
        $stmt = $db->prepare("
            SELECT id, name, email, mobile, status, last_login_at
            FROM users
            WHERE deleted_at IS NULL
              AND (
                    id = :user_id
                 OR (role_id = 4 AND (agent_id = :agent_id OR mobile = :mobile))
              )
            ORDER BY (id = :user_id2) DESC, (role_id = 4) DESC, id ASC
            LIMIT 1
        ");
        $stmt->execute([
            'user_id' => !empty($agent['user_id']) ? $agent['user_id'] : 0,
            'user_id2' => !empty($agent['user_id']) ? $agent['user_id'] : 0,
            'agent_id' => $id,
            'mobile' => $agent['mobile']
        ]);
        $user = $stmt->fetch();
        $agent['linked_user'] = $user ? $user : null;

        Response::success($agent);
    }

    public static function byArea($db, $authUser, $areaId) {
        $agents = Agent::getByArea($db, $areaId);
        Response::success($agents);
    }

    public static function store($db, $authUser, $input) {
        $errors = Validator::required($input, ['code', 'name', 'mobile', 'branch_id', 'area_id']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        // Check unique code
        if (Agent::getByCode($db, $input['code'])) {
            Response::error('Agent with this code already exists.', 409);
        }

        // Validate branch & area
        if (!Branch::getById($db, $input['branch_id'])) {
            Response::error('Invalid branch selected.', 422);
        }
        if (!Area::getById($db, $input['area_id'])) {
            Response::error('Invalid area selected.', 422);
        }

        // Handle Photo Upload
        if (isset($_FILES['photo'])) {
            $input['photo_path'] = FileUpload::upload($_FILES['photo'], 'photos');
        }

        // Mobile must be valid 10-digit for the login user
        if (!preg_match('/^[6-9]\d{9}$/', $input['mobile'])) {
            Response::error('A valid 10-digit mobile number is required (used for agent login).', 422);
        }

        $db->beginTransaction();
        try {
            // 1. Create agent record
            $id = Agent::create($db, $input);

            // 2. Login user — mobile pe pehle se user ho to link, warna naya banao
            $defaultPin = substr(preg_replace('/\D/', '', $input['mobile']), -4);   // last 4 digits
            $defaultPassword = $input['mobile'];                                     // full mobile

            $stmtU = $db->prepare("SELECT id, role_id, agent_id FROM users WHERE mobile = :m AND deleted_at IS NULL LIMIT 1");
            $stmtU->execute(['m' => $input['mobile']]);
            $existingUser = $stmtU->fetch();

            $createdLogin = false;
            if ($existingUser) {
                if ((int)$existingUser['role_id'] !== 4) {
                    throw new Exception('This mobile number already belongs to a non-agent user. Use a different mobile.');
                }
                // Existing agent-user ko is agent se link karo
                $userId = $existingUser['id'];
                $db->prepare("UPDATE users SET agent_id = :aid, branch_id = :bid, area_id = :arid, policy_id = :pid, name = :name, email = :email WHERE id = :uid")
                   ->execute([
                       'aid' => $id, 'bid' => $input['branch_id'], 'arid' => $input['area_id'],
                       'pid' => !empty($input['policy_id']) ? $input['policy_id'] : null,
                       'name' => $input['name'],
                       'email' => !empty($input['email']) ? $input['email'] : null,
                       'uid' => $userId
                   ]);
            } else {
                // Naya agent login-user
                $stmtIns = $db->prepare("
                    INSERT INTO users (uuid, name, email, mobile, password_hash, pin_hash, role_id, branch_id, area_id, agent_id, policy_id, status)
                    VALUES (:uuid, :name, :email, :mobile, :pw, :pin, 4, :bid, :arid, :aid, :pid, 'Active')
                ");
                $stmtIns->execute([
                    'uuid' => Validator::uuid(),
                    'name' => $input['name'],
                    'email' => !empty($input['email']) ? $input['email'] : null,
                    'mobile' => $input['mobile'],
                    'pw' => password_hash($defaultPassword, PASSWORD_BCRYPT),
                    'pin' => password_hash($defaultPin, PASSWORD_BCRYPT),
                    'bid' => $input['branch_id'],
                    'arid' => $input['area_id'],
                    'aid' => $id,
                    'pid' => !empty($input['policy_id']) ? $input['policy_id'] : null
                ]);
                $userId = $db->lastInsertId();
                $createdLogin = true;
            }

            // 3. Agent -> user link
            $db->prepare("UPDATE agents SET user_id = :uid WHERE id = :id")
               ->execute(['uid' => $userId, 'id' => $id]);

            $db->commit();

            $agent = Agent::getById($db, $id);
            AuditLog::log($db, $authUser['id'], 'create_agent', 'agents', $id, null, $agent);

            $msg = $createdLogin
                ? "Agent created. Login — Mobile: {$input['mobile']}, PIN: {$defaultPin} (default; ask agent to change it)."
                : 'Agent created and linked to the existing user for this mobile.';
            Response::success($agent, $msg, 201);
        } catch (Exception $e) {
            $db->rollBack();
            Response::error($e->getMessage(), 400);
        }
    }

    public static function update($db, $authUser, $id, $input) {
        $agent = Agent::getById($db, $id);
        if (!$agent) {
            Response::error('Agent profile not found.', 404);
        }

        $errors = Validator::required($input, ['code', 'name', 'mobile', 'branch_id', 'area_id']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        // Check unique code if changed
        $existing = Agent::getByCode($db, $input['code']);
        if ($existing && $existing['id'] != $id) {
            Response::error('Agent with this code already exists.', 409);
        }

        // Validate branch & area
        if (!Branch::getById($db, $input['branch_id'])) {
            Response::error('Invalid branch selected.', 422);
        }
        if (!Area::getById($db, $input['area_id'])) {
            Response::error('Invalid area selected.', 422);
        }

        // Handle Photo Upload
        if (isset($_FILES['photo'])) {
            $input['photo_path'] = FileUpload::upload($_FILES['photo'], 'photos');
        } else {
            $input['photo_path'] = $agent['photo_path'];
        }

        Agent::update($db, $id, $input);
        
        // Sync linked user details if exists
        $stmtUser = $db->prepare("
            UPDATE users SET 
                name = :name,
                email = :email,
                mobile = :mobile
            WHERE (id = :user_id OR agent_id = :agent_id OR (mobile = :old_mobile AND role_id = 4))
              AND deleted_at IS NULL
        ");
        $stmtUser->execute([
            'name' => $input['name'],
            'email' => !empty($input['email']) ? $input['email'] : null,
            'mobile' => $input['mobile'],
            'user_id' => !empty($agent['user_id']) ? $agent['user_id'] : 0,
            'agent_id' => $id,
            'old_mobile' => $agent['mobile']
        ]);

        $updated = Agent::getById($db, $id);
        
        // Fetch linked user for response (same priority + agent-role-only
        // fallback as show(), taaki manager kabhi na aaye)
        $stmt = $db->prepare("
            SELECT id, name, email, mobile, status, last_login_at
            FROM users
            WHERE deleted_at IS NULL
              AND (
                    id = :user_id
                 OR (role_id = 4 AND (agent_id = :agent_id OR mobile = :mobile))
              )
            ORDER BY (id = :user_id2) DESC, (role_id = 4) DESC, id ASC
            LIMIT 1
        ");
        $stmt->execute([
            'user_id' => !empty($updated['user_id']) ? $updated['user_id'] : 0,
            'user_id2' => !empty($updated['user_id']) ? $updated['user_id'] : 0,
            'agent_id' => $id,
            'mobile' => $updated['mobile']
        ]);
        $user = $stmt->fetch();
        $updated['linked_user'] = $user ? $user : null;

        AuditLog::log($db, $authUser['id'], 'update_agent', 'agents', $id, $agent, $updated);
        Response::success($updated, 'Agent profile updated successfully.');
    }

    public static function destroy($db, $authUser, $id) {
        $agent = Agent::getById($db, $id);
        if (!$agent) {
            Response::error('Agent profile not found.', 404);
        }

        // Check if there are active customers assigned to this agent
        $stmt = $db->prepare("SELECT COUNT(*) FROM customers WHERE agent_id = :id AND deleted_at IS NULL");
        $stmt->execute(['id' => $id]);
        if ($stmt->fetchColumn() > 0) {
            Response::error('Cannot delete agent. They have active customer accounts assigned.', 400);
        }

        Agent::delete($db, $id);

        // Linked login-user ko bhi deactivate karo taaki wo login na kar sake
        $db->prepare("UPDATE users SET status = 'Inactive' WHERE (id = :uid OR agent_id = :aid) AND role_id = 4 AND deleted_at IS NULL")
           ->execute(['uid' => !empty($agent['user_id']) ? $agent['user_id'] : 0, 'aid' => $id]);

        AuditLog::log($db, $authUser['id'], 'delete_agent', 'agents', $id, $agent);
        Response::success(null, 'Agent profile deleted successfully.');
    }
}
?>

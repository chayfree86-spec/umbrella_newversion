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

        $id = Agent::create($db, $input);
        $agent = Agent::getById($db, $id);

        AuditLog::log($db, $authUser['id'], 'create_agent', 'agents', $id, null, $agent);
        Response::success($agent, 'Agent profile created successfully.', 201);
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
        $updated = Agent::getById($db, $id);

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

        AuditLog::log($db, $authUser['id'], 'delete_agent', 'agents', $id, $agent);
        Response::success(null, 'Agent profile deleted successfully.');
    }
}
?>

<?php
/**
 * Area Controller
 */
class AreaController {

    public static function index($db, $authUser) {
        $areas = Area::getAll($db);
        Response::success($areas);
    }

    public static function byBranch($db, $authUser, $branchId) {
        $areas = Area::getByBranch($db, $branchId);
        Response::success($areas);
    }

    public static function store($db, $authUser, $input) {
        $errors = Validator::required($input, ['code', 'name', 'branch_id']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        // Validate branch exists
        if (!Branch::getById($db, $input['branch_id'])) {
            Response::error('Invalid branch selected.', 422);
        }

        // Check unique code
        if (Area::getByCode($db, $input['code'])) {
            Response::error('Area with this code already exists.', 409);
        }

        $id = Area::create($db, $input);
        $area = Area::getById($db, $id);

        AuditLog::log($db, $authUser['id'], 'create_area', 'areas', $id, null, $area);
        Response::success($area, 'Area created successfully.', 201);
    }

    public static function update($db, $authUser, $id, $input) {
        $area = Area::getById($db, $id);
        if (!$area) {
            Response::error('Area not found.', 404);
        }

        $errors = Validator::required($input, ['code', 'name', 'branch_id']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        // Validate branch exists
        if (!Branch::getById($db, $input['branch_id'])) {
            Response::error('Invalid branch selected.', 422);
        }

        // Check unique code if updated
        $existing = Area::getByCode($db, $input['code']);
        if ($existing && $existing['id'] != $id) {
            Response::error('Area with this code already exists.', 409);
        }

        Area::update($db, $id, $input);
        $updated = Area::getById($db, $id);

        AuditLog::log($db, $authUser['id'], 'update_area', 'areas', $id, $area, $updated);
        Response::success($updated, 'Area updated successfully.');
    }

    public static function destroy($db, $authUser, $id) {
        $area = Area::getById($db, $id);
        if (!$area) {
            Response::error('Area not found.', 404);
        }

        // Check if there are active agents in this area
        $stmt = $db->prepare("SELECT COUNT(*) FROM agents WHERE area_id = :id AND deleted_at IS NULL");
        $stmt->execute(['id' => $id]);
        if ($stmt->fetchColumn() > 0) {
            Response::error('Cannot delete area. It has active field agents assigned.', 400);
        }

        Area::delete($db, $id);

        AuditLog::log($db, $authUser['id'], 'delete_area', 'areas', $id, $area);
        Response::success(null, 'Area deleted successfully.');
    }
}
?>

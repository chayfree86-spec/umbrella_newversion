<?php
/**
 * Branch Controller
 */
class BranchController {

    public static function index($db, $authUser) {
        $branches = Branch::getAll($db);
        Response::success($branches);
    }

    public static function store($db, $authUser, $input) {
        $errors = Validator::required($input, ['code', 'name']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        // Check unique code
        if (Branch::getByCode($db, $input['code'])) {
            Response::error('Branch with this code already exists.', 409);
        }

        $id = Branch::create($db, $input);
        $branch = Branch::getById($db, $id);

        AuditLog::log($db, $authUser['id'], 'create_branch', 'branches', $id, null, $branch);
        Response::success($branch, 'Branch created successfully.', 201);
    }

    public static function update($db, $authUser, $id, $input) {
        $branch = Branch::getById($db, $id);
        if (!$branch) {
            Response::error('Branch not found.', 404);
        }

        $errors = Validator::required($input, ['code', 'name']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        // Check unique code if updated
        $existing = Branch::getByCode($db, $input['code']);
        if ($existing && $existing['id'] != $id) {
            Response::error('Branch with this code already exists.', 409);
        }

        Branch::update($db, $id, $input);
        $updated = Branch::getById($db, $id);

        AuditLog::log($db, $authUser['id'], 'update_branch', 'branches', $id, $branch, $updated);
        Response::success($updated, 'Branch updated successfully.');
    }

    public static function destroy($db, $authUser, $id) {
        $branch = Branch::getById($db, $id);
        if (!$branch) {
            Response::error('Branch not found.', 404);
        }

        // Check if there are active users/customers in this branch
        $stmt = $db->prepare("SELECT COUNT(*) FROM users WHERE branch_id = :id AND deleted_at IS NULL");
        $stmt->execute(['id' => $id]);
        if ($stmt->fetchColumn() > 0) {
            Response::error('Cannot delete branch. It has active users/staff assigned.', 400);
        }

        Branch::delete($db, $id);

        AuditLog::log($db, $authUser['id'], 'delete_branch', 'branches', $id, $branch);
        Response::success(null, 'Branch deleted successfully.');
    }
}
?>

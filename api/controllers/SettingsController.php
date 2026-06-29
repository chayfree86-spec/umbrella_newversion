<?php
/**
 * Settings and Policies Controller
 */
class SettingsController {

    public static function index($db, $authUser) {
        $settings = Setting::getAll($db);
        Response::success($settings);
    }

    public static function update($db, $authUser, $input) {
        foreach ($input as $key => $value) {
            Setting::update($db, $key, $value, $authUser['id']);
        }
        AuditLog::log($db, $authUser['id'], 'update_settings', 'settings', null, null, $input);
        Response::success(null, 'Settings updated successfully.');
    }

    public static function policies($db, $authUser) {
        $policies = Policy::getAll($db);
        Response::success($policies);
    }

    public static function storePolicy($db, $authUser, $input) {
        $errors = Validator::required($input, ['name', 'role']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        $id = Policy::create($db, array_merge($input, ['created_by' => $authUser['id']]));
        $policy = Policy::getById($db, $id);

        AuditLog::log($db, $authUser['id'], 'create_policy', 'policies', $id, null, $policy);
        Response::success($policy, 'Policy profile created successfully.', 201);
    }

    public static function updatePolicy($db, $authUser, $id, $input) {
        $policy = Policy::getById($db, $id);
        if (!$policy) {
            Response::error('Policy not found.', 404);
        }
        if ($policy['is_system']) {
            Response::error('System policy profiles cannot be modified.', 403);
        }

        $errors = Validator::required($input, ['name', 'role']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        Policy::update($db, $id, $input);
        $updated = Policy::getById($db, $id);

        AuditLog::log($db, $authUser['id'], 'update_policy', 'policies', $id, $policy, $updated);
        Response::success($updated, 'Policy profile updated successfully.');
    }

    public static function destroyPolicy($db, $authUser, $id) {
        $policy = Policy::getById($db, $id);
        if (!$policy) {
            Response::error('Policy not found.', 404);
        }
        if ($policy['is_system']) {
            Response::error('System policy profiles cannot be deleted.', 403);
        }

        Policy::delete($db, $id);

        AuditLog::log($db, $authUser['id'], 'delete_policy', 'policies', $id, $policy);
        Response::success(null, 'Policy profile deleted successfully.');
    }
}
?>

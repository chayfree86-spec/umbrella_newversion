<?php
/**
 * Role-Based Access Control Guard Middleware
 */
class RoleGuard {
    public static function check($user, $permissionSlug) {
        // Super admin always has bypass permission
        if ($user['role_slug'] === 'super_admin') {
            return true;
        }

        // Check if user permissions list contains the slug
        $permissions = $user['permissions'] ?? [];
        if (!in_array($permissionSlug, $permissions)) {
            throw new Exception("Unauthorized. You do not have permission to access this resource: {$permissionSlug}", 403);
        }

        return true;
    }
}

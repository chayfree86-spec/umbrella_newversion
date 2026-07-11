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

    // Account Approval (loan/saving) — sirf assigned Policy Profile
    // decide karti hai, koi role bypass nahi (Super Admin bhi is check
    // se guzarta hai, jaanboojh kar).
    public static function checkDisbursementPolicy($db, $user) {
        if (!Policy::canApprove($db, $user['policy_id'] ?? null)) {
            throw new Exception('Your policy profile does not allow account approval/disbursement.', 403);
        }
        return true;
    }
}

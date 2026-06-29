<?php
/**
 * Plan Master Controller (Loan and Saving Plans)
 */
class PlanController {

    public static function loanPlans($db, $authUser) {
        $plans = LoanPlan::getAll($db);
        Response::success($plans);
    }

    public static function storeLoanPlan($db, $authUser, $input) {
        $errors = Validator::required($input, ['name', 'min_amount', 'max_amount', 'interest_rate', 'duration_value']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        $id = LoanPlan::create($db, array_merge($input, ['created_by' => $authUser['id']]));
        $plan = LoanPlan::getById($db, $id);

        AuditLog::log($db, $authUser['id'], 'create_loan_plan', 'loan_plans', $id, null, $plan);
        Response::success($plan, 'Loan plan created successfully.', 201);
    }

    public static function updateLoanPlan($db, $authUser, $id, $input) {
        $plan = LoanPlan::getById($db, $id);
        if (!$plan) {
            Response::error('Loan plan not found.', 404);
        }

        $errors = Validator::required($input, ['name', 'min_amount', 'max_amount', 'interest_rate', 'duration_value']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        LoanPlan::update($db, $id, $input);
        $updated = LoanPlan::getById($db, $id);

        AuditLog::log($db, $authUser['id'], 'update_loan_plan', 'loan_plans', $id, $plan, $updated);
        Response::success($updated, 'Loan plan updated successfully.');
    }

    public static function destroyLoanPlan($db, $authUser, $id) {
        $plan = LoanPlan::getById($db, $id);
        if (!$plan) {
            Response::error('Loan plan not found.', 404);
        }

        // Check if there are active loan accounts on this plan
        $stmt = $db->prepare("SELECT COUNT(*) FROM loan_accounts WHERE loan_plan_id = :id AND deleted_at IS NULL");
        $stmt->execute(['id' => $id]);
        if ($stmt->fetchColumn() > 0) {
            Response::error('Cannot delete loan plan. It has active accounts assigned to it.', 400);
        }

        LoanPlan::delete($db, $id);

        AuditLog::log($db, $authUser['id'], 'delete_loan_plan', 'loan_plans', $id, $plan);
        Response::success(null, 'Loan plan deleted successfully.');
    }

    public static function savingPlans($db, $authUser) {
        $plans = SavingPlan::getAll($db);
        Response::success($plans);
    }

    public static function storeSavingPlan($db, $authUser, $input) {
        $errors = Validator::required($input, ['name', 'deposit_amount', 'interest_rate', 'duration_value']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        $id = SavingPlan::create($db, array_merge($input, ['created_by' => $authUser['id']]));
        $plan = SavingPlan::getById($db, $id);

        AuditLog::log($db, $authUser['id'], 'create_saving_plan', 'saving_plans', $id, null, $plan);
        Response::success($plan, 'Saving plan created successfully.', 201);
    }

    public static function updateSavingPlan($db, $authUser, $id, $input) {
        $plan = SavingPlan::getById($db, $id);
        if (!$plan) {
            Response::error('Saving plan not found.', 404);
        }

        $errors = Validator::required($input, ['name', 'deposit_amount', 'interest_rate', 'duration_value']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        SavingPlan::update($db, $id, $input);
        $updated = SavingPlan::getById($db, $id);

        AuditLog::log($db, $authUser['id'], 'update_saving_plan', 'saving_plans', $id, $plan, $updated);
        Response::success($updated, 'Saving plan updated successfully.');
    }

    public static function destroySavingPlan($db, $authUser, $id) {
        $plan = SavingPlan::getById($db, $id);
        if (!$plan) {
            Response::error('Saving plan not found.', 404);
        }

        // Check if there are active saving accounts on this plan
        $stmt = $db->prepare("SELECT COUNT(*) FROM saving_accounts WHERE saving_plan_id = :id AND deleted_at IS NULL");
        $stmt->execute(['id' => $id]);
        if ($stmt->fetchColumn() > 0) {
            Response::error('Cannot delete saving plan. It has active accounts assigned to it.', 400);
        }

        SavingPlan::delete($db, $id);

        AuditLog::log($db, $authUser['id'], 'delete_saving_plan', 'saving_plans', $id, $plan);
        Response::success(null, 'Saving plan deleted successfully.');
    }
}
?>

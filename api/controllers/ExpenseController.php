<?php
/**
 * Expense Controller
 */
class ExpenseController {

    public static function index($db, $authUser) {
        $month = $_GET['month'] ?? date('Y-m');
        $expenses = Expense::getList($db, $month);
        $summary = Expense::getSummary($db, $month);

        Response::success([
            'expenses' => $expenses,
            'summary' => [
                'saving_expense' => (float)$summary['saving_expense'],
                'loan_expense' => (float)$summary['loan_expense'],
                'individual_expense' => (float)$summary['individual_expense'],
                'total_expense' => (float)($summary['saving_expense'] + $summary['loan_expense'] + $summary['individual_expense'])
            ]
        ]);
    }

    public static function store($db, $authUser, $input) {
        $errors = Validator::required($input, ['expense_type', 'amount', 'entry_date']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        $amount = (float)$input['amount'];
        if ($amount <= 0) {
            Response::error('Amount must be greater than zero.', 422);
        }

        $allowedTypes = ['Saving Balance', 'Loan Balance', 'Individual'];
        if (!in_array($input['expense_type'], $allowedTypes)) {
            Response::error('Invalid expense type.', 422);
        }

        $currentMonth = date('Y-m');
        $newExpenseMonth = date('Y-m', strtotime($input['entry_date']));
        if ($newExpenseMonth < $currentMonth) {
            Response::error('Cannot add backdated expenses to previous months.', 400);
        }

        $branchId = $authUser['branch_id'] ?? null;
        if (!$branchId) {
            $branchId = $db->query("SELECT id FROM branches WHERE status = 'Active' LIMIT 1")->fetchColumn() ?: null;
        }

        $data = [
            'expense_type' => $input['expense_type'],
            'amount' => $amount,
            'entry_date' => $input['entry_date'],
            'remarks' => $input['remarks'] ?? null,
            'branch_id' => $branchId,
            'entered_by' => $authUser['id']
        ];

        try {
            $id = Expense::create($db, $data);
            AuditLog::log($db, $authUser['id'], 'create_expense', 'expenses', $id, null, $data);
            Response::success(['id' => $id], 'Expense added successfully.', 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public static function update($db, $authUser, $id, $input) {
        $expense = Expense::getById($db, $id);
        if (!$expense) {
            Response::error('Expense not found.', 404);
        }

        $currentMonth = date('Y-m');
        $expenseMonth = date('Y-m', strtotime($expense['entry_date']));
        if ($expenseMonth < $currentMonth) {
            Response::error('Expenses from previous months cannot be modified.', 400);
        }

        $errors = Validator::required($input, ['expense_type', 'amount', 'entry_date']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        $amount = (float)$input['amount'];
        if ($amount <= 0) {
            Response::error('Amount must be greater than zero.', 422);
        }

        $newExpenseMonth = date('Y-m', strtotime($input['entry_date']));
        if ($newExpenseMonth < $currentMonth) {
            Response::error('Cannot set expense date to a previous month.', 400);
        }

        $data = [
            'expense_type' => $input['expense_type'],
            'amount' => $amount,
            'entry_date' => $input['entry_date'],
            'remarks' => $input['remarks'] ?? null
        ];

        try {
            Expense::update($db, $id, $data);
            AuditLog::log($db, $authUser['id'], 'update_expense', 'expenses', $id, $expense, $data);
            Response::success(null, 'Expense updated successfully.');
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public static function destroy($db, $authUser, $id) {
        $expense = Expense::getById($db, $id);
        if (!$expense) {
            Response::error('Expense not found.', 404);
        }

        $currentMonth = date('Y-m');
        $expenseMonth = date('Y-m', strtotime($expense['entry_date']));
        if ($expenseMonth < $currentMonth) {
            Response::error('Expenses from previous months cannot be deleted.', 400);
        }

        try {
            Expense::delete($db, $id);
            AuditLog::log($db, $authUser['id'], 'delete_expense', 'expenses', $id, $expense, null);
            Response::success(null, 'Expense deleted successfully.');
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }
}

<?php
/**
 * Fund Management Controller
 */
class FundController {

    public static function summary($db, $authUser) {
        $summary = Fund::getSummary($db);
        Response::success($summary);
    }

    public static function addCapital($db, $authUser, $input) {
        $errors = Validator::required($input, ['amount', 'description']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        $amount = (float)$input['amount'];
        if ($amount <= 0) {
            Response::error('Capital amount must be greater than zero.', 422);
        }

        try {
            $txnNo = Fund::addCapital($db, $amount, $input['description'], $authUser['id']);
            Response::success(['transaction_no' => $txnNo], 'Owner capital added successfully.', 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public static function addInvestorFunding($db, $authUser, $input) {
        $errors = Validator::required($input, ['investor_name', 'amount', 'description']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        $amount = (float)$input['amount'];
        if ($amount <= 0) {
            Response::error('Funding amount must be greater than zero.', 422);
        }

        try {
            $txnNo = Fund::addInvestorFunding($db, $input['investor_name'], $amount, $input['description'], $authUser['id']);
            Response::success(['transaction_no' => $txnNo], 'Investor funding recorded successfully.', 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public static function transactions($db, $authUser) {
        $transactions = Fund::getTransactions($db);

        // Return BOTH snake_case + short legacy aliases so any consumer works
        $list = [];
        foreach ($transactions as $ce) {
            $list[] = [
                'id' => $ce['id'],
                // Display/filter date = entry kab BANI (created_at) — backdated
                // entry_date wali entries bhi apne asli month me dikhengi
                'transaction_date' => $ce['transaction_date'],
                'date' => date('d-m-Y', strtotime($ce['transaction_date'])),
                // Edit modal ke liye business date wahi rehti hai jo user ne chuni thi
                'entry_date' => $ce['entry_date'],
                'transaction_type' => $ce['transaction_type'],
                'type' => $ce['transaction_type'],
                'description' => $ce['description'],
                'desc' => $ce['description'],
                'reference_no' => $ce['reference_no'],
                'ref' => $ce['reference_no'],
                'amount' => (float)$ce['amount'],
                'entry_type' => $ce['entry_type'],
                'source_name' => $ce['source_name'],
                'created_by' => $ce['created_by'] ?: 'System',
                'user' => $ce['created_by'] ?: 'System'
            ];
        }

        Response::success($list);
    }

    public static function cashBalance($db, $authUser) {
        $summary = Fund::getSummary($db);
        Response::success(['overall_cash_balance' => $summary['overallCashBalance']]);
    }

    public static function updateTransaction($db, $authUser, $id, $input) {
        $errors = Validator::required($input, ['amount', 'description', 'entry_date']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        $amount = (float)$input['amount'];
        if ($amount <= 0) {
            Response::error('Transaction amount must be greater than zero.', 422);
        }

        try {
            Fund::updateTransaction($db, $id, $amount, $input['description'], $input['entry_date'], $authUser['id']);
            Response::success(null, 'Transaction updated successfully.');
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public static function executeTransfer($db, $authUser, $input) {
        $errors = Validator::required($input, ['type', 'amount', 'description', 'entry_date']);
        if (!empty($errors)) {
            Response::error('Validation error', 422, $errors);
        }

        $amount = (float)$input['amount'];
        if ($amount <= 0) {
            Response::error('Transfer amount must be greater than zero.', 422);
        }

        $type = $input['type'];
        if ($type !== 'saving_to_loan' && $type !== 'loan_to_saving') {
            Response::error('Invalid transfer type.', 422);
        }

        try {
            Fund::executeTransfer($db, $type, $amount, $input['description'], $input['entry_date'], $authUser['id']);
            Response::success(null, 'Fund transfer executed successfully.');
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public static function deleteTransaction($db, $authUser, $id) {
        try {
            Fund::deleteTransaction($db, $id, $authUser['id']);
            Response::success(null, 'Transaction deleted successfully.');
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }
}
?>

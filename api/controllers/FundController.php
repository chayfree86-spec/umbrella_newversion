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
        
        $list = [];
        foreach ($transactions as $ce) {
            $list[] = [
                'id' => $ce['id'],
                'date' => date('d-m-Y', strtotime($ce['entry_date'])),
                'entry_date' => $ce['entry_date'],
                'type' => (stripos($ce['description'] ?? '', 'transfer') !== false) 
                            ? 'Fund Transfer' 
                            : ($ce['entry_type'] === 'credit' ? 'Capital Added' : 'Withdrawal'),
                'amount' => (float)$ce['amount'],
                'desc' => $ce['description'],
                'ref' => $ce['transaction_no'],
                'user' => $ce['entered_name'] ?? 'System'
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

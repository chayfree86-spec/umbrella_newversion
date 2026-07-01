<?php
/**
 * Capital and Fund Management Database Model
 */
class Fund {

    public static function getSummary($db) {
        // Total Capital (Owner Equity + Investor Funding)
        $stmt = $db->prepare("SELECT COALESCE(SUM(total_invested), 0) FROM fund_sources WHERE status = 'Active'");
        $stmt->execute();
        $totalCapital = $stmt->fetchColumn();

        // Total Savings Deposited (Customer balances)
        $stmt = $db->prepare("SELECT COALESCE(SUM(total_deposited), 0) FROM saving_accounts WHERE deleted_at IS NULL");
        $stmt->execute();
        $customerSavings = (float)$stmt->fetchColumn();

        // Calculate net transfers between Savings and Loan Pool (to adjust virtual balances)
        // Savings to Loan Transfer increases capital, decreases savings
        $stmt = $db->prepare("SELECT COALESCE(SUM(amount), 0) FROM capital_entries WHERE description LIKE '%Savings to Loan%' OR description = 'Savings to Loan Fund Transfer'");
        $stmt->execute();
        $savingsToLoan = (float)$stmt->fetchColumn();

        // Loan to Savings Transfer decreases capital, increases savings
        $stmt = $db->prepare("SELECT COALESCE(SUM(amount), 0) FROM capital_entries WHERE description LIKE '%Loan to Savings%' OR description = 'Loan to Savings Fund Transfer'");
        $stmt->execute();
        $loanToSavings = (float)$stmt->fetchColumn();

        $netSavingsTransferred = $savingsToLoan - $loanToSavings;

        // Virtual savings balance of the branch
        $totalSavings = max(0, $customerSavings - $netSavingsTransferred);

        // Total Disbursed Loans (Approved principal)
        $stmt = $db->prepare("SELECT COALESCE(SUM(principal_amount), 0) FROM loan_accounts WHERE account_status NOT IN ('Processing', 'Rejected') AND deleted_at IS NULL");
        $stmt->execute();
        $totalDisbursed = $stmt->fetchColumn();

        // Total Interest Received
        $stmt = $db->prepare("SELECT COALESCE(SUM(interest_amount), 0) FROM loan_collections WHERE is_reversal = 0");
        $stmt->execute();
        $interestReceived = $stmt->fetchColumn();

        // Total Penalties Received
        $stmt = $db->prepare("SELECT COALESCE(SUM(penalty_amount), 0) FROM loan_collections WHERE is_reversal = 0");
        $stmt->execute();
        $penaltiesReceived = $stmt->fetchColumn();

        // Principal repaid (from loan collections)
        $stmt = $db->prepare("SELECT COALESCE(SUM(principal_amount), 0) FROM loan_collections WHERE is_reversal = 0");
        $stmt->execute();
        $principalRepaid = $stmt->fetchColumn();

        // Overall Cash Balance = (Capital + Savings + Interest + Penalties + Principal Repaid) - Disbursed
        $overallCash = ($totalCapital + $totalSavings + $interestReceived + $penaltiesReceived + $principalRepaid) - $totalDisbursed;

        // Loan pool size (100% allocation, no reserve)
        $loanPool = $totalCapital;

        $availableLoanFund = max(0, $loanPool - $totalDisbursed + $principalRepaid + $interestReceived + $penaltiesReceived);

        return [
            'totalCapital' => (float)$totalCapital,
            'total_capital' => (float)$totalCapital,
            'totalSavings' => (float)$totalSavings,
            'total_savings' => (float)$totalSavings,
            'loanPool' => (float)$loanPool,
            'loan_pool' => (float)$loanPool,
            'totalDisbursed' => (float)$totalDisbursed,
            'total_disbursed' => (float)$totalDisbursed,
            'interestReceived' => (float)($interestReceived + $penaltiesReceived),
            'total_interest' => (float)($interestReceived + $penaltiesReceived),
            'overallCashBalance' => (float)$overallCash,
            'cash_balance' => (float)$overallCash,
            'availableLoanFund' => (float)$availableLoanFund,
            'available_loan_fund' => (float)$availableLoanFund
        ];
    }

    public static function addCapital($db, $amount, $description, $userId) {
        $db->beginTransaction();
        try {
            $txnNo = NumberGenerator::generate($db, PREFIX_TRANSACTION);

            // Fetch or create owner equity source
            $stmt = $db->prepare("SELECT id FROM fund_sources WHERE source_type = 'owner_capital'");
            $stmt->execute();
            $sourceId = $stmt->fetchColumn();

            if (!$sourceId) {
                $stmtIns = $db->prepare("INSERT INTO fund_sources (uuid, source_type, source_name, status) VALUES (:uuid, 'owner_capital', 'Owner Equity capital', 'Active')");
                $stmtIns->execute(['uuid' => Validator::uuid()]);
                $sourceId = $db->lastInsertId();
            }

            // Update total invested
            $stmtUpdate = $db->prepare("UPDATE fund_sources SET total_invested = total_invested + :amount WHERE id = :id");
            $stmtUpdate->execute(['amount' => $amount, 'id' => $sourceId]);

            // Add capital entry
            $stmtEntry = $db->prepare("
                INSERT INTO capital_entries (uuid, transaction_no, fund_source_id, entry_type, amount, description, entry_date, entered_by)
                VALUES (:uuid, :txn_no, :source_id, 'credit', :amount, :desc, NOW(), :user_id)
            ");
            $stmtEntry->execute([
                'uuid' => Validator::uuid(),
                'txn_no' => $txnNo,
                'source_id' => $sourceId,
                'amount' => $amount,
                'desc' => $description,
                'user_id' => $userId
            ]);

            // Compute new balance separately (MySQL disallows INSERT + SELECT on same table)
            $currBal = (float)$db->query("SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END), 0) FROM cash_book")->fetchColumn();
            $newBal = $currBal + $amount;

            // Add to cash book
            $stmtCash = $db->prepare("
                INSERT INTO cash_book (
                    uuid, entry_date, entry_type, category, description, reference_no, reference_type, amount, balance_after, entered_by
                ) VALUES (
                    :uuid, NOW(), 'credit', 'Capital Added', :description, :ref_no, 'capital_entry', :amount,
                    :balance_after, :entered_by
                )
            ");
            $stmtCash->execute([
                'uuid' => Validator::uuid(),
                'description' => $description,
                'ref_no' => $txnNo,
                'amount' => $amount,
                'balance_after' => $newBal,
                'entered_by' => $userId
            ]);

            $db->commit();
            return $txnNo;
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    public static function addInvestorFunding($db, $investorName, $amount, $description, $userId) {
        $db->beginTransaction();
        try {
            $txnNo = NumberGenerator::generate($db, PREFIX_TRANSACTION);

            // Create new investor source
            $stmtIns = $db->prepare("
                INSERT INTO fund_sources (uuid, source_type, source_name, total_invested, status) 
                VALUES (:uuid, 'investor', :name, :amount, 'Active')
            ");
            $stmtIns->execute([
                'uuid' => Validator::uuid(),
                'name' => $investorName,
                'amount' => $amount
            ]);
            $sourceId = $db->lastInsertId();

            // Add capital entry
            $stmtEntry = $db->prepare("
                INSERT INTO capital_entries (uuid, transaction_no, fund_source_id, entry_type, amount, description, entry_date, entered_by)
                VALUES (:uuid, :txn_no, :source_id, 'credit', :amount, :desc, NOW(), :user_id)
            ");
            $stmtEntry->execute([
                'uuid' => Validator::uuid(),
                'txn_no' => $txnNo,
                'source_id' => $sourceId,
                'amount' => $amount,
                'desc' => $description,
                'user_id' => $userId
            ]);

            // Compute new balance separately (MySQL disallows INSERT + SELECT on same table)
            $currBal = (float)$db->query("SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END), 0) FROM cash_book")->fetchColumn();
            $newBal = $currBal + $amount;

            // Add to cash book
            $stmtCash = $db->prepare("
                INSERT INTO cash_book (
                    uuid, entry_date, entry_type, category, description, reference_no, reference_type, amount, balance_after, entered_by
                ) VALUES (
                    :uuid, NOW(), 'credit', 'Investor Capital Injection', :description, :ref_no, 'capital_entry', :amount,
                    :balance_after, :entered_by
                )
            ");
            $stmtCash->execute([
                'uuid' => Validator::uuid(),
                'description' => "Funding from investor: " . $investorName . " — " . $description,
                'ref_no' => $txnNo,
                'amount' => $amount,
                'balance_after' => $newBal,
                'entered_by' => $userId
            ]);

            $db->commit();
            return $txnNo;
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    public static function updateTransaction($db, $id, $amount, $description, $entryDate, $userId) {
        $db->beginTransaction();
        try {
            // Get existing entry
            $stmt = $db->prepare("SELECT * FROM capital_entries WHERE id = :id");
            $stmt->execute(['id' => $id]);
            $entry = $stmt->fetch();
            if (!$entry) {
                throw new Exception("Transaction not found.");
            }

            $oldAmount = (float)$entry['amount'];
            $entryType = $entry['entry_type'];
            
            // If credit, difference is (amount - oldAmount). If debit, difference is -(amount - oldAmount)
            $difference = ($entryType === 'credit') ? ($amount - $oldAmount) : -($amount - $oldAmount);

            // Update fund source total_invested
            $stmtUpdateSource = $db->prepare("UPDATE fund_sources SET total_invested = total_invested + :diff WHERE id = :source_id");
            $stmtUpdateSource->execute(['diff' => $difference, 'source_id' => $entry['fund_source_id']]);

            // Update capital entry
            $stmtUpdateEntry = $db->prepare("UPDATE capital_entries SET amount = :amount, description = :desc, entry_date = :entry_date WHERE id = :id");
            $stmtUpdateEntry->execute([
                'amount' => $amount,
                'desc' => $description,
                'entry_date' => $entryDate,
                'id' => $id
            ]);

            // Find matching cash book entry
            $stmtCash = $db->prepare("SELECT id FROM cash_book WHERE reference_no = :ref_no AND reference_type = 'capital_entry' LIMIT 1");
            $stmtCash->execute(['ref_no' => $entry['transaction_no']]);
            $cashBookId = $stmtCash->fetchColumn();

            if ($cashBookId) {
                // Update cash book entry amount, description, and entry_date
                $stmtUpdateCash = $db->prepare("UPDATE cash_book SET amount = :amount, description = :desc, entry_date = :entry_date WHERE id = :id");
                $stmtUpdateCash->execute([
                    'amount' => $amount,
                    'desc' => $description,
                    'entry_date' => $entryDate,
                    'id' => $cashBookId
                ]);

                // Propagate balance_after changes to subsequent entries
                $stmtPropagate = $db->prepare("UPDATE cash_book SET balance_after = balance_after + :diff WHERE id >= :id");
                $stmtPropagate->execute(['diff' => $difference, 'id' => $cashBookId]);
            }

            $db->commit();
            return true;
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    public static function deleteTransaction($db, $id, $userId) {
        $db->beginTransaction();
        try {
            // Get existing entry
            $stmt = $db->prepare("SELECT * FROM capital_entries WHERE id = :id");
            $stmt->execute(['id' => $id]);
            $entry = $stmt->fetch();
            if (!$entry) {
                throw new Exception("Transaction not found.");
            }

            $oldAmount = (float)$entry['amount'];
            $entryType = $entry['entry_type'];
            
            // If credit, deleting it decreases balance. If debit, deleting it increases balance.
            $difference = ($entryType === 'credit') ? -$oldAmount : $oldAmount;

            // Update fund source total_invested
            $stmtUpdateSource = $db->prepare("UPDATE fund_sources SET total_invested = total_invested + :diff WHERE id = :source_id");
            $stmtUpdateSource->execute(['diff' => $difference, 'source_id' => $entry['fund_source_id']]);

            // Delete capital entry
            $stmtDeleteEntry = $db->prepare("DELETE FROM capital_entries WHERE id = :id");
            $stmtDeleteEntry->execute(['id' => $id]);

            // Find matching cash book entry
            $stmtCash = $db->prepare("SELECT id FROM cash_book WHERE reference_no = :ref_no AND reference_type = 'capital_entry' LIMIT 1");
            $stmtCash->execute(['ref_no' => $entry['transaction_no']]);
            $cashBookId = $stmtCash->fetchColumn();

            if ($cashBookId) {
                // Propagate balance_after changes to subsequent entries
                $stmtPropagate = $db->prepare("UPDATE cash_book SET balance_after = balance_after + :diff WHERE id > :id");
                $stmtPropagate->execute(['diff' => $difference, 'id' => $cashBookId]);

                // Delete cash book entry
                $stmtDeleteCash = $db->prepare("DELETE FROM cash_book WHERE id = :id");
                $stmtDeleteCash->execute(['id' => $cashBookId]);
            }

            $db->commit();
            return true;
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    public static function executeTransfer($db, $type, $amount, $description, $entryDate, $userId) {
        $db->beginTransaction();
        try {
            $txnNo = NumberGenerator::generate($db, PREFIX_TRANSACTION);

            // Fetch or create owner equity source
            $stmt = $db->prepare("SELECT id FROM fund_sources WHERE source_type = 'owner_capital'");
            $stmt->execute();
            $sourceId = $stmt->fetchColumn();

            if (!$sourceId) {
                $stmtIns = $db->prepare("INSERT INTO fund_sources (uuid, source_type, source_name, status) VALUES (:uuid, 'owner_capital', 'Owner Equity capital', 'Active')");
                $stmtIns->execute(['uuid' => Validator::uuid()]);
                $sourceId = $db->lastInsertId();
            }

            if ($type === 'saving_to_loan') {
                $entryType = 'credit';
                $particulars = 'Savings to Loan Transfer';
                $cashBookType = 'credit';
                $diff = $amount;
            } elseif ($type === 'loan_to_saving') {
                $entryType = 'debit';
                $particulars = 'Loan to Savings Transfer';
                $cashBookType = 'debit';
                $diff = -$amount;
            } else {
                throw new Exception("Invalid transfer type.");
            }

            // Update fund_sources.total_invested
            $stmtUpdate = $db->prepare("UPDATE fund_sources SET total_invested = total_invested + :amount WHERE id = :id");
            $stmtUpdate->execute(['amount' => $diff, 'id' => $sourceId]);

            // Add capital entry
            $stmtEntry = $db->prepare("
                INSERT INTO capital_entries (uuid, transaction_no, fund_source_id, entry_type, amount, description, entry_date, entered_by)
                VALUES (:uuid, :txn_no, :source_id, :entry_type, :amount, :desc, :entry_date, :user_id)
            ");
            $stmtEntry->execute([
                'uuid' => Validator::uuid(),
                'txn_no' => $txnNo,
                'source_id' => $sourceId,
                'entry_type' => $entryType,
                'amount' => $amount,
                'desc' => $description,
                'entry_date' => $entryDate,
                'user_id' => $userId
            ]);

            // Compute new cash balance
            $currBal = (float)$db->query("SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END), 0) FROM cash_book")->fetchColumn();
            $newBal = $currBal + $diff;

            // Add to cash book
            $stmtCash = $db->prepare("
                INSERT INTO cash_book (
                    uuid, entry_date, entry_type, category, description, reference_no, reference_type, amount, balance_after, entered_by
                ) VALUES (
                    :uuid, :entry_date, :entry_type, :category, :description, :ref_no, 'capital_entry', :amount,
                    :balance_after, :entered_by
                )
            ");
            $stmtCash->execute([
                'uuid' => Validator::uuid(),
                'entry_date' => $entryDate,
                'entry_type' => $cashBookType,
                'category' => $particulars,
                'description' => $description,
                'ref_no' => $txnNo,
                'amount' => $amount,
                'balance_after' => $newBal,
                'entered_by' => $userId
            ]);

            $db->commit();
            return true;
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    public static function getTransactions($db) {
        $stmt = $db->prepare("
            SELECT ce.id, ce.uuid,
                ce.entry_date AS transaction_date,
                ce.transaction_no AS reference_no,
                CASE
                    WHEN ce.description LIKE '%Savings to Loan%' OR ce.description LIKE '%Loan to Savings%' THEN 'Internal Transfer'
                    WHEN fs.source_type = 'investor' THEN 'Investor Funding'
                    WHEN fs.source_type = 'owner_capital' THEN 'Capital Addition'
                    WHEN ce.entry_type = 'debit' THEN 'Capital Withdrawal'
                    ELSE 'Capital Addition'
                END AS transaction_type,
                ce.description,
                ce.amount,
                ce.entry_type,
                fs.source_name,
                u.name AS created_by,
                ce.entered_by AS created_by_id,
                ce.created_at
            FROM capital_entries ce
            LEFT JOIN fund_sources fs ON ce.fund_source_id = fs.id
            LEFT JOIN users u ON ce.entered_by = u.id
            ORDER BY ce.id DESC
            LIMIT 100
        ");
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function getEntryById($db, $id) {
        $stmt = $db->prepare("
            SELECT ce.*, fs.source_type, fs.source_name
            FROM capital_entries ce
            LEFT JOIN fund_sources fs ON ce.fund_source_id = fs.id
            WHERE ce.id = :id
        ");
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

}

<?php
/**
 * Capital and Fund Management Database Model
 *
 * Structure:
 *  - fund_sources me do POOL rows hain: 'loan_fund' aur 'saving_fund'
 *    (available_amount, total_received, distribute, withdraw)
 *  - Har paisa-movement ki entry fund_loan_history / fund_saving_history
 *    me jati hai, balance_before / balance_after ke saath.
 *  - owner_capital / investor rows pehle jaisi hi hain (total_invested).
 */
class Fund {

    // Fund page se sirf ye categories edit/delete ho sakti hain —
    // collections/disbursal wali entries system-generated hain
    private const MANUAL_CATEGORIES = [
        'capital_added', 'investor_funding', 'withdraw',
        'transfer_from_saving', 'transfer_to_saving',
        'transfer_from_loan', 'transfer_to_loan'
    ];

    // ------------------------------------------------------------------
    // POOL CORE
    // ------------------------------------------------------------------

    /** Pool row (loan_fund / saving_fund) ko lock karke lao; na ho to bana do */
    private static function poolRow($db, $pool) {
        $stmt = $db->prepare("SELECT * FROM fund_sources WHERE source_type = :t LIMIT 1 FOR UPDATE");
        $stmt->execute(['t' => $pool]);
        $row = $stmt->fetch();
        if (!$row) {
            $name = $pool === 'loan_fund' ? 'Loan Fund Pool' : 'Saving Fund Pool';
            $db->prepare("INSERT INTO fund_sources (uuid, source_type, source_name, status) VALUES (:u, :t, :n, 'Active')")
               ->execute(['u' => Validator::uuid(), 't' => $pool, 'n' => $name]);
            $stmt->execute(['t' => $pool]);
            $row = $stmt->fetch();
        }
        return $row;
    }

    /**
     * Pool par ek transaction apply karo:
     *  - available_amount + bucket (total_received / distribute / withdraw) update
     *  - history table me balance_before / balance_after ke saath row insert
     *
     * NOTE: caller ke transaction ke andar chalta hai (khud begin/commit nahi karta).
     *
     * $pool      : 'loan_fund' | 'saving_fund'
     * $entryType : 'credit' | 'debit'
     * $category  : capital_added / investor_funding / transfer_* / loan_disbursed /
     *              disbursal_reversed / emi_received / collection_reversed /
     *              deposit_received / deposit_reversed / maturity_payout / withdraw
     * $opts      : transaction_no, fund_source_id, reference_no, description,
     *              entry_date, entered_by
     */
    public static function applyPoolTxn($db, $pool, $entryType, $category, $amount, $opts = []) {
        $amount = round((float)$amount, 2);
        if ($amount <= 0) return null;

        $row = self::poolRow($db, $pool);

        $before = (float)$row['available_amount'];
        $after  = ($entryType === 'credit') ? $before + $amount : $before - $amount;

        $received   = (float)$row['total_received'];
        $distribute = (float)$row['distribute'];
        $withdraw   = (float)$row['withdraw'];

        if ($entryType === 'credit') {
            if ($category === 'disbursal_reversed') {
                $distribute = max(0, $distribute - $amount);
            } elseif (in_array($category, ['withdraw_reversed', 'expense_reversed'])) {
                $withdraw = max(0, $withdraw - $amount);
            } else {
                $received += $amount;
            }
        } else {
            if ($category === 'loan_disbursed') {
                $distribute += $amount;
            } elseif (in_array($category, ['collection_reversed', 'deposit_reversed'])) {
                $received = max(0, $received - $amount);
            } else {
                $withdraw += $amount;
            }
        }

        $db->prepare("
            UPDATE fund_sources
               SET available_amount = :avail, total_received = :recv,
                   distribute = :dist, withdraw = :wd
             WHERE id = :id
        ")->execute([
            'avail' => $after, 'recv' => $received,
            'dist' => $distribute, 'wd' => $withdraw,
            'id' => $row['id']
        ]);

        $txnNo = $opts['transaction_no'] ?? NumberGenerator::generate($db, PREFIX_TRANSACTION);
        $table = $pool === 'loan_fund' ? 'fund_loan_history' : 'fund_saving_history';

        $db->prepare("
            INSERT INTO {$table} (
                uuid, transaction_no, fund_source_id, entry_type, category, amount,
                balance_before, balance_after, reference_no, description, entry_date, entered_by
            ) VALUES (
                :uuid, :txn_no, :source_id, :entry_type, :category, :amount,
                :bal_before, :bal_after, :ref_no, :description, :entry_date, :entered_by
            )
        ")->execute([
            'uuid'        => Validator::uuid(),
            'txn_no'      => $txnNo,
            'source_id'   => $opts['fund_source_id'] ?? null,
            'entry_type'  => $entryType,
            'category'    => $category,
            'amount'      => $amount,
            'bal_before'  => $before,
            'bal_after'   => $after,
            'ref_no'      => $opts['reference_no'] ?? null,
            'description' => $opts['description'] ?? null,
            'entry_date'  => $opts['entry_date'] ?? date('Y-m-d'),
            'entered_by'  => $opts['entered_by'] ?? null
        ]);

        return ['txn_no' => $txnNo, 'balance_after' => $after];
    }

    /** 'L-12' / 'S-7' jaise transaction id ko table/pool/row-id me todo */
    private static function resolveTxnId($id) {
        if (preg_match('/^L-(\d+)$/', (string)$id, $m)) {
            return ['fund_loan_history', 'loan_fund', (int)$m[1]];
        }
        if (preg_match('/^S-(\d+)$/', (string)$id, $m)) {
            return ['fund_saving_history', 'saving_fund', (int)$m[1]];
        }
        throw new Exception('Transaction not found.');
    }

    private static function categoryLabel($category, $entryType) {
        switch ($category) {
            case 'capital_added':        return 'Capital Addition';
            case 'investor_funding':     return 'Investor Funding';
            case 'transfer_from_saving':
            case 'transfer_to_saving':
            case 'transfer_from_loan':
            case 'transfer_to_loan':     return 'Internal Transfer';
            case 'loan_disbursed':       return 'Loan Disbursed';
            case 'disbursal_reversed':   return 'Disbursal Reversed';
            case 'emi_received':         return 'Loan EMI Deposit';
            case 'collection_reversed':  return 'Collection Reversed';
            case 'deposit_received':     return 'Savings Deposit';
            case 'deposit_reversed':     return 'Deposit Reversed';
            case 'maturity_payout':      return 'Maturity Payout';
            case 'withdraw':             return 'Capital Withdrawal';
            case 'withdraw_reversed':    return 'Withdrawal Reversed';
            case 'expense':              return 'Business Expense';
            case 'expense_reversed':     return 'Expense Reversed';
            default: return $entryType === 'debit' ? 'Debit Entry' : 'Credit Entry';
        }
    }

    // ------------------------------------------------------------------
    // SUMMARY (frontend response shape purani jaisi hi)
    // ------------------------------------------------------------------

    public static function getSummary($db) {
        // Pool rows
        $stmt = $db->prepare("SELECT * FROM fund_sources WHERE source_type IN ('loan_fund','saving_fund')");
        $stmt->execute();
        $loanPoolRow = null; $savingPoolRow = null;
        foreach ($stmt->fetchAll() as $p) {
            if ($p['source_type'] === 'loan_fund') $loanPoolRow = $p;
            else $savingPoolRow = $p;
        }

        // Owner + investor capital (migration ke baad transfers isme nahi judte)
        $stmt = $db->prepare("SELECT COALESCE(SUM(total_invested), 0) FROM fund_sources WHERE source_type IN ('owner_capital','investor') AND status = 'Active'");
        $stmt->execute();
        $totalCapital = (float)$stmt->fetchColumn();

        // Net transfers (history tables se)
        $stmt = $db->prepare("SELECT COALESCE(SUM(amount), 0) FROM fund_loan_history WHERE category = 'transfer_from_saving'");
        $stmt->execute();
        $savingsToLoan = (float)$stmt->fetchColumn();

        $stmt = $db->prepare("SELECT COALESCE(SUM(amount), 0) FROM fund_loan_history WHERE category = 'transfer_to_saving'");
        $stmt->execute();
        $loanToSavings = (float)$stmt->fetchColumn();

        $netSavingsTransferred = $savingsToLoan - $loanToSavings;

        // Customer savings balances (liability)
        $stmt = $db->prepare("SELECT COALESCE(SUM(total_deposited), 0) FROM saving_accounts WHERE deleted_at IS NULL");
        $stmt->execute();
        $customerSavings = (float)$stmt->fetchColumn();

        // Loan-side figures (live queries — pool ke distribute se cross-check hote hain)
        $stmt = $db->prepare("SELECT COALESCE(SUM(principal_amount), 0) FROM loan_accounts WHERE account_status NOT IN ('Processing', 'Rejected') AND deleted_at IS NULL");
        $stmt->execute();
        $totalDisbursed = (float)$stmt->fetchColumn();

        $stmt = $db->prepare("SELECT COALESCE(SUM(interest_amount), 0) FROM loan_collections WHERE is_reversal = 0");
        $stmt->execute();
        $interestReceived = (float)$stmt->fetchColumn();

        $stmt = $db->prepare("SELECT COALESCE(SUM(penalty_amount), 0) FROM loan_collections WHERE is_reversal = 0");
        $stmt->execute();
        $penaltiesReceived = (float)$stmt->fetchColumn();

        $stmt = $db->prepare("SELECT COALESCE(SUM(principal_amount), 0) FROM loan_collections WHERE is_reversal = 0");
        $stmt->execute();
        $principalRepaid = (float)$stmt->fetchColumn();

        $loanPool = $totalCapital + $netSavingsTransferred;

        // Available balances ab pool rows se aate hain (proper ledger)
        $availableLoanFund = $loanPoolRow
            ? (float)$loanPoolRow['available_amount']
            : max(0.0, $loanPool - $totalDisbursed + $principalRepaid + $interestReceived + $penaltiesReceived);

        $availableSavingsCash = $savingPoolRow
            ? (float)$savingPoolRow['available_amount']
            : max(0.0, $customerSavings - $netSavingsTransferred);

        // Cash in hand is the actual ledger cash left across both pools.
        // Derived capital/savings formulas can double count deposits or miss expenses.
        $overallCash = $availableLoanFund + $availableSavingsCash;

        return [
            'totalCapital' => (float)$totalCapital,
            'total_capital' => (float)$totalCapital,
            'totalSavings' => (float)$customerSavings,
            'total_savings' => (float)$customerSavings,
            'availableSavingsCash' => (float)$availableSavingsCash,
            'available_savings_cash' => (float)$availableSavingsCash,
            'netSavingsTransferred' => (float)$netSavingsTransferred,
            'net_savings_transferred' => (float)$netSavingsTransferred,
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

    // ------------------------------------------------------------------
    // MANUAL ENTRIES (Fund Management page)
    // ------------------------------------------------------------------

    public static function addCapital($db, $amount, $description, $userId) {
        $db->beginTransaction();
        try {
            $txnNo = NumberGenerator::generate($db, PREFIX_TRANSACTION);

            // Owner equity source (total_invested track hota rahega)
            $stmt = $db->prepare("SELECT id FROM fund_sources WHERE source_type = 'owner_capital'");
            $stmt->execute();
            $sourceId = $stmt->fetchColumn();

            if (!$sourceId) {
                $stmtIns = $db->prepare("INSERT INTO fund_sources (uuid, source_type, source_name, status) VALUES (:uuid, 'owner_capital', 'Owner Equity capital', 'Active')");
                $stmtIns->execute(['uuid' => Validator::uuid()]);
                $sourceId = $db->lastInsertId();
            }

            $stmtUpdate = $db->prepare("UPDATE fund_sources SET total_invested = total_invested + :amount WHERE id = :id");
            $stmtUpdate->execute(['amount' => $amount, 'id' => $sourceId]);

            // Loan pool me paisa aaya — history + balances
            self::applyPoolTxn($db, 'loan_fund', 'credit', 'capital_added', $amount, [
                'transaction_no' => $txnNo,
                'fund_source_id' => $sourceId,
                'description'    => $description,
                'entered_by'     => $userId
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

            self::applyPoolTxn($db, 'loan_fund', 'credit', 'investor_funding', $amount, [
                'transaction_no' => $txnNo,
                'fund_source_id' => $sourceId,
                'description'    => $description,
                'entered_by'     => $userId
            ]);

            $db->commit();
            return $txnNo;
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    public static function executeTransfer($db, $type, $amount, $description, $entryDate, $userId) {
        $db->beginTransaction();
        try {
            $txnNo = NumberGenerator::generate($db, PREFIX_TRANSACTION);

            if ($type === 'saving_to_loan') {
                // Saving pool se nikla, loan pool me aaya — twin entries, same txn no
                self::applyPoolTxn($db, 'saving_fund', 'debit', 'transfer_to_loan', $amount, [
                    'transaction_no' => $txnNo, 'description' => $description,
                    'entry_date' => $entryDate, 'entered_by' => $userId
                ]);
                self::applyPoolTxn($db, 'loan_fund', 'credit', 'transfer_from_saving', $amount, [
                    'transaction_no' => $txnNo, 'description' => $description,
                    'entry_date' => $entryDate, 'entered_by' => $userId
                ]);
            } elseif ($type === 'loan_to_saving') {
                self::applyPoolTxn($db, 'loan_fund', 'debit', 'transfer_to_saving', $amount, [
                    'transaction_no' => $txnNo, 'description' => $description,
                    'entry_date' => $entryDate, 'entered_by' => $userId
                ]);
                self::applyPoolTxn($db, 'saving_fund', 'credit', 'transfer_from_loan', $amount, [
                    'transaction_no' => $txnNo, 'description' => $description,
                    'entry_date' => $entryDate, 'entered_by' => $userId
                ]);
            } else {
                throw new Exception("Invalid transfer type.");
            }

            $db->commit();
            return true;
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    // ------------------------------------------------------------------
    // TRANSACTION LIST (dono history tables ka union)
    // ------------------------------------------------------------------

    public static function getTransactions($db) {
        $stmt = $db->prepare("
            (SELECT CONCAT('L-', h.id) AS id, h.created_at,
                    h.entry_date AS transaction_date,
                    h.transaction_no AS reference_no,
                    h.category, h.description, h.amount, h.entry_type,
                    COALESCE(fs.source_name, 'Loan Fund') AS source_name,
                    u.name AS created_by
             FROM fund_loan_history h
             LEFT JOIN fund_sources fs ON h.fund_source_id = fs.id
             LEFT JOIN users u ON h.entered_by = u.id)
            UNION ALL
            (SELECT CONCAT('S-', h.id) AS id, h.created_at,
                    h.entry_date AS transaction_date,
                    h.transaction_no AS reference_no,
                    h.category, h.description, h.amount, h.entry_type,
                    COALESCE(fs.source_name, 'Saving Fund') AS source_name,
                    u.name AS created_by
             FROM fund_saving_history h
             LEFT JOIN fund_sources fs ON h.fund_source_id = fs.id
             LEFT JOIN users u ON h.entered_by = u.id)
            ORDER BY created_at DESC, id DESC
            LIMIT 100
        ");
        $stmt->execute();
        $rows = $stmt->fetchAll();

        foreach ($rows as &$row) {
            $row['transaction_type'] = self::categoryLabel($row['category'], $row['entry_type']);
        }
        return $rows;
    }

    // ------------------------------------------------------------------
    // EDIT / DELETE (sirf manual entries — L-/S- prefixed ids)
    // ------------------------------------------------------------------

    /** Row edit ka pool + balances par asar (transfer twin ke liye bhi reuse) */
    private static function applyEditToRow($db, $table, $pool, $row, $newAmount, $description, $entryDate, $diff) {
        // Pool running balance kitna shift hua
        $delta = ($row['entry_type'] === 'credit') ? $diff : -$diff;

        $poolRow = self::poolRow($db, $pool);
        $avail = (float)$poolRow['available_amount'] + $delta;
        $recv  = (float)$poolRow['total_received'];
        $wd    = (float)$poolRow['withdraw'];
        if ($row['entry_type'] === 'credit') {
            $recv += $diff;
        } else {
            $wd += $diff;
        }
        $db->prepare("UPDATE fund_sources SET available_amount = :a, total_received = :r, withdraw = :w WHERE id = :id")
           ->execute(['a' => $avail, 'r' => max(0, $recv), 'w' => max(0, $wd), 'id' => $poolRow['id']]);

        // Row khud update (balance_after shift; balance_before same rehta hai)
        $db->prepare("
            UPDATE {$table}
               SET amount = :amount, description = :description, entry_date = :entry_date,
                   balance_after = CASE WHEN balance_after IS NULL THEN NULL ELSE balance_after + :delta END
             WHERE id = :id
        ")->execute([
            'amount' => $newAmount, 'description' => $description,
            'entry_date' => $entryDate, 'delta' => $delta, 'id' => $row['id']
        ]);

        // Baad ki entries ke balances shift — proper history maintain
        $db->prepare("
            UPDATE {$table}
               SET balance_before = balance_before + :d1, balance_after = balance_after + :d2
             WHERE id > :id AND balance_after IS NOT NULL
        ")->execute(['d1' => $delta, 'd2' => $delta, 'id' => $row['id']]);
    }

    /** Row remove ka pool + balances par asar */
    private static function applyRemoveRow($db, $table, $pool, $row) {
        $amount = (float)$row['amount'];
        $delta = ($row['entry_type'] === 'credit') ? -$amount : $amount;

        $poolRow = self::poolRow($db, $pool);
        $avail = (float)$poolRow['available_amount'] + $delta;
        $recv  = (float)$poolRow['total_received'];
        $wd    = (float)$poolRow['withdraw'];
        if ($row['entry_type'] === 'credit') {
            $recv = max(0, $recv - $amount);
        } else {
            $wd = max(0, $wd - $amount);
        }
        $db->prepare("UPDATE fund_sources SET available_amount = :a, total_received = :r, withdraw = :w WHERE id = :id")
           ->execute(['a' => $avail, 'r' => $recv, 'w' => $wd, 'id' => $poolRow['id']]);

        $db->prepare("
            UPDATE {$table}
               SET balance_before = balance_before + :d1, balance_after = balance_after + :d2
             WHERE id > :id AND balance_after IS NOT NULL
        ")->execute(['d1' => $delta, 'd2' => $delta, 'id' => $row['id']]);

        $db->prepare("DELETE FROM {$table} WHERE id = :id")->execute(['id' => $row['id']]);
    }

    public static function updateTransaction($db, $id, $amount, $description, $entryDate, $userId) {
        $db->beginTransaction();
        try {
            [$table, $pool, $rid] = self::resolveTxnId($id);

            $stmt = $db->prepare("SELECT * FROM {$table} WHERE id = :id FOR UPDATE");
            $stmt->execute(['id' => $rid]);
            $row = $stmt->fetch();
            if (!$row) {
                throw new Exception("Transaction not found.");
            }
            if (!in_array($row['category'], self::MANUAL_CATEGORIES)) {
                throw new Exception("System-generated entries (collections / disbursals) cannot be edited from the fund page.");
            }

            $oldAmount = (float)$row['amount'];
            $diff = round((float)$amount - $oldAmount, 2);

            self::applyEditToRow($db, $table, $pool, $row, $amount, $description, $entryDate, $diff);

            // Transfer ki twin entry doosri table me (same transaction_no)
            if (strpos($row['category'], 'transfer_') === 0) {
                $otherTable = ($table === 'fund_loan_history') ? 'fund_saving_history' : 'fund_loan_history';
                $otherPool  = ($table === 'fund_loan_history') ? 'saving_fund' : 'loan_fund';
                $stmtTwin = $db->prepare("SELECT * FROM {$otherTable} WHERE transaction_no = :t LIMIT 1 FOR UPDATE");
                $stmtTwin->execute(['t' => $row['transaction_no']]);
                $twin = $stmtTwin->fetch();
                if ($twin) {
                    self::applyEditToRow($db, $otherTable, $otherPool, $twin, $amount, $description, $entryDate, $diff);
                }
            }

            // Owner / investor total_invested sync (capital entries ke liye)
            if (in_array($row['category'], ['capital_added', 'investor_funding', 'withdraw']) && $row['fund_source_id']) {
                $tiDiff = ($row['entry_type'] === 'credit') ? $diff : -$diff;
                $db->prepare("UPDATE fund_sources SET total_invested = total_invested + :d WHERE id = :sid")
                   ->execute(['d' => $tiDiff, 'sid' => $row['fund_source_id']]);
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
            [$table, $pool, $rid] = self::resolveTxnId($id);

            $stmt = $db->prepare("SELECT * FROM {$table} WHERE id = :id FOR UPDATE");
            $stmt->execute(['id' => $rid]);
            $row = $stmt->fetch();
            if (!$row) {
                throw new Exception("Transaction not found.");
            }
            if (!in_array($row['category'], self::MANUAL_CATEGORIES)) {
                throw new Exception("System-generated entries (collections / disbursals) cannot be deleted from the fund page.");
            }

            self::applyRemoveRow($db, $table, $pool, $row);

            // Transfer twin bhi hatao
            if (strpos($row['category'], 'transfer_') === 0) {
                $otherTable = ($table === 'fund_loan_history') ? 'fund_saving_history' : 'fund_loan_history';
                $otherPool  = ($table === 'fund_loan_history') ? 'saving_fund' : 'loan_fund';
                $stmtTwin = $db->prepare("SELECT * FROM {$otherTable} WHERE transaction_no = :t LIMIT 1 FOR UPDATE");
                $stmtTwin->execute(['t' => $row['transaction_no']]);
                $twin = $stmtTwin->fetch();
                if ($twin) {
                    self::applyRemoveRow($db, $otherTable, $otherPool, $twin);
                }
            }

            // Owner / investor total_invested wapas
            if (in_array($row['category'], ['capital_added', 'investor_funding', 'withdraw']) && $row['fund_source_id']) {
                $tiDiff = ($row['entry_type'] === 'credit') ? -(float)$row['amount'] : (float)$row['amount'];
                $db->prepare("UPDATE fund_sources SET total_invested = total_invested + :d WHERE id = :sid")
                   ->execute(['d' => $tiDiff, 'sid' => $row['fund_source_id']]);
            }

            $db->commit();
            return true;
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }
}

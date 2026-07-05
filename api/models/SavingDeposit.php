<?php
/**
 * Saving Deposit Database Model
 */
class SavingDeposit {

    public static function deposit($db, $data) {
        $db->beginTransaction();

        try {
            $savingAccountId = $data['saving_account_id'];
            $depositAmount = $data['deposit_amount'];
            $paymentMode = $data['payment_mode'] ?? 'Cash';
            $remarks = $data['remarks'] ?? null;
            $collectedBy = $data['collected_by'];
            $depositDate = $data['deposit_date'] ?? date('Y-m-d');

            // Get account details
            $stmt = $db->prepare("SELECT * FROM saving_accounts WHERE id = :id FOR UPDATE");
            $stmt->execute(['id' => $savingAccountId]);
            $account = $stmt->fetch();
            if (!$account) {
                throw new Exception('Savings account not found.');
            }

            if (!in_array($account['account_status'], ['Approved', 'Active'])) {
                throw new Exception('Savings account is not in an active state for deposits.');
            }

            $receiptNo = NumberGenerator::generate($db, PREFIX_RECEIPT);

            // Apply payment to saving installments (FIFO) — matches loan behaviour
            $stmtPending = $db->prepare("
                SELECT * FROM saving_installments
                WHERE saving_account_id = :id AND status != 'Paid'
                ORDER BY installment_no ASC
                FOR UPDATE
            ");
            $stmtPending->execute(['id' => $savingAccountId]);
            $pendingInstallments = $stmtPending->fetchAll();

            $remaining = $depositAmount;
            $allocations = [];
            $isAdvance = 0;
            foreach ($pendingInstallments as $inst) {
                if ($remaining <= 0) break;
                $pending = (float)$inst['total_due'] - (float)$inst['paid_amount'];
                if ($pending <= 0) continue;

                if ($remaining >= $pending) {
                    $allocatedForInst = $pending;
                    $remaining -= $pending;
                    $db->prepare("UPDATE saving_installments SET paid_amount = total_due, status = 'Paid', paid_at = NOW() WHERE id = :id")
                       ->execute(['id' => $inst['id']]);
                } else {
                    $allocatedForInst = $remaining;
                    $db->prepare("UPDATE saving_installments SET paid_amount = paid_amount + :paid, status = 'Partial' WHERE id = :id")
                       ->execute(['paid' => $remaining, 'id' => $inst['id']]);
                    $remaining = 0;
                }

                if ($inst['due_date'] > $depositDate && $allocatedForInst > 0) {
                    $isAdvance = 1;
                }

                $allocations[] = [
                    'installment_id' => (int)$inst['id'],
                    'due_date' => $inst['due_date'],
                    'amount' => $allocatedForInst
                ];
            }

            if ($remaining > 0) {
                $isAdvance = 1;
                $allocations[] = [
                    'installment_id' => null,
                    'due_date' => 'Advance',
                    'amount' => $remaining
                ];
            }

            // Insert into saving_deposits
            $stmt = $db->prepare("
                INSERT INTO saving_deposits (
                    uuid, receipt_no, saving_account_id, customer_id, branch_id, area_id, agent_id,
                    deposit_date, deposit_amount, payment_mode, remarks, collected_by, is_advance, installment_allocations
                ) VALUES (
                    :uuid, :receipt_no, :saving_account_id, :customer_id, :branch_id, :area_id, :agent_id,
                    :deposit_date, :deposit_amount, :payment_mode, :remarks, :collected_by, :is_advance, :installment_allocations
                )
            ");
            
            $depUuid = Validator::uuid();
            $stmt->execute([
                'uuid' => $depUuid,
                'receipt_no' => $receiptNo,
                'saving_account_id' => $savingAccountId,
                'customer_id' => $account['customer_id'],
                'branch_id' => $account['branch_id'],
                'area_id' => $account['area_id'],
                'agent_id' => $account['agent_id'],
                'deposit_date' => $depositDate,
                'deposit_amount' => $depositAmount,
                'payment_mode' => $paymentMode,
                'remarks' => $remarks,
                'collected_by' => $collectedBy,
                'is_advance' => $isAdvance,
                'installment_allocations' => json_encode($allocations)
            ]);
            $depositId = $db->lastInsertId();

            // Insert into central receipts table
            $stmtReceipt = $db->prepare("
                INSERT INTO receipts (
                    receipt_no, receipt_type, reference_id, customer_id, account_no, amount, payment_mode, branch_id, area_id, agent_id, generated_by
                ) VALUES (
                    :receipt_no, 'saving_deposit', :reference_id, :customer_id, :account_no, :amount, :payment_mode, :branch_id, :area_id, :agent_id, :generated_by
                )
            ");
            $stmtReceipt->execute([
                'receipt_no' => $receiptNo,
                'reference_id' => $depositId,
                'customer_id' => $account['customer_id'],
                'account_no' => $account['saving_account_no'],
                'amount' => $depositAmount,
                'payment_mode' => $paymentMode,
                'branch_id' => $account['branch_id'],
                'area_id' => $account['area_id'],
                'agent_id' => $account['agent_id'],
                'generated_by' => $collectedBy
            ]);

            // Update saving account deposited amount
            $newDeposited = $account['total_deposited'] + $depositAmount;

            $stmtUpdateAccount = $db->prepare("
                UPDATE saving_accounts
                SET total_deposited = :total_deposited
                WHERE id = :id
            ");
            $stmtUpdateAccount->execute([
                'total_deposited' => $newDeposited,
                'id' => $savingAccountId
            ]);

            // Compute new balance separately
            $stmtBal = $db->prepare("SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END), 0) FROM cash_book WHERE branch_id = :branch_id");
            $stmtBal->execute(['branch_id' => $account['branch_id']]);
            $newBal = (float)$stmtBal->fetchColumn() + $depositAmount;

            // Write to cash book
            $stmtCashBook = $db->prepare("
                INSERT INTO cash_book (
                    uuid, entry_date, entry_type, category, description, reference_no, reference_type, amount, balance_after, branch_id, entered_by
                ) VALUES (
                    :uuid, :entry_date, 'credit', 'Savings Deposit', :description, :ref_no, 'saving_deposit', :amount,
                    :balance_after, :branch_id, :entered_by
                )
            ");
            $stmtCashBook->execute([
                'uuid' => Validator::uuid(),
                'entry_date' => $depositDate,
                'description' => "Received deposit for Savings Account: " . $account['saving_account_no'],
                'ref_no' => $receiptNo,
                'amount' => $depositAmount,
                'balance_after' => $newBal,
                'branch_id' => $account['branch_id'],
                'entered_by' => $collectedBy
            ]);

            // Create Sync Event
            $stmtSync = $db->prepare("
                INSERT INTO sync_events (
                    event_type, module, reference_id, branch_id, area_id, agent_id, user_id, title, message
                ) VALUES (
                    'deposit_created', 'savings', :reference_id, :branch_id, :area_id, :agent_id, :user_id, :title, :message
                )
            ");
            $stmtSync->execute([
                'reference_id' => $savingAccountId,
                'branch_id' => $account['branch_id'],
                'area_id' => $account['area_id'],
                'agent_id' => $account['agent_id'],
                'user_id' => $collectedBy,
                'title' => 'Savings Deposit Received',
                'message' => '₹' . number_format($depositAmount, 2) . ' deposited for account ' . $account['saving_account_no']
            ]);

            $db->commit();
            return $receiptNo;

        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }
}

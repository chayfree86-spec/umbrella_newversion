<?php
/**
 * Loan Collection Database Model
 */
class LoanCollection {

    public static function collect($db, $data) {
        $db->beginTransaction();

        try {
            $loanAccountId = $data['loan_account_id'];
            $collectedAmount = $data['collected_amount'];
            $penaltyAmount = $data['penalty_amount'] ?? 0.00;
            $paymentMode = $data['payment_mode'] ?? 'Cash';
            $remarks = $data['remarks'] ?? null;
            $collectedBy = $data['collected_by'];
            $collectionDate = $data['collection_date'] ?? date('Y-m-d');

            // Get account details
            $stmt = $db->prepare("SELECT * FROM loan_accounts WHERE id = :id FOR UPDATE");
            $stmt->execute(['id' => $loanAccountId]);
            $account = $stmt->fetch();

            if (!$account) {
                throw new Exception('Loan account not found.');
            }

            if (!in_array($account['account_status'], ['Approved', 'Active', 'Defaulter', 'NPA'])) {
                throw new Exception('Loan account is not in an active state for collections.');
            }

            $receiptNo = NumberGenerator::generate($db, PREFIX_RECEIPT);

            // Fetch pending installments
            $stmt = $db->prepare("
                SELECT * FROM loan_installments 
                WHERE loan_account_id = :loan_id AND status != 'Paid'
                ORDER BY installment_no ASC 
                FOR UPDATE
            ");
            $stmt->execute(['loan_id' => $loanAccountId]);
            $installments = $stmt->fetchAll();

            $remainingAmount = $collectedAmount;
            $allocatedPrincipal = 0;
            $allocatedInterest = 0;
            $allocatedPenalty = 0;
            $allocations = [];
            $isAdvance = 0;

            // Apply collected amount to installments sequentially (FIFO)
            foreach ($installments as $inst) {
                if ($remainingAmount <= 0) break;

                $instId = $inst['id'];
                $totalDue = $inst['total_due'];
                $paidAmt = $inst['paid_amount'];
                $pending = $totalDue - $paidAmt;

                // Simple principal/interest allocation based on components ratio
                $ratio = $inst['total_due'] > 0 ? ($inst['principal_component'] / $inst['total_due']) : 1;

                if ($remainingAmount >= $pending) {
                    // Pay off this installment completely
                    $allocatedForInst = $pending;
                    $remainingAmount -= $pending;

                    $pComp = round($allocatedForInst * $ratio, 2);
                    $iComp = $allocatedForInst - $pComp;

                    $allocatedPrincipal += $pComp;
                    $allocatedInterest += $iComp;

                    $stmtUpdate = $db->prepare("
                        UPDATE loan_installments 
                        SET paid_amount = total_due, status = 'Paid', paid_at = NOW() 
                        WHERE id = :id
                    ");
                    $stmtUpdate->execute(['id' => $instId]);
                } else {
                    // Partial payment of this installment
                    $allocatedForInst = $remainingAmount;
                    $remainingAmount = 0;

                    $pComp = round($allocatedForInst * $ratio, 2);
                    $iComp = $allocatedForInst - $pComp;

                    $allocatedPrincipal += $pComp;
                    $allocatedInterest += $iComp;

                    $stmtUpdate = $db->prepare("
                        UPDATE loan_installments 
                        SET paid_amount = paid_amount + :allocated, status = 'Partial' 
                        WHERE id = :id
                    ");
                    $stmtUpdate->execute(['allocated' => $allocatedForInst, 'id' => $instId]);
                }

                if ($inst['due_date'] > $collectionDate && $allocatedForInst > 0) {
                    $isAdvance = 1;
                }

                $allocations[] = [
                    'installment_id' => (int)$instId,
                    'due_date' => $inst['due_date'],
                    'amount' => $allocatedForInst
                ];
            }

            if ($remainingAmount > 0) {
                $isAdvance = 1;
                $allocations[] = [
                    'installment_id' => null,
                    'due_date' => 'Advance',
                    'amount' => $remainingAmount
                ];
            }

            // Record penalty if paid
            if ($penaltyAmount > 0) {
                $allocatedPenalty = $penaltyAmount;
                // Add penalty to outstanding if any installment was overdue
                if (!empty($installments)) {
                    $stmtUpdate = $db->prepare("
                        UPDATE loan_installments 
                        SET penalty_amount = penalty_amount + :penalty 
                        WHERE id = :id
                    ");
                    $stmtUpdate->execute(['penalty' => $penaltyAmount, 'id' => $installments[0]['id']]);
                }
            }

            // Insert into loan_collections
            $stmt = $db->prepare("
                INSERT INTO loan_collections (
                    uuid, receipt_no, loan_account_id, customer_id, branch_id, area_id, agent_id,
                    collection_date, collected_amount, principal_amount, interest_amount, penalty_amount,
                    payment_mode, remarks, collected_by, is_advance, installment_allocations
                ) VALUES (
                    :uuid, :receipt_no, :loan_account_id, :customer_id, :branch_id, :area_id, :agent_id,
                    :collection_date, :collected_amount, :principal_amount, :interest_amount, :penalty_amount,
                    :payment_mode, :remarks, :collected_by, :is_advance, :installment_allocations
                )
            ");
            
            $collUuid = Validator::uuid();
            $stmt->execute([
                'uuid' => $collUuid,
                'receipt_no' => $receiptNo,
                'loan_account_id' => $loanAccountId,
                'customer_id' => $account['customer_id'],
                'branch_id' => $account['branch_id'],
                'area_id' => $account['area_id'],
                'agent_id' => $account['agent_id'],
                'collection_date' => $collectionDate,
                'collected_amount' => $collectedAmount,
                'principal_amount' => $allocatedPrincipal,
                'interest_amount' => $allocatedInterest,
                'penalty_amount' => $allocatedPenalty,
                'payment_mode' => $paymentMode,
                'remarks' => $remarks,
                'collected_by' => $collectedBy,
                'is_advance' => $isAdvance,
                'installment_allocations' => json_encode($allocations)
            ]);
            $collectionId = $db->lastInsertId();

            // Insert into central receipts table
            $stmtReceipt = $db->prepare("
                INSERT INTO receipts (
                    receipt_no, receipt_type, reference_id, customer_id, account_no, amount, payment_mode, branch_id, area_id, agent_id, generated_by
                ) VALUES (
                    :receipt_no, 'loan_collection', :reference_id, :customer_id, :account_no, :amount, :payment_mode, :branch_id, :area_id, :agent_id, :generated_by
                )
            ");
            $stmtReceipt->execute([
                'receipt_no' => $receiptNo,
                'reference_id' => $collectionId,
                'customer_id' => $account['customer_id'],
                'account_no' => $account['loan_account_no'],
                'amount' => $collectedAmount + $penaltyAmount,
                'payment_mode' => $paymentMode,
                'branch_id' => $account['branch_id'],
                'area_id' => $account['area_id'],
                'agent_id' => $account['agent_id'],
                'generated_by' => $collectedBy
            ]);

            // Loan fund pool me paisa wapas aaya — history + balance update
            Fund::applyPoolTxn($db, 'loan_fund', 'credit', 'emi_received', $collectedAmount + $penaltyAmount, [
                'reference_no' => $receiptNo,
                'description'  => 'EMI received: ' . $account['loan_account_no'] . ' (' . $receiptNo . ')',
                'entry_date'   => $collectionDate,
                'entered_by'   => $collectedBy
            ]);

            // Update loan account balance
            $newPaid = $account['total_paid'] + $collectedAmount;
            $newOutstanding = max(0, $account['outstanding_amount'] - $collectedAmount);
            $newPenalty = $account['penalty_amount'] + $penaltyAmount;
            $newStatus = ($newOutstanding <= 0) ? 'Closed' : 'Active';

            $stmtUpdateAccount = $db->prepare("
                UPDATE loan_accounts 
                SET total_paid = :total_paid, outstanding_amount = :outstanding_amount, 
                    penalty_amount = :penalty_amount, account_status = :status,
                    closed_at = :closed_at, closed_by = :closed_by
                WHERE id = :id
            ");
            $stmtUpdateAccount->execute([
                'total_paid' => $newPaid,
                'outstanding_amount' => $newOutstanding,
                'penalty_amount' => $newPenalty,
                'status' => $newStatus,
                'closed_at' => ($newStatus === 'Closed') ? date('Y-m-d H:i:s') : null,
                'closed_by' => ($newStatus === 'Closed') ? $collectedBy : null,
                'id' => $loanAccountId
            ]);

            // Create Sync Event
            $stmtSync = $db->prepare("
                INSERT INTO sync_events (
                    event_type, module, reference_id, branch_id, area_id, agent_id, user_id, title, message
                ) VALUES (
                    'collection_created', 'loans', :reference_id, :branch_id, :area_id, :agent_id, :user_id, :title, :message
                )
            ");
            $stmtSync->execute([
                'reference_id' => $loanAccountId,
                'branch_id' => $account['branch_id'],
                'area_id' => $account['area_id'],
                'agent_id' => $account['agent_id'],
                'user_id' => $collectedBy,
                'title' => 'Loan Payment Received',
                'message' => '₹' . number_format($collectedAmount, 2) . ' collected for loan ' . $account['loan_account_no']
            ]);

            $db->commit();
            return $receiptNo;

        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }
}

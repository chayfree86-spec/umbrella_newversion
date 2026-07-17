import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:umbrella_core/umbrella_core.dart';

import '../../data/account_repository.dart';
import '../../models/account.dart';
import '../../models/collection_worklist_item.dart';
import '../collect_payment/collect_payment_screen.dart';
import 'customer_profile_screen.dart';

/// GET /{loan|saving}-accounts/{accountNo} + .../statement (transactions +
/// installments), in one screen. This is where the "Processing = read-only,
/// no approve/reject" rule lives — agents never have disbursement
/// permission (policy-profile gated, not role-based), so the only
/// affordance on a Processing account is a status banner. Once an admin
/// approves elsewhere, the account flips to Active/Approved and Collect
/// becomes available here.
class AccountDetailScreen extends StatefulWidget {
  final String accountNo;
  final bool isLoan;
  const AccountDetailScreen(
      {super.key, required this.accountNo, required this.isLoan});

  @override
  State<AccountDetailScreen> createState() => _AccountDetailScreenState();
}

class _AccountDetailScreenState extends State<AccountDetailScreen> {
  late Future<
      (Account, List<StatementTransaction>, List<Installment>)> _future;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    final repo = AccountRepository(context.read<ApiClient>());
    _future = _fetchAll(repo);
  }

  Future<(Account, List<StatementTransaction>, List<Installment>)> _fetchAll(
      AccountRepository repo) async {
    // Sequential, not Future.wait — the two calls return unrelated types
    // (Account vs. a record), and keeping them simple awaits is easier to
    // reason about than heterogeneous-list type inference.
    final account = await repo.getAccount(widget.accountNo, widget.isLoan);
    final (transactions, installments) =
        await repo.statement(widget.accountNo, widget.isLoan);
    return (account, transactions, installments);
  }

  Future<void> _refresh() async {
    setState(_load);
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: Text(widget.accountNo)),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: _refresh,
        child: AsyncBody<(Account, List<StatementTransaction>, List<Installment>)>(
          future: _future,
          onRetry: _refresh,
          builder: (context, data) {
            final (account, transactions, installments) = data;
            return _DetailBody(
              account: account,
              transactions: transactions,
              installments: installments,
              onCollected: _refresh,
            );
          },
        ),
      ),
    );
  }
}

class _DetailBody extends StatelessWidget {
  final Account account;
  final List<StatementTransaction> transactions;
  final List<Installment> installments;
  final VoidCallback onCollected;

  const _DetailBody({
    required this.account,
    required this.transactions,
    required this.installments,
    required this.onCollected,
  });

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                InkWell(
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => CustomerProfileScreen(customerId: account.customerId),
                  )),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Flexible(
                                  child: Text(account.customerName,
                                      style: const TextStyle(
                                          fontSize: 16, fontWeight: FontWeight.w900)),
                                ),
                                const SizedBox(width: 4),
                                const Icon(Icons.chevron_right,
                                    size: 18, color: AppColors.secondaryText),
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(account.customerMobile,
                                style: const TextStyle(
                                    fontSize: 12, color: AppColors.secondaryText)),
                          ],
                        ),
                      ),
                      StatusChip(account.status),
                    ],
                  ),
                ),
                const Divider(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _Stat(
                      label: account.isLoan ? 'Principal' : 'Deposit Amount',
                      value: Formatters.inr(account.principalOrDeposit),
                    ),
                    _Stat(
                      label: account.isLoan ? 'Outstanding' : 'Total Deposited',
                      value: Formatters.inr(account.outstandingOrDeposited),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _Stat(
                      label: account.isLoan ? 'EMI' : 'Recurring Deposit',
                      value: Formatters.inr(account.recurringAmount),
                    ),
                    _Stat(
                      label: 'Installments',
                      value:
                          '${account.paidInstallments}/${account.totalInstallments}',
                    ),
                  ],
                ),
                if (account.planName.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  Row(children: [_Stat(label: 'Plan', value: account.planName)]),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        if (account.isAwaitingApproval)
          const _AwaitingApprovalBanner()
        else if (account.canCollect)
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              icon: const Icon(Icons.payments, size: 18),
              label: const Text('Collect Payment'),
              onPressed: () async {
                final collected = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(
                    builder: (_) => CollectPaymentScreen(
                      item: CollectionWorklistItem(
                        id: account.id,
                        accNo: account.accountNo,
                        type: account.type,
                        emiAmt: account.recurringAmount,
                        outstanding: account.outstandingOrDeposited,
                        todayStatus: 'Pending',
                        customerId: account.customerId,
                        customerName: account.customerName,
                        customerPhone: account.customerMobile,
                        branch: account.branchName,
                        area: account.areaName,
                        agent: account.agentName,
                      ),
                    ),
                  ),
                );
                if (collected == true) onCollected();
              },
            ),
          ),
        const SizedBox(height: 24),
        const _SectionLabel('INSTALLMENT SCHEDULE'),
        const SizedBox(height: 10),
        if (installments.isEmpty)
          const _EmptyInline(text: 'No installment schedule yet.')
        else
          Card(
            child: Column(
              children: [
                for (int i = 0; i < installments.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  _InstallmentRow(inst: installments[i]),
                ],
              ],
            ),
          ),
        const SizedBox(height: 24),
        const _SectionLabel('PAYMENT HISTORY'),
        const SizedBox(height: 10),
        if (transactions.isEmpty)
          const _EmptyInline(text: 'No payments collected yet.')
        else
          Card(
            child: Column(
              children: [
                for (int i = 0; i < transactions.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  _TransactionRow(tx: transactions[i]),
                ],
              ],
            ),
          ),
      ],
    );
  }
}

class _AwaitingApprovalBanner extends StatelessWidget {
  const _AwaitingApprovalBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF2563EB).withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF2563EB).withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          const Icon(Icons.hourglass_top, color: Color(0xFF2563EB)),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Awaiting Approval',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF2563EB),
                    letterSpacing: 0.4,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'This account is pending review. Once approved by an '
                  'admin, the Collect Payment option will appear here.',
                  style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                      color: AppColors.secondaryText),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  final String label;
  final String value;
  const _Stat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(),
              style: const TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w700,
                  color: AppColors.secondaryText)),
          const SizedBox(height: 2),
          Text(value,
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.6,
          color: AppColors.secondaryText),
    );
  }
}

class _EmptyInline extends StatelessWidget {
  final String text;
  const _EmptyInline({required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Text(text,
          style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.secondaryText)),
    );
  }
}

class _InstallmentRow extends StatelessWidget {
  final Installment inst;
  const _InstallmentRow({required this.inst});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      dense: true,
      leading: CircleAvatar(
        radius: 14,
        backgroundColor: AppColors.statusColor(inst.status).withValues(alpha: 0.1),
        child: Text('${inst.installmentNo}',
            style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                color: AppColors.statusColor(inst.status))),
      ),
      title: Text(Formatters.date(inst.dueDate),
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
      subtitle: Text(Formatters.inr(inst.totalDue),
          style: const TextStyle(fontSize: 11, color: AppColors.secondaryText)),
      trailing: StatusChip(inst.status),
    );
  }
}

class _TransactionRow extends StatelessWidget {
  final StatementTransaction tx;
  const _TransactionRow({required this.tx});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      dense: true,
      leading: const CircleAvatar(
        radius: 14,
        backgroundColor: Color(0x1A16A34A),
        child: Icon(Icons.check, size: 14, color: AppColors.success),
      ),
      title: Text(tx.refNo,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
      subtitle: Text('${Formatters.date(tx.date)} · ${tx.paymentMode}',
          style: const TextStyle(fontSize: 11, color: AppColors.secondaryText)),
      trailing: Text(Formatters.inr(tx.amount),
          style: const TextStyle(
              fontSize: 12.5, fontWeight: FontWeight.w800, color: AppColors.success)),
    );
  }
}

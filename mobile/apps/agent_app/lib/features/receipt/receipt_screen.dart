import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:umbrella_core/umbrella_core.dart';

import '../../data/collection_repository.dart';
import '../../models/collection_receipt.dart';
import '../shell/app_shell.dart';

/// GET /receipts/{receiptNo} — shown right after a successful collection.
/// This is a terminal screen (no back-to-form) — it replaces the collect
/// route in the nav stack, and its only exit is "Done" back to the shell.
class ReceiptScreen extends StatefulWidget {
  final String receiptNo;
  const ReceiptScreen({super.key, required this.receiptNo});

  @override
  State<ReceiptScreen> createState() => _ReceiptScreenState();
}

class _ReceiptScreenState extends State<ReceiptScreen> {
  late Future<CollectionReceipt> _future;

  @override
  void initState() {
    super.initState();
    final repo = CollectionRepository(context.read<ApiClient>());
    _future = repo.receipt(widget.receiptNo);
  }

  void _done() {
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const AppShell()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _done();
      },
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          title: const Text('Receipt'),
          automaticallyImplyLeading: false,
        ),
        body: AsyncBody<CollectionReceipt>(
          future: _future,
          builder: (context, r) => _ReceiptBody(receipt: r),
        ),
        bottomNavigationBar: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: ElevatedButton(onPressed: _done, child: const Text('Done')),
          ),
        ),
      ),
    );
  }
}

class _ReceiptBody extends StatelessWidget {
  final CollectionReceipt receipt;
  const _ReceiptBody({required this.receipt});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const SizedBox(height: 8),
        const Center(
          child: CircleAvatar(
            radius: 32,
            backgroundColor: Color(0x1A16A34A),
            child: Icon(Icons.check, color: AppColors.success, size: 34),
          ),
        ),
        const SizedBox(height: 16),
        Center(
          child: Text(
            Formatters.inr(receipt.amount),
            style: const TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w900,
                color: AppColors.primaryText),
          ),
        ),
        const Center(
          child: Text(
            'Collected Successfully',
            style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: AppColors.success),
          ),
        ),
        const SizedBox(height: 24),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _Row('Receipt No', receipt.receiptNo),
                _Row('Customer', receipt.customerName),
                _Row('Account No', receipt.accountNo ?? '—'),
                _Row('Payment Mode', receipt.paymentMode),
                _Row('Collected By', receipt.collectorName),
                if (receipt.createdAt != null)
                  _Row('Date', Formatters.dateTime(receipt.createdAt)),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _Row extends StatelessWidget {
  final String label;
  final String value;
  const _Row(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.secondaryText)),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }
}

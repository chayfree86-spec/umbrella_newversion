import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:umbrella_core/umbrella_core.dart';

import '../../data/collection_repository.dart';
import '../../models/collection_worklist_item.dart';
import '../receipt/receipt_screen.dart';

/// EMI/deposit collection form — pre-filled with the account's EMI amount
/// (agent can adjust for partial/advance payments, same as web). Submits to
/// POST /collections/loan or /collections/saving depending on item.type.
class CollectPaymentScreen extends StatefulWidget {
  final CollectionWorklistItem item;
  const CollectPaymentScreen({super.key, required this.item});

  @override
  State<CollectPaymentScreen> createState() => _CollectPaymentScreenState();
}

class _CollectPaymentScreenState extends State<CollectPaymentScreen> {
  late final TextEditingController _amountCtrl;
  final _penaltyCtrl = TextEditingController(text: '0');
  final _remarksCtrl = TextEditingController();
  String _paymentMode = kPaymentModes.first;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _amountCtrl =
        TextEditingController(text: widget.item.emiAmt.toStringAsFixed(0));
  }

  @override
  void dispose() {
    _amountCtrl.dispose();
    _penaltyCtrl.dispose();
    _remarksCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _error = null);

    final amount = double.tryParse(_amountCtrl.text.trim()) ?? 0;
    if (amount <= 0) {
      setState(() => _error = 'Enter an amount greater than 0.');
      return;
    }
    final penalty = double.tryParse(_penaltyCtrl.text.trim()) ?? 0;

    setState(() => _submitting = true);
    try {
      final repo = CollectionRepository(context.read<ApiClient>());
      final receiptNo = widget.item.isLoan
          ? await repo.collectLoan(
              accountNo: widget.item.accNo,
              amount: amount,
              penaltyAmount: penalty,
              paymentMode: _paymentMode,
              remarks: _remarksCtrl.text.trim(),
            )
          : await repo.collectSaving(
              accountNo: widget.item.accNo,
              amount: amount,
              paymentMode: _paymentMode,
              remarks: _remarksCtrl.text.trim(),
            );

      if (!mounted) return;
      await Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => ReceiptScreen(receiptNo: receiptNo)),
      );
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Collection failed. Please check your connection.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Collect Payment')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.customerName,
                      style: const TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  Text('${item.accNo} · ${item.type} Account',
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.secondaryText)),
                  const Divider(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _MiniStat(
                          label: item.isLoan ? 'EMI Amount' : 'Deposit Amount',
                          value: Formatters.inr(item.emiAmt)),
                      _MiniStat(
                          label: item.isLoan ? 'Outstanding' : 'Total Deposited',
                          value: Formatters.inr(item.outstanding)),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          if (_error != null) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.danger.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                _error!,
                style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.danger),
              ),
            ),
            const SizedBox(height: 16),
          ],
          TextField(
            controller: _amountCtrl,
            enabled: !_submitting,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
            ],
            decoration: InputDecoration(
              labelText: item.isLoan ? 'Amount Collected' : 'Amount Deposited',
              prefixText: '₹ ',
            ),
          ),
          if (item.isLoan) ...[
            const SizedBox(height: 14),
            TextField(
              controller: _penaltyCtrl,
              enabled: !_submitting,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
              ],
              decoration: const InputDecoration(
                labelText: 'Penalty (if any)',
                prefixText: '₹ ',
              ),
            ),
          ],
          const SizedBox(height: 14),
          DropdownButtonFormField<String>(
            initialValue: _paymentMode,
            decoration: const InputDecoration(labelText: 'Payment Mode'),
            items: [
              for (final m in kPaymentModes)
                DropdownMenuItem(value: m, child: Text(m)),
            ],
            onChanged: _submitting
                ? null
                : (v) => setState(() => _paymentMode = v ?? _paymentMode),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _remarksCtrl,
            enabled: !_submitting,
            maxLines: 2,
            decoration: const InputDecoration(labelText: 'Remarks (optional)'),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: _submitting ? null : _submit,
            child: _submitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2.5, color: Colors.white),
                  )
                : const Text('Confirm Collection'),
          ),
        ],
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label;
  final String value;
  const _MiniStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
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
    );
  }
}

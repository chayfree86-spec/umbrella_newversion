import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:speech_to_text/speech_recognition_result.dart';
import 'package:speech_to_text/speech_to_text.dart';
import 'package:umbrella_core/umbrella_core.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../data/collection_repository.dart';
import '../../models/collection_worklist_item.dart';
import '../../state/session_provider.dart';
import '../accounts/customer_profile_screen.dart';
import '../collect_payment/collect_payment_screen.dart';

/// GET /collections/agent/{agentId} — today's due checklist. This is the
/// agent's default landing tab (matches the web's Daily Collection page,
/// server-scoped to the logged-in agent already) — embedded directly in
/// AppShell rather than pushed, so the bottom nav stays visible.
class DailyCollectionScreen extends StatefulWidget {
  const DailyCollectionScreen({super.key});

  @override
  State<DailyCollectionScreen> createState() => _DailyCollectionScreenState();
}

class _DailyCollectionScreenState extends State<DailyCollectionScreen> {
  late Future<List<CollectionWorklistItem>> _future;
  final _searchController = TextEditingController();
  final _speech = SpeechToText();

  String _typeFilter = 'All'; // 'All' | 'Loan' | 'Saving'
  String _statusFilter = 'All'; // 'All' | 'Pending' | 'Paid'
  String _search = '';
  bool _speechAvailable = false;
  bool _listening = false;

  @override
  void initState() {
    super.initState();
    _load();
    _initSpeech();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _speech.stop();
    super.dispose();
  }

  Future<void> _initSpeech() async {
    final available = await _speech.initialize(
      onStatus: (status) {
        if (status == 'done' || status == 'notListening') {
          if (mounted) setState(() => _listening = false);
        }
      },
      onError: (_) {
        if (mounted) setState(() => _listening = false);
      },
    );
    if (mounted) setState(() => _speechAvailable = available);
  }

  void _toggleListening() async {
    if (_listening) {
      await _speech.stop();
      setState(() => _listening = false);
      return;
    }
    if (!_speechAvailable) return;
    setState(() => _listening = true);
    await _speech.listen(
      onResult: (SpeechRecognitionResult result) {
        setState(() {
          _searchController.text = result.recognizedWords;
          _searchController.selection = TextSelection.collapsed(
              offset: _searchController.text.length);
          _search = result.recognizedWords.trim();
        });
      },
    );
  }

  void _load() {
    final session = context.read<SessionProvider>();
    final repo = CollectionRepository(context.read<ApiClient>());
    final agentId = session.currentUser?.agentId ?? 0;
    _future = repo.worklist(agentId);
  }

  Future<void> _refresh() async {
    setState(_load);
    await _future;
  }

  List<CollectionWorklistItem> _applyFilters(List<CollectionWorklistItem> items) {
    return items.where((item) {
      if (_typeFilter == 'Loan' && !item.isLoan) return false;
      if (_typeFilter == 'Saving' && item.isLoan) return false;
      if (_statusFilter != 'All' && item.todayStatus != _statusFilter) return false;
      if (_search.isNotEmpty) {
        final q = _search.toLowerCase();
        final matches = item.customerName.toLowerCase().contains(q) ||
            item.accNo.toLowerCase().contains(q) ||
            item.customerPhone.toLowerCase().contains(q);
        if (!matches) return false;
      }
      return true;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text("Today's Collection")),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Row(
              children: [
                for (final type in const ['All', 'Loan', 'Saving']) ...[
                  Expanded(
                    child: _FilterChip(
                      label: type,
                      selected: _typeFilter == type,
                      onTap: () => setState(() => _typeFilter = type),
                    ),
                  ),
                  if (type != 'Saving') const SizedBox(width: 8),
                ],
              ],
            ),
          ),
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                for (final status in const ['All', 'Pending', 'Paid']) ...[
                  _StatusPill(
                    label: status,
                    selected: _statusFilter == status,
                    onTap: () => setState(() => _statusFilter = status),
                  ),
                  if (status != 'Paid') const SizedBox(width: 8),
                ],
              ],
            ),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: RefreshIndicator(
              color: AppColors.primary,
              onRefresh: _refresh,
              child: AsyncBody<List<CollectionWorklistItem>>(
                future: _future,
                onRetry: _refresh,
                builder: (context, allItems) {
                  final items = _applyFilters(allItems);
                  if (items.isEmpty) {
                    return ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        Padding(
                          padding: const EdgeInsets.only(top: 80),
                          child: Column(
                            children: [
                              Icon(
                                allItems.isEmpty
                                    ? Icons.check_circle_outline
                                    : Icons.search_off,
                                size: 40,
                                color: AppColors.border,
                              ),
                              const SizedBox(height: 12),
                              Text(
                                allItems.isEmpty
                                    ? 'No accounts due today.'
                                    : 'No accounts match current filters.',
                                style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.secondaryText),
                              ),
                            ],
                          ),
                        ),
                      ],
                    );
                  }
                  return ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(16),
                    itemCount: items.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, i) => _WorklistTile(
                      item: items[i],
                      onCollected: _refresh,
                    ),
                  );
                },
              ),
            ),
          ),
          // Pinned near the footer nav rather than under the filters, per
          // design — this Column sits directly above AppShell's bottom bar.
          Container(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: AppColors.border)),
            ),
            child: TextField(
              controller: _searchController,
              onChanged: (v) => setState(() => _search = v.trim()),
              decoration: InputDecoration(
                hintText: _listening
                    ? 'Listening…'
                    : 'Search by name, mobile, account no.',
                prefixIcon: const Icon(Icons.search, size: 20),
                suffixIcon: _speechAvailable
                    ? IconButton(
                        onPressed: _toggleListening,
                        icon: Icon(
                          _listening ? Icons.mic : Icons.mic_none_outlined,
                          color: _listening ? AppColors.danger : AppColors.secondaryText,
                          size: 20,
                        ),
                      )
                    : null,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _FilterChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: selected ? AppColors.primary : AppColors.border),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 12.5,
            color: selected ? Colors.white : AppColors.primaryText,
          ),
        ),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _StatusPill({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = label == 'Paid'
        ? AppColors.success
        : label == 'Pending'
            ? const Color(0xFFEA580C)
            : AppColors.primary;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? c.withValues(alpha: 0.12) : const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: selected ? c : AppColors.border),
        ),
        child: Text(
          label.toUpperCase(),
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.3,
            color: selected ? c : AppColors.secondaryText,
          ),
        ),
      ),
    );
  }
}

class _WorklistTile extends StatelessWidget {
  final CollectionWorklistItem item;
  final VoidCallback onCollected;

  const _WorklistTile({required this.item, required this.onCollected});

  Future<void> _call(BuildContext context) async {
    final uri = Uri(scheme: 'tel', path: item.customerPhone);
    final ok = await launchUrl(uri);
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to open dialer.')),
      );
    }
  }

  Future<void> _collect(BuildContext context) async {
    final collected = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => CollectPaymentScreen(item: item)),
    );
    if (collected == true) onCollected();
  }

  String? _photoUrl(BuildContext context) {
    final path = item.customerPhoto;
    if (path == null || path.isEmpty) return null;
    final root = context
        .read<ApiClient>()
        .baseUrl
        .replaceFirst(RegExp(r'/api/?$'), '');
    return '$root/$path';
  }

  @override
  Widget build(BuildContext context) {
    final accentColor = item.isLoan ? AppColors.primary : AppColors.success;
    final photo = _photoUrl(context);
    final initial =
        item.customerName.trim().isNotEmpty ? item.customerName.trim()[0].toUpperCase() : '?';

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => CustomerProfileScreen(customerId: item.customerId),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 20,
                    backgroundColor: accentColor.withValues(alpha: 0.1),
                    backgroundImage: photo != null ? NetworkImage(photo) : null,
                    child: photo == null
                        ? Text(
                            initial,
                            style: TextStyle(
                                fontWeight: FontWeight.w800, color: accentColor),
                          )
                        : null,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.customerName,
                          style: const TextStyle(
                              fontSize: 13, fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${item.accNo} · ${item.customerPhone}',
                          style: const TextStyle(
                              fontSize: 11, color: AppColors.secondaryText),
                        ),
                      ],
                    ),
                  ),
                  StatusChip(item.todayStatus),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _AmountBlock(label: 'PENDING', amount: item.outstanding),
                  ),
                  Expanded(
                    child: _AmountBlock(label: "TODAY'S AMOUNT", amount: item.emiAmt),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _call(context),
                      icon: const Icon(Icons.call_outlined, size: 16),
                      label: const Text('Call'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.primary,
                        side: const BorderSide(color: AppColors.border),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton.icon(
                      onPressed: item.isPaid ? null : () => _collect(context),
                      icon: Icon(
                          item.isPaid ? Icons.check_circle_outline : Icons.payments_outlined,
                          size: 16),
                      label: Text(item.isPaid ? 'Collected' : 'Collect'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: item.isPaid ? AppColors.success : AppColors.primary,
                        foregroundColor: Colors.white,
                        disabledBackgroundColor: AppColors.success,
                        disabledForegroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AmountBlock extends StatelessWidget {
  final String label;
  final double amount;
  const _AmountBlock({required this.label, required this.amount});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.4,
              color: AppColors.secondaryText),
        ),
        const SizedBox(height: 2),
        Text(
          Formatters.inr(amount),
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
        ),
      ],
    );
  }
}

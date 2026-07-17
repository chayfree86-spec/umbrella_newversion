import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:umbrella_core/umbrella_core.dart';

import '../../data/account_repository.dart';
import '../../models/account.dart';
import 'account_detail_screen.dart';

const _loanStatuses = ['Processing', 'Approved', 'Active', 'Defaulter', 'NPA', 'Closed', 'Rejected'];
const _savingStatuses = ['Processing', 'Approved', 'Active', 'Matured', 'Closed', 'Rejected'];
const _allStatuses = ['Processing', 'Approved', 'Active', 'Defaulter', 'NPA', 'Matured', 'Closed', 'Rejected'];

/// GET /loan-accounts + /saving-accounts, paginated 20/page (server
/// default), agent-scoped. Unified list with Type (All/Loan/Saving) and
/// Status filter chips, search bar below the filters — replaces the
/// earlier Loan/Saving TabBar layout per the redesign request.
class AccountsListScreen extends StatefulWidget {
  /// Preselects the Type chip (e.g. jumping in from a Dashboard stat card) —
  /// defaults to the normal unfiltered view.
  final String initialTypeFilter;
  const AccountsListScreen({super.key, this.initialTypeFilter = 'All'});

  @override
  State<AccountsListScreen> createState() => _AccountsListScreenState();
}

class _AccountsListScreenState extends State<AccountsListScreen> {
  final _scrollController = ScrollController();
  final _searchController = TextEditingController();
  Timer? _debounce;

  late String _typeFilter = widget.initialTypeFilter; // 'All' | 'Loan' | 'Saving'
  String? _statusFilter; // null = All Status

  final List<Account> _items = [];
  int _loanPage = 1;
  int _savingPage = 1;
  bool _loanHasMore = true;
  bool _savingHasMore = true;
  bool _loading = false;
  bool _initialLoading = true;
  String? _error;
  String _search = '';

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _loadFirstPage();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _searchController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  List<String> get _availableStatuses {
    if (_typeFilter == 'Loan') return _loanStatuses;
    if (_typeFilter == 'Saving') return _savingStatuses;
    return _allStatuses;
  }

  void _onScroll() {
    if (_loading) return;
    if (!_loanHasMore && !_savingHasMore) return;
    if (_scrollController.position.pixels >
        _scrollController.position.maxScrollExtent - 200) {
      _loadNextPage();
    }
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () {
      setState(() => _search = value.trim());
      _loadFirstPage();
    });
  }

  void _onTypeFilterChanged(String type) {
    setState(() {
      _typeFilter = type;
      // Drop a status selection that doesn't apply to the newly selected type.
      if (_statusFilter != null && !_availableStatuses.contains(_statusFilter)) {
        _statusFilter = null;
      }
    });
    _loadFirstPage();
  }

  void _onStatusFilterChanged(String? status) {
    setState(() => _statusFilter = status);
    _loadFirstPage();
  }

  Future<void> _loadFirstPage() async {
    setState(() {
      _initialLoading = true;
      _error = null;
      _loanPage = 1;
      _savingPage = 1;
      _loanHasMore = _typeFilter != 'Saving';
      _savingHasMore = _typeFilter != 'Loan';
      _items.clear();
    });
    await _fetchPage();
  }

  Future<void> _loadNextPage() async {
    setState(() => _loading = true);
    await _fetchPage();
  }

  Future<void> _fetchPage() async {
    try {
      final repo = AccountRepository(context.read<ApiClient>());
      final wantLoans = _typeFilter != 'Saving' && _loanHasMore;
      final wantSavings = _typeFilter != 'Loan' && _savingHasMore;

      final results = await Future.wait([
        wantLoans
            ? repo.listLoans(page: _loanPage, search: _search, status: _statusFilter)
            : Future.value(null),
        wantSavings
            ? repo.listSavings(page: _savingPage, search: _search, status: _statusFilter)
            : Future.value(null),
      ]);

      if (!mounted) return;
      setState(() {
        final loanResult = results[0];
        final savingResult = results[1];
        if (loanResult != null) {
          _items.addAll(loanResult.items);
          _loanHasMore = loanResult.pagination.hasMore;
          _loanPage++;
        }
        if (savingResult != null) {
          _items.addAll(savingResult.items);
          _savingHasMore = savingResult.pagination.hasMore;
          _savingPage++;
        }
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Could not load accounts. Please try again.');
      }
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          _initialLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasMore = _loanHasMore || _savingHasMore;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Accounts')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Row(
              children: [
                for (final type in const ['All', 'Loan', 'Saving']) ...[
                  Expanded(child: _TypeChip(
                    label: type,
                    selected: _typeFilter == type,
                    onTap: () => _onTypeFilterChanged(type),
                  )),
                  if (type != 'Saving') const SizedBox(width: 8),
                ],
              ],
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 34,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                _StatusFilterChip(
                  label: 'All Status',
                  selected: _statusFilter == null,
                  onTap: () => _onStatusFilterChanged(null),
                ),
                const SizedBox(width: 8),
                for (final status in _availableStatuses) ...[
                  _StatusFilterChip(
                    label: status,
                    color: AppColors.statusColor(status),
                    selected: _statusFilter == status,
                    onTap: () => _onStatusFilterChanged(status),
                  ),
                  const SizedBox(width: 8),
                ],
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              controller: _searchController,
              onChanged: _onSearchChanged,
              decoration: const InputDecoration(
                hintText: 'Search by name, mobile, account no.',
                prefixIcon: Icon(Icons.search, size: 20),
              ),
            ),
          ),
          Expanded(child: _buildBody(hasMore)),
        ],
      ),
    );
  }

  Widget _buildBody(bool hasMore) {
    if (_initialLoading) {
      return const Center(
          child: CircularProgressIndicator(color: AppColors.primary));
    }
    if (_error != null && _items.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 36, color: AppColors.danger),
            const SizedBox(height: 12),
            Text(_error!,
                style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.secondaryText)),
            const SizedBox(height: 16),
            OutlinedButton(onPressed: _loadFirstPage, child: const Text('Retry')),
          ],
        ),
      );
    }
    if (_items.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.badge_outlined, size: 40, color: AppColors.border),
            const SizedBox(height: 12),
            const Text(
              'No accounts found.',
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppColors.secondaryText),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: _loadFirstPage,
      child: ListView.separated(
        controller: _scrollController,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
        itemCount: _items.length + (hasMore ? 1 : 0),
        separatorBuilder: (_, _) => const SizedBox(height: 10),
        itemBuilder: (context, i) {
          if (i >= _items.length) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(
                  child: CircularProgressIndicator(
                      strokeWidth: 2.5, color: AppColors.primary)),
            );
          }
          final acc = _items[i];
          return _AccountTile(
            account: acc,
            onTap: () => Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => AccountDetailScreen(
                accountNo: acc.accountNo,
                isLoan: acc.isLoan,
              ),
            )),
          );
        },
      ),
    );
  }
}

class _TypeChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _TypeChip({required this.label, required this.selected, required this.onTap});

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

class _StatusFilterChip extends StatelessWidget {
  final String label;
  final Color? color;
  final bool selected;
  final VoidCallback onTap;
  const _StatusFilterChip({
    required this.label,
    this.color,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.primary;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
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

class _AccountTile extends StatelessWidget {
  final Account account;
  final VoidCallback onTap;
  const _AccountTile({required this.account, required this.onTap});

  String? _photoUrl(BuildContext context) {
    final path = account.customerPhoto;
    if (path == null || path.isEmpty) return null;
    final root = context
        .read<ApiClient>()
        .baseUrl
        .replaceFirst(RegExp(r'/api/?$'), '');
    return '$root/$path';
  }

  @override
  Widget build(BuildContext context) {
    final accentColor = account.isLoan ? AppColors.primary : AppColors.success;
    final photo = _photoUrl(context);
    final initial = account.customerName.trim().isNotEmpty
        ? account.customerName.trim()[0].toUpperCase()
        : '?';

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              CircleAvatar(
                radius: 20,
                backgroundColor: accentColor.withValues(alpha: 0.1),
                backgroundImage: photo != null ? NetworkImage(photo) : null,
                child: photo == null
                    ? Text(
                        initial,
                        style: TextStyle(fontWeight: FontWeight.w800, color: accentColor),
                      )
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(account.customerName,
                        style: const TextStyle(
                            fontSize: 13, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 2),
                    Text(account.accountNo,
                        style: const TextStyle(
                            fontSize: 11, color: AppColors.secondaryText)),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    Formatters.inr(account.outstandingOrDeposited),
                    style: const TextStyle(
                        fontSize: 12.5, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 4),
                  StatusChip(account.status),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

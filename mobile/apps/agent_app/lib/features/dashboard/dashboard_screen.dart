import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:umbrella_core/umbrella_core.dart';

import '../../data/dashboard_repository.dart';
import '../../state/session_provider.dart';
import '../accounts/accounts_list_screen.dart';
import '../accounts/customer_profile_screen.dart';
import '../daily_collection/daily_collection_screen.dart';

/// GET /dashboard/summary — agent-scoped stats. Business-wide fields
/// (overall_cash_balance, available_loan_fund, total_branches, total_agents)
/// are zeroed server-side for the agent role, so they're deliberately not
/// shown here.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    final repo = DashboardRepository(context.read<ApiClient>());
    _future = repo.summary();
  }

  Future<void> _refresh() async {
    setState(_load);
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<SessionProvider>().currentUser;

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: _refresh,
      child: CustomScrollView(
        slivers: [
          SliverAppBar(
            floating: true,
            backgroundColor: AppColors.background,
            surfaceTintColor: Colors.transparent,
            title: Text('Welcome, ${user?.name ?? ''}'),
          ),
          SliverToBoxAdapter(
            child: AsyncBody<Map<String, dynamic>>(
              future: _future,
              onRetry: _refresh,
              builder: (context, summary) => _DashboardBody(summary: summary),
            ),
          ),
        ],
      ),
    );
  }
}

class _DashboardBody extends StatelessWidget {
  final Map<String, dynamic> summary;
  const _DashboardBody({required this.summary});

  num _n(String key) => Formatters.asNum(summary[key]);
  List _rows(String key) => summary[key] is List ? summary[key] as List : [];

  @override
  Widget build(BuildContext context) {
    final recent = _rows('recent_collections');

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.5,
            children: [
              _StatCard(
                icon: Icons.payments_outlined,
                label: "Today's Collection",
                value: Formatters.inr(_n('today_collection')),
                color: AppColors.warning,
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const DailyCollectionScreen()),
                ),
              ),
              _StatCard(
                icon: Icons.calendar_month_outlined,
                label: 'Monthly Collection',
                value: Formatters.inr(_n('monthly_collection')),
                color: AppColors.primary,
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const DailyCollectionScreen()),
                ),
              ),
              _StatCard(
                icon: Icons.schedule_outlined,
                label: "Today's Due",
                value: Formatters.inr(_n('today_due')),
                color: AppColors.danger,
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const DailyCollectionScreen()),
                ),
              ),
              _StatCard(
                icon: Icons.pending_actions_outlined,
                label: 'Outstanding',
                value: Formatters.inr(_n('outstanding_amount')),
                color: AppColors.secondaryText,
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const AccountsListScreen()),
                ),
              ),
              _StatCard(
                icon: Icons.credit_score_outlined,
                label: 'Active Loans',
                value: _n('active_loans').toString(),
                color: AppColors.success,
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => const AccountsListScreen(initialTypeFilter: 'Loan'),
                  ),
                ),
              ),
              _StatCard(
                icon: Icons.savings_outlined,
                label: 'Active Savings',
                value: _n('active_savings').toString(),
                color: AppColors.success,
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => const AccountsListScreen(initialTypeFilter: 'Saving'),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          const Text(
            'RECENT COLLECTIONS',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.6,
              color: AppColors.secondaryText,
            ),
          ),
          const SizedBox(height: 10),
          if (recent.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Text(
                'No collections yet.',
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.secondaryText),
              ),
            )
          else
            Card(
              child: Column(
                children: [
                  for (int i = 0; i < recent.length; i++) ...[
                    if (i > 0) const Divider(height: 1),
                    _RecentRow(row: recent[i] as Map<String, dynamic>),
                  ],
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;
  final VoidCallback onTap;

  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Icon(icon, color: color, size: 20),
              Text(
                value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: AppColors.primaryText,
                ),
              ),
              Text(
                label.toUpperCase(),
                style: const TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.3,
                  color: AppColors.secondaryText,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RecentRow extends StatelessWidget {
  final Map<String, dynamic> row;
  const _RecentRow({required this.row});

  @override
  Widget build(BuildContext context) {
    final amount = Formatters.asNum(row['amount']);
    final type = row['type'] as String? ?? '';
    final customerId = Formatters.asNum(row['customer_id']).toInt();
    return ListTile(
      dense: true,
      onTap: customerId <= 0
          ? null
          : () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => CustomerProfileScreen(customerId: customerId),
                ),
              ),
      leading: CircleAvatar(
        radius: 16,
        backgroundColor: (type == 'Loan' ? AppColors.primary : AppColors.success)
            .withValues(alpha: 0.1),
        child: Icon(
          type == 'Loan' ? Icons.credit_score : Icons.savings,
          size: 16,
          color: type == 'Loan' ? AppColors.primary : AppColors.success,
        ),
      ),
      title: Text(
        row['customer_name'] as String? ?? '',
        style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
      ),
      subtitle: Text(
        row['receipt_no'] as String? ?? '',
        style: const TextStyle(fontSize: 10.5, color: AppColors.secondaryText),
      ),
      trailing: Text(
        Formatters.inr(amount),
        style: const TextStyle(
          fontSize: 12.5,
          fontWeight: FontWeight.w800,
          color: AppColors.success,
        ),
      ),
    );
  }
}

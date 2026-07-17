import 'package:umbrella_core/umbrella_core.dart';

/// GET /dashboard/summary — role-scoped (agent sees only their own numbers;
/// business-wide fields like overall_cash_balance/available_loan_fund are
/// zeroed server-side for the agent role, so they're intentionally not
/// surfaced in this app).
class DashboardRepository {
  final ApiClient api;
  DashboardRepository(this.api);

  Future<Map<String, dynamic>> summary() async {
    final data = await api.get('/dashboard/summary');
    return data as Map<String, dynamic>? ?? {};
  }
}

import 'package:umbrella_core/umbrella_core.dart';

import '../models/loan_plan.dart';
import '../models/saving_plan.dart';

class PlanRepository {
  final ApiClient api;
  PlanRepository(this.api);

  Future<List<LoanPlan>> loanPlans() async {
    final data = await api.get('/loan-plans');
    return (data as List? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(LoanPlan.fromJson)
        .where((p) => p.name != 'Custom Loan Plan')
        .toList();
  }

  Future<List<SavingPlan>> savingPlans() async {
    final data = await api.get('/saving-plans');
    return (data as List? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(SavingPlan.fromJson)
        .where((p) => p.name != 'Custom Savings Plan')
        .toList();
  }
}

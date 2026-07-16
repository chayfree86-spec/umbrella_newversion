import 'package:umbrella_core/umbrella_core.dart';

import '../models/account.dart';

/// GET /loan-accounts, /saving-accounts (paginated, agent-scoped
/// server-side — LoanController::index/SavingController::index both apply
/// `agent_id = authUser.agent_id` for the agent role) + per-account
/// statement (transactions + installments).
class AccountRepository {
  final ApiClient api;
  AccountRepository(this.api);

  Future<PagedResult<Account>> listLoans(
      {int page = 1, String? search, String? status}) async {
    final data = await api.get('/loan-accounts', query: {
      'page': page,
      if (search != null && search.isNotEmpty) 'search': search,
      if (status != null && status.isNotEmpty) 'status': status,
    });
    return PagedResult.fromEnvelope(
        data as Map<String, dynamic>, Account.fromLoanJson);
  }

  Future<PagedResult<Account>> listSavings(
      {int page = 1, String? search, String? status}) async {
    final data = await api.get('/saving-accounts', query: {
      'page': page,
      if (search != null && search.isNotEmpty) 'search': search,
      if (status != null && status.isNotEmpty) 'status': status,
    });
    return PagedResult.fromEnvelope(
        data as Map<String, dynamic>, Account.fromSavingJson);
  }

  Future<Account> getAccount(String accountNo, bool isLoan) async {
    final data = await api.get(
        isLoan ? '/loan-accounts/$accountNo' : '/saving-accounts/$accountNo');
    final json = data as Map<String, dynamic>;
    return isLoan ? Account.fromLoanJson(json) : Account.fromSavingJson(json);
  }

  Future<(List<StatementTransaction>, List<Installment>)> statement(
      String accountNo, bool isLoan) async {
    final data = await api.get(isLoan
        ? '/loan-accounts/$accountNo/statement'
        : '/saving-accounts/$accountNo/statement');
    final json = data as Map<String, dynamic>;
    final transactions = (json['transactions'] as List? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(StatementTransaction.fromJson)
        .toList();
    final installments = (json['installments'] as List? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(Installment.fromJson)
        .toList();
    return (transactions, installments);
  }
}

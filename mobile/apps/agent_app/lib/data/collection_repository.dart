import 'package:umbrella_core/umbrella_core.dart';

import '../models/collection_receipt.dart';
import '../models/collection_worklist_item.dart';

/// Daily Collection worklist + Collect Payment + Receipt. Standardizes on
/// /collections/loan and /collections/saving (not the /loan-accounts/{id}/
/// collect alias) — this is the pair the web app actually calls, and the
/// one that fires the admin notification when an agent collects.
class CollectionRepository {
  final ApiClient api;
  CollectionRepository(this.api);

  /// GET /collections/agent/{agentId} — today's due checklist for this agent.
  Future<List<CollectionWorklistItem>> worklist(int agentId) async {
    final data = await api.get('/collections/agent/$agentId');
    return (data as List)
        .whereType<Map<String, dynamic>>()
        .map(CollectionWorklistItem.fromJson)
        .toList();
  }

  Future<String> collectLoan({
    required String accountNo,
    required double amount,
    double penaltyAmount = 0,
    required String paymentMode,
    String? remarks,
  }) async {
    final data = await api.post('/collections/loan', body: {
      'account_no': accountNo,
      'collected_amount': amount,
      if (penaltyAmount > 0) 'penalty_amount': penaltyAmount,
      'payment_mode': paymentMode,
      if (remarks != null && remarks.isNotEmpty) 'remarks': remarks,
    });
    return (data as Map<String, dynamic>)['receipt_no'] as String;
  }

  Future<String> collectSaving({
    required String accountNo,
    required double amount,
    required String paymentMode,
    String? remarks,
  }) async {
    final data = await api.post('/collections/saving', body: {
      'account_no': accountNo,
      'deposit_amount': amount,
      'payment_mode': paymentMode,
      if (remarks != null && remarks.isNotEmpty) 'remarks': remarks,
    });
    return (data as Map<String, dynamic>)['receipt_no'] as String;
  }

  Future<CollectionReceipt> receipt(String receiptNo) async {
    final data = await api.get('/receipts/$receiptNo');
    return CollectionReceipt.fromJson(data as Map<String, dynamic>);
  }
}

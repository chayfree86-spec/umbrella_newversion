/// GET /receipts/{receiptNo} response — central receipts row + type-specific
/// `detail` (customer/account/collector/branch/area names).
class CollectionReceipt {
  final String receiptNo;
  final String receiptType; // 'loan_collection' | 'saving_deposit' | ...
  final String? accountNo;
  final double amount;
  final String paymentMode;
  final DateTime? createdAt;
  final Map<String, dynamic> detail;

  const CollectionReceipt({
    required this.receiptNo,
    required this.receiptType,
    this.accountNo,
    required this.amount,
    required this.paymentMode,
    this.createdAt,
    this.detail = const {},
  });

  String get customerName => detail['customer_name'] as String? ?? '';
  String get collectorName => detail['collector_name'] as String? ?? '';
  String get branchName => detail['branch_name'] as String? ?? '';
  String get areaName => detail['area_name'] as String? ?? '';
  double get penaltyAmount =>
      _toDouble(detail['penalty_amount'] ?? detail['collected_amount']);
  bool get isLoan => receiptType == 'loan_collection';

  factory CollectionReceipt.fromJson(Map<String, dynamic> json) {
    return CollectionReceipt(
      receiptNo: json['receipt_no'] as String? ?? '',
      receiptType: json['receipt_type'] as String? ?? '',
      accountNo: json['account_no'] as String?,
      amount: _toDouble(json['amount']),
      paymentMode: json['payment_mode'] as String? ?? 'Cash',
      createdAt: DateTime.tryParse(json['created_at']?.toString() ?? ''),
      detail: json['detail'] is Map<String, dynamic>
          ? json['detail'] as Map<String, dynamic>
          : const {},
    );
  }

  static double _toDouble(dynamic v) =>
      v is num ? v.toDouble() : double.tryParse(v?.toString() ?? '') ?? 0;
}

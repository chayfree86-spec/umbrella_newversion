/// A single row from GET /collections/agent/{agentId} — the agent's daily
/// checklist (accounts due today, Paid/Pending status).
class CollectionWorklistItem {
  final int id;
  final String accNo;
  final String type; // 'Loan' | 'Saving'
  final double emiAmt;
  final double outstanding;
  final String todayStatus; // 'Paid' | 'Pending'
  final int customerId;
  final String customerName;
  final String customerPhone;
  final String? customerPhoto;
  final String branch;
  final String area;
  final String agent;

  const CollectionWorklistItem({
    required this.id,
    required this.accNo,
    required this.type,
    required this.emiAmt,
    required this.outstanding,
    required this.todayStatus,
    required this.customerId,
    required this.customerName,
    required this.customerPhone,
    this.customerPhoto,
    required this.branch,
    required this.area,
    required this.agent,
  });

  bool get isLoan => type == 'Loan';
  bool get isPaid => todayStatus == 'Paid';

  factory CollectionWorklistItem.fromJson(Map<String, dynamic> json) {
    final customer = json['customer'] as Map<String, dynamic>? ?? {};
    return CollectionWorklistItem(
      id: _toInt(json['id']),
      accNo: json['accNo'] as String? ?? '',
      type: json['type'] as String? ?? '',
      emiAmt: _toDouble(json['emiAmt']),
      outstanding: _toDouble(json['outstanding']),
      todayStatus: json['todayStatus'] as String? ?? 'Pending',
      customerId: _toInt(customer['id']),
      customerName: customer['name'] as String? ?? '',
      customerPhone: customer['phone'] as String? ?? '',
      customerPhoto: customer['photo'] as String?,
      branch: json['branch'] as String? ?? '',
      area: json['area'] as String? ?? '',
      agent: json['agent'] as String? ?? '',
    );
  }

  static int _toInt(dynamic v) =>
      v is int ? v : int.tryParse(v?.toString() ?? '') ?? 0;
  static double _toDouble(dynamic v) =>
      v is num ? v.toDouble() : double.tryParse(v?.toString() ?? '') ?? 0;
}

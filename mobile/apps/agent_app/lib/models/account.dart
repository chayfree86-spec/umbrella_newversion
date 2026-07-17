import 'package:umbrella_core/umbrella_core.dart';

/// Unified view over loan_accounts / saving_accounts rows (both come back
/// from GET /loan-accounts, /saving-accounts, /loan-accounts/{id}, and
/// /saving-accounts/{id} with the same shape modulo a few field-name
/// differences, which this model normalizes).
class Account {
  final int id;
  final int customerId;
  final String accountNo;
  final String type; // 'Loan' | 'Saving'
  final String status;
  final String customerName;
  final String customerMobile;
  final String? customerPhoto;
  final String planName;
  final String branchName;
  final String areaName;
  final String agentName;

  /// Loan: principal_amount / Saving: deposit_amount
  final double principalOrDeposit;

  /// Loan: emi_amount / Saving: deposit_amount (same field, recurring amount)
  final double recurringAmount;

  /// Loan: outstanding_amount / Saving: total_deposited
  final double outstandingOrDeposited;

  final double totalPayableOrMaturity;
  final double todayDue;
  final String? nextDueDate;
  final int paidInstallments;
  final int totalInstallments;
  final String? startDate;
  final String? endDate; // loan end_date or saving maturity_date

  const Account({
    required this.id,
    required this.customerId,
    required this.accountNo,
    required this.type,
    required this.status,
    required this.customerName,
    required this.customerMobile,
    this.customerPhoto,
    required this.planName,
    required this.branchName,
    required this.areaName,
    required this.agentName,
    required this.principalOrDeposit,
    required this.recurringAmount,
    required this.outstandingOrDeposited,
    required this.totalPayableOrMaturity,
    required this.todayDue,
    this.nextDueDate,
    required this.paidInstallments,
    required this.totalInstallments,
    this.startDate,
    this.endDate,
  });

  bool get isLoan => type == 'Loan';

  /// Processing accounts are read-only in this app — agents never see
  /// approve/reject controls (policy-profile gated, agent role never has
  /// disbursement permission). Collect is only enabled once approved.
  bool get isAwaitingApproval => status == 'Processing';
  bool get canCollect => ['Approved', 'Active', 'Defaulter'].contains(status);

  factory Account.fromLoanJson(Map<String, dynamic> j) => Account(
        id: _int(j['id']),
        customerId: _int(j['customer_id']),
        accountNo: j['loan_account_no'] as String? ?? '',
        type: 'Loan',
        status: j['account_status'] as String? ?? '',
        customerName: j['customer_name'] as String? ?? '',
        customerMobile: j['customer_mobile'] as String? ?? '',
        customerPhoto: j['customer_photo'] as String?,
        planName: j['plan_name'] as String? ?? '',
        branchName: j['branch_name'] as String? ?? '',
        areaName: j['area_name'] as String? ?? '',
        agentName: j['agent_name'] as String? ?? '',
        principalOrDeposit: Formatters.asNum(j['principal_amount']).toDouble(),
        recurringAmount: Formatters.asNum(j['emi_amount']).toDouble(),
        outstandingOrDeposited:
            Formatters.asNum(j['outstanding_amount']).toDouble(),
        totalPayableOrMaturity: Formatters.asNum(j['total_payable']).toDouble(),
        todayDue: Formatters.asNum(j['today_due']).toDouble(),
        nextDueDate: j['next_due_date'] as String?,
        paidInstallments: _int(j['paid_installments']),
        totalInstallments: _int(j['total_installments']),
        startDate: j['start_date'] as String?,
        endDate: j['end_date'] as String?,
      );

  factory Account.fromSavingJson(Map<String, dynamic> j) => Account(
        id: _int(j['id']),
        customerId: _int(j['customer_id']),
        accountNo: j['saving_account_no'] as String? ?? '',
        type: 'Saving',
        status: j['account_status'] as String? ?? '',
        customerName: j['customer_name'] as String? ?? '',
        customerMobile: j['customer_mobile'] as String? ?? '',
        customerPhoto: j['customer_photo'] as String?,
        planName: j['plan_name'] as String? ?? '',
        branchName: j['branch_name'] as String? ?? '',
        areaName: j['area_name'] as String? ?? '',
        agentName: j['agent_name'] as String? ?? '',
        principalOrDeposit: Formatters.asNum(j['deposit_amount']).toDouble(),
        recurringAmount: Formatters.asNum(j['deposit_amount']).toDouble(),
        outstandingOrDeposited:
            Formatters.asNum(j['total_deposited']).toDouble(),
        totalPayableOrMaturity:
            Formatters.asNum(j['maturity_amount']).toDouble(),
        todayDue: Formatters.asNum(j['today_due']).toDouble(),
        nextDueDate: j['next_due_date'] as String?,
        paidInstallments: _int(j['paid_installments']),
        totalInstallments: _int(j['total_installments']),
        startDate: j['start_date'] as String?,
        endDate: j['maturity_date'] as String?,
      );

  static int _int(dynamic v) =>
      v is int ? v : int.tryParse(v?.toString() ?? '') ?? 0;
}

/// loan_installments / saving_installments row — same shape both sides.
class Installment {
  final int id;
  final int installmentNo;
  final String dueDate;
  final double totalDue;
  final double paidAmount;
  final String status;

  const Installment({
    required this.id,
    required this.installmentNo,
    required this.dueDate,
    required this.totalDue,
    required this.paidAmount,
    required this.status,
  });

  double get pending => (totalDue - paidAmount).clamp(0, double.infinity);

  factory Installment.fromJson(Map<String, dynamic> j) => Installment(
        id: Formatters.asNum(j['id']).toInt(),
        installmentNo: Formatters.asNum(j['installment_no']).toInt(),
        dueDate: j['due_date'] as String? ?? '',
        totalDue: Formatters.asNum(j['total_due']).toDouble(),
        paidAmount: Formatters.asNum(j['paid_amount']).toDouble(),
        status: j['status'] as String? ?? 'Pending',
      );
}

/// A row from GET /{loan|saving}-accounts/{id}/statement's `transactions`
/// array (loan_collections/saving_deposits, aliased fields).
class StatementTransaction {
  final String refNo;
  final String date;
  final String txType;
  final double amount;
  final double fine;
  final String collector;
  final String paymentMode;
  final String? remarks;

  const StatementTransaction({
    required this.refNo,
    required this.date,
    required this.txType,
    required this.amount,
    required this.fine,
    required this.collector,
    required this.paymentMode,
    this.remarks,
  });

  factory StatementTransaction.fromJson(Map<String, dynamic> j) =>
      StatementTransaction(
        refNo: j['refNo'] as String? ?? '',
        date: j['date'] as String? ?? '',
        txType: j['type'] as String? ?? '',
        amount: Formatters.asNum(j['amt']).toDouble(),
        fine: Formatters.asNum(j['fine']).toDouble(),
        collector: j['collector'] as String? ?? '',
        paymentMode: j['paymentMode'] as String? ?? 'Cash',
        remarks: j['remarks'] as String?,
      );
}

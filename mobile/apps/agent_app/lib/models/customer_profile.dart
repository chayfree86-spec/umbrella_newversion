import 'package:umbrella_core/umbrella_core.dart';

class CustomerAddress {
  final String addressLine1;
  final String? city;
  final String? state;
  final String? pincode;

  const CustomerAddress({required this.addressLine1, this.city, this.state, this.pincode});

  factory CustomerAddress.fromJson(Map<String, dynamic> j) => CustomerAddress(
        addressLine1: j['address_line1'] as String? ?? '',
        city: j['city'] as String?,
        state: j['state'] as String?,
        pincode: j['pincode'] as String?,
      );
}

class CustomerKyc {
  final String? aadhaarNo;
  final String? panNo;
  final String? bankName;
  final String? bankAccountNo;
  final String? bankIfsc;
  final bool verified;

  const CustomerKyc({
    this.aadhaarNo,
    this.panNo,
    this.bankName,
    this.bankAccountNo,
    this.bankIfsc,
    this.verified = false,
  });

  factory CustomerKyc.fromJson(Map<String, dynamic> j) => CustomerKyc(
        aadhaarNo: j['aadhaar_no'] as String?,
        panNo: j['pan_no'] as String?,
        bankName: j['bank_name'] as String?,
        bankAccountNo: j['bank_account_no'] as String?,
        bankIfsc: j['bank_ifsc'] as String?,
        verified: j['verified'] == true || j['verified'] == 1,
      );
}

class CustomerGuarantor {
  final String name;
  final String? mobile;
  final String? relation;

  const CustomerGuarantor({required this.name, this.mobile, this.relation});

  factory CustomerGuarantor.fromJson(Map<String, dynamic> j) => CustomerGuarantor(
        name: j['name'] as String? ?? '',
        mobile: j['mobile'] as String?,
        relation: j['relation'] as String?,
      );
}

class CustomerAccountSummary {
  final String accountNo;
  final String status;
  final bool isLoan;

  const CustomerAccountSummary({required this.accountNo, required this.status, required this.isLoan});

  factory CustomerAccountSummary.fromLoanJson(Map<String, dynamic> j) => CustomerAccountSummary(
        accountNo: j['loan_account_no'] as String? ?? '',
        status: j['account_status'] as String? ?? '',
        isLoan: true,
      );

  factory CustomerAccountSummary.fromSavingJson(Map<String, dynamic> j) => CustomerAccountSummary(
        accountNo: j['saving_account_no'] as String? ?? '',
        status: j['account_status'] as String? ?? '',
        isLoan: false,
      );
}

class CustomerProfile {
  final int id;
  final String customerCode;
  final String fullName;
  final String mobile;
  final String? alternateMobile;
  final String? dob;
  final String? gender;
  final String? fatherHusbandName;
  final String? occupation;
  final String status;
  final String branchName;
  final String areaName;
  final String agentName;
  final CustomerAddress? address;
  final CustomerKyc? kyc;
  final List<CustomerGuarantor> guarantors;
  final List<CustomerAccountSummary> accounts;

  const CustomerProfile({
    required this.id,
    required this.customerCode,
    required this.fullName,
    required this.mobile,
    this.alternateMobile,
    this.dob,
    this.gender,
    this.fatherHusbandName,
    this.occupation,
    required this.status,
    required this.branchName,
    required this.areaName,
    required this.agentName,
    this.address,
    this.kyc,
    this.guarantors = const [],
    this.accounts = const [],
  });

  factory CustomerProfile.fromJson(Map<String, dynamic> j) {
    final addresses = (j['addresses'] as List? ?? []).whereType<Map<String, dynamic>>();
    final loans = (j['loans'] as List? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(CustomerAccountSummary.fromLoanJson);
    final savings = (j['savings'] as List? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(CustomerAccountSummary.fromSavingJson);

    return CustomerProfile(
      id: Formatters.asNum(j['id']).toInt(),
      customerCode: j['customer_code'] as String? ?? '',
      fullName: j['full_name'] as String? ?? '',
      mobile: j['mobile'] as String? ?? '',
      alternateMobile: j['alternate_mobile'] as String?,
      dob: j['dob'] as String?,
      gender: j['gender'] as String?,
      fatherHusbandName: j['father_or_husband_name'] as String?,
      occupation: j['occupation'] as String?,
      status: j['status'] as String? ?? '',
      branchName: j['branch_name'] as String? ?? '',
      areaName: j['area_name'] as String? ?? '',
      agentName: j['agent_name'] as String? ?? '',
      address: addresses.isEmpty ? null : CustomerAddress.fromJson(addresses.first),
      kyc: j['kyc'] is Map<String, dynamic> ? CustomerKyc.fromJson(j['kyc'] as Map<String, dynamic>) : null,
      guarantors: (j['guarantors'] as List? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(CustomerGuarantor.fromJson)
          .toList(),
      accounts: [...loans, ...savings],
    );
  }
}

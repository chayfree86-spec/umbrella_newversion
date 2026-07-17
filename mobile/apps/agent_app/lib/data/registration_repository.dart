import 'package:dio/dio.dart' show FormData, MultipartFile;
import 'package:image_picker/image_picker.dart';
import 'package:umbrella_core/umbrella_core.dart';

class MobileCheckResult {
  final bool registered;
  final String? customerName;
  final String? customerCode;
  const MobileCheckResult({required this.registered, this.customerName, this.customerCode});
}

class RegistrationResult {
  final int customerId;
  final String accountNo;
  final String accountType;
  const RegistrationResult(
      {required this.customerId, required this.accountNo, required this.accountType});
}

/// POST /customer-registration + POST /customers/{id}/documents — mirrors
/// CustomerController::register/uploadDocuments field-for-field.
class RegistrationRepository {
  final ApiClient api;
  RegistrationRepository(this.api);

  Future<MobileCheckResult> checkMobile(String mobile) async {
    final data = await api
        .get('/customers/check-mobile', query: {'mobile': mobile}) as Map<String, dynamic>;
    final registered = data['registered'] == true;
    final customer = data['customer'] as Map<String, dynamic>?;
    return MobileCheckResult(
      registered: registered,
      customerName: customer?['full_name'] as String?,
      customerCode: customer?['customer_code'] as String?,
    );
  }

  Future<RegistrationResult> register(Map<String, dynamic> payload) async {
    final data = await api.post('/customer-registration', body: payload)
        as Map<String, dynamic>;
    return RegistrationResult(
      customerId: int.parse(data['customer_id'].toString()),
      accountNo: data['account_no'] as String? ?? '',
      accountType: data['account_type'] as String? ?? '',
    );
  }

  /// [files] keys must match the backend's recognized keys
  /// (aadhaar_front/aadhaar_back/pan/cheque update customer_kyc paths;
  /// any other key — photo/signature/guarantor_* — lands in
  /// customer_documents as a generic row). Null/empty entries are skipped.
  Future<void> uploadDocuments(int customerId, Map<String, XFile?> files) async {
    final entries = files.entries.where((e) => e.value != null).toList();
    if (entries.isEmpty) return;

    final form = FormData();
    for (final e in entries) {
      final file = e.value!;
      form.files.add(MapEntry(
        e.key,
        await MultipartFile.fromFile(file.path, filename: file.name),
      ));
    }
    await api.postMultipart('/customers/$customerId/documents', form);
  }
}

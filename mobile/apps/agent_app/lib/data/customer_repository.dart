import 'package:umbrella_core/umbrella_core.dart';

import '../models/customer_profile.dart';

/// GET /customers/{id}/profile — full nested profile (address/KYC/
/// guarantors/accounts). Agent access is restricted server-side to their
/// own customers (CustomerController::show 403s otherwise).
class CustomerRepository {
  final ApiClient api;
  CustomerRepository(this.api);

  Future<CustomerProfile> getProfile(int customerId) async {
    final data = await api.get('/customers/$customerId/profile');
    return CustomerProfile.fromJson(data as Map<String, dynamic>);
  }
}

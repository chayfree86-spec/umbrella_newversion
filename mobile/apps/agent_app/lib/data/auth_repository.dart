import 'package:umbrella_core/umbrella_core.dart';

/// POST /auth/login (mobile+PIN), /auth/profile, /auth/logout,
/// /auth/change-password, /auth/branding.
class AuthRepository {
  final ApiClient api;

  AuthRepository(this.api);

  /// Agent login is always mobile+PIN (see plan: password/email path
  /// omitted entirely for this app).
  Future<Map<String, dynamic>> login(String mobile, String pin) async {
    final data = await api.post('/auth/login', body: {
      'username': mobile,
      'pin': pin,
    });
    return data as Map<String, dynamic>;
  }

  Future<UserSession> profile() async {
    final data = await api.get('/auth/profile');
    return UserSession.fromJson(data as Map<String, dynamic>);
  }

  Future<void> logout() async {
    try {
      await api.post('/auth/logout');
    } catch (_) {
      // best-effort, same as web's .catch(() => {})
    }
  }

  Future<void> changePassword({String? password, String? pin}) async {
    final body = <String, dynamic>{};
    if (password != null && password.isNotEmpty) body['password'] = password;
    if (pin != null && pin.isNotEmpty) body['pin'] = pin;
    await api.post('/auth/change-password', body: body);
  }

  Future<Map<String, dynamic>> branding() async {
    final data = await api.get('/auth/branding');
    return data as Map<String, dynamic>? ?? {};
  }
}

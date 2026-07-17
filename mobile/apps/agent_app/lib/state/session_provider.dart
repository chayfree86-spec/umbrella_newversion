import 'package:flutter/foundation.dart';
import 'package:umbrella_core/umbrella_core.dart';

import '../data/auth_repository.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

/// Session/auth state layer — bootstraps from secure storage on app start,
/// wires itself as ApiClient.onSessionExpired so a 401 anywhere mid-app
/// routes back to Login (same effect as the web's window.location.href='/').
class SessionProvider extends ChangeNotifier {
  final ApiClient api;
  final SecureStorageService storage;
  late final AuthRepository _authRepo;

  AuthStatus status = AuthStatus.unknown;
  UserSession? currentUser;
  String? companyName;
  String? companyTagline;

  SessionProvider(this.api, this.storage) {
    _authRepo = AuthRepository(api);
    api.onSessionExpired = _handleSessionExpired;
  }

  Future<void> bootstrap() async {
    await api.applyStoredBaseUrl();

    // Branding is public — fetch regardless of login state, fall back
    // silently on failure (mirrors Login.jsx's catch-and-keep-default).
    try {
      final b = await _authRepo.branding();
      companyName = b['company_name'] as String? ?? 'Umbrella Finance';
      companyTagline = b['company_tagline'] as String? ?? 'Chhote Kadam, Bade Sapne';
    } catch (_) {
      companyName ??= 'Umbrella Finance';
      companyTagline ??= 'Chhote Kadam, Bade Sapne';
    }

    final token = await storage.readToken();
    if (token == null || token.isEmpty) {
      status = AuthStatus.unauthenticated;
      notifyListeners();
      return;
    }

    // Restore instantly from cached session, then reconcile via /auth/profile.
    final cached = await storage.readSession();
    if (cached != null) {
      currentUser = UserSession.fromJson(cached);
      status = AuthStatus.authenticated;
      notifyListeners();
    }

    try {
      final fresh = await _authRepo.profile();
      currentUser = fresh;
      status = AuthStatus.authenticated;
      await storage.writeSession(fresh.toJson());
    } catch (_) {
      // profile() 401 already triggers _handleSessionExpired via the
      // interceptor; if it was some other error, keep the cached session.
      if (currentUser == null) {
        status = AuthStatus.unauthenticated;
      }
    }
    notifyListeners();
  }

  Future<void> login(String mobile, String pin) async {
    final data = await _authRepo.login(mobile, pin);
    final token = data['token'] as String;
    final user = UserSession.fromJson(data['user'] as Map<String, dynamic>);

    await storage.writeToken(token);
    await storage.writeSession(user.toJson());

    currentUser = user;
    status = AuthStatus.authenticated;
    notifyListeners();
  }

  Future<void> logout() async {
    await _authRepo.logout();
    await storage.clearSession();
    currentUser = null;
    status = AuthStatus.unauthenticated;
    notifyListeners();
  }

  void _handleSessionExpired() {
    currentUser = null;
    status = AuthStatus.unauthenticated;
    notifyListeners();
  }
}

import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Android-Keystore-backed storage for the JWT + session snapshot.
/// Financial data — never use SharedPreferences for these.
class SecureStorageService {
  static const _kToken = 'auth_token';
  static const _kSession = 'session_json';
  static const _kServerUrl = 'server_url_override';

  final FlutterSecureStorage _storage;

  SecureStorageService()
      : _storage = const FlutterSecureStorage(
          aOptions: AndroidOptions(encryptedSharedPreferences: true),
        );

  Future<String?> readToken() => _storage.read(key: _kToken);

  Future<void> writeToken(String token) =>
      _storage.write(key: _kToken, value: token);

  Future<Map<String, dynamic>?> readSession() async {
    final raw = await _storage.read(key: _kSession);
    if (raw == null) return null;
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  Future<void> writeSession(Map<String, dynamic> session) =>
      _storage.write(key: _kSession, value: jsonEncode(session));

  /// Runtime server-URL override (field re-pointing without rebuild).
  Future<String?> readServerUrl() => _storage.read(key: _kServerUrl);

  Future<void> writeServerUrl(String url) =>
      _storage.write(key: _kServerUrl, value: url);

  Future<void> clearServerUrl() => _storage.delete(key: _kServerUrl);

  /// Logout: clears credentials but keeps the server-URL override.
  Future<void> clearSession() async {
    await _storage.delete(key: _kToken);
    await _storage.delete(key: _kSession);
  }
}

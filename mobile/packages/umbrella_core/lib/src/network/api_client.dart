import 'package:dio/dio.dart';

import '../config/env.dart';
import '../storage/secure_storage_service.dart';
import '../widgets/app_snackbar.dart';
import 'api_exception.dart';

/// Central HTTP client — structural port of the web app's
/// src/services/api.js axios instance (request interceptor attaches the JWT,
/// error interceptor handles session expiry).
class ApiClient {
  late final Dio dio;
  final SecureStorageService storage;

  /// Called when a 401 arrives from any authenticated endpoint —
  /// SessionProvider clears state and returns the user to Login.
  void Function()? onSessionExpired;

  /// Auth endpoints jinka 401 "galat credentials" hai, "session expired"
  /// nahi — inpar auto-logout kabhi nahi (web app ka hard-learned fix:
  /// warna login form ka error message dikhne se pehle hi user logout ho
  /// jata tha aur lagta tha "kuch hua hi nahi").
  static const _authEndpoints = ['/auth/login', '/auth/reset-credentials'];

  ApiClient(this.storage, {String? baseUrl}) {
    dio = Dio(BaseOptions(
      baseUrl: baseUrl ?? Env.apiBaseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
      // Envelope {success:false} bodies arrive with 4xx/5xx — let them
      // through so we can unwrap the message instead of throwing blind.
      validateStatus: (status) => status != null && status < 600,
    ));

    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await storage.readToken();
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
    ));
  }

  /// Runtime server-URL override (login-screen hidden setting) — applied on
  /// app start and whenever changed.
  Future<void> applyStoredBaseUrl() async {
    final override = await storage.readServerUrl();
    if (override != null && override.isNotEmpty) {
      dio.options.baseUrl = override;
    }
  }

  void setBaseUrl(String url) {
    dio.options.baseUrl = url;
  }

  String get baseUrl => dio.options.baseUrl;

  bool _isAuthEndpoint(String path) =>
      _authEndpoints.any((ep) => path.contains(ep));

  /// Unwraps the backend envelope. Returns `data` (plus `pagination` merged
  /// under key '_pagination' when present). Throws [ApiException] on
  /// `success:false`, HTTP errors, or network failures.
  Future<dynamic> request(
    String method,
    String path, {
    Object? body,
    Map<String, dynamic>? query,
    Options? options,
  }) async {
    Response resp;
    try {
      resp = await dio.request(
        path,
        data: body,
        queryParameters: query,
        options: (options ?? Options()).copyWith(method: method),
      );
    } on DioException {
      // No BuildContext down here, so this is the one place a failure can
      // go completely unseen if a screen's own catch block doesn't already
      // surface it — the global snackbar is the safety net for that case.
      AppSnackbar.showError('Network connection failed. Please check your internet.');
      throw ApiException(
        'Network connection failed. Please check your internet.',
        isNetworkError: true,
      );
    }

    final status = resp.statusCode ?? 0;
    final data = resp.data;

    // Session expiry: any 401 outside the login endpoints.
    if (status == 401 && !_isAuthEndpoint(path)) {
      await storage.clearSession();
      onSessionExpired?.call();
    }

    if (data is Map<String, dynamic>) {
      if (data['success'] == true) {
        final payload = data['data'];
        if (data['pagination'] != null && payload is List) {
          return {'items': payload, 'pagination': data['pagination']};
        }
        return payload;
      }
      throw ApiException(
        (data['message'] as String?) ?? 'Server error occurred',
        statusCode: status,
        errors: data['errors'] is Map<String, dynamic>
            ? data['errors'] as Map<String, dynamic>
            : null,
      );
    }

    if (status >= 200 && status < 300) return data;
    throw ApiException('Server error occurred', statusCode: status);
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) =>
      request('GET', path, query: query);

  Future<dynamic> post(String path, {Object? body}) =>
      request('POST', path, body: body);

  Future<dynamic> put(String path, {Object? body}) =>
      request('PUT', path, body: body);

  Future<dynamic> delete(String path) => request('DELETE', path);

  /// Multipart upload — Content-Type is intentionally NOT set manually so
  /// Dio writes the multipart boundary itself (same gotcha as the web app's
  /// `'Content-Type': undefined` override; a manual JSON content type would
  /// leave PHP's $_FILES empty).
  Future<dynamic> postMultipart(String path, FormData formData) =>
      request('POST', path,
          body: formData, options: Options(contentType: null));
}

/// Typed wrapper for the backend's `{success, message, errors}` envelope so
/// UI code never touches Dio types directly.
class ApiException implements Exception {
  final String message;
  final int? statusCode;

  /// Field-level validation errors from a 422 response ({field: message}).
  final Map<String, dynamic>? errors;

  /// True when the request never reached the server (timeout / no network).
  final bool isNetworkError;

  const ApiException(
    this.message, {
    this.statusCode,
    this.errors,
    this.isNetworkError = false,
  });

  @override
  String toString() => message;
}

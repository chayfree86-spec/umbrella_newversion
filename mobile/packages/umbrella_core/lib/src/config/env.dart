/// Build-time environment config.
///
/// Default base URL points at the host machine's XAMPP from the Android
/// emulator (10.0.2.2 = emulator's alias for host localhost). Override per
/// build with:
///   flutter build apk --dart-define=API_BASE_URL=https://yourhost.com/api
///
/// A runtime override (stored in secure storage) takes precedence — see
/// ApiClient.baseUrlOverride — so the server URL can be re-pointed in the
/// field without rebuilding the APK.
class Env {
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2/umbrella_newversion/api',
  );
}

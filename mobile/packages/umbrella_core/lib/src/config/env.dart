/// Build-time environment config, read from mobile/.env via Flutter's native
/// --dart-define-from-file (Flutter 3.28+ accepts plain KEY=VALUE .env files
/// directly, no extra package needed):
///   flutter build apk --release --dart-define-from-file=../../.env
///
/// mobile/.env is gitignored (holds the real live API_BASE_URL); copy
/// mobile/.env.example to mobile/.env and fill in your own values to build
/// locally. Falls back to the local XAMPP/emulator address when not passed
/// (e.g. plain `flutter run` with no --dart-define-from-file), so dev still
/// works out of the box.
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

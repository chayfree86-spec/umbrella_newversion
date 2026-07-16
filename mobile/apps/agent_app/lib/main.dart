import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:umbrella_core/umbrella_core.dart';

import 'app.dart';
import 'state/session_provider.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Surface uncaught widget-build errors to logcat (adb logcat | grep
  // flutter) instead of a silently blank screen — this is how we caught
  // and diagnosed the AccountDetailScreen Future.wait issue.
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    debugPrint('FLUTTER ERROR: ${details.exceptionAsString()}');
    debugPrint(details.stack.toString());
  };

  final storage = SecureStorageService();
  final api = ApiClient(storage);

  runApp(
    MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: api),
        ChangeNotifierProvider(
          create: (_) => SessionProvider(api, storage),
        ),
      ],
      child: const App(),
    ),
  );
}

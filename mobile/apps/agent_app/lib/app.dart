import 'package:flutter/material.dart';
import 'package:umbrella_core/umbrella_core.dart';

import 'features/splash/splash_screen.dart';

class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Umbrella Finance — Agent',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      scaffoldMessengerKey: AppSnackbar.messengerKey,
      builder: (context, child) =>
          ConnectivityBanner(child: child ?? const SizedBox.shrink()),
      home: const SplashScreen(),
    );
  }
}

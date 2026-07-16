import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// Global toast surface — MaterialApp.scaffoldMessengerKey wires to this so
/// ApiClient (which has no BuildContext) can still show network-failure
/// feedback from anywhere in the app, instead of failing silently when a
/// screen's own try/catch doesn't already surface the error.
abstract final class AppSnackbar {
  static final GlobalKey<ScaffoldMessengerState> messengerKey =
      GlobalKey<ScaffoldMessengerState>();

  static void showError(String message) {
    final messenger = messengerKey.currentState;
    if (messenger == null) return;
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: AppColors.danger,
      behavior: SnackBarBehavior.floating,
      margin: const EdgeInsets.all(12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ));
  }
}

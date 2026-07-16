import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:umbrella_core/umbrella_core.dart';

import '../../state/session_provider.dart';

/// Hidden "Server URL" override — long-press the logo on Login. Lets field
/// staff re-point the app at a different deployment without a rebuild.
void showServerUrlSheet(BuildContext context) {
  final api = context.read<SessionProvider>().api;
  final ctrl = TextEditingController(text: api.baseUrl);

  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) => Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Server URL (Advanced)',
            style: TextStyle(
                fontSize: 14, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          const Text(
            'Only change this if instructed by your admin.',
            style: TextStyle(fontSize: 11, color: AppColors.secondaryText),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: ctrl,
            keyboardType: TextInputType.url,
            decoration: const InputDecoration(
                hintText: 'https://yourhost.com/api'),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Cancel'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () async {
                    final url = ctrl.text.trim();
                    if (url.isEmpty) return;
                    final storage = context.read<SessionProvider>().storage;
                    await storage.writeServerUrl(url);
                    api.setBaseUrl(url);
                    if (ctx.mounted) Navigator.pop(ctx);
                  },
                  child: const Text('Save'),
                ),
              ),
            ],
          ),
        ],
      ),
    ),
  );
}

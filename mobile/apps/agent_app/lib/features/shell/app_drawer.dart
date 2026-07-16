import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:umbrella_core/umbrella_core.dart';

import '../../data/registration_repository.dart';
import '../../state/session_provider.dart';
import '../profile/my_profile_screen.dart';
import '../registration/registration_wizard_screen.dart';

/// Mirrors Layout.jsx's mobile drawer for the Agent role: Registration +
/// My Profile + Logout — the entire Administration section (Users,
/// Policies, Branches, Areas, Agents, Plans, Funds, Expense) is hidden for
/// this role on web and is simply never built in this agent-only app.
/// Dashboard is a bottom-nav tab, not a drawer item.
class AppDrawer extends StatelessWidget {
  final VoidCallback onLoggedOut;
  const AppDrawer({super.key, required this.onLoggedOut});

  @override
  Widget build(BuildContext context) {
    final user = context.watch<SessionProvider>().currentUser;

    return Drawer(
      backgroundColor: Colors.white,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.all(20),
              child: Row(
                children: [
                  const CircleAvatar(
                    radius: 22,
                    backgroundColor: Color(0x1A0A3598),
                    child: Icon(Icons.person, color: AppColors.primary),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user?.name ?? '',
                          style: const TextStyle(
                              fontSize: 14, fontWeight: FontWeight.w800),
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          user?.role ?? '',
                          style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: AppColors.secondaryText),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.person_add_outlined),
              title: const Text('Registration'),
              onTap: () async {
                Navigator.pop(context);
                final result = await Navigator.of(context).push<RegistrationResult>(
                  MaterialPageRoute(builder: (_) => const RegistrationWizardScreen()),
                );
                if (result != null && context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                          '${result.accountType} account ${result.accountNo} created — awaiting approval.'),
                    ),
                  );
                }
              },
            ),
            ListTile(
              leading: const Icon(Icons.badge_outlined),
              title: const Text('My Profile'),
              onTap: () {
                Navigator.pop(context);
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const MyProfileScreen()),
                );
              },
            ),
            const Spacer(),
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.logout, color: AppColors.danger),
              title: const Text('Logout',
                  style: TextStyle(
                      color: AppColors.danger, fontWeight: FontWeight.w700)),
              onTap: () async {
                Navigator.pop(context);
                await context.read<SessionProvider>().logout();
                onLoggedOut();
              },
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }
}

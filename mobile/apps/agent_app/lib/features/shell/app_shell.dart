import 'package:flutter/material.dart';
import 'package:umbrella_core/umbrella_core.dart';

import '../accounts/accounts_list_screen.dart';
import '../auth/login_screen.dart';
import '../dashboard/dashboard_screen.dart';
import '../daily_collection/daily_collection_screen.dart';
import '../notifications/notifications_screen.dart';
import 'app_drawer.dart';

/// Port of Layout.jsx's mobile bottom nav: Dashboard / Accounts / center FAB
/// (Collect) / Alerts / Menu. Today's Collection (index 0) is embedded
/// directly rather than pushed via Navigator, so the bar stays visible —
/// but it isn't a row tab itself (that caused a duplicate "Collect" label
/// alongside the FAB); the FAB is the single entry point for it and is
/// also the agent's default landing screen.
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _tab = 0; // 0=Collect (default, FAB-only), 1=Dashboard, 2=Accounts, 3=Alerts

  final _screens = const [
    DailyCollectionScreen(),
    DashboardScreen(),
    AccountsListScreen(),
    NotificationsScreen(),
  ];

  void _openDrawer() => _scaffoldKey.currentState?.openEndDrawer();

  final _scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: AppColors.background,
      endDrawer: AppDrawer(onLoggedOut: () {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const LoginScreen()),
          (route) => false,
        );
      }),
      body: SafeArea(child: _screens[_tab]),
      bottomNavigationBar: _BottomNav(
        current: _tab,
        onTap: (i) => setState(() => _tab = i),
        onCollectTap: () => setState(() => _tab = 0),
        onMenuTap: _openDrawer,
      ),
    );
  }
}

class _BottomNav extends StatelessWidget {
  final int current;
  final ValueChanged<int> onTap;
  final VoidCallback onCollectTap;
  final VoidCallback onMenuTap;

  const _BottomNav({
    required this.current,
    required this.onTap,
    required this.onCollectTap,
    required this.onMenuTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.border)),
        boxShadow: [
          BoxShadow(
            color: Color(0x0D000000),
            blurRadius: 16,
            offset: Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        // Stack + Positioned so the raised FAB pokes above the bar without
        // being constrained by the Row's fixed height (Transform.translate
        // inside the Row previously caused a bottom-overflow, since the
        // Column it shifted still reserved its full untransformed height).
        child: SizedBox(
          height: 64,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _NavTab(
                    icon: Icons.dashboard_outlined,
                    activeIcon: Icons.dashboard,
                    label: 'Dashboard',
                    active: current == 1,
                    onTap: () => onTap(1),
                  ),
                  _NavTab(
                    icon: Icons.badge_outlined,
                    activeIcon: Icons.badge,
                    label: 'Accounts',
                    active: current == 2,
                    onTap: () => onTap(2),
                  ),
                  const SizedBox(width: 64),
                  _NavTab(
                    icon: Icons.notifications_outlined,
                    activeIcon: Icons.notifications,
                    label: 'Alerts',
                    active: current == 3,
                    onTap: () => onTap(3),
                  ),
                  _NavTab(
                    icon: Icons.menu,
                    activeIcon: Icons.menu,
                    label: 'Menu',
                    active: false,
                    onTap: onMenuTap,
                  ),
                ],
              ),
              Positioned(
                left: 0,
                right: 0,
                top: -20,
                child: Center(child: _CenterFab(onTap: onCollectTap)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavTab extends StatelessWidget {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final bool active;
  final VoidCallback onTap;

  const _NavTab({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = active ? AppColors.primary : AppColors.secondaryText;
    return InkWell(
      onTap: onTap,
      child: SizedBox(
        width: 64,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(active ? activeIcon : icon, size: 22, color: color),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
            const SizedBox(height: 2),
            Container(
              width: 4,
              height: 4,
              decoration: BoxDecoration(
                color: active ? AppColors.primary : Colors.transparent,
                shape: BoxShape.circle,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Raised gradient FAB matching Layout.jsx's center "Collect" button exactly.
class _CenterFab extends StatelessWidget {
  final VoidCallback onTap;
  const _CenterFab({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        InkWell(
          onTap: onTap,
          customBorder: const CircleBorder(),
          child: Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: AppColors.fabGradient,
              border: Border.all(color: Colors.white, width: 3.5),
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.3),
                  blurRadius: 20,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: const Icon(Icons.payments, color: Colors.white, size: 24),
          ),
        ),
        const SizedBox(height: 2),
        const Text(
          'COLLECT',
          style: TextStyle(
            fontSize: 8.5,
            fontWeight: FontWeight.w900,
            letterSpacing: 0.5,
            color: AppColors.primary,
          ),
        ),
      ],
    );
  }
}

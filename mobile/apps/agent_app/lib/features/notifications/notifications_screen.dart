import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:umbrella_core/umbrella_core.dart';

import '../../data/notification_repository.dart';
import '../../models/notification_item.dart';

/// GET /sync/notifications — unread-only feed (matches the backend's
/// Notification::getUnread; there is no "history" endpoint, so read items
/// simply disappear from this list once marked read, same as the web bell).
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  late Future<List<NotificationItem>> _future;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    final repo = NotificationRepository(context.read<ApiClient>());
    _future = repo.unread();
  }

  Future<void> _refresh() async {
    setState(_load);
    await _future;
  }

  Future<void> _markRead(NotificationItem item) async {
    final repo = NotificationRepository(context.read<ApiClient>());
    try {
      await repo.markRead(item.id);
      await _refresh();
    } catch (_) {
      // best-effort — item stays in the list, user can retry
    }
  }

  Future<void> _markAllRead() async {
    final repo = NotificationRepository(context.read<ApiClient>());
    try {
      await repo.markAllRead();
      await _refresh();
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        AppBar(
          title: const Text('Notifications'),
          automaticallyImplyLeading: false,
          actions: [
            TextButton(
              onPressed: _markAllRead,
              child: const Text('Mark all read'),
            ),
          ],
        ),
        Expanded(
          child: RefreshIndicator(
            color: AppColors.primary,
            onRefresh: _refresh,
            child: AsyncBody<List<NotificationItem>>(
              future: _future,
              onRetry: _refresh,
              isEmpty: (data) => data.isEmpty,
              emptyMessage: 'No new notifications.',
              emptyIcon: Icons.notifications_none_outlined,
              builder: (context, items) => ListView.separated(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                itemCount: items.length,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (context, i) => _NotificationTile(
                  item: items[i],
                  onMarkRead: () => _markRead(items[i]),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _NotificationTile extends StatelessWidget {
  final NotificationItem item;
  final VoidCallback onMarkRead;
  const _NotificationTile({required this.item, required this.onMarkRead});

  Color get _color {
    switch (item.type) {
      case 'success':
        return AppColors.success;
      case 'warning':
        return const Color(0xFFEA580C);
      case 'danger':
        return AppColors.danger;
      default:
        return AppColors.primary;
    }
  }

  IconData get _icon {
    switch (item.type) {
      case 'success':
        return Icons.check_circle_outline;
      case 'warning':
        return Icons.warning_amber_outlined;
      case 'danger':
        return Icons.error_outline;
      default:
        return Icons.info_outline;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onMarkRead,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: _color.withValues(alpha: 0.1),
                child: Icon(_icon, size: 18, color: _color),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.title,
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                    if (item.message != null && item.message!.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(item.message!,
                          style: const TextStyle(fontSize: 12, color: AppColors.secondaryText)),
                    ],
                    if (item.createdAt != null) ...[
                      const SizedBox(height: 6),
                      Text(Formatters.dateTime(item.createdAt),
                          style: const TextStyle(fontSize: 10, color: AppColors.secondaryText)),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                width: 8,
                height: 8,
                margin: const EdgeInsets.only(top: 4),
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

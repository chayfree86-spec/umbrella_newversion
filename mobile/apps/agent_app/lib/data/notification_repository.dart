import 'package:umbrella_core/umbrella_core.dart';

import '../models/notification_item.dart';

/// GET /sync/notifications (unread only, newest 50 first) + mark-read.
class NotificationRepository {
  final ApiClient api;
  NotificationRepository(this.api);

  Future<List<NotificationItem>> unread() async {
    final data = await api.get('/sync/notifications');
    return (data as List? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(NotificationItem.fromJson)
        .toList();
  }

  Future<void> markRead(int id) => api.post('/sync/notifications/$id/read');

  Future<void> markAllRead() => api.post('/sync/notifications/read-all');
}

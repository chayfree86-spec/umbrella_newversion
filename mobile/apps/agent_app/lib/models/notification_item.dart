import 'package:umbrella_core/umbrella_core.dart';

class NotificationItem {
  final int id;
  final String title;
  final String? message;
  final String type; // info | success | warning | danger
  final bool isRead;
  final String? createdAt;

  const NotificationItem({
    required this.id,
    required this.title,
    this.message,
    required this.type,
    required this.isRead,
    this.createdAt,
  });

  factory NotificationItem.fromJson(Map<String, dynamic> j) => NotificationItem(
        id: Formatters.asNum(j['id']).toInt(),
        title: j['title'] as String? ?? '',
        message: j['message'] as String?,
        type: j['type'] as String? ?? 'info',
        isRead: j['is_read'] == true || j['is_read'] == 1,
        createdAt: j['created_at'] as String?,
      );
}

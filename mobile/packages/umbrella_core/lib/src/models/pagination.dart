/// Backend pagination envelope: {total, page, per_page, total_pages, has_more}
class Pagination {
  final int total;
  final int page;
  final int perPage;
  final int totalPages;
  final bool hasMore;

  const Pagination({
    required this.total,
    required this.page,
    required this.perPage,
    required this.totalPages,
    required this.hasMore,
  });

  factory Pagination.fromJson(Map<String, dynamic> json) => Pagination(
        total: _toInt(json['total']),
        page: _toInt(json['page']),
        perPage: _toInt(json['per_page']),
        totalPages: _toInt(json['total_pages']),
        hasMore: json['has_more'] == true,
      );

  static int _toInt(dynamic v) =>
      v is int ? v : int.tryParse(v?.toString() ?? '') ?? 0;
}

/// A page of items + its pagination info, as returned by
/// ApiClient.request for paginated endpoints.
class PagedResult<T> {
  final List<T> items;
  final Pagination pagination;

  const PagedResult({required this.items, required this.pagination});

  factory PagedResult.fromEnvelope(
    Map<String, dynamic> envelope,
    T Function(Map<String, dynamic>) fromJson,
  ) =>
      PagedResult(
        items: (envelope['items'] as List)
            .whereType<Map<String, dynamic>>()
            .map(fromJson)
            .toList(),
        pagination:
            Pagination.fromJson(envelope['pagination'] as Map<String, dynamic>),
      );
}

import 'package:intl/intl.dart';

/// Indian formatting — matches the web's toLocaleString('en-IN') everywhere.
abstract final class Formatters {
  static final _inr = NumberFormat.currency(
    locale: 'en_IN',
    symbol: '₹',
    decimalDigits: 0,
  );

  static final _inrPaise = NumberFormat.currency(
    locale: 'en_IN',
    symbol: '₹',
    decimalDigits: 2,
  );

  /// ₹1,00,000 (Indian digit grouping, no paise)
  static String inr(dynamic value) => _inr.format(asNum(value));

  /// ₹1,00,000.50 (with paise)
  static String inrExact(dynamic value) => _inrPaise.format(asNum(value));

  /// The PHP/PDO backend sends DECIMAL columns as JSON strings in some
  /// endpoints (raw passthrough columns) but as real numbers in others
  /// (explicitly (float)-cast in the controller) — never trust the JSON
  /// type. Use this everywhere a numeric API field is read.
  static num asNum(dynamic value) {
    if (value == null) return 0;
    if (value is num) return value;
    return num.tryParse(value.toString()) ?? 0;
  }

  static final _date = DateFormat('dd-MM-yyyy');
  static final _dateTime = DateFormat('dd-MM-yyyy hh:mm a');

  /// dd-MM-yyyy from a DateTime or an ISO/`Y-m-d` string. Empty on null.
  static String date(dynamic value) {
    final dt = _parse(value);
    return dt == null ? '' : _date.format(dt);
  }

  static String dateTime(dynamic value) {
    final dt = _parse(value);
    return dt == null ? '' : _dateTime.format(dt);
  }

  static DateTime? _parse(dynamic value) {
    if (value == null) return null;
    if (value is DateTime) return value;
    return DateTime.tryParse(value.toString());
  }
}

import 'package:flutter/material.dart';

/// DB enum: loan_collections/saving_deposits/receipts.payment_mode.
const kPaymentModes = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Online'];

/// 1:1 port of the web app's Tailwind @theme tokens (src/index.css).
abstract final class AppColors {
  static const primary = Color(0xFF0A3598);
  static const accent = Color(0xFFFFC107);
  static const background = Color(0xFFF8FAFC);
  static const surface = Color(0xFFFFFFFF);
  static const primaryText = Color(0xFF0F172A);
  static const secondaryText = Color(0xFF64748B);
  static const border = Color(0xFFE2E8F0);
  static const success = Color(0xFF16A34A);
  static const warning = Color(0xFFEA580C);
  static const danger = Color(0xFFE11D48);

  /// Center-FAB gradient from the web mobile bottom nav (Layout.jsx).
  static const fabGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFF0A3598),
      Color(0xFF3B82F6),
      Color(0xFF1E3A8A),
      Color(0xFF0A3598),
    ],
    stops: [0.0, 0.4, 0.7, 1.0],
  );

  /// Status chip colors matching the web's bg-{color}/10 text-{color} pills.
  static Color statusColor(String status) {
    switch (status) {
      case 'Active':
      case 'Approved':
      case 'Paid':
        return success;
      case 'Processing':
      case 'Pending':
        return Color(0xFF2563EB);
      case 'Defaulter':
      case 'NPA':
        return warning;
      case 'Rejected':
      case 'Overdue':
        return danger;
      case 'Closed':
      case 'Matured':
      default:
        return secondaryText;
    }
  }
}

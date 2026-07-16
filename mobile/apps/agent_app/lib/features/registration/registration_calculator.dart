import 'dart:math';

/// Dart port of CustomerRegistration.jsx's EMI/maturity math, used only for
/// the live preview shown to the agent before submit — the backend
/// (CustomerController::register) is authoritative and recomputes
/// everything server-side from the same plan fields.
abstract final class RegistrationCalculator {
  static int daysInYear(DateTime? date) {
    final year = (date ?? DateTime.now()).year;
    return (year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)) ? 366 : 365;
  }

  static double durationDays(num durationVal, String durationUnit) {
    if (durationUnit == 'Months') return durationVal * 30;
    if (durationUnit == 'Years') return durationVal * 360;
    return durationVal.toDouble();
  }

  static double durationMonths(num durationVal, String durationUnit) =>
      durationDays(durationVal, durationUnit) / 30;

  /// Rounded EMI per installment. loanPeriod is 'monthly' or 'yearly'
  /// (matches the web's Settings > interest_calculation_period_loan,
  /// defaulted to 'monthly' — agent role has no settings.view permission
  /// so this app never fetches that setting and always uses the default).
  static int calculateEmi({
    required num principal,
    required num rate,
    required num duration,
    required String durationUnit,
    required String frequency,
    required String interestType,
    DateTime? startDate,
    String loanPeriod = 'monthly',
  }) {
    if (principal <= 0 || rate <= 0 || duration <= 0) return 0;

    final totalDays = durationDays(duration, durationUnit);
    final totalMonths = durationMonths(duration, durationUnit);

    num n = 0;
    if (frequency == 'Daily') {
      n = totalDays.round();
    } else if (frequency == 'Weekly') {
      n = (totalDays / 7).round();
    } else if (frequency == 'Monthly') {
      n = totalMonths.round();
    }
    if (n <= 0) n = 1;

    if (interestType == 'Flat') {
      final timeFactor = loanPeriod == 'yearly' ? totalMonths / 12 : totalMonths;
      final interest = principal * (rate / 100) * timeFactor;
      final totalPayable = principal + interest;
      return (totalPayable / n).round();
    }

    double r = 0;
    final daysYr = daysInYear(startDate);
    if (frequency == 'Daily') {
      r = loanPeriod == 'yearly' ? ((rate / 100) / daysYr) : (((rate / 100) * 12) / daysYr);
    } else if (frequency == 'Weekly') {
      r = loanPeriod == 'yearly' ? ((rate / 100) / 52) : (((rate / 100) * 12) / 52);
    } else if (frequency == 'Monthly') {
      r = loanPeriod == 'yearly' ? ((rate / 100) / 12) : (rate / 100);
    }
    if (r == 0) return (principal / n).round();

    final onePlusRToN = pow(1 + r, n).toDouble();
    final emi = (principal * r * onePlusRToN) / (onePlusRToN - 1);
    if (emi.isNaN || !emi.isFinite) return (principal / n).round();
    return emi.round();
  }

  static int calculateMaturity({
    required num depositAmt,
    required num rate,
    required num duration,
    required String durationUnit,
    required String frequency,
    DateTime? startDate,
  }) {
    if (depositAmt <= 0 || duration <= 0) return 0;

    final totalDays = durationDays(duration, durationUnit);
    final totalMonths = durationMonths(duration, durationUnit);

    int instPerYear = 0;
    if (frequency == 'Daily') {
      instPerYear = daysInYear(startDate);
    } else if (frequency == 'Weekly') {
      instPerYear = 52;
    } else if (frequency == 'Monthly') {
      instPerYear = 12;
    }

    int totalInstallments = 0;
    if (frequency == 'Daily') {
      totalInstallments = totalDays.round();
    } else if (frequency == 'Weekly') {
      totalInstallments = (totalDays / 7).round();
    } else if (frequency == 'Monthly') {
      totalInstallments = totalMonths.round();
    }
    if (totalInstallments <= 0) totalInstallments = 1;

    final fullYears = (totalMonths / 12).floor();
    final remainingMonths = totalMonths % 12;

    double balance = 0;
    int remainingInstallments = totalInstallments;

    for (var i = 0; i < fullYears; i++) {
      final installmentsThisYear = min(instPerYear, remainingInstallments);
      remainingInstallments -= installmentsThisYear;
      final principalAdded = depositAmt * installmentsThisYear;
      final interestOnNew = principalAdded * (rate / 100);
      final interestOnBalance = balance * (rate / 100);
      balance = balance + interestOnBalance + principalAdded + interestOnNew;
    }

    if (remainingMonths > 0 && remainingInstallments > 0) {
      final fracYear = remainingMonths / 12;
      final principalAdded = depositAmt * remainingInstallments;
      final interestOnNew = principalAdded * (rate / 100) * fracYear;
      final interestOnBalance = balance * (rate / 100) * fracYear;
      balance = balance + interestOnBalance + principalAdded + interestOnNew;
    }

    return balance.round();
  }

  /// Approximate end/maturity date for preview only — the backend computes
  /// the authoritative end_date/maturity_date itself on submit.
  static DateTime? endDate(DateTime? start, num duration, String durationUnit) {
    if (start == null) return null;
    if (durationUnit == 'Days') return start.add(Duration(days: duration.round()));
    if (durationUnit == 'Years') return start.add(Duration(days: (duration * 360).round()));
    return start.add(Duration(days: (duration * 30).round()));
  }
}

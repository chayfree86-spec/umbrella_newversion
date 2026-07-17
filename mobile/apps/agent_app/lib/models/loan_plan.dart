import 'package:umbrella_core/umbrella_core.dart';

class LoanPlan {
  final int id;
  final String name;
  final num minAmount;
  final num maxAmount;
  final num interestRate;
  final String interestType;
  final num durationValue;
  final String durationUnit;
  final String collectionFrequency;
  final num processingFee;

  const LoanPlan({
    required this.id,
    required this.name,
    required this.minAmount,
    required this.maxAmount,
    required this.interestRate,
    required this.interestType,
    required this.durationValue,
    required this.durationUnit,
    required this.collectionFrequency,
    required this.processingFee,
  });

  factory LoanPlan.fromJson(Map<String, dynamic> json) => LoanPlan(
        id: int.parse(json['id'].toString()),
        name: json['name'] as String? ?? '',
        minAmount: Formatters.asNum(json['min_amount']),
        maxAmount: Formatters.asNum(json['max_amount']),
        interestRate: Formatters.asNum(json['interest_rate']),
        interestType: json['interest_type'] as String? ?? 'Flat',
        durationValue: Formatters.asNum(json['duration_value']),
        durationUnit: json['duration_unit'] as String? ?? 'Days',
        collectionFrequency: json['collection_frequency'] as String? ?? 'Daily',
        processingFee: Formatters.asNum(json['processing_fee']),
      );
}

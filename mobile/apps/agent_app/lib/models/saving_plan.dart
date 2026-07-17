import 'package:umbrella_core/umbrella_core.dart';

class SavingPlan {
  final int id;
  final String name;
  final num depositAmount;
  final num interestRate;
  final num durationValue;
  final String durationUnit;
  final String collectionFrequency;
  final num maturityAmount;

  const SavingPlan({
    required this.id,
    required this.name,
    required this.depositAmount,
    required this.interestRate,
    required this.durationValue,
    required this.durationUnit,
    required this.collectionFrequency,
    required this.maturityAmount,
  });

  factory SavingPlan.fromJson(Map<String, dynamic> json) => SavingPlan(
        id: int.parse(json['id'].toString()),
        name: json['name'] as String? ?? '',
        depositAmount: Formatters.asNum(json['deposit_amount']),
        interestRate: Formatters.asNum(json['interest_rate']),
        durationValue: Formatters.asNum(json['duration_value']),
        durationUnit: json['duration_unit'] as String? ?? 'Days',
        collectionFrequency: json['collection_frequency'] as String? ?? 'Daily',
        maturityAmount: Formatters.asNum(json['maturity_amount']),
      );
}

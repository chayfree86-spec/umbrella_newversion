import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';
import 'package:umbrella_core/umbrella_core.dart';

import '../../data/plan_repository.dart';
import '../../data/registration_repository.dart';
import '../../models/loan_plan.dart';
import '../../models/saving_plan.dart';
import 'registration_calculator.dart';

String ymd(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// Owns all 6-step registration form state + plan lookups + submit. Agent's
/// own branch/area/agent are taken straight from [user] — unlike the web
/// app's picker (which supports every role), an agent can only ever
/// register customers under themselves, so there's nothing to pick.
class RegistrationController extends ChangeNotifier {
  final PlanRepository planRepo;
  final RegistrationRepository regRepo;
  final UserSession user;

  RegistrationController({
    required this.planRepo,
    required this.regRepo,
    required this.user,
  });

  void updateField(void Function() mutator) {
    mutator();
    notifyListeners();
  }

  int step = 1;
  static const totalSteps = 6;

  bool loadingPlans = true;
  String? loadError;
  List<LoanPlan> loanPlans = [];
  List<SavingPlan> savingPlans = [];

  Future<void> loadPlans() async {
    loadingPlans = true;
    loadError = null;
    notifyListeners();
    try {
      final results = await Future.wait([planRepo.loanPlans(), planRepo.savingPlans()]);
      loanPlans = results[0] as List<LoanPlan>;
      savingPlans = results[1] as List<SavingPlan>;
    } on ApiException catch (e) {
      loadError = e.message;
    } catch (_) {
      loadError = 'Could not load plans. Please try again.';
    } finally {
      loadingPlans = false;
      notifyListeners();
    }
  }

  // ---- Step 1: Account Setup ----
  String accountType = 'Loan';
  String planId = '';
  DateTime startDate = DateTime.now();
  String customAmount = '';
  String customRate = '';
  String customDuration = '';
  String customDurationUnit = 'Days';
  String customFrequency = 'Daily';
  String customType = 'Flat';
  String customDailyDeposit = '';

  bool get isCustomPlan => planId == 'custom';

  LoanPlan? get selectedLoanPlan =>
      isCustomPlan ? null : loanPlans.where((p) => p.id.toString() == planId).firstOrNull;

  SavingPlan? get selectedSavingPlan =>
      isCustomPlan ? null : savingPlans.where((p) => p.id.toString() == planId).firstOrNull;

  num get previewAmount => accountType == 'Loan'
      ? (isCustomPlan ? (num.tryParse(customAmount) ?? 0) : (selectedLoanPlan?.minAmount ?? 0))
      : (isCustomPlan ? (num.tryParse(customDailyDeposit) ?? 0) : (selectedSavingPlan?.depositAmount ?? 0));

  num get previewRate => isCustomPlan
      ? (num.tryParse(customRate) ?? 0)
      : (accountType == 'Loan' ? (selectedLoanPlan?.interestRate ?? 0) : (selectedSavingPlan?.interestRate ?? 0));

  num get previewDuration => isCustomPlan
      ? (num.tryParse(customDuration) ?? 0)
      : (accountType == 'Loan' ? (selectedLoanPlan?.durationValue ?? 0) : (selectedSavingPlan?.durationValue ?? 0));

  String get previewDurationUnit => isCustomPlan
      ? customDurationUnit
      : (accountType == 'Loan' ? (selectedLoanPlan?.durationUnit ?? 'Days') : (selectedSavingPlan?.durationUnit ?? 'Days'));

  String get previewFrequency => isCustomPlan
      ? customFrequency
      : (accountType == 'Loan' ? (selectedLoanPlan?.collectionFrequency ?? 'Daily') : (selectedSavingPlan?.collectionFrequency ?? 'Daily'));

  String get previewInterestType => isCustomPlan ? customType : (selectedLoanPlan?.interestType ?? 'Flat');

  int get previewEmi => accountType == 'Loan'
      ? RegistrationCalculator.calculateEmi(
          principal: previewAmount,
          rate: previewRate,
          duration: previewDuration,
          durationUnit: previewDurationUnit,
          frequency: previewFrequency,
          interestType: previewInterestType,
          startDate: startDate,
        )
      : 0;

  int get previewMaturity => accountType == 'Saving'
      ? (isCustomPlan
          ? RegistrationCalculator.calculateMaturity(
              depositAmt: previewAmount,
              rate: previewRate,
              duration: previewDuration,
              durationUnit: previewDurationUnit,
              frequency: previewFrequency,
              startDate: startDate,
            )
          : (selectedSavingPlan?.maturityAmount ?? 0).round())
      : 0;

  DateTime? get previewEndDate =>
      RegistrationCalculator.endDate(startDate, previewDuration, previewDurationUnit);

  bool get isStep1Valid {
    if (planId.isEmpty) return false;
    if (accountType == 'Saving') {
      if (isCustomPlan) {
        return customDailyDeposit.isNotEmpty && customRate.isNotEmpty && customDuration.isNotEmpty;
      }
      return selectedSavingPlan != null;
    }
    if (isCustomPlan) {
      return customAmount.isNotEmpty && customRate.isNotEmpty && customDuration.isNotEmpty;
    }
    return selectedLoanPlan != null;
  }

  // ---- Step 2: Customer Details ----
  String fullName = '';
  String mobile = '';
  String altMobile = '';
  DateTime? dob;
  String gender = 'Male';
  String fatherHusbandName = '';
  String occupation = '';

  bool checkingMobile = false;
  bool? mobileRegistered;
  String? mobileRegisteredWith;

  Future<void> checkMobile() async {
    final m = mobile.trim();
    if (m.length < 10) {
      mobileRegistered = null;
      mobileRegisteredWith = null;
      notifyListeners();
      return;
    }
    checkingMobile = true;
    notifyListeners();
    try {
      final result = await regRepo.checkMobile(m);
      mobileRegistered = result.registered;
      mobileRegisteredWith = result.registered
          ? '${result.customerName ?? ''} (${result.customerCode ?? ''})'
          : null;
    } catch (_) {
      mobileRegistered = null;
      mobileRegisteredWith = null;
    } finally {
      checkingMobile = false;
      notifyListeners();
    }
  }

  bool get isStep2Valid =>
      fullName.trim().isNotEmpty &&
      mobile.trim().length >= 10 &&
      mobileRegistered != true &&
      dob != null &&
      gender.isNotEmpty;

  // ---- Step 3: Address ----
  String houseNumber = '';
  String street = '';
  String villageCity = '';
  String landmark = '';
  String district = '';
  String state = 'Uttar Pradesh';
  String pinCode = '';

  bool get isStep3Valid =>
      houseNumber.trim().isNotEmpty &&
      street.trim().isNotEmpty &&
      villageCity.trim().isNotEmpty &&
      district.trim().isNotEmpty &&
      state.trim().isNotEmpty &&
      pinCode.trim().length == 6;

  // ---- Step 4: KYC (always mandatory — agent role) ----
  String aadhaarNumber = '';
  String panNumber = '';
  String bankName = '';
  String bankAccountNo = '';
  String bankIfsc = '';
  XFile? aadhaarFront;
  XFile? aadhaarBack;
  XFile? panUpload;
  XFile? chequeUpload;
  XFile? photo;
  XFile? signature;

  bool get isStep4Valid =>
      aadhaarNumber.trim().length == 12 &&
      panNumber.trim().isNotEmpty &&
      bankName.trim().isNotEmpty &&
      bankAccountNo.trim().isNotEmpty &&
      bankIfsc.trim().isNotEmpty;

  // ---- Step 5: Guarantor / Nominee (always mandatory — agent role) ----
  String guarantorName = '';
  String guarantorMobile = '';
  String guarantorRelation = 'Father';
  String guarantorAddress = '';
  String guarantorAadhaar = '';
  XFile? guarantorPhoto;
  XFile? guarantorAadhaarFront;
  XFile? guarantorAadhaarBack;

  bool get isStep5Valid =>
      guarantorName.trim().isNotEmpty &&
      guarantorMobile.trim().length >= 10 &&
      guarantorRelation.trim().isNotEmpty &&
      guarantorAadhaar.trim().length == 12;

  String get guarantorLabel => accountType == 'Saving' ? 'Nominee' : 'Guarantor';

  bool isStepValid(int s) {
    switch (s) {
      case 1:
        return isStep1Valid;
      case 2:
        return isStep2Valid;
      case 3:
        return isStep3Valid;
      case 4:
        return isStep4Valid;
      case 5:
        return isStep5Valid;
      default:
        return true;
    }
  }

  void next() {
    if (step < totalSteps && isStepValid(step)) {
      step++;
      notifyListeners();
    }
  }

  void back() {
    if (step > 1) {
      step--;
      notifyListeners();
    }
  }

  bool submitting = false;
  String? submitError;
  String? docsWarning;

  Future<RegistrationResult?> submit() async {
    submitting = true;
    submitError = null;
    docsWarning = null;
    notifyListeners();
    try {
      final payload = <String, dynamic>{
        'full_name': fullName.trim(),
        'mobile': mobile.trim(),
        'alternate_mobile': altMobile.trim(),
        'dob': dob != null ? ymd(dob!) : null,
        'gender': gender,
        'father_or_husband_name': fatherHusbandName.trim(),
        'occupation': occupation.trim(),
        'branch_id': user.branchId,
        'area_id': user.areaId,
        'agent_id': user.agentId,
        'address': [houseNumber, street, villageCity, landmark, district]
            .where((s) => s.trim().isNotEmpty)
            .join(', '),
        'city': villageCity.trim(),
        'state': state.trim(),
        'pincode': pinCode.trim(),
        'aadhaar_no': aadhaarNumber.trim(),
        'pan_no': panNumber.trim(),
        'bank_name': bankName.trim(),
        'bank_account_no': bankAccountNo.trim(),
        'bank_ifsc': bankIfsc.trim(),
        'guarantor_name': guarantorName.trim(),
        'guarantor_mobile': guarantorMobile.trim(),
        'guarantor_relation': guarantorRelation.trim(),
        'guarantor_aadhaar': guarantorAadhaar.trim(),
        'guarantor_address': guarantorAddress.trim(),
        'plan_type': accountType,
        'plan_id': isCustomPlan ? null : int.tryParse(planId),
        'start_date': ymd(startDate),
      };

      if (isCustomPlan) {
        if (accountType == 'Loan') {
          payload.addAll({
            'principal_amount': num.tryParse(customAmount) ?? 0,
            'interest_rate': num.tryParse(customRate) ?? 0,
            'interest_type': customType,
            'duration_value': int.tryParse(customDuration) ?? 0,
            'duration_unit': customDurationUnit,
            'collection_frequency': customFrequency,
            'emi_amount': previewEmi,
          });
        } else {
          payload.addAll({
            'interest_rate': num.tryParse(customRate) ?? 0,
            'duration_value': int.tryParse(customDuration) ?? 0,
            'duration_unit': customDurationUnit,
            'collection_frequency': customFrequency,
            'deposit_amount': num.tryParse(customDailyDeposit) ?? 0,
            'maturity_amount': previewMaturity,
          });
        }
      }

      final result = await regRepo.register(payload);

      try {
        await regRepo.uploadDocuments(result.customerId, {
          'aadhaar_front': aadhaarFront,
          'aadhaar_back': aadhaarBack,
          'pan': panUpload,
          'cheque': chequeUpload,
          'photo': photo,
          'signature': signature,
          'guarantor_photo': guarantorPhoto,
          'guarantor_aadhaar_front': guarantorAadhaarFront,
          'guarantor_aadhaar_back': guarantorAadhaarBack,
        });
      } on ApiException catch (e) {
        docsWarning = 'Customer registered, but document upload failed: ${e.message}';
      } catch (_) {
        docsWarning = 'Customer registered, but document upload failed. Please retry from the office.';
      }

      return result;
    } on ApiException catch (e) {
      submitError = e.message;
      return null;
    } catch (_) {
      submitError = 'Registration failed. Please check your connection and try again.';
      return null;
    } finally {
      submitting = false;
      notifyListeners();
    }
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}

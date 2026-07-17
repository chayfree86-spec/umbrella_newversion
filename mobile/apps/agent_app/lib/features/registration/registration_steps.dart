import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:umbrella_core/umbrella_core.dart';

import 'registration_controller.dart';

const _durationUnits = ['Days', 'Months', 'Years'];
const _frequencies = ['Daily', 'Weekly', 'Monthly'];
const _interestTypes = ['Flat', 'Reducing'];
const _genders = ['Male', 'Female', 'Other'];
const _relations = ['Father', 'Mother', 'Spouse', 'Sibling', 'Son', 'Daughter', 'Relative', 'Friend', 'Other'];

class StepScaffold extends StatelessWidget {
  final String title;
  final List<Widget> children;
  const StepScaffold({super.key, required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(title,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
        const SizedBox(height: 16),
        ...children,
      ],
    );
  }
}

class Step1AccountSetup extends StatefulWidget {
  const Step1AccountSetup({super.key});

  @override
  State<Step1AccountSetup> createState() => _Step1AccountSetupState();
}

class _Step1AccountSetupState extends State<Step1AccountSetup> {
  late final TextEditingController _amount;
  late final TextEditingController _rate;
  late final TextEditingController _duration;
  late final TextEditingController _deposit;

  @override
  void initState() {
    super.initState();
    final rc = context.read<RegistrationController>();
    _amount = TextEditingController(text: rc.customAmount);
    _rate = TextEditingController(text: rc.customRate);
    _duration = TextEditingController(text: rc.customDuration);
    _deposit = TextEditingController(text: rc.customDailyDeposit);
  }

  @override
  void dispose() {
    _amount.dispose();
    _rate.dispose();
    _duration.dispose();
    _deposit.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final rc = context.watch<RegistrationController>();

    if (rc.loadingPlans) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }
    if (rc.loadError != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 36, color: AppColors.danger),
            const SizedBox(height: 12),
            Text(rc.loadError!, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            OutlinedButton(onPressed: rc.loadPlans, child: const Text('Retry')),
          ],
        ),
      );
    }

    return StepScaffold(
      title: 'Account Setup',
      children: [
        Row(
          children: [
            Expanded(
              child: _TypeToggle(
                label: 'Loan',
                selected: rc.accountType == 'Loan',
                onTap: () => rc.updateField(() {
                  rc.accountType = 'Loan';
                  rc.planId = '';
                }),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _TypeToggle(
                label: 'Saving',
                selected: rc.accountType == 'Saving',
                onTap: () => rc.updateField(() {
                  rc.accountType = 'Saving';
                  rc.planId = '';
                }),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        DropdownButtonFormField<String>(
          initialValue: rc.planId.isEmpty ? null : rc.planId,
          decoration: const InputDecoration(labelText: 'Plan'),
          hint: const Text('Select a plan'),
          items: [
            if (rc.accountType == 'Loan')
              for (final p in rc.loanPlans)
                DropdownMenuItem(
                  value: p.id.toString(),
                  child: Text('${p.name} — ${p.interestRate}% (${p.durationValue} ${p.durationUnit})'),
                )
            else
              for (final p in rc.savingPlans)
                DropdownMenuItem(
                  value: p.id.toString(),
                  child: Text('${p.name} — ${p.interestRate}% (${p.durationValue} ${p.durationUnit})'),
                ),
            const DropdownMenuItem(value: 'custom', child: Text('Custom Plan')),
          ],
          onChanged: (v) => rc.updateField(() => rc.planId = v ?? ''),
        ),
        const SizedBox(height: 16),
        _DateField(
          label: 'Account Opening Date',
          value: rc.startDate,
          onPicked: (d) => rc.updateField(() => rc.startDate = d),
        ),
        if (rc.isCustomPlan) ...[
          const SizedBox(height: 16),
          if (rc.accountType == 'Loan') ...[
            TextField(
              controller: _amount,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}'))],
              decoration: const InputDecoration(labelText: 'Principal Amount', prefixText: '₹ '),
              onChanged: (v) => rc.updateField(() => rc.customAmount = v),
            ),
            const SizedBox(height: 14),
            _DropdownRow(
              value: rc.customType,
              label: 'Interest Type',
              items: _interestTypes,
              onChanged: (v) => rc.updateField(() => rc.customType = v),
            ),
          ] else ...[
            TextField(
              controller: _deposit,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}'))],
              decoration: const InputDecoration(labelText: 'Deposit Amount', prefixText: '₹ '),
              onChanged: (v) => rc.updateField(() => rc.customDailyDeposit = v),
            ),
          ],
          const SizedBox(height: 14),
          TextField(
            controller: _rate,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}'))],
            decoration: const InputDecoration(labelText: 'Interest Rate (%)'),
            onChanged: (v) => rc.updateField(() => rc.customRate = v),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _duration,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  decoration: const InputDecoration(labelText: 'Duration'),
                  onChanged: (v) => rc.updateField(() => rc.customDuration = v),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _DropdownRow(
                  value: rc.customDurationUnit,
                  label: 'Unit',
                  items: _durationUnits,
                  onChanged: (v) => rc.updateField(() => rc.customDurationUnit = v),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _DropdownRow(
            value: rc.customFrequency,
            label: 'Collection Frequency',
            items: _frequencies,
            onChanged: (v) => rc.updateField(() => rc.customFrequency = v),
          ),
        ],
        if (rc.previewAmount > 0 && rc.previewDuration > 0) ...[
          const SizedBox(height: 20),
          _PlanPreview(rc: rc),
        ],
      ],
    );
  }
}

class _PlanPreview extends StatelessWidget {
  final RegistrationController rc;
  const _PlanPreview({required this.rc});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('PREVIEW',
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.primary, letterSpacing: 0.5)),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _PreviewStat(
                  label: rc.accountType == 'Loan' ? 'Principal' : 'Deposit',
                  value: Formatters.inr(rc.previewAmount)),
              _PreviewStat(
                  label: rc.accountType == 'Loan' ? 'EMI / installment' : 'Maturity Amount',
                  value: Formatters.inr(rc.accountType == 'Loan' ? rc.previewEmi : rc.previewMaturity)),
            ],
          ),
          if (rc.previewEndDate != null) ...[
            const SizedBox(height: 8),
            Text('Ends around ${Formatters.date(rc.previewEndDate)}',
                style: const TextStyle(fontSize: 11, color: AppColors.secondaryText)),
          ],
        ],
      ),
    );
  }
}

class _PreviewStat extends StatelessWidget {
  final String label;
  final String value;
  const _PreviewStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label.toUpperCase(),
            style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: AppColors.secondaryText)),
        const SizedBox(height: 2),
        Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
      ],
    );
  }
}

class _TypeToggle extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _TypeToggle({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: selected ? AppColors.primary : AppColors.border),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 13,
            color: selected ? Colors.white : AppColors.primaryText,
          ),
        ),
      ),
    );
  }
}

class _DropdownRow extends StatelessWidget {
  final String value;
  final String label;
  final List<String> items;
  final ValueChanged<String> onChanged;
  const _DropdownRow(
      {required this.value, required this.label, required this.items, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String>(
      initialValue: value,
      decoration: InputDecoration(labelText: label),
      items: [for (final i in items) DropdownMenuItem(value: i, child: Text(i))],
      onChanged: (v) => onChanged(v ?? value),
    );
  }
}

class _DateField extends StatelessWidget {
  final String label;
  final DateTime? value;
  final ValueChanged<DateTime> onPicked;
  const _DateField({required this.label, required this.value, required this.onPicked});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: value ?? DateTime.now(),
          firstDate: DateTime(1950),
          lastDate: DateTime.now().add(const Duration(days: 3650)),
        );
        if (picked != null) onPicked(picked);
      },
      child: InputDecorator(
        decoration: InputDecoration(labelText: label, suffixIcon: const Icon(Icons.calendar_today_outlined, size: 18)),
        child: Text(value == null ? 'Select date' : Formatters.date(value)),
      ),
    );
  }
}

class Step2CustomerDetails extends StatefulWidget {
  const Step2CustomerDetails({super.key});

  @override
  State<Step2CustomerDetails> createState() => _Step2CustomerDetailsState();
}

class _Step2CustomerDetailsState extends State<Step2CustomerDetails> {
  late final TextEditingController _fullName;
  late final TextEditingController _mobile;
  late final TextEditingController _altMobile;
  late final TextEditingController _fatherHusband;
  late final TextEditingController _occupation;

  @override
  void initState() {
    super.initState();
    final rc = context.read<RegistrationController>();
    _fullName = TextEditingController(text: rc.fullName);
    _mobile = TextEditingController(text: rc.mobile);
    _altMobile = TextEditingController(text: rc.altMobile);
    _fatherHusband = TextEditingController(text: rc.fatherHusbandName);
    _occupation = TextEditingController(text: rc.occupation);
  }

  @override
  void dispose() {
    _fullName.dispose();
    _mobile.dispose();
    _altMobile.dispose();
    _fatherHusband.dispose();
    _occupation.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final rc = context.watch<RegistrationController>();

    return StepScaffold(
      title: 'Customer Details',
      children: [
        _ProfilePhotoPicker(
          file: rc.photo,
          onPicked: (f) => rc.updateField(() => rc.photo = f),
        ),
        const SizedBox(height: 20),
        TextField(
          controller: _fullName,
          textCapitalization: TextCapitalization.words,
          decoration: const InputDecoration(labelText: 'Full Name'),
          onChanged: (v) => rc.updateField(() => rc.fullName = v),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _mobile,
          keyboardType: TextInputType.phone,
          maxLength: 10,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          decoration: InputDecoration(
            labelText: 'Mobile Number',
            counterText: '',
            suffixIcon: rc.checkingMobile
                ? const Padding(
                    padding: EdgeInsets.all(12),
                    child: SizedBox(
                        width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                  )
                : null,
          ),
          onChanged: (v) => rc.updateField(() {
            rc.mobile = v;
            rc.mobileRegistered = null;
          }),
          onEditingComplete: () => rc.checkMobile(),
        ),
        if (rc.mobileRegistered == true) ...[
          const SizedBox(height: 6),
          Text('Already registered with ${rc.mobileRegisteredWith ?? ''}',
              style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: AppColors.danger)),
        ],
        const SizedBox(height: 14),
        TextField(
          controller: _altMobile,
          keyboardType: TextInputType.phone,
          maxLength: 10,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          decoration: const InputDecoration(labelText: 'Alternate Mobile (optional)', counterText: ''),
          onChanged: (v) => rc.updateField(() => rc.altMobile = v),
        ),
        const SizedBox(height: 14),
        _DateField(
          label: 'Date of Birth',
          value: rc.dob,
          onPicked: (d) => rc.updateField(() => rc.dob = d),
        ),
        const SizedBox(height: 14),
        _DropdownRow(
          value: rc.gender,
          label: 'Gender',
          items: _genders,
          onChanged: (v) => rc.updateField(() => rc.gender = v),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _fatherHusband,
          textCapitalization: TextCapitalization.words,
          decoration: const InputDecoration(labelText: "Father / Husband's Name (optional)"),
          onChanged: (v) => rc.updateField(() => rc.fatherHusbandName = v),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _occupation,
          decoration: const InputDecoration(labelText: 'Occupation (optional)'),
          onChanged: (v) => rc.updateField(() => rc.occupation = v),
        ),
      ],
    );
  }
}

class Step3Address extends StatefulWidget {
  const Step3Address({super.key});

  @override
  State<Step3Address> createState() => _Step3AddressState();
}

class _Step3AddressState extends State<Step3Address> {
  late final TextEditingController _house;
  late final TextEditingController _street;
  late final TextEditingController _village;
  late final TextEditingController _landmark;
  late final TextEditingController _district;
  late final TextEditingController _state;
  late final TextEditingController _pin;

  @override
  void initState() {
    super.initState();
    final rc = context.read<RegistrationController>();
    _house = TextEditingController(text: rc.houseNumber);
    _street = TextEditingController(text: rc.street);
    _village = TextEditingController(text: rc.villageCity);
    _landmark = TextEditingController(text: rc.landmark);
    _district = TextEditingController(text: rc.district);
    _state = TextEditingController(text: rc.state);
    _pin = TextEditingController(text: rc.pinCode);
  }

  @override
  void dispose() {
    _house.dispose();
    _street.dispose();
    _village.dispose();
    _landmark.dispose();
    _district.dispose();
    _state.dispose();
    _pin.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final rc = context.watch<RegistrationController>();
    return StepScaffold(
      title: 'Address Details',
      children: [
        TextField(
          controller: _house,
          decoration: const InputDecoration(labelText: 'House Number'),
          onChanged: (v) => rc.updateField(() => rc.houseNumber = v),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _street,
          decoration: const InputDecoration(labelText: 'Street / Road'),
          onChanged: (v) => rc.updateField(() => rc.street = v),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _village,
          decoration: const InputDecoration(labelText: 'Village / City'),
          onChanged: (v) => rc.updateField(() => rc.villageCity = v),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _landmark,
          decoration: const InputDecoration(labelText: 'Landmark (optional)'),
          onChanged: (v) => rc.updateField(() => rc.landmark = v),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _district,
          decoration: const InputDecoration(labelText: 'District'),
          onChanged: (v) => rc.updateField(() => rc.district = v),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _state,
          decoration: const InputDecoration(labelText: 'State'),
          onChanged: (v) => rc.updateField(() => rc.state = v),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _pin,
          keyboardType: TextInputType.number,
          maxLength: 6,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          decoration: const InputDecoration(labelText: 'PIN Code', counterText: ''),
          onChanged: (v) => rc.updateField(() => rc.pinCode = v),
        ),
      ],
    );
  }
}

class Step4Kyc extends StatefulWidget {
  const Step4Kyc({super.key});

  @override
  State<Step4Kyc> createState() => _Step4KycState();
}

class _Step4KycState extends State<Step4Kyc> {
  late final TextEditingController _aadhaar;
  late final TextEditingController _pan;
  late final TextEditingController _bankName;
  late final TextEditingController _bankAcc;
  late final TextEditingController _ifsc;

  @override
  void initState() {
    super.initState();
    final rc = context.read<RegistrationController>();
    _aadhaar = TextEditingController(text: rc.aadhaarNumber);
    _pan = TextEditingController(text: rc.panNumber);
    _bankName = TextEditingController(text: rc.bankName);
    _bankAcc = TextEditingController(text: rc.bankAccountNo);
    _ifsc = TextEditingController(text: rc.bankIfsc);
  }

  @override
  void dispose() {
    _aadhaar.dispose();
    _pan.dispose();
    _bankName.dispose();
    _bankAcc.dispose();
    _ifsc.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final rc = context.watch<RegistrationController>();
    return StepScaffold(
      title: 'KYC Details',
      children: [
        TextField(
          controller: _aadhaar,
          keyboardType: TextInputType.number,
          maxLength: 12,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          decoration: const InputDecoration(labelText: 'Aadhaar Number', counterText: ''),
          onChanged: (v) => rc.updateField(() => rc.aadhaarNumber = v),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _pan,
          textCapitalization: TextCapitalization.characters,
          maxLength: 10,
          decoration: const InputDecoration(labelText: 'PAN Number', counterText: ''),
          onChanged: (v) => rc.updateField(() => rc.panNumber = v),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _bankName,
          decoration: const InputDecoration(labelText: 'Bank Name'),
          onChanged: (v) => rc.updateField(() => rc.bankName = v),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _bankAcc,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Bank Account Number'),
          onChanged: (v) => rc.updateField(() => rc.bankAccountNo = v),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _ifsc,
          textCapitalization: TextCapitalization.characters,
          maxLength: 11,
          decoration: const InputDecoration(labelText: 'Bank IFSC Code', counterText: ''),
          onChanged: (v) => rc.updateField(() => rc.bankIfsc = v),
        ),
        const SizedBox(height: 20),
        const _SectionLabel('DOCUMENTS'),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: DocPicker(
                label: 'Aadhaar Front',
                file: rc.aadhaarFront,
                onPicked: (f) => rc.updateField(() => rc.aadhaarFront = f),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: DocPicker(
                label: 'Aadhaar Back',
                file: rc.aadhaarBack,
                onPicked: (f) => rc.updateField(() => rc.aadhaarBack = f),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: DocPicker(
                label: 'PAN Card',
                file: rc.panUpload,
                onPicked: (f) => rc.updateField(() => rc.panUpload = f),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: DocPicker(
                label: 'Cheque / Passbook',
                file: rc.chequeUpload,
                onPicked: (f) => rc.updateField(() => rc.chequeUpload = f),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        DocPicker(
          label: 'Signature',
          file: rc.signature,
          onPicked: (f) => rc.updateField(() => rc.signature = f),
        ),
      ],
    );
  }
}

class Step5Guarantor extends StatefulWidget {
  const Step5Guarantor({super.key});

  @override
  State<Step5Guarantor> createState() => _Step5GuarantorState();
}

class _Step5GuarantorState extends State<Step5Guarantor> {
  late final TextEditingController _name;
  late final TextEditingController _mobile;
  late final TextEditingController _address;
  late final TextEditingController _aadhaar;

  @override
  void initState() {
    super.initState();
    final rc = context.read<RegistrationController>();
    _name = TextEditingController(text: rc.guarantorName);
    _mobile = TextEditingController(text: rc.guarantorMobile);
    _address = TextEditingController(text: rc.guarantorAddress);
    _aadhaar = TextEditingController(text: rc.guarantorAadhaar);
  }

  @override
  void dispose() {
    _name.dispose();
    _mobile.dispose();
    _address.dispose();
    _aadhaar.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final rc = context.watch<RegistrationController>();
    final label = rc.guarantorLabel;
    return StepScaffold(
      title: '$label Details',
      children: [
        TextField(
          controller: _name,
          textCapitalization: TextCapitalization.words,
          decoration: InputDecoration(labelText: '$label Name'),
          onChanged: (v) => rc.updateField(() => rc.guarantorName = v),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _mobile,
          keyboardType: TextInputType.phone,
          maxLength: 10,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          decoration: InputDecoration(labelText: '$label Mobile', counterText: ''),
          onChanged: (v) => rc.updateField(() => rc.guarantorMobile = v),
        ),
        const SizedBox(height: 14),
        _DropdownRow(
          value: _relations.contains(rc.guarantorRelation) ? rc.guarantorRelation : _relations.first,
          label: '$label Relation',
          items: _relations,
          onChanged: (v) => rc.updateField(() => rc.guarantorRelation = v),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _aadhaar,
          keyboardType: TextInputType.number,
          maxLength: 12,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          decoration: InputDecoration(labelText: '$label Aadhaar', counterText: ''),
          onChanged: (v) => rc.updateField(() => rc.guarantorAadhaar = v),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _address,
          maxLines: 2,
          decoration: InputDecoration(labelText: '$label Address (optional)'),
          onChanged: (v) => rc.updateField(() => rc.guarantorAddress = v),
        ),
        const SizedBox(height: 20),
        const _SectionLabel('DOCUMENTS (OPTIONAL)'),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: DocPicker(
                label: '$label Photo',
                file: rc.guarantorPhoto,
                onPicked: (f) => rc.updateField(() => rc.guarantorPhoto = f),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: DocPicker(
                label: 'Aadhaar Front',
                file: rc.guarantorAadhaarFront,
                onPicked: (f) => rc.updateField(() => rc.guarantorAadhaarFront = f),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        DocPicker(
          label: 'Aadhaar Back',
          file: rc.guarantorAadhaarBack,
          onPicked: (f) => rc.updateField(() => rc.guarantorAadhaarBack = f),
        ),
      ],
    );
  }
}

class Step6Review extends StatelessWidget {
  const Step6Review({super.key});

  @override
  Widget build(BuildContext context) {
    final rc = context.watch<RegistrationController>();
    return StepScaffold(
      title: 'Review & Submit',
      children: [
        if (rc.submitError != null) ...[
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.danger.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(rc.submitError!,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.danger)),
          ),
          const SizedBox(height: 16),
        ],
        _ReviewCard(title: 'Account', rows: [
          _kv(rc.accountType, rc.isCustomPlan
              ? 'Custom Plan'
              : (rc.accountType == 'Loan' ? rc.selectedLoanPlan?.name : rc.selectedSavingPlan?.name) ?? ''),
          _kv(rc.accountType == 'Loan' ? 'Principal' : 'Deposit', Formatters.inr(rc.previewAmount)),
          _kv(rc.accountType == 'Loan' ? 'EMI' : 'Maturity', Formatters.inr(
              rc.accountType == 'Loan' ? rc.previewEmi : rc.previewMaturity)),
          _kv('Start Date', Formatters.date(rc.startDate)),
        ]),
        const SizedBox(height: 14),
        _ReviewCard(title: 'Customer', rows: [
          _kv('Name', rc.fullName),
          _kv('Mobile', rc.mobile),
          _kv('DOB', rc.dob != null ? Formatters.date(rc.dob) : '—'),
          _kv('Gender', rc.gender),
        ]),
        const SizedBox(height: 14),
        _ReviewCard(title: 'Address', rows: [
          _kv('Village/City', rc.villageCity),
          _kv('District', rc.district),
          _kv('State', rc.state),
          _kv('PIN', rc.pinCode),
        ]),
        const SizedBox(height: 14),
        _ReviewCard(title: 'KYC', rows: [
          _kv('Aadhaar', rc.aadhaarNumber),
          _kv('PAN', rc.panNumber),
          _kv('Bank', rc.bankName),
        ]),
        const SizedBox(height: 14),
        _ReviewCard(title: rc.guarantorLabel, rows: [
          _kv('Name', rc.guarantorName),
          _kv('Mobile', rc.guarantorMobile),
          _kv('Relation', rc.guarantorRelation),
        ]),
        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: rc.submitting
                ? null
                : () async {
                    final result = await rc.submit();
                    if (result != null && context.mounted) {
                      Navigator.of(context).pop(result);
                    }
                  },
            child: rc.submitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                  )
                : const Text('Submit Registration'),
          ),
        ),
      ],
    );
  }

  MapEntry<String, String> _kv(String k, String v) => MapEntry(k, v);
}

class _ReviewCard extends StatelessWidget {
  final String title;
  final List<MapEntry<String, String>> rows;
  const _ReviewCard({required this.title, required this.rows});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title.toUpperCase(),
                style: const TextStyle(
                    fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.primary, letterSpacing: 0.5)),
            const SizedBox(height: 10),
            for (final r in rows)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(r.key, style: const TextStyle(fontSize: 12, color: AppColors.secondaryText)),
                    Flexible(
                      child: Text(r.value.isEmpty ? '—' : r.value,
                          textAlign: TextAlign.right,
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(text,
        style: const TextStyle(
            fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.6, color: AppColors.secondaryText));
  }
}

/// Circular profile-photo picker shown at the top of Customer Details —
/// shares the same camera/gallery bottom sheet as [DocPicker] and writes
/// to the same `RegistrationController.photo` field consumed at submit.
class _ProfilePhotoPicker extends StatelessWidget {
  final XFile? file;
  final ValueChanged<XFile?> onPicked;
  const _ProfilePhotoPicker({required this.file, required this.onPicked});

  Future<void> _pick(BuildContext context) async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Camera'),
              onTap: () => Navigator.pop(ctx, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Gallery'),
              onTap: () => Navigator.pop(ctx, ImageSource.gallery),
            ),
          ],
        ),
      ),
    );
    if (source == null) return;
    final picked = await ImagePicker().pickImage(source: source, imageQuality: 70);
    if (picked != null) onPicked(picked);
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: GestureDetector(
        onTap: () => _pick(context),
        child: Stack(
          children: [
            CircleAvatar(
              radius: 46,
              backgroundColor: const Color(0xFFF8FAFC),
              backgroundImage: file != null ? FileImage(File(file!.path)) : null,
              child: file == null
                  ? const Icon(Icons.person_outline, size: 42, color: AppColors.secondaryText)
                  : null,
            ),
            Positioned(
              right: 0,
              bottom: 0,
              child: Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 2.5),
                ),
                child: const Icon(Icons.camera_alt, size: 15, color: Colors.white),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class DocPicker extends StatelessWidget {
  final String label;
  final XFile? file;
  final ValueChanged<XFile?> onPicked;
  const DocPicker({super.key, required this.label, required this.file, required this.onPicked});

  Future<void> _pick(BuildContext context) async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Camera'),
              onTap: () => Navigator.pop(ctx, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Gallery'),
              onTap: () => Navigator.pop(ctx, ImageSource.gallery),
            ),
          ],
        ),
      ),
    );
    if (source == null) return;
    final picked = await ImagePicker().pickImage(source: source, imageQuality: 70);
    if (picked != null) onPicked(picked);
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => _pick(context),
      child: Container(
        height: 90,
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: file == null
            ? Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.add_a_photo_outlined, size: 20, color: AppColors.secondaryText),
                  const SizedBox(height: 6),
                  Text(label,
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.secondaryText)),
                ],
              )
            : Stack(
                fit: StackFit.expand,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.file(File(file!.path), fit: BoxFit.cover),
                  ),
                  Positioned(
                    right: 4,
                    top: 4,
                    child: InkWell(
                      onTap: () => onPicked(null),
                      child: const CircleAvatar(
                        radius: 11,
                        backgroundColor: Colors.black54,
                        child: Icon(Icons.close, size: 14, color: Colors.white),
                      ),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

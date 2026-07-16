import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:umbrella_core/umbrella_core.dart';

import '../../data/customer_repository.dart';
import '../../models/customer_profile.dart';
import 'account_detail_screen.dart';

/// GET /customers/{id}/profile — read-only customer summary reachable from
/// the account detail screen. Server-side scoped to the agent's own
/// customers (CustomerController::show 403s cross-agent access).
class CustomerProfileScreen extends StatefulWidget {
  final int customerId;
  const CustomerProfileScreen({super.key, required this.customerId});

  @override
  State<CustomerProfileScreen> createState() => _CustomerProfileScreenState();
}

class _CustomerProfileScreenState extends State<CustomerProfileScreen> {
  late Future<CustomerProfile> _future;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    final repo = CustomerRepository(context.read<ApiClient>());
    _future = repo.getProfile(widget.customerId);
  }

  Future<void> _refresh() async {
    setState(_load);
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Customer Profile')),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: _refresh,
        child: AsyncBody<CustomerProfile>(
          future: _future,
          onRetry: _refresh,
          builder: (context, profile) => _ProfileBody(profile: profile),
        ),
      ),
    );
  }
}

class _ProfileBody extends StatelessWidget {
  final CustomerProfile profile;
  const _ProfileBody({required this.profile});

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(profile.fullName,
                              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
                          const SizedBox(height: 2),
                          Text(profile.customerCode,
                              style: const TextStyle(fontSize: 12, color: AppColors.secondaryText)),
                        ],
                      ),
                    ),
                    StatusChip(profile.status),
                  ],
                ),
                const Divider(height: 24),
                _KvRow('Mobile', profile.mobile),
                if (profile.alternateMobile != null && profile.alternateMobile!.isNotEmpty)
                  _KvRow('Alternate Mobile', profile.alternateMobile!),
                if (profile.dob != null) _KvRow('DOB', Formatters.date(profile.dob)),
                if (profile.gender != null) _KvRow('Gender', profile.gender!),
                if (profile.fatherHusbandName != null && profile.fatherHusbandName!.isNotEmpty)
                  _KvRow("Father/Husband", profile.fatherHusbandName!),
                if (profile.occupation != null && profile.occupation!.isNotEmpty)
                  _KvRow('Occupation', profile.occupation!),
                _KvRow('Branch', profile.branchName),
                _KvRow('Area', profile.areaName),
              ],
            ),
          ),
        ),
        if (profile.address != null) ...[
          const SizedBox(height: 16),
          const _SectionLabel('ADDRESS'),
          const SizedBox(height: 10),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                [
                  profile.address!.addressLine1,
                  profile.address!.city,
                  profile.address!.state,
                  profile.address!.pincode,
                ].where((s) => s != null && s.isNotEmpty).join(', '),
                style: const TextStyle(fontSize: 13),
              ),
            ),
          ),
        ],
        if (profile.kyc != null) ...[
          const SizedBox(height: 16),
          const _SectionLabel('KYC'),
          const SizedBox(height: 10),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Status',
                          style: TextStyle(fontSize: 12, color: AppColors.secondaryText)),
                      StatusChip(
                        profile.kyc!.verified ? 'Verified' : 'Pending',
                        color: profile.kyc!.verified ? AppColors.success : const Color(0xFFEA580C),
                      ),
                    ],
                  ),
                  if (profile.kyc!.aadhaarNo != null && profile.kyc!.aadhaarNo!.isNotEmpty)
                    _KvRow('Aadhaar', profile.kyc!.aadhaarNo!),
                  if (profile.kyc!.panNo != null && profile.kyc!.panNo!.isNotEmpty)
                    _KvRow('PAN', profile.kyc!.panNo!),
                  if (profile.kyc!.bankName != null && profile.kyc!.bankName!.isNotEmpty)
                    _KvRow('Bank', profile.kyc!.bankName!),
                ],
              ),
            ),
          ),
        ],
        if (profile.guarantors.isNotEmpty) ...[
          const SizedBox(height: 16),
          const _SectionLabel('GUARANTOR / NOMINEE'),
          const SizedBox(height: 10),
          Card(
            child: Column(
              children: [
                for (int i = 0; i < profile.guarantors.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  ListTile(
                    dense: true,
                    leading: const Icon(Icons.person_outline, size: 20),
                    title: Text(profile.guarantors[i].name,
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                    subtitle: Text(
                      [profile.guarantors[i].relation, profile.guarantors[i].mobile]
                          .where((s) => s != null && s.isNotEmpty)
                          .join(' · '),
                      style: const TextStyle(fontSize: 11.5),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
        if (profile.accounts.isNotEmpty) ...[
          const SizedBox(height: 16),
          const _SectionLabel('ACCOUNTS'),
          const SizedBox(height: 10),
          Card(
            child: Column(
              children: [
                for (int i = 0; i < profile.accounts.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  ListTile(
                    dense: true,
                    leading: Icon(
                      profile.accounts[i].isLoan ? Icons.credit_score : Icons.savings,
                      size: 20,
                      color: profile.accounts[i].isLoan ? AppColors.primary : AppColors.success,
                    ),
                    title: Text(profile.accounts[i].accountNo,
                        style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
                    trailing: StatusChip(profile.accounts[i].status),
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => AccountDetailScreen(
                        accountNo: profile.accounts[i].accountNo,
                        isLoan: profile.accounts[i].isLoan,
                      ),
                    )),
                  ),
                ],
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _KvRow extends StatelessWidget {
  final String label;
  final String value;
  const _KvRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: const TextStyle(fontSize: 12, color: AppColors.secondaryText)),
          Flexible(
            child: Text(value,
                textAlign: TextAlign.right,
                style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
          ),
        ],
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

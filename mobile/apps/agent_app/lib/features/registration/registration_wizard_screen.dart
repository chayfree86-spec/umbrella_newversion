import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:umbrella_core/umbrella_core.dart';

import '../../data/plan_repository.dart';
import '../../data/registration_repository.dart';
import '../../state/session_provider.dart';
import 'registration_controller.dart';
import 'registration_steps.dart';

class RegistrationWizardScreen extends StatelessWidget {
  const RegistrationWizardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final api = context.read<ApiClient>();
    final user = context.read<SessionProvider>().currentUser!;
    return ChangeNotifierProvider(
      create: (_) => RegistrationController(
        planRepo: PlanRepository(api),
        regRepo: RegistrationRepository(api),
        user: user,
      )..loadPlans(),
      child: const _WizardBody(),
    );
  }
}

class _WizardBody extends StatefulWidget {
  const _WizardBody();

  @override
  State<_WizardBody> createState() => _WizardBodyState();
}

class _WizardBodyState extends State<_WizardBody> {
  late final PageController _pageController;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  static const _titles = [
    'Account Setup',
    'Customer Details',
    'Address',
    'KYC Details',
    'Guarantor',
    'Review',
  ];

  @override
  Widget build(BuildContext context) {
    final rc = context.watch<RegistrationController>();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: Text('New Registration — ${_titles[rc.step - 1]}')),
      body: Column(
        children: [
          _StepIndicator(current: rc.step, total: RegistrationController.totalSteps),
          Expanded(
            child: PageView(
              controller: _pageController,
              physics: const NeverScrollableScrollPhysics(),
              children: const [
                Step1AccountSetup(),
                Step2CustomerDetails(),
                Step3Address(),
                Step4Kyc(),
                Step5Guarantor(),
                Step6Review(),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: rc.step == RegistrationController.totalSteps
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                child: Row(
                  children: [
                    if (rc.step > 1) ...[
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () {
                            rc.back();
                            _pageController.previousPage(
                                duration: const Duration(milliseconds: 200), curve: Curves.easeOut);
                          },
                          child: const Text('Back'),
                        ),
                      ),
                      const SizedBox(width: 12),
                    ],
                    Expanded(
                      flex: 2,
                      child: ElevatedButton(
                        onPressed: rc.isStepValid(rc.step)
                            ? () {
                                rc.next();
                                _pageController.nextPage(
                                    duration: const Duration(milliseconds: 200), curve: Curves.easeOut);
                              }
                            : null,
                        child: const Text('Next'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}

class _StepIndicator extends StatelessWidget {
  final int current;
  final int total;
  const _StepIndicator({required this.current, required this.total});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Row(
        children: [
          for (var i = 1; i <= total; i++) ...[
            Expanded(
              child: Container(
                height: 4,
                decoration: BoxDecoration(
                  color: i <= current ? AppColors.primary : AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            if (i != total) const SizedBox(width: 4),
          ],
        ],
      ),
    );
  }
}

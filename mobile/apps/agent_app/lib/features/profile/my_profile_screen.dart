import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:umbrella_core/umbrella_core.dart';

import '../../data/auth_repository.dart';
import '../../state/session_provider.dart';

/// Session-derived, read-only (matches web's agent-role settings page —
/// agents can't edit their own profile fields, only change their PIN).
class MyProfileScreen extends StatefulWidget {
  const MyProfileScreen({super.key});

  @override
  State<MyProfileScreen> createState() => _MyProfileScreenState();
}

class _MyProfileScreenState extends State<MyProfileScreen> {
  final _pinCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _submitting = false;
  String? _error;
  String? _success;

  @override
  void dispose() {
    _pinCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _changePin() async {
    setState(() {
      _error = null;
      _success = null;
    });

    final pin = _pinCtrl.text.trim();
    if (pin.length != 4) {
      setState(() => _error = 'PIN must be exactly 4 digits.');
      return;
    }
    if (pin != _confirmCtrl.text.trim()) {
      setState(() => _error = 'PIN and confirmation do not match.');
      return;
    }

    setState(() => _submitting = true);
    try {
      final repo = AuthRepository(context.read<ApiClient>());
      await repo.changePassword(pin: pin);
      if (!mounted) return;
      setState(() {
        _success = 'PIN updated successfully.';
        _pinCtrl.clear();
        _confirmCtrl.clear();
      });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Could not update PIN. Please check your connection.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<SessionProvider>().currentUser;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('My Profile')),
      body: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const CircleAvatar(
                            radius: 26,
                            backgroundColor: Color(0x1A0A3598),
                            child: Icon(Icons.person, color: AppColors.primary, size: 28),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(user?.name ?? '',
                                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
                                const SizedBox(height: 2),
                                Text(user?.role ?? '',
                                    style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.secondaryText)),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const Divider(height: 28),
                      _InfoRow(label: 'Mobile', value: user?.mobile ?? ''),
                      if (user?.email != null && user!.email!.isNotEmpty)
                        _InfoRow(label: 'Email', value: user.email!),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Text(
                  'Profile details are managed by your Branch Manager. To update '
                  'your name, mobile, or assignment, please contact your office.',
                  style: TextStyle(fontSize: 11.5, color: AppColors.secondaryText),
                ),
              ),
              const SizedBox(height: 24),
              const Text('CHANGE LOGIN PIN',
                  style: TextStyle(
                      fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.6, color: AppColors.secondaryText)),
              const SizedBox(height: 12),
              if (_error != null) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.danger.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(_error!,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.danger)),
                ),
                const SizedBox(height: 14),
              ],
              if (_success != null) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.success.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(_success!,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.success)),
                ),
                const SizedBox(height: 14),
              ],
              TextField(
                controller: _pinCtrl,
                enabled: !_submitting,
                obscureText: true,
                keyboardType: TextInputType.number,
                maxLength: 4,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: const InputDecoration(labelText: 'New 4-digit PIN', counterText: ''),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _confirmCtrl,
                enabled: !_submitting,
                obscureText: true,
                keyboardType: TextInputType.number,
                maxLength: 4,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: const InputDecoration(labelText: 'Confirm New PIN', counterText: ''),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: _submitting ? null : _changePin,
                child: _submitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                      )
                    : const Text('Update PIN'),
              ),
            ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label.toUpperCase(),
              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.secondaryText)),
          Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

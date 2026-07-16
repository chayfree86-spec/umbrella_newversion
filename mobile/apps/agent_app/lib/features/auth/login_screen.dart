import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:umbrella_core/umbrella_core.dart';

import '../../state/session_provider.dart';
import '../shell/app_shell.dart';
import 'server_url_sheet.dart';

/// Mirrors web src/pages/Login.jsx's mobile+PIN path: floating-label mobile
/// field + 4-box auto-advance PIN input with show/hide toggle. Agent app
/// only supports mobile+PIN login (no email/password path — not relevant
/// for this role per the plan).
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _mobileCtrl = TextEditingController();
  final List<TextEditingController> _pinCtrls =
      List.generate(4, (_) => TextEditingController());
  final List<FocusNode> _pinNodes = List.generate(4, (_) => FocusNode());
  final _mobileFocus = FocusNode();

  bool _obscure = true;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _mobileCtrl.dispose();
    _mobileFocus.dispose();
    for (final c in _pinCtrls) {
      c.dispose();
    }
    for (final n in _pinNodes) {
      n.dispose();
    }
    super.dispose();
  }

  String get _pin => _pinCtrls.map((c) => c.text).join();

  void _onPinChanged(int index, String value) {
    if (value.isNotEmpty && index < 3) {
      _pinNodes[index + 1].requestFocus();
    }
    setState(() {});
  }

  void _onPinBackspace(int index) {
    if (_pinCtrls[index].text.isEmpty && index > 0) {
      _pinNodes[index - 1].requestFocus();
    }
  }

  Future<void> _submit() async {
    setState(() => _error = null);

    final mobile = _mobileCtrl.text.trim();
    if (mobile.isEmpty) {
      setState(() => _error = 'Please enter your mobile number.');
      return;
    }
    if (_pin.length != 4) {
      setState(() => _error = 'PIN must be exactly a 4-digit number.');
      return;
    }

    setState(() => _loading = true);
    try {
      await context.read<SessionProvider>().login(mobile, _pin);
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const AppShell()),
      );
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Login failed. Please check your connection.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  GestureDetector(
                    onLongPress: () => showServerUrlSheet(context),
                    child: Image.asset('assets/images/logo.png',
                        width: 64, height: 64),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    session.companyName ?? 'Umbrella Finance',
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      color: AppColors.primaryText,
                    ),
                  ),
                  Text(
                    session.companyTagline ?? 'Chhote Kadam, Bade Sapne',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.secondaryText,
                    ),
                  ),
                  const SizedBox(height: 32),
                  if (_error != null) ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.danger.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                            color: AppColors.danger.withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline,
                              color: AppColors.danger, size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _error!,
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: AppColors.danger,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  TextField(
                    controller: _mobileCtrl,
                    focusNode: _mobileFocus,
                    keyboardType: TextInputType.phone,
                    enabled: !_loading,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(10),
                    ],
                    decoration: const InputDecoration(
                      labelText: 'Mobile Number',
                      prefixIcon: Icon(Icons.phone_android_outlined),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'ENTER 4-DIGIT SECURITY PIN',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.8,
                      color: AppColors.secondaryText,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      for (int i = 0; i < 4; i++) ...[
                        SizedBox(
                          width: 48,
                          height: 48,
                          child: Focus(
                            onKeyEvent: (node, event) {
                              if (event is KeyDownEvent &&
                                  event.logicalKey ==
                                      LogicalKeyboardKey.backspace) {
                                _onPinBackspace(i);
                              }
                              return KeyEventResult.ignored;
                            },
                            child: TextField(
                              controller: _pinCtrls[i],
                              focusNode: _pinNodes[i],
                              enabled: !_loading,
                              obscureText: _obscure,
                              textAlign: TextAlign.center,
                              keyboardType: TextInputType.number,
                              maxLength: 1,
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                                color: AppColors.primary,
                              ),
                              inputFormatters: [
                                FilteringTextInputFormatter.digitsOnly,
                              ],
                              decoration: const InputDecoration(
                                counterText: '',
                                contentPadding: EdgeInsets.zero,
                              ),
                              onChanged: (v) => _onPinChanged(i, v),
                              onSubmitted: (_) {
                                if (i == 3) _submit();
                              },
                              onTap: () => _pinCtrls[i].selection =
                                  TextSelection(
                                      baseOffset: 0,
                                      extentOffset:
                                          _pinCtrls[i].text.length),
                            ),
                          ),
                        ),
                        if (i < 3) const SizedBox(width: 12),
                      ],
                      const SizedBox(width: 8),
                      IconButton(
                        onPressed: () => setState(() => _obscure = !_obscure),
                        icon: Icon(
                          _obscure
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined,
                          color: AppColors.secondaryText,
                          size: 20,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 28),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _loading ? null : _submit,
                      child: _loading
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Secure Sign In'),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Forgot PIN? Contact your Branch Manager.',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.secondaryText,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

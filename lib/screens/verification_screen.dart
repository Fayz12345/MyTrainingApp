import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:amplify_flutter/amplify_flutter.dart';
import '../bloc/auth/auth_bloc.dart';
import '../theme/app_theme.dart';
import '../widgets/auth_screen_layout.dart';
import '../widgets/custom_button.dart';
import '../widgets/error_message.dart';
import '../widgets/auth_footer_link.dart';
import 'account_created_success_screen.dart';

class VerificationScreen extends StatefulWidget {
  final String email;
  final String password;

  const VerificationScreen({
    super.key,
    required this.email,
    required this.password,
  });

  @override
  State<VerificationScreen> createState() => _VerificationScreenState();
}

class _VerificationScreenState extends State<VerificationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _codeController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _handleVerification() async {
    if (_formKey.currentState!.validate()) {
      setState(() {
        _isLoading = true;
        _errorMessage = null;
      });

      try {
        context.read<AuthBloc>().add(
              ConfirmSignUp(
                email: widget.email,
                password: widget.password,
                confirmationCode: _codeController.text.trim(),
              ),
            );
      } catch (e) {
        setState(() {
          _isLoading = false;
          _errorMessage = e.toString();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final dims = AppTheme.getDimensions(context);
    final fieldSpacing = AppTheme.fieldSpacing(context);
    final sectionSpacing = AppTheme.sectionSpacing(context);

    return BlocListener<AuthBloc, AuthState>(
      listener: (context, state) {
        if (state is AuthError) {
          setState(() {
            _isLoading = false;
            _errorMessage = state.message;
          });
        } else if (state is AuthLoading) {
          setState(() {
            _isLoading = true;
          });
        } else if (state is AccountCreatedSuccess) {
          setState(() {
            _isLoading = false;
          });
          // Navigate to success screen with AuthBloc
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(
              builder: (context) => BlocProvider.value(
                value: context.read<AuthBloc>(),
                child: AccountCreatedSuccessScreen(
                  email: state.email,
                ),
              ),
            ),
          );
        } else if (state is AuthAuthenticated) {
          setState(() {
            _isLoading = false;
          });
          // Directly navigate to course list screen with bottom navigation
          safePrint(
              '[SIGNUP_FLOW] [VerificationScreen] AuthAuthenticated detected - Navigating directly to course list');
          // Replace all routes and navigate directly to MainTabNavigator
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (context.mounted) {
              Navigator.of(context, rootNavigator: true)
                  .pushNamedAndRemoveUntil(
                '/home',
                (route) => false, // Remove all previous routes
              );
              safePrint(
                  '[SIGNUP_FLOW] [VerificationScreen] ✅ Navigated directly to course list screen');
            }
          });
        }
      },
      child: AuthScreenLayout(
        formKey: _formKey,
        title: 'Verify Your Email',
        subtitle:
            'We\'ve sent a verification code to\n${widget.email}\nPlease enter it below.',
        children: [
          // Verification Code Field
          TextFormField(
            controller: _codeController,
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            maxLength: 6,
            style: TextStyle(
              fontSize: (dims.isTablet ? 24 : 20) * dims.textScaleFactor,
              fontWeight: FontWeight.bold,
              letterSpacing: dims.isTablet ? 8 : 6,
            ),
            decoration: InputDecoration(
              labelText: 'Verification Code',
              hintText: 'Enter 6-digit code',
              counterText: '',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.grey[300]!),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide:
                    const BorderSide(color: AppTheme.primaryColor, width: 2),
              ),
              errorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Colors.red),
              ),
              focusedErrorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Colors.red, width: 2),
              ),
            ),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Please enter the verification code';
              }
              if (value.length != 6) {
                return 'Verification code must be 6 digits';
              }
              return null;
            },
          ),
          SizedBox(height: fieldSpacing),
          // Error Message
          if (_errorMessage != null) ErrorMessage(message: _errorMessage!),
          // Verify Button
          CustomButton(
            text: 'Verify Email',
            onPressed: _handleVerification,
            isLoading: _isLoading,
          ),
          SizedBox(height: sectionSpacing),
          // Resend Code Link
          AuthFooterLink(
            promptText: 'Didn\'t receive the code? ',
            linkText: 'Resend Code',
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Resend code functionality coming soon'),
                ),
              );
            },
          ),
          SizedBox(height: sectionSpacing),
          // Back to Sign Up Link
          AuthFooterLink(
            promptText: 'Wrong email? ',
            linkText: 'Go Back',
            onTap: () {
              Navigator.of(context).pop();
            },
          ),
        ],
      ),
    );
  }
}

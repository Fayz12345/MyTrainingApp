import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/auth/auth_bloc.dart';
import '../theme/app_theme.dart';
import '../widgets/auth_screen_layout.dart';
import '../widgets/custom_text_field.dart';
import '../widgets/custom_button.dart';
import '../widgets/error_message.dart';
import 'reset_password_screen.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _handleResetPassword() async {
    if (_formKey.currentState!.validate()) {
      setState(() {
        _isLoading = true;
        _errorMessage = null;
      });

      try {
        context.read<AuthBloc>().add(
              ResetPassword(email: _emailController.text.trim()),
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
        } else if (state is PasswordResetCodeSent) {
          setState(() {
            _isLoading = false;
          });
          // Navigate to reset password screen
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(
              builder: (context) => ResetPasswordScreen(
                email: state.email,
              ),
            ),
          );
        }
      },
      child: AuthScreenLayout(
        formKey: _formKey,
        title: 'Forgot Password',
        subtitle:
            'Enter your email address and we\'ll send you a code to reset your password.',
        children: [
          // Email Field
          CustomTextField(
            label: 'Email Address',
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            hintText: 'Enter your email',
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Please enter your email';
              }
              if (!value.contains('@')) {
                return 'Please enter a valid email';
              }
              return null;
            },
          ),
          SizedBox(height: fieldSpacing),
          // Error Message
          if (_errorMessage != null) ErrorMessage(message: _errorMessage!),
          // Send Code Button
          CustomButton(
            text: 'Send Reset Code',
            onPressed: _handleResetPassword,
            isLoading: _isLoading,
          ),
          SizedBox(height: sectionSpacing),
          // Back to Login Link
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                'Remember your password? ',
                style: TextStyle(
                  color: Colors.grey[600],
                  fontSize: (dims.isTablet ? 16 : 14) * dims.textScaleFactor,
                ),
              ),
              TextButton(
                onPressed: () {
                  HapticFeedback.lightImpact();
                  Navigator.of(context).pop();
                },
                style: TextButton.styleFrom(
                  padding: EdgeInsets.zero,
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: Text(
                  'Sign In',
                  style: AppTheme.linkTextStyle(context),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

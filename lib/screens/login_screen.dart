import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:amplify_flutter/amplify_flutter.dart';
import '../bloc/auth/auth_bloc.dart';
import '../theme/app_theme.dart';
import '../widgets/auth_screen_layout.dart';
import '../widgets/custom_text_field.dart';
import '../widgets/custom_button.dart';
import '../widgets/social_login_button.dart';
import '../widgets/error_message.dart';
import '../widgets/auth_divider.dart';
import '../widgets/auth_footer_link.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (_formKey.currentState!.validate()) {
      setState(() {
        _isLoading = true;
        _errorMessage = null;
      });

      try {
        context.read<AuthBloc>().add(
              SignIn(
                email: _emailController.text.trim(),
                password: _passwordController.text,
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
      listenWhen: (previous, current) {
        // Only listen to state changes, not rebuild on every state
        return current is AuthError ||
            current is AuthLoading ||
            current is AuthAuthenticated;
      },
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
        } else if (state is AuthAuthenticated) {
          setState(() {
            _isLoading = false;
          });
          // Directly navigate to course list screen with bottom navigation
          safePrint(
              '[LOGIN_FLOW] [LoginScreen] AuthAuthenticated detected - Navigating directly to course list');
          // Replace all routes and navigate directly to MainTabNavigator
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (context.mounted) {
              Navigator.of(context, rootNavigator: true)
                  .pushNamedAndRemoveUntil(
                '/home',
                (route) => false, // Remove all previous routes
              );
              safePrint(
                  '[LOGIN_FLOW] [LoginScreen] ✅ Navigated directly to course list screen');
            }
          });
        }
      },
      child: AuthScreenLayout(
        formKey: _formKey,
        title: 'Log In to Your Account',
        subtitle: 'Welcome back, start your training.',
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
          // Password Field
          CustomTextField(
            label: 'Password',
            controller: _passwordController,
            obscureText: _obscurePassword,
            hintText: 'Enter your password',
            suffixIcon: IconButton(
              icon: Icon(
                _obscurePassword ? Icons.visibility_off : Icons.visibility,
                color: Colors.grey[600],
                size: dims.isTablet ? 24 : 20,
              ),
              onPressed: () {
                setState(() {
                  _obscurePassword = !_obscurePassword;
                });
              },
            ),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Please enter your password';
              }
              return null;
            },
          ),
          SizedBox(height: dims.isSmallScreen ? 8 : 10),
          // Forgot Password
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () {
                HapticFeedback.lightImpact();
                Navigator.of(context).pushNamed('/forgot-password');
              },
              style: TextButton.styleFrom(
                padding: EdgeInsets.symmetric(
                  horizontal: dims.isTablet ? 16 : 8,
                  vertical: dims.isTablet ? 12 : 8,
                ),
                minimumSize: Size(
                  dims.isTablet ? 120 : 80,
                  dims.isTablet ? 48 : 40,
                ),
              ),
              child: Text(
                'Forgot Password?',
                style: TextStyle(
                  color: AppTheme.primaryColor,
                  fontSize: (dims.isTablet ? 16 : 14) * dims.textScaleFactor,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
          SizedBox(height: fieldSpacing),
          // Error Message
          if (_errorMessage != null) ErrorMessage(message: _errorMessage!),
          // Login Button
          CustomButton(
            text: 'Log In',
            onPressed: _handleLogin,
            isLoading: _isLoading,
          ),
          SizedBox(height: 20),
          // Divider
          const AuthDivider(text: 'Or continue with'),
          SizedBox(height: sectionSpacing),
          // Social Login Buttons
          Row(
            children: [
              Expanded(
                child: SocialLoginButton(
                  icon: Icons.g_mobiledata,
                  label: 'Google',
                  onPressed: () {
                    context.read<AuthBloc>().add(const SignInWithGoogle());
                  },
                ),
              ),
              SizedBox(width: dims.isTablet ? 16 : 12),
              Expanded(
                child: SocialLoginButton(
                  icon: Icons.apple,
                  label: 'Apple',
                  onPressed: () {
                    context.read<AuthBloc>().add(const SignInWithApple());
                  },
                ),
              ),
            ],
          ),
          SizedBox(height: sectionSpacing),
          // Sign Up Link
          AuthFooterLink(
            promptText: 'New to our app? ',
            linkText: 'Sign Up',
            onTap: () {
              Navigator.of(context).pushReplacementNamed('/signup');
            },
          ),
        ],
      ),
    );
  }
}

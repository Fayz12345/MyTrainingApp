import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:amplify_flutter/amplify_flutter.dart';
import '../bloc/auth_bloc.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/auth_screen_layout.dart';
import '../../../../core/widgets/custom_text_field.dart';
import '../../../../core/widgets/custom_button.dart';
import '../../../../core/widgets/social_login_button.dart';
import '../../../../core/widgets/auth_divider.dart';
import '../../../../core/widgets/auth_footer_link.dart';

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
  bool _isApiCallInProgress = false; // Track if API call is in progress
  String?
      _lastErrorShown; // Track last error shown to avoid showing same error twice

  // Email validation regex pattern
  static final RegExp _emailRegex = RegExp(
    r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
  );

  bool _isValidEmail(String email) {
    return _emailRegex.hasMatch(email);
  }

  @override
  void initState() {
    super.initState();
    // Reset loading state when screen is initialized
    _isLoading = false;

    // Dismiss error SnackBar when user starts typing
    _emailController.addListener(_dismissErrorSnackBar);
    _passwordController.addListener(_dismissErrorSnackBar);
  }

  void _dismissErrorSnackBar() {
    // Dismiss any visible SnackBar when user starts typing
    if (mounted) {
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
    }
  }

  String _cleanErrorMessage(String message) {
    // Remove common prefixes and make message user-friendly
    String cleaned = message;

    // Remove "Exception: " prefix
    if (cleaned.startsWith('Exception: ')) {
      cleaned = cleaned.substring(11);
    }

    // Remove "Failed to sign in: " prefix
    if (cleaned.startsWith('Failed to sign in: ')) {
      cleaned = cleaned.substring(19);
    }

    // Remove "Failed to sign up: " prefix
    if (cleaned.startsWith('Failed to sign up: ')) {
      cleaned = cleaned.substring(19);
    }

    // Clean up common error messages
    if (cleaned.contains('Incorrect username or password') ||
        cleaned.contains('Incorrect email or password')) {
      cleaned = 'Incorrect email or password. Please try again.';
    } else if (cleaned.contains('UserNotFoundException')) {
      cleaned = 'No account found with this email. Please sign up.';
    } else if (cleaned.contains('NotAuthorizedException')) {
      cleaned = 'Incorrect email or password. Please try again.';
    } else if (cleaned.contains('UserNotConfirmedException')) {
      cleaned = 'Please verify your email address before signing in.';
    } else if (cleaned.contains('Network') || cleaned.contains('network')) {
      cleaned = 'Network error. Please check your internet connection.';
    }

    return cleaned.trim();
  }

  void _showErrorSnackBar(String message) {
    if (!mounted) return;

    final cleanedMessage = _cleanErrorMessage(message);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(
              Icons.error_outline,
              color: Colors.white,
              size: 20,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                cleanedMessage,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
        backgroundColor: Colors.red[700],
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        duration: const Duration(seconds: 4),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
        ),
        action: SnackBarAction(
          label: 'Dismiss',
          textColor: Colors.white,
          onPressed: () {
            ScaffoldMessenger.of(context).hideCurrentSnackBar();
          },
        ),
      ),
    );
  }

  @override
  void dispose() {
    _emailController.removeListener(_dismissErrorSnackBar);
    _passwordController.removeListener(_dismissErrorSnackBar);
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    // Dismiss any existing error SnackBar when user clicks login
    _dismissErrorSnackBar();

    // Clear last error shown and reset API call flag - we're starting a new login attempt
    _lastErrorShown = null;
    _isApiCallInProgress = false;

    if (_formKey.currentState!.validate()) {
      setState(() {
        _isLoading = true;
        _isApiCallInProgress = true; // Mark that API call is starting
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
          _isApiCallInProgress = false; // Mark that API call is starting
        });
        _showErrorSnackBar(e.toString());
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
        // Always listen to error, verification required, and authenticated states
        return current is AuthError ||
            current is VerificationRequired ||
            current is AuthAuthenticated;
      },
      listener: (context, state) {
        if (state is VerificationRequired) {
          // Stop loader and reset API call flag
          setState(() {
            _isLoading = false;
            _isApiCallInProgress = false;
          });
          // Navigate to verification screen with email and password
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) {
              context.push(
                '/verification?email=${Uri.encodeComponent(state.email)}&password=${Uri.encodeComponent(state.password)}',
              );
            }
          });
        } else if (state is AuthError) {
          // Only show error if API call was in progress (user clicked login)
          // This ensures error only shows after API completes, not from old state
          if (_isApiCallInProgress) {
            // Stop loader and reset API call flag
            setState(() {
              _isLoading = false;
              _isApiCallInProgress = false;
            });
            // Only show if this is a new error (not the same as last one shown)
            if (_lastErrorShown != state.message) {
              _lastErrorShown = state.message;
              // Show error as SnackBar toast after loading stops
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted) {
                  _showErrorSnackBar(state.message);
                }
              });
            }
          }
        } else if (state is AuthAuthenticated) {
          // Reset API call flag on success
          setState(() {
            _isLoading = false;
            _isApiCallInProgress = false;
          });
          setState(() {
            _isLoading = false;
          });
          // Directly navigate to course list screen with bottom navigation
          safePrint(
              '[LOGIN_FLOW] [LoginScreen] AuthAuthenticated detected - Navigating directly to course list');
          // Replace all routes and navigate directly to MainTabNavigator
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (context.mounted) {
              context.go('/home');
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
            autofocus: true,
            textInputAction: TextInputAction.next,
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Please enter your email';
              }
              if (!_isValidEmail(value.trim())) {
                return 'Please enter a valid email address';
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
            textInputAction: TextInputAction.done,
            onFieldSubmitted: _handleLogin,
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
                context.push('/forgot-password');
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
          // Login Button
          CustomButton(
            text: 'Log In',
            onPressed: _handleLogin,
            isLoading: _isLoading,
          ),

          SizedBox(height: 20),
          // Divider
          ///prachi
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
                    // Navigate directly to social login error screen
                    context.push('/social-login-error');
                  },
                ),
              ),
              SizedBox(width: dims.isTablet ? 16 : 12),
              Expanded(
                child: SocialLoginButton(
                  icon: Icons.apple,
                  label: 'Apple',
                  onPressed: () {
                    // Navigate directly to social login error screen
                    context.push('/social-login-error');
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
              context.go('/signup');
            },
          ),
        ],
      ),
    );
  }
}

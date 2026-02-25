import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:amplify_flutter/amplify_flutter.dart';
import '../bloc/auth_bloc.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/auth_screen_layout.dart';
import '../../../../core/widgets/custom_button.dart';
import '../../../../core/widgets/auth_footer_link.dart';

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
  bool _isApiCallInProgress = false; // Track if API call is in progress
  String? _lastErrorShown; // Track last error shown to avoid showing same error twice

  @override
  void initState() {
    super.initState();
    // Reset loading state when screen is initialized
    _isLoading = false;

    // Dismiss error SnackBar when user starts typing
    _codeController.addListener(_dismissErrorSnackBar);
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

    // Remove "Failed to confirm sign up: " prefix
    if (cleaned.startsWith('Failed to confirm sign up: ')) {
      cleaned = cleaned.substring(29);
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
    if (cleaned.contains('CodeMismatchException') ||
        cleaned.contains('Invalid verification code')) {
      cleaned = 'Invalid verification code. Please check and try again.';
    } else if (cleaned.contains('ExpiredCodeException') ||
        cleaned.contains('expired')) {
      cleaned = 'Verification code has expired. Please request a new one.';
    } else if (cleaned.contains('NotAuthorizedException')) {
      cleaned = 'Invalid verification code. Please check and try again.';
    } else if (cleaned.contains('Incorrect username or password') ||
        cleaned.contains('Incorrect email or password')) {
      cleaned = 'Incorrect email or password. Please try again.';
    } else if (cleaned.contains('UserNotFoundException')) {
      cleaned = 'No account found with this email. Please sign up.';
    } else if (cleaned.contains('UserNotConfirmedException')) {
      cleaned = 'Please verify your email address before signing in.';
    } else if (cleaned.contains('Network') || cleaned.contains('network')) {
      cleaned = 'Network error. Please check your internet connection.';
    } else if (cleaned.contains('Password does not meet requirements')) {
      cleaned =
          'Password must be at least 8 characters with uppercase, lowercase, number, and special character.';
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
    _codeController.removeListener(_dismissErrorSnackBar);
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _handleVerification() async {
    // Dismiss any existing error SnackBar when user clicks verify
    _dismissErrorSnackBar();

    // Clear last error shown and reset API call flag - we're starting a new verification attempt
    _lastErrorShown = null;
    _isApiCallInProgress = false;

    if (_formKey.currentState!.validate()) {
      setState(() {
        _isLoading = true;
        _isApiCallInProgress = true; // Mark that API call is starting
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
          _isApiCallInProgress = false;
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
        // Always listen to error, loading, success, and authenticated states
        return current is AuthError ||
            current is AuthLoading ||
            current is AccountCreatedSuccess ||
            current is AuthAuthenticated;
      },
      listener: (context, state) {
        if (state is AuthError) {
          // Only show error if API call was in progress (user clicked verify)
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
        } else if (state is AuthLoading) {
          setState(() {
            _isLoading = true;
          });
        } else if (state is AccountCreatedSuccess) {
          // Reset API call flag on success
          setState(() {
            _isLoading = false;
            _isApiCallInProgress = false;
          });
          // Navigate to success screen
          context.go('/account-created-success?email=${Uri.encodeComponent(state.email)}');
        } else if (state is AuthAuthenticated) {
          // Reset API call flag on success
          setState(() {
            _isLoading = false;
            _isApiCallInProgress = false;
          });
          // Directly navigate to course list screen with bottom navigation
          safePrint(
              '[SIGNUP_FLOW] [VerificationScreen] AuthAuthenticated detected - Navigating directly to course list');
          // Replace all routes and navigate directly to MainTabNavigator
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (context.mounted) {
              context.go('/home');
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

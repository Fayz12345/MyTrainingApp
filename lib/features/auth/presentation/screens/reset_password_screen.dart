import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../bloc/auth_bloc.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/auth_screen_layout.dart';
import '../../../../core/widgets/custom_text_field.dart';
import '../../../../core/widgets/custom_button.dart';

class ResetPasswordScreen extends StatefulWidget {
  final String email;

  const ResetPasswordScreen({
    super.key,
    required this.email,
  });

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _codeController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _isLoading = false;
  bool _passwordsMatch = false;
  bool _isApiCallInProgress = false; // Track if API call is in progress
  String? _lastErrorShown; // Track last error shown to avoid showing same error twice

  @override
  void initState() {
    super.initState();
    // Reset loading state when screen is initialized
    _isLoading = false;
    // Listen to password changes to check if passwords match
    _passwordController.addListener(_checkPasswordMatch);
    _confirmPasswordController.addListener(_checkPasswordMatch);

    // Dismiss error SnackBar when user starts typing
    _codeController.addListener(_dismissErrorSnackBar);
    _passwordController.addListener(_dismissErrorSnackBar);
    _confirmPasswordController.addListener(_dismissErrorSnackBar);
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

    // Remove "Failed to confirm password reset: " prefix
    if (cleaned.startsWith('Failed to confirm password reset: ')) {
      cleaned = cleaned.substring(36);
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

  void _checkPasswordMatch() {
    if (!mounted) return;
    final password = _passwordController.text;
    final confirmPassword = _confirmPasswordController.text;
    final matches = password.isNotEmpty &&
        confirmPassword.isNotEmpty &&
        password == confirmPassword;
    // Always update state to ensure UI refreshes in real-time
    // Don't call validate() here as it causes infinite loop with validator
    setState(() {
      _passwordsMatch = matches;
    });
  }

  @override
  void dispose() {
    _passwordController.removeListener(_checkPasswordMatch);
    _confirmPasswordController.removeListener(_checkPasswordMatch);
    _codeController.removeListener(_dismissErrorSnackBar);
    _passwordController.removeListener(_dismissErrorSnackBar);
    _confirmPasswordController.removeListener(_dismissErrorSnackBar);
    _codeController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _handleResetPassword() async {
    // Dismiss any existing error SnackBar when user clicks reset password
    _dismissErrorSnackBar();

    // Clear last error shown and reset API call flag - we're starting a new reset attempt
    _lastErrorShown = null;
    _isApiCallInProgress = false;

    if (_formKey.currentState!.validate()) {
      setState(() {
        _isLoading = true;
        _isApiCallInProgress = true; // Mark that API call is starting
      });

      try {
        context.read<AuthBloc>().add(
              ConfirmResetPassword(
                email: widget.email,
                newPassword: _passwordController.text,
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
        // Always listen to error, loading, and success states
        return current is AuthError ||
            current is AuthLoading ||
            current is PasswordResetSuccess;
      },
      listener: (context, state) {
        if (state is AuthError) {
          // Only show error if API call was in progress (user clicked reset password)
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
        } else if (state is PasswordResetSuccess) {
          // Reset API call flag on success
          setState(() {
            _isLoading = false;
            _isApiCallInProgress = false;
          });
          // Show success message and navigate to login
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Password reset successful! Please sign in with your new password.'),
              backgroundColor: Colors.green,
              duration: Duration(seconds: 3),
            ),
          );
          context.go('/login');
        }
      },
      child: AuthScreenLayout(
        formKey: _formKey,
        title: 'Reset Password',
        subtitle: 'Enter the verification code sent to ${widget.email} and your new password.',
        children: [
          // Verification Code Field
          CustomTextField(
            label: 'Verification Code',
            controller: _codeController,
            keyboardType: TextInputType.number,
            hintText: 'Enter 6-digit code',
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Please enter the verification code';
              }
              if (value.length < 6) {
                return 'Verification code must be 6 digits';
              }
              return null;
            },
          ),
          SizedBox(height: fieldSpacing),
          // New Password Field
          CustomTextField(
            label: 'New Password',
            controller: _passwordController,
            obscureText: _obscurePassword,
            hintText: 'Enter your new password',
            suffixIcon: IconButton(
              icon: Icon(
                _obscurePassword ? Icons.visibility_off : Icons.visibility,
                color: Colors.grey[600],
                size: dims.isTablet ? 24 : 20,
              ),
              onPressed: () {
                setState(() {
                  _obscurePassword = !_obscurePassword;
                  // Re-check password match when visibility changes
                  _checkPasswordMatch();
                });
              },
            ),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Please enter your new password';
              }
              if (value.length < 8) {
                return 'Password must be at least 8 characters';
              }
              return null;
            },
          ),
          SizedBox(height: fieldSpacing),
          // Confirm Password Field
          CustomTextField(
            label: 'Confirm New Password',
            controller: _confirmPasswordController,
            obscureText: _obscureConfirmPassword,
            hintText: 'Confirm your new password',
            suffixIcon: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Password match indicator - show when passwords match and confirm field has text
                if (_passwordsMatch &&
                    _confirmPasswordController.text.isNotEmpty &&
                    _passwordController.text.isNotEmpty)
                  Padding(
                    padding: EdgeInsets.only(right: dims.isTablet ? 8 : 4),
                    child: Icon(
                      Icons.check_circle,
                      color: Colors.green[600],
                      size: dims.isTablet ? 24 : 20,
                    ),
                  ),
                // Visibility toggle
                IconButton(
                  icon: Icon(
                    _obscureConfirmPassword
                        ? Icons.visibility_off
                        : Icons.visibility,
                    color: Colors.grey[600],
                    size: dims.isTablet ? 24 : 20,
                  ),
                  onPressed: () {
                    setState(() {
                      _obscureConfirmPassword = !_obscureConfirmPassword;
                      // Re-check password match when visibility changes
                      _checkPasswordMatch();
                    });
                  },
                ),
              ],
            ),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Please confirm your new password';
              }
              // Don't call _checkPasswordMatch() here - it's handled by the listener
              // Calling it here causes infinite loop with setState -> validate -> validator -> _checkPasswordMatch
              if (value != _passwordController.text) {
                return 'Passwords do not match';
              }
              return null;
            },
          ),
          // Password match message - show below confirm password field
          if (_confirmPasswordController.text.isNotEmpty &&
              _passwordController.text.isNotEmpty)
            Padding(
              padding: EdgeInsets.only(
                top: dims.isSmallScreen ? 4 : 6,
                left: dims.isTablet ? 4 : 2,
              ),
              child: Row(
                children: [
                  if (_passwordsMatch) ...[
                    Icon(
                      Icons.check_circle_outline,
                      color: Colors.green[600],
                      size: dims.isTablet ? 18 : 16,
                    ),
                    SizedBox(width: dims.isTablet ? 8 : 6),
                    Text(
                      'Passwords match',
                      style: TextStyle(
                        color: Colors.green[600],
                        fontSize:
                            (dims.isTablet ? 14 : 12) * dims.textScaleFactor,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ] else ...[
                    Icon(
                      Icons.error_outline,
                      color: Colors.orange[600],
                      size: dims.isTablet ? 18 : 16,
                    ),
                    SizedBox(width: dims.isTablet ? 8 : 6),
                    Text(
                      'Passwords do not match',
                      style: TextStyle(
                        color: Colors.orange[600],
                        fontSize:
                            (dims.isTablet ? 14 : 12) * dims.textScaleFactor,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          SizedBox(height: fieldSpacing),
          // Reset Password Button
          CustomButton(
            text: 'Reset Password',
            onPressed: _handleResetPassword,
            isLoading: _isLoading,
          ),
          SizedBox(height: sectionSpacing),
          // Resend Code Link
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                'Didn\'t receive the code? ',
                style: TextStyle(
                  color: Colors.grey[600],
                  fontSize: (dims.isTablet ? 16 : 14) * dims.textScaleFactor,
                ),
              ),
              TextButton(
                onPressed: _isLoading
                    ? null
                    : () {
                        HapticFeedback.lightImpact();
                        context.read<AuthBloc>().add(
                              ResetPassword(email: widget.email),
                            );
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Verification code resent to your email'),
                          ),
                        );
                      },
                style: TextButton.styleFrom(
                  padding: EdgeInsets.zero,
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: Text(
                  'Resend Code',
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


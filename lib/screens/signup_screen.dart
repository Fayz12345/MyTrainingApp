import 'package:flutter/material.dart';
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

class SignUpScreen extends StatefulWidget {
  const SignUpScreen({super.key});

  @override
  State<SignUpScreen> createState() => _SignUpScreenState();
}

class _SignUpScreenState extends State<SignUpScreen> {
  final _formKey = GlobalKey<FormState>();

  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _handleSignUp() async {
    if (_formKey.currentState!.validate()) {
      setState(() {
        _isLoading = true;
        _errorMessage = null;
      });

      try {
        context.read<AuthBloc>().add(
          SignUp(
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
        } else if (state is SignUpConfirmationRequired) {
          setState(() {
            _isLoading = false;
          });
          // Navigate to verification screen with email and password
          Navigator.of(context).pushNamed(
            '/verification',
            arguments: {
              'email': state.email,
              'password': state.password,
            },
          );
        } else if (state is AuthAuthenticated) {
          setState(() {
            _isLoading = false;
          });
          // Directly navigate to course list screen with bottom navigation
          safePrint(
              '[SIGNUP_FLOW] [SignUpScreen] AuthAuthenticated detected - Navigating directly to course list');
          // Replace all routes and navigate directly to MainTabNavigator
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (context.mounted) {
              Navigator.of(context, rootNavigator: true)
                  .pushNamedAndRemoveUntil(
                '/home',
                (route) => false, // Remove all previous routes
              );
              safePrint(
                  '[SIGNUP_FLOW] [SignUpScreen] ✅ Navigated directly to course list screen');
          }
          });
        }
      },
      child: AuthScreenLayout(
        formKey: _formKey,
        title: 'Create Your Account',
        subtitle: 'Sign up to start your training journey.',
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
              if (value.length < 8) {
                return 'Password must be at least 8 characters';
              }
              return null;
            },
          ),
          SizedBox(height: fieldSpacing),
          // Confirm Password Field
          CustomTextField(
            label: 'Confirm Password',
            controller: _confirmPasswordController,
            obscureText: _obscureConfirmPassword,
            hintText: 'Confirm your password',
            suffixIcon: IconButton(
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
                });
              },
            ),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Please confirm your password';
              }
              if (value != _passwordController.text) {
                return 'Passwords do not match';
              }
              return null;
            },
          ),
          SizedBox(height: fieldSpacing),
          // Error Message
          if (_errorMessage != null) ErrorMessage(message: _errorMessage!),
          // Sign Up Button
          CustomButton(
            text: 'Sign Up',
            onPressed: _handleSignUp,
            isLoading: _isLoading,
          ),
          SizedBox(height: sectionSpacing),
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
          // Sign In Link
          AuthFooterLink(
            promptText: 'Already have an account? ',
            linkText: 'Sign In',
            onTap: () {
              Navigator.of(context).pushReplacementNamed('/login');
            },
          ),
        ],
      ),
    );
  }
}





/*
class SignUpScreen extends StatefulWidget {
  const SignUpScreen({super.key});

  @override
  State<SignUpScreen> createState() => _SignUpScreenState();
}

class _SignUpScreenState extends State<SignUpScreen> {
  final _formKey = GlobalKey<FormState>();

  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _handleSignUp() async {
    if (_formKey.currentState!.validate()) {
      setState(() {
        _isLoading = true;
        _errorMessage = null;
      });

      try {
        context.read<AuthBloc>().add(
              SignUp(
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
        } else if (state is SignUpConfirmationRequired) {
          setState(() {
            _isLoading = false;
          });
          // Navigate to verification screen with email and password
          Navigator.of(context).pushNamed(
            '/verification',
            arguments: {
              'email': state.email,
              'password': state.password,
            },
          );
        } else if (state is AuthAuthenticated) {
          setState(() {
            _isLoading = false;
          });
          // AppContent will automatically rebuild and show MainTabNavigator
          // The BlocBuilder in AppContent will detect AuthAuthenticated state
          // and return MainTabNavigator which shows CourseListScreen with bottom nav
          safePrint(
              '[SIGNUP_FLOW] [SignUpScreen] AuthAuthenticated detected - AppContent will show MainTabNavigator');
          // Clear all navigation routes and return to AppContent
          // AppContent will detect AuthAuthenticated and show MainTabNavigator
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (context.mounted) {
              // Pop all routes until we're back at AppContent (the home widget)
              // AppContent will automatically rebuild and show MainTabNavigator
              Navigator.of(context, rootNavigator: true)
                  .popUntil((route) {
                safePrint(
                    '[SIGNUP_FLOW] [SignUpScreen] Popping route: ${route.settings.name ?? route.runtimeType}');
                return route.isFirst;
              });
              safePrint(
                  '[SIGNUP_FLOW] [SignUpScreen] Navigation stack cleared, AppContent should rebuild');
            }
          });
        }
      },
      child: AuthScreenLayout(
        formKey: _formKey,
        title: 'Create Your Account',
        subtitle: 'Sign up to start your training journey.',
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
              if (value.length < 8) {
                return 'Password must be at least 8 characters';
              }
              return null;
            },
          ),
          SizedBox(height: fieldSpacing),
          // Confirm Password Field
          CustomTextField(
            label: 'Confirm Password',
            controller: _confirmPasswordController,
            obscureText: _obscureConfirmPassword,
            hintText: 'Confirm your password',
            suffixIcon: IconButton(
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
                });
              },
            ),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Please confirm your password';
              }
              if (value != _passwordController.text) {
                return 'Passwords do not match';
              }
              return null;
            },
          ),
          SizedBox(height: fieldSpacing),
          // Error Message
          if (_errorMessage != null) ErrorMessage(message: _errorMessage!),
          // Sign Up Button
          CustomButton(
            text: 'Sign Up',
            onPressed: _handleSignUp,
            isLoading: _isLoading,
          ),
          SizedBox(height: sectionSpacing),
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
          // Sign In Link
          AuthFooterLink(
            promptText: 'Already have an account? ',
            linkText: 'Sign In',
            onTap: () {
              Navigator.of(context).pushReplacementNamed('/login');
            },
          ),
        ],
      ),
    );
  }
}

 */


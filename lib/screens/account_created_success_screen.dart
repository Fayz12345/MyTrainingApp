import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:amplify_flutter/amplify_flutter.dart';
import '../bloc/auth/auth_bloc.dart';
import '../theme/app_theme.dart';
import '../widgets/custom_button.dart';

class AccountCreatedSuccessScreen extends StatefulWidget {
  final String email;

  const AccountCreatedSuccessScreen({
    super.key,
    required this.email,
  });

  @override
  State<AccountCreatedSuccessScreen> createState() =>
      _AccountCreatedSuccessScreenState();
}

class _AccountCreatedSuccessScreenState
    extends State<AccountCreatedSuccessScreen> {
  @override
  Widget build(BuildContext context) {
    return BlocListener<AuthBloc, AuthState>(
      listenWhen: (previous, current) =>
          current is AuthUnauthenticated || current is AuthAuthenticated,
      listener: (context, state) {
        // When user logs out, navigate back to login screen
        if (state is AuthUnauthenticated) {
          // Pop all screens back to root (AppContent)
          // AppContent will automatically show LoginScreen when AuthUnauthenticated
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (context.mounted && Navigator.of(context).canPop()) {
              Navigator.of(context).popUntil((route) => route.isFirst);
            }
          });
        } else if (state is AuthAuthenticated) {
          // Directly navigate to course list screen with bottom navigation
          safePrint(
              '[SIGNUP_FLOW] [AccountCreatedSuccessScreen] AuthAuthenticated detected - Navigating directly to course list');
          // Replace all routes and navigate directly to MainTabNavigator
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (context.mounted) {
              Navigator.of(context, rootNavigator: true)
                  .pushNamedAndRemoveUntil(
                '/home',
                (route) => false, // Remove all previous routes
              );
              safePrint(
                  '[SIGNUP_FLOW] [AccountCreatedSuccessScreen] ✅ Navigated directly to course list screen');
            }
          });
        }
      },
      child: _buildSuccessContent(context),
    );
  }

  void _showLogoutDialog(BuildContext context) {
    final dims = AppTheme.getDimensions(context);

    showDialog(
      context: context,
      barrierColor: Colors.black54,
      builder: (context) => Dialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        child: Container(
          padding: EdgeInsets.all(dims.isTablet ? 28 : 24),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Icon
              Container(
                width: dims.isTablet ? 80 : 64,
                height: dims.isTablet ? 80 : 64,
                decoration: BoxDecoration(
                  color: Colors.red[50],
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.logout_rounded,
                  size: dims.isTablet ? 40 : 32,
                  color: Colors.red[600],
                ),
              ),
              SizedBox(height: dims.isTablet ? 24 : 20),
              // Title
              Text(
                'Log Out',
                style: TextStyle(
                  fontSize: (dims.isTablet ? 24 : 20) * dims.textScaleFactor,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
              SizedBox(height: dims.isTablet ? 12 : 8),
              // Message
              Text(
                'Are you sure you want to log out?\nYou\'ll need to sign in again to access your account.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: (dims.isTablet ? 16 : 14) * dims.textScaleFactor,
                  color: Colors.grey[600],
                  height: 1.5,
                ),
              ),
              SizedBox(height: dims.isTablet ? 28 : 24),
              // Buttons
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context),
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: Colors.grey[300]!),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        padding: EdgeInsets.symmetric(
                          vertical: dims.isTablet ? 16 : 14,
                        ),
                      ),
                      child: Text(
                        'Cancel',
                        style: TextStyle(
                          fontSize:
                              (dims.isTablet ? 16 : 14) * dims.textScaleFactor,
                          fontWeight: FontWeight.w600,
                          color: Colors.black87,
                        ),
                      ),
                    ),
                  ),
                  SizedBox(width: dims.isTablet ? 16 : 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () async {
                        Navigator.pop(context);
                        // Trigger logout
                        context.read<AuthBloc>().add(const SignOut());
                        // Wait a moment for state to update, then clear navigation
                        await Future.delayed(const Duration(milliseconds: 100));
                        // Clear navigation stack to ensure we go back to login
                        if (context.mounted) {
                          Navigator.of(context).pushNamedAndRemoveUntil(
                            '/login',
                                (route) => false,
                          );
                         // Navigator.of(context, rootNavigator: true)
                           //   .popUntil((route) => route.isFirst);
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.red[600],
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        padding: EdgeInsets.symmetric(
                          vertical: dims.isTablet ? 16 : 14,
                        ),
                        elevation: 0,
                      ),
                      child: Text(
                        'Log Out',
                        style: TextStyle(
                          fontSize:
                              (dims.isTablet ? 16 : 14) * dims.textScaleFactor,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSuccessContent(BuildContext context) {
    final dims = AppTheme.getDimensions(context);
    final horizontalPadding = AppTheme.horizontalPadding(context);
    final topSpacing = AppTheme.topSpacing(context);

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.symmetric(
            horizontal: horizontalPadding,
            vertical: dims.isSmallScreen ? 16.0 : 24.0,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              SizedBox(height: topSpacing),
              // Success Icon
              Container(
                width: dims.isTablet ? 120 : 100,
                height: dims.isTablet ? 120 : 100,
                decoration: BoxDecoration(
                  color: Colors.green[50],
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.check_circle,
                  size: dims.isTablet ? 80 : 70,
                  color: Colors.green[600],
                ),
              ),
              SizedBox(height: dims.isTablet ? 40 : 30),
              // Congratulations Title
              Text(
                'Congratulations!',
                style: TextStyle(
                  fontSize: (dims.isTablet ? 32 : 28) * dims.textScaleFactor,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
                textAlign: TextAlign.center,
              ),
              SizedBox(height: dims.isSmallScreen ? 12 : 16),
              // Success Message
              Text(
                'Your account has been created successfully.',
                style: TextStyle(
                  fontSize: (dims.isTablet ? 18 : 16) * dims.textScaleFactor,
                  color: Colors.grey[700],
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),
              SizedBox(height: dims.isTablet ? 40 : 30),
              // Contact Admin Card
              Container(
                padding: EdgeInsets.all(dims.isTablet ? 24 : 20),
                decoration: BoxDecoration(
                  color: Colors.blue[50],
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: Colors.blue[200]!,
                    width: 1,
                  ),
                ),
                child: Column(
                  children: [
                    Icon(
                      Icons.info_outline,
                      size: dims.isTablet ? 40 : 32,
                      color: AppTheme.primaryColor,
                    ),
                    SizedBox(height: dims.isTablet ? 16 : 12),
                    Text(
                      'Contact Your Administrator',
                      style: TextStyle(
                        fontSize:
                            (dims.isTablet ? 20 : 18) * dims.textScaleFactor,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    SizedBox(height: dims.isTablet ? 12 : 8),
                    Text(
                      'Your account has been created, but you need to contact your administrator to get access to the training courses.',
                      style: TextStyle(
                        fontSize:
                            (dims.isTablet ? 16 : 14) * dims.textScaleFactor,
                        color: Colors.grey[700],
                        height: 1.5,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    SizedBox(height: dims.isTablet ? 12 : 8),
                    Text(
                      'Email: ${widget.email}',
                      style: TextStyle(
                        fontSize:
                            (dims.isTablet ? 14 : 12) * dims.textScaleFactor,
                        color: Colors.grey[600],
                        fontWeight: FontWeight.w500,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
              SizedBox(height: dims.isTablet ? 40 : 30),
              // Logout Button
              CustomButton(
                text: 'Log Out',
                onPressed: () {
                  // Show logout confirmation dialog
                  _showLogoutDialog(context);
                },
                backgroundColor: Colors.red[600],
              ),
              SizedBox(
                height: MediaQuery.of(context).viewInsets.bottom > 0
                    ? 20
                    : (dims.isSmallScreen ? 20 : 40),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

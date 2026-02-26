import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:amplify_flutter/amplify_flutter.dart';
import '../../services/google_signin_test.dart';
import '../../services/auth_service.dart';
import '../bloc/auth_bloc.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// Test screen for Google Sign-In diagnostics and testing
/// This screen runs diagnostics, tests Google Sign-In, and navigates to main page on success
class GoogleSignInTestScreen extends StatefulWidget {
  const GoogleSignInTestScreen({super.key});

  @override
  State<GoogleSignInTestScreen> createState() => _GoogleSignInTestScreenState();
}

class _GoogleSignInTestScreenState extends State<GoogleSignInTestScreen> {
  Map<String, dynamic>? _diagnosticResults;
  bool _isRunning = false;
  String? _error;
  String? _report;

  Future<void> _runDiagnostics() async {
    setState(() {
      _isRunning = true;
      _error = null;
      _diagnosticResults = null;
      _report = null;
    });

    try {
      final results = await GoogleSignInTest.runDiagnostics();
      final report = GoogleSignInTest.generateReport(results);

      setState(() {
        _diagnosticResults = results;
        _report = report;
        _isRunning = false;
      });

      safePrint(_report);
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isRunning = false;
      });
    }
  }

  Future<void> _testGoogleSignIn() async {
    setState(() {
      _isRunning = true;
      _error = null;
      _diagnosticResults = null;
      _report = null;
    });

    try {
      // Step 1: Run diagnostics first
      safePrint('🔍 [TEST] Running diagnostics before Google sign-in...');
      final diagnostics = await GoogleSignInTest.runDiagnostics();
      final report = GoogleSignInTest.generateReport(diagnostics);
      
      setState(() {
        _diagnosticResults = diagnostics;
        _report = report;
      });

      safePrint('✅ [TEST] Diagnostics complete');
      safePrint(report);

      // Step 2: Attempt Google sign-in
      safePrint('🧪 [TEST] Attempting Google sign-in...');
      await AuthService.signInWithGoogle();
      safePrint('✅ [TEST] Google sign-in successful!');

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✅ Google sign-in successful! Navigating to main page...'),
            backgroundColor: Colors.green,
            duration: Duration(seconds: 2),
          ),
        );

        // Step 3: Navigate to main page after successful sign-in
        await Future.delayed(const Duration(milliseconds: 500));
        if (mounted) {
          context.go('/home');
          safePrint('✅ [TEST] Navigated to main page');
        }
      }
    } catch (e) {
      safePrint('❌ [TEST] Google sign-in failed: $e');
      setState(() {
        _error = e.toString();
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('❌ Google sign-in failed: $e'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 5),
          ),
        );
      }
    } finally {
      setState(() {
        _isRunning = false;
      });
    }
  }

  Future<void> _checkCurrentUser() async {
    try {
      final user = await Amplify.Auth.getCurrentUser();
      if (mounted) {
        showDialog(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Current User'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('User ID: ${user.userId}'),
                Text('Username: ${user.username}'),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => context.pop(),
                child: const Text('OK'),
              ),
            ],
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        showDialog(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('No User Signed In'),
            content: Text('Error: $e'),
            actions: [
              TextButton(
                onPressed: () => context.pop(),
                child: const Text('OK'),
              ),
            ],
          ),
        );
      }
    }
  }

  Future<void> _signOut() async {
    try {
      await AuthService.signOut();
      if (mounted) {
        context.read<AuthBloc>().add(const SignOut());
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✅ Signed out successfully'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('❌ Sign out failed: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  void initState() {
    super.initState();
    // Automatically run diagnostics and test sign-in when screen loads
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _testGoogleSignIn();
    });
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<AuthBloc, AuthState>(
      listener: (context, state) {
        // Listen for successful authentication and navigate to main page
        if (state is AuthAuthenticated) {
          safePrint('✅ [TEST] AuthAuthenticated detected, navigating to main page...');
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) {
              Navigator.of(context, rootNavigator: true).pushNamedAndRemoveUntil(
                '/home',
                (route) => false,
              );
            }
          });
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Google Sign-In Test'),
          backgroundColor: const Color(0xFF2C6EF2),
          foregroundColor: Colors.white,
        ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header
            Card(
              color: const Color(0xFF2C6EF2),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    const Icon(
                      Icons.bug_report,
                      size: 48,
                      color: Colors.white,
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Google Sign-In Diagnostics',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Run diagnostics to identify configuration issues',
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.white70,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Action Buttons
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                ElevatedButton.icon(
                  onPressed: _isRunning ? null : _runDiagnostics,
                  icon: _isRunning
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.search),
                  label: const Text('Run Diagnostics'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2C6EF2),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 24,
                      vertical: 12,
                    ),
                  ),
                ),
                ElevatedButton.icon(
                  onPressed: _isRunning ? null : _testGoogleSignIn,
                  icon: const Icon(Icons.login),
                  label: const Text('Test Google Sign-In'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 24,
                      vertical: 12,
                    ),
                  ),
                ),
                OutlinedButton.icon(
                  onPressed: _checkCurrentUser,
                  icon: const Icon(Icons.person),
                  label: const Text('Check Current User'),
                ),
                OutlinedButton.icon(
                  onPressed: _signOut,
                  icon: const Icon(Icons.logout),
                  label: const Text('Sign Out'),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Error Display
            if (_error != null)
              Card(
                color: Colors.red[50],
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.error, color: Colors.red[700]),
                          const SizedBox(width: 8),
                          Text(
                            'Error',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: Colors.red[700],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _error!,
                        style: TextStyle(color: Colors.red[900]),
                      ),
                    ],
                  ),
                ),
              ),

            // Diagnostic Report
            if (_report != null) ...[
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.assessment, color: Colors.blue[700]),
                          const SizedBox(width: 8),
                          Text(
                            'Diagnostic Report',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: Colors.blue[700],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.grey[100],
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.grey[300]!),
                        ),
                        child: SelectableText(
                          _report!,
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],

            // Test Results Summary
            if (_diagnosticResults != null) ...[
              const SizedBox(height: 16),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Test Summary',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Colors.grey[800],
                        ),
                      ),
                      const SizedBox(height: 12),
                      _buildSummaryItem(
                        'Errors',
                        (_diagnosticResults!['errors'] as List).length,
                        Colors.red,
                      ),
                      _buildSummaryItem(
                        'Warnings',
                        (_diagnosticResults!['warnings'] as List).length,
                        Colors.orange,
                      ),
                      _buildSummaryItem(
                        'Recommendations',
                        (_diagnosticResults!['recommendations'] as List).length,
                        Colors.blue,
                      ),
                    ],
                  ),
                ),
              ),
            ],

            const SizedBox(height: 32),
          ],
        ),
      ),
    ));
  }

  Widget _buildSummaryItem(String label, int count, Color color) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Container(
            width: 12,
            height: 12,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            '$label: ',
            style: const TextStyle(fontWeight: FontWeight.w500),
          ),
          Text(
            '$count',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

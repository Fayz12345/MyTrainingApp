import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/auth/auth_bloc.dart';
import '../services/connection_test.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? _connectionStatus;
  Map<String, dynamic>? _loginStatus;
  bool _isTesting = false;
  bool _isTestingLogin = false;

  Future<void> _testConnection() async {
    if (!mounted) return;

    setState(() {
      _isTesting = true;
    });

    final result = await ConnectionTest.testAmplifyConnection();

    if (!mounted) return;

    setState(() {
      _connectionStatus = result;
      _isTesting = false;
    });
  }

  Future<void> _testLogin() async {
    if (!mounted) return;

    setState(() {
      _isTestingLogin = true;
    });

    final result = await ConnectionTest.testLoginFunctionality();

    if (!mounted) return;

    setState(() {
      _loginStatus = result;
      _isTestingLogin = false;
    });
  }

  @override
  void initState() {
    super.initState();
    _testConnection();
    _testLogin();
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthBloc, AuthState>(
      builder: (context, state) {
        String? username;

        if (state is AuthAuthenticated) {
          username = state.username;
        }

        final connectionInfo = ConnectionTest.getConnectionInfo();

        return Scaffold(
          appBar: AppBar(
            title: const Text('Profile'),
            backgroundColor: const Color(0xFF007AFF),
            foregroundColor: Colors.white,
          ),
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(20.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // User Info
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      children: [
                        const Text(
                          'Profile',
                          style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                            color: Colors.black87,
                          ),
                        ),
                        const SizedBox(height: 20),
                        Text(
                          'Welcome, ${username ?? 'User'}!',
                          style: TextStyle(
                            fontSize: 16,
                            color: Colors.grey[600],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                // Database Connection Info
                Card(
                  color: Colors.blue[50],
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Database Information',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 12),
                        _buildInfoRow(
                            'Registration DB', connectionInfo['auth_database']),
                        _buildInfoRow(
                            'Data Storage', connectionInfo['database_type']),
                        _buildInfoRow(
                            'API Type', connectionInfo['database_access']),
                        _buildInfoRow('Region', connectionInfo['region']),
                        _buildInfoRow(
                            'User Pool ID', connectionInfo['user_pool_id']),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                // Connection Test
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'Connection Status',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 12),
                        ElevatedButton.icon(
                          onPressed: _isTesting ? null : _testConnection,
                          icon: _isTesting
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Icon(Icons.refresh),
                          label: Text(
                              _isTesting ? 'Testing...' : 'Test Connection'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF007AFF),
                            foregroundColor: Colors.white,
                          ),
                        ),
                        if (_connectionStatus != null) ...[
                          const SizedBox(height: 16),
                          _buildStatusRow(
                            'Amplify Configured',
                            _connectionStatus!['amplifyConfigured'] ?? false,
                          ),
                          _buildStatusRow(
                            'Cognito Connected',
                            _connectionStatus!['cognitoConnected'] ?? false,
                          ),
                          _buildStatusRow(
                            'GraphQL/DynamoDB Connected',
                            _connectionStatus!['graphqlConnected'] ?? false,
                          ),
                          const Divider(),
                          _buildStatusRow(
                            'Overall Status',
                            _connectionStatus!['overallStatus'] ?? false,
                            isMain: true,
                          ),
                          if (_connectionStatus!['error'] != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 8.0),
                              child: Text(
                                'Error: ${_connectionStatus!['error']}',
                                style: const TextStyle(
                                    color: Colors.red, fontSize: 12),
                              ),
                            ),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                // Login Test
                Card(
                  color: Colors.green[50],
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'Login Test',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 12),
                        ElevatedButton.icon(
                          onPressed: _isTestingLogin ? null : _testLogin,
                          icon: _isTestingLogin
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Icon(Icons.login),
                          label: Text(_isTestingLogin
                              ? 'Testing Login...'
                              : 'Test Login Functionality'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.green,
                            foregroundColor: Colors.white,
                          ),
                        ),
                        if (_loginStatus != null) ...[
                          const SizedBox(height: 16),
                          _buildStatusRow(
                            'Login Configured',
                            _loginStatus!['loginConfigured'] ?? false,
                          ),
                          _buildStatusRow(
                            'Can Login',
                            _loginStatus!['canLogin'] ?? false,
                          ),
                          if (_loginStatus!['isLoggedIn'] == true) ...[
                            _buildStatusRow(
                              'User Logged In',
                              true,
                            ),
                            if (_loginStatus!['username'] != null)
                              Padding(
                                padding: const EdgeInsets.only(left: 28.0),
                                child: Text(
                                  'Username: ${_loginStatus!['username']}',
                                  style: const TextStyle(fontSize: 12),
                                ),
                              ),
                            _buildStatusRow(
                              'Session Valid',
                              _loginStatus!['sessionValid'] ?? false,
                            ),
                            _buildStatusRow(
                              'Is Employee',
                              _loginStatus!['isEmployee'] ?? false,
                            ),
                          ] else ...[
                            _buildStatusRow(
                              'User Logged In',
                              false,
                            ),
                            Padding(
                              padding:
                                  const EdgeInsets.only(top: 8.0, left: 28.0),
                              child: Text(
                                _loginStatus!['loginStatus'] ?? 'Not logged in',
                                style: TextStyle(
                                  color: Colors.grey[700],
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ],
                          if (_loginStatus!['error'] != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 8.0),
                              child: Text(
                                'Error: ${_loginStatus!['error']}',
                                style: const TextStyle(
                                    color: Colors.red, fontSize: 12),
                              ),
                            ),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                // Sign Out Button
                ElevatedButton(
                  onPressed: () {
                    context.read<AuthBloc>().add(const SignOut());
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 12,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: const Text(
                    'Sign Out',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              '$label:',
              style: const TextStyle(fontWeight: FontWeight.w500),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusRow(String label, bool status, {bool isMain = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        children: [
          Icon(
            status ? Icons.check_circle : Icons.error,
            color: status ? Colors.green : Colors.red,
            size: isMain ? 24 : 20,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontWeight: isMain ? FontWeight.bold : FontWeight.normal,
                fontSize: isMain ? 16 : 14,
              ),
            ),
          ),
          Text(
            status ? 'Connected' : 'Failed',
            style: TextStyle(
              color: status ? Colors.green : Colors.red,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}

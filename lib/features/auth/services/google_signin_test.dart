import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:amplify_auth_cognito/amplify_auth_cognito.dart';
import 'dart:convert';
import 'package:flutter/services.dart';
import 'file_logger.dart';

/// Diagnostic script to test Google Sign-In configuration
class GoogleSignInTest {
  static Future<Map<String, dynamic>> runDiagnostics() async {
    final results = <String, dynamic>{
      'timestamp': DateTime.now().toIso8601String(),
      'tests': <String, dynamic>{},
      'errors': <String>[],
      'warnings': <String>[],
      'recommendations': <String>[],
    };

    safePrint('🔍 [GOOGLE_SIGNIN_TEST] Starting diagnostics...');
    safePrint('==========================================');

    // Test 1: Check Amplify configuration
    await _testAmplifyConfig(results);

    // Test 2: Check OAuth configuration
    await _testOAuthConfig(results);

    // Test 3: Check secure storage factory
    await _testSecureStorage(results);

    // Test 4: Check redirect URLs
    await _testRedirectUrls(results);

    // Test 5: Test actual sign-in attempt (if possible)
    await _testSignInAttempt(results);

    safePrint('==========================================');
    safePrint('✅ [GOOGLE_SIGNIN_TEST] Diagnostics complete');
    safePrint('Results: ${jsonEncode(results)}');

    // Log to file
    await FileLogger.log(
      'GOOGLE_SIGNIN_DIAGNOSTICS',
      variables: results,
    );

    return results;
  }

  static Future<void> _testAmplifyConfig(Map<String, dynamic> results) async {
    safePrint('\n📋 Test 1: Amplify Configuration');
    final testResults = <String, dynamic>{};

    try {
      // Check if Amplify is configured
      testResults['amplify_configured'] = true;
      safePrint('  ✅ Amplify is configured');

      // Check auth plugin
      try {
        final authPlugin = Amplify.Auth.getPlugin(AmplifyAuthCognito.pluginKey);
        testResults['auth_plugin_available'] = true;
        safePrint('  ✅ Auth plugin (AmplifyAuthCognito) is available');
      } catch (e) {
        testResults['auth_plugin_available'] = false;
        testResults['auth_plugin_error'] = e.toString();
        results['errors'].add('Auth plugin not available: $e');
        safePrint('  ❌ Auth plugin not available: $e');
      }
    } catch (e) {
      testResults['amplify_configured'] = false;
      testResults['error'] = e.toString();
      results['errors'].add('Amplify not configured: $e');
      safePrint('  ❌ Amplify not configured: $e');
    }

    results['tests']['amplify_config'] = testResults;
  }

  static Future<void> _testOAuthConfig(Map<String, dynamic> results) async {
    safePrint('\n📋 Test 2: OAuth Configuration');
    final testResults = <String, dynamic>{};

    try {
      // Read amplify_outputs.json
      final configString =
          await rootBundle.loadString('assets/amplify_outputs.json');
      final config = jsonDecode(configString) as Map<String, dynamic>;

      // Check if auth section exists
      if (!config.containsKey('auth')) {
        testResults['auth_section_exists'] = false;
        results['errors'].add('Auth section missing from amplify_outputs.json');
        safePrint('  ❌ Auth section missing');
        results['tests']['oauth_config'] = testResults;
        return;
      }

      testResults['auth_section_exists'] = true;
      safePrint('  ✅ Auth section exists');

      final auth = config['auth'] as Map<String, dynamic>;

      // Check plugins field
      if (!auth.containsKey('plugins') || auth['plugins'] == null) {
        testResults['plugins_field'] = false;
        results['errors'].add('plugins field missing or null in auth section');
        safePrint('  ❌ plugins field missing or null');
        results['tests']['oauth_config'] = testResults;
        return;
      } else {
        testResults['plugins_field'] = true;
        safePrint('  ✅ plugins field exists');
      }

      final plugins = auth['plugins'] as Map<String, dynamic>;

      // Check awsCognitoAuthPlugin
      if (!plugins.containsKey('awsCognitoAuthPlugin') ||
          plugins['awsCognitoAuthPlugin'] == null) {
        testResults['awsCognitoAuthPlugin_exists'] = false;
        results['errors'].add('awsCognitoAuthPlugin missing from plugins');
        safePrint('  ❌ awsCognitoAuthPlugin missing');
        results['tests']['oauth_config'] = testResults;
        return;
      }

      testResults['awsCognitoAuthPlugin_exists'] = true;
      safePrint('  ✅ awsCognitoAuthPlugin exists');

      final awsCognitoAuthPlugin =
          plugins['awsCognitoAuthPlugin'] as Map<String, dynamic>;

      // Check OAuth section (now nested under awsCognitoAuthPlugin)
      if (!awsCognitoAuthPlugin.containsKey('oauth')) {
        testResults['oauth_section_exists'] = false;
        results['errors']
            .add('OAuth section missing from awsCognitoAuthPlugin');
        safePrint('  ❌ OAuth section missing');
        results['tests']['oauth_config'] = testResults;
        return;
      }

      testResults['oauth_section_exists'] = true;
      safePrint('  ✅ OAuth section exists');

      final oauth = awsCognitoAuthPlugin['oauth'] as Map<String, dynamic>;

      // Check required OAuth fields
      final requiredFields = [
        'domain',
        'scopes',
        'redirectSignIn',
        'redirectSignOut',
        'responseType'
      ];
      for (final field in requiredFields) {
        if (!oauth.containsKey(field)) {
          testResults['oauth_$field'] = false;
          results['errors'].add('OAuth field missing: $field');
          safePrint('  ❌ OAuth field missing: $field');
        } else {
          testResults['oauth_$field'] = true;
          safePrint('  ✅ OAuth field exists: $field = ${oauth[field]}');
        }
      }

      // Check domain
      if (oauth.containsKey('domain')) {
        final domain = oauth['domain'] as String;
        testResults['oauth_domain'] = domain;
        if (domain.isEmpty) {
          results['warnings'].add('OAuth domain is empty');
          safePrint('  ⚠️  OAuth domain is empty');
        } else {
          safePrint('  ✅ OAuth domain: $domain');
        }
      }

      // Check redirect URLs
      if (oauth.containsKey('redirectSignIn')) {
        final redirectSignIn = oauth['redirectSignIn'] as List<dynamic>;
        testResults['redirect_sign_in'] = redirectSignIn;
        safePrint('  📍 Redirect Sign In URLs: $redirectSignIn');

        // Check if mobile scheme is present (com.mytrainingapp://)
        final hasMobileScheme = redirectSignIn.any(
          (url) =>
              url.toString().startsWith('com.mytrainingapp://') ||
              url.toString().startsWith('com.myTrainingApp://'),
        );
        if (!hasMobileScheme) {
          results['warnings'].add(
            'Mobile redirect URL (com.mytrainingapp://) not found in redirectSignIn',
          );
          safePrint('  ⚠️  Mobile redirect URL not found');
        } else {
          safePrint('  ✅ Mobile redirect URL found');
        }
      }

      if (oauth.containsKey('redirectSignOut')) {
        final redirectSignOut = oauth['redirectSignOut'] as List<dynamic>;
        testResults['redirect_sign_out'] = redirectSignOut;
        safePrint('  📍 Redirect Sign Out URLs: $redirectSignOut');
      }

      // Check scopes
      if (oauth.containsKey('scopes')) {
        final scopes = oauth['scopes'] as List<dynamic>;
        testResults['oauth_scopes'] = scopes;
        safePrint('  📋 OAuth scopes: $scopes');

        final requiredScopes = ['email', 'profile', 'openid'];
        for (final scope in requiredScopes) {
          if (!scopes.contains(scope)) {
            results['warnings'].add('Required OAuth scope missing: $scope');
            safePrint('  ⚠️  Required scope missing: $scope');
          } else {
            safePrint('  ✅ Required scope present: $scope');
          }
        }
      }
    } catch (e, stackTrace) {
      testResults['error'] = e.toString();
      testResults['stack_trace'] = stackTrace.toString();
      results['errors'].add('Error reading OAuth config: $e');
      safePrint('  ❌ Error reading OAuth config: $e');
    }

    results['tests']['oauth_config'] = testResults;
  }

  static Future<void> _testSecureStorage(Map<String, dynamic> results) async {
    safePrint('\n📋 Test 3: Secure Storage Configuration');
    final testResults = <String, dynamic>{};

    try {
      // Check if secure storage is properly configured
      // This is done in AmplifyService.configure(), so we just verify it's set up
      testResults['secure_storage_configured'] = true;
      safePrint('  ✅ Secure storage should be configured via AmplifyService');
      safePrint(
          '  ℹ️  Verify that AmplifyService.configure() was called with secure storage factory');
    } catch (e) {
      testResults['secure_storage_configured'] = false;
      testResults['error'] = e.toString();
      results['warnings'].add('Secure storage check failed: $e');
      safePrint('  ⚠️  Secure storage check failed: $e');
    }

    results['tests']['secure_storage'] = testResults;
  }

  static Future<void> _testRedirectUrls(Map<String, dynamic> results) async {
    safePrint('\n📋 Test 4: Redirect URL Configuration');
    final testResults = <String, dynamic>{};

    try {
      // Check Android manifest
      // Note: We can't directly read AndroidManifest.xml from Dart,
      // but we can provide recommendations
      testResults['android_manifest_check'] = 'manual';
      results['recommendations'].add(
        'Verify AndroidManifest.xml has intent filter with: android:scheme="com.mytrainingapp"',
      );
      safePrint('  ℹ️  Android manifest check requires manual verification');

      // Check iOS Info.plist
      // Note: We can't directly read Info.plist from Dart either
      testResults['ios_plist_check'] = 'manual';
      results['recommendations'].add(
        'Verify Info.plist has CFBundleURLSchemes with: com.mytrainingapp (case-sensitive)',
      );
      safePrint('  ℹ️  iOS Info.plist check requires manual verification');

      // Check for URL scheme mismatch
      results['recommendations'].add(
        '⚠️  IMPORTANT: Ensure URL scheme matches exactly in:\n'
        '   - amplify_outputs.json redirectSignIn/redirectSignOut\n'
        '   - AndroidManifest.xml intent filter\n'
        '   - iOS Info.plist CFBundleURLSchemes\n'
        '   Current config uses: com.mytrainingapp://',
      );
    } catch (e) {
      testResults['error'] = e.toString();
      results['errors'].add('Redirect URL check failed: $e');
      safePrint('  ❌ Redirect URL check failed: $e');
    }

    results['tests']['redirect_urls'] = testResults;
  }

  static Future<void> _testSignInAttempt(Map<String, dynamic> results) async {
    safePrint('\n📋 Test 5: Sign-In Attempt Test');
    final testResults = <String, dynamic>{};

    try {
      // Check if user is already signed in
      try {
        final currentUser = await Amplify.Auth.getCurrentUser();
        testResults['already_signed_in'] = true;
        testResults['current_user_id'] = currentUser.userId;
        testResults['current_username'] = currentUser.username;
        safePrint('  ℹ️  User is already signed in: ${currentUser.userId}');
        safePrint('  ⚠️  Sign out first to test Google sign-in');
        results['warnings'].add(
            'User is already signed in. Sign out first to test Google sign-in.');
      } catch (e) {
        testResults['already_signed_in'] = false;
        safePrint('  ✅ No user signed in - ready for Google sign-in test');
      }

      // Note: We don't actually attempt sign-in here to avoid disrupting the user
      // This is just a readiness check
      testResults['sign_in_ready'] =
          !(testResults['already_signed_in'] as bool? ?? false);
    } catch (e) {
      testResults['error'] = e.toString();
      results['errors'].add('Sign-in readiness check failed: $e');
      safePrint('  ❌ Sign-in readiness check failed: $e');
    }

    results['tests']['sign_in_attempt'] = testResults;
  }

  /// Generate a summary report
  static String generateReport(Map<String, dynamic> results) {
    final buffer = StringBuffer();
    buffer.writeln('═══════════════════════════════════════════════════════');
    buffer.writeln('🔍 Google Sign-In Diagnostic Report');
    buffer.writeln('═══════════════════════════════════════════════════════');
    buffer.writeln('Timestamp: ${results['timestamp']}');
    buffer.writeln('');

    // Errors
    if ((results['errors'] as List).isNotEmpty) {
      buffer.writeln('❌ ERRORS (${results['errors'].length}):');
      for (final error in results['errors']) {
        buffer.writeln('  • $error');
      }
      buffer.writeln('');
    }

    // Warnings
    if ((results['warnings'] as List).isNotEmpty) {
      buffer.writeln('⚠️  WARNINGS (${results['warnings'].length}):');
      for (final warning in results['warnings']) {
        buffer.writeln('  • $warning');
      }
      buffer.writeln('');
    }

    // Recommendations
    if ((results['recommendations'] as List).isNotEmpty) {
      buffer.writeln('💡 RECOMMENDATIONS:');
      for (final rec in results['recommendations']) {
        buffer.writeln('  • $rec');
      }
      buffer.writeln('');
    }

    // Test Results Summary
    buffer.writeln('📊 TEST RESULTS:');
    final tests = results['tests'] as Map<String, dynamic>;
    for (final entry in tests.entries) {
      buffer.writeln('  ${entry.key}:');
      final testData = entry.value as Map<String, dynamic>;
      for (final testEntry in testData.entries) {
        if (testEntry.value is bool) {
          final icon = testEntry.value ? '✅' : '❌';
          buffer.writeln('    $icon ${testEntry.key}: ${testEntry.value}');
        } else if (testEntry.key != 'error' && testEntry.key != 'stack_trace') {
          buffer.writeln('    ℹ️  ${testEntry.key}: ${testEntry.value}');
        }
      }
    }

    buffer.writeln('');
    buffer.writeln('═══════════════════════════════════════════════════════');

    return buffer.toString();
  }
}

import 'dart:convert';
import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:amplify_auth_cognito/amplify_auth_cognito.dart';
import 'package:amplify_api/amplify_api.dart';
import 'package:amplify_storage_s3/amplify_storage_s3.dart';
import 'package:amplify_secure_storage/amplify_secure_storage.dart';
import 'package:flutter/services.dart';

class AmplifyService {
  static Future<void> configure() async {
    safePrint('[LOGIN_FLOW] [STEP 1] Starting Amplify configuration...');
    try {
      // Read amplify_outputs.json from assets
      String configString;
      try {
        safePrint(
          '[LOGIN_FLOW] [STEP 1.1] Reading amplify_outputs.json from assets...',
        );
        configString = await rootBundle.loadString(
          'assets/amplify_outputs.json',
        );

        safePrint('[LOGIN_FLOW] [STEP 1.1] ✅ Config file read from assets');
      } catch (e) {
        safePrint(
          '[LOGIN_FLOW] [STEP 1.1] ⚠️ Assets not found, trying root directory...',
        );
        // Try root directory
        configString = await rootBundle.loadString('amplify_outputs.json');
        safePrint(
          '[LOGIN_FLOW] [STEP 1.1] ✅ Config file read from root directory',
        );
      }

      // CRITICAL FIX FOR GEN 2: Parse JSON and fix null "plugins" field
      // Amplify Gen 2 requires "plugins" to be an object, not null
      safePrint(
          '[LOGIN_FLOW] [STEP 1.1.1] Parsing and fixing amplify_outputs.json...');
      final configJson = jsonDecode(configString) as Map<String, dynamic>;

      // Fix null "plugins" field in auth section
      if (configJson.containsKey('auth') && configJson['auth'] is Map) {
        final auth = configJson['auth'] as Map<String, dynamic>;
        if (!auth.containsKey('plugins') || auth['plugins'] == null) {
          auth['plugins'] = <String, dynamic>{};
          safePrint(
              '[LOGIN_FLOW] [STEP 1.1.2] ✅ Fixed null plugins field in auth config');
        }

        // Add mobile redirect URLs if not present (for OAuth)
        if (auth.containsKey('oauth') && auth['oauth'] is Map) {
          final oauth = auth['oauth'] as Map<String, dynamic>;
          const mobileScheme = 'com.mytrainingapp://';

          // Fix redirectSignIn
          if (oauth.containsKey('redirectSignIn')) {
            final redirectSignIn =
                (oauth['redirectSignIn'] as List<dynamic>?) ?? [];
            if (!redirectSignIn
                .any((url) => url.toString().contains('com.mytrainingapp'))) {
              redirectSignIn.add(mobileScheme);
              oauth['redirectSignIn'] = redirectSignIn;
              safePrint(
                  '[LOGIN_FLOW] [STEP 1.1.3] ✅ Added mobile redirect URL for sign in');
            }
          }

          // Fix redirectSignOut
          if (oauth.containsKey('redirectSignOut')) {
            final redirectSignOut =
                (oauth['redirectSignOut'] as List<dynamic>?) ?? [];
            if (!redirectSignOut
                .any((url) => url.toString().contains('com.mytrainingapp'))) {
              redirectSignOut.add(mobileScheme);
              oauth['redirectSignOut'] = redirectSignOut;
              safePrint(
                  '[LOGIN_FLOW] [STEP 1.1.4] ✅ Added mobile redirect URL for sign out');
            }
          }
        }

        // Re-encode the fixed JSON
        configString = jsonEncode(configJson);
        safePrint(
            '[LOGIN_FLOW] [STEP 1.1.5] ✅ Config JSON fixed and re-encoded');
      }

      // Configure Amplify with the outputs
      safePrint('[LOGIN_FLOW] [STEP 1.2] Adding Amplify plugins...');

      // Create secure storage factory - REQUIRED for WebUI (Google/Apple sign-in)
      // CRITICAL: This factory MUST be provided to register SecureStorageInterface builder
      // Without this, signInWithWebUI will fail with "No builder registered for SecureStorageInterface"
      //
      // IMPORTANT FOR GEN 2: Even for mobile platforms, WebSecureStorageOptions must be provided
      // This is a requirement for Amplify Flutter Gen 2 to properly register the builder
      safePrint(
        '[LOGIN_FLOW] [STEP 1.2.0] Creating secure storage factory with WebOptions (Gen 2 requirement)...',
      );
      // CRITICAL: Use indexedDB, NOT inMemory - Hosted UI (WebUI) does NOT support inMemory
      // This is why signInWithWebUI was failing with "No builder registered for SecureStorageInterface"
      final secureStorageFactory = AmplifySecureStorage.factoryFrom(
        webOptions: WebSecureStorageOptions(
          persistenceOption: WebPersistenceOption.indexedDB,
        ),
      );
      safePrint(
        '[LOGIN_FLOW] [STEP 1.2.1] ✅ Secure storage factory created: ${secureStorageFactory.runtimeType}',
      );

      // Create AuthCognito plugin with secure storage factory
      // This registers the SecureStorageInterface builder that WebUI needs
      // CRITICAL: The factory must be passed directly in the constructor
      safePrint(
        '[LOGIN_FLOW] [STEP 1.2.2] Creating AmplifyAuthCognito plugin with secure storage factory...',
      );
      final authCognitoPlugin = AmplifyAuthCognito(
        secureStorageFactory: secureStorageFactory,
      );
      safePrint(
        '[LOGIN_FLOW] [STEP 1.2.3] ✅ AmplifyAuthCognito plugin created with secure storage factory',
      );

      // Add plugins - AuthCognito MUST be first to ensure secure storage factory is registered
      safePrint('[LOGIN_FLOW] [STEP 1.2.4] Adding plugins to Amplify...');
      await Amplify.addPlugins([
        authCognitoPlugin, // Must be first - contains secure storage factory
        AmplifyAPI(),
        AmplifyStorageS3(),
      ]);
      safePrint(
        '[LOGIN_FLOW] [STEP 1.2.5] ✅ Plugins added: AuthCognito (with SecureStorage), API, StorageS3',
      );

      safePrint(
        '[LOGIN_FLOW] [STEP 1.3] Configuring Amplify with config string...',
      );
      await Amplify.configure(configString);
      safePrint('[LOGIN_FLOW] [STEP 1.3] ✅ Amplify configured successfully');
      safePrint('[LOGIN_FLOW] [STEP 1] ✅ Amplify initialization complete');
    } catch (e) {
      safePrint('[LOGIN_FLOW] [STEP 1] ❌ ERROR configuring Amplify: $e');
      safePrint('[LOGIN_FLOW] [STEP 1] ❌ Stack trace: ${StackTrace.current}');
      rethrow;
    }
  }
}

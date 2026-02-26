import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:amplify_auth_cognito/amplify_auth_cognito.dart';
import 'package:amplify_api/amplify_api.dart';
import 'package:amplify_storage_s3/amplify_storage_s3.dart';
import 'package:amplify_secure_storage/amplify_secure_storage.dart';
import 'package:flutter/services.dart';
import 'dart:convert';

class AmplifyService {
  static Future<void> configure() async {
    safePrint('[LOGIN_FLOW] [STEP 1] Starting Amplify configuration...');
    try {
      // Read amplify_outputs.json from assets
      safePrint(
          '[LOGIN_FLOW] [STEP 1.1] Reading amplify_outputs.json from assets...');
      final configString =
          await rootBundle.loadString('assets/amplify_outputs.json');
      safePrint('[LOGIN_FLOW] [STEP 1.1] ✅ Config file read from assets');

      // Configure Amplify with the outputs
      safePrint('[LOGIN_FLOW] [STEP 1.2] Adding Amplify plugins...');
      safePrint(
          '[LOGIN_FLOW] [STEP 1.2.1] Configuring AmplifyAuthCognito with secure storage...');

      // Configure AmplifyAuthCognito with secure storage factory for OAuth/WebUI
      // This is REQUIRED for OAuth/WebUI sign-in to work properly
      await Amplify.addPlugins([
        AmplifyAuthCognito(
          secureStorageFactory: AmplifySecureStorage.factoryFrom(),
        ),
        AmplifyAPI(),
        AmplifyStorageS3(),
      ]);
      safePrint(
          '[LOGIN_FLOW] [STEP 1.2] ✅ Plugins added: AuthCognito (with secure storage), API, StorageS3');

      safePrint(
          '[LOGIN_FLOW] [STEP 1.3] Configuring Amplify with config string...');

      // Debug: Check if CognitoUserPool is in the config
      try {
        final configMap = jsonDecode(configString) as Map<String, dynamic>;
        final auth = configMap['auth'] as Map<String, dynamic>?;
        if (auth != null) {
          final plugins = auth['plugins'] as Map<String, dynamic>?;
          if (plugins != null) {
            final awsCognitoAuthPlugin =
                plugins['awsCognitoAuthPlugin'] as Map<String, dynamic>?;
            if (awsCognitoAuthPlugin != null) {
              final cognitoUserPool = awsCognitoAuthPlugin['CognitoUserPool']
                  as Map<String, dynamic>?;
              if (cognitoUserPool != null) {
                safePrint(
                    '[LOGIN_FLOW] [STEP 1.3] ✅ CognitoUserPool found in config');
                safePrint(
                    '[LOGIN_FLOW] [STEP 1.3] CognitoUserPool: $cognitoUserPool');
              } else {
                safePrint(
                    '[LOGIN_FLOW] [STEP 1.3] ❌ CognitoUserPool NOT found in awsCognitoAuthPlugin');
              }
            } else {
              safePrint(
                  '[LOGIN_FLOW] [STEP 1.3] ❌ awsCognitoAuthPlugin NOT found in plugins');
            }
          } else {
            safePrint('[LOGIN_FLOW] [STEP 1.3] ❌ plugins NOT found in auth');
          }
        } else {
          safePrint('[LOGIN_FLOW] [STEP 1.3] ❌ auth section NOT found');
        }
      } catch (e) {
        safePrint(
            '[LOGIN_FLOW] [STEP 1.3] ⚠️ Error checking config structure: $e');
      }

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

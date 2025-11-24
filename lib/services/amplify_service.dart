import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:amplify_auth_cognito/amplify_auth_cognito.dart';
import 'package:amplify_api/amplify_api.dart';
import 'package:amplify_storage_s3/amplify_storage_s3.dart';
import 'package:flutter/services.dart';

class AmplifyService {
  static Future<void> configure() async {
    safePrint('[LOGIN_FLOW] [STEP 1] Starting Amplify configuration...');
    try {
      // Read amplify_outputs.json from assets
      String configString;
      try {
        safePrint(
            '[LOGIN_FLOW] [STEP 1.1] Reading amplify_outputs.json from assets...');
        configString =
            await rootBundle.loadString('assets/amplify_outputs.json');
        safePrint('[LOGIN_FLOW] [STEP 1.1] ✅ Config file read from assets');
      } catch (e) {
        safePrint(
            '[LOGIN_FLOW] [STEP 1.1] ⚠️ Assets not found, trying root directory...');
        // Try root directory
        configString = await rootBundle.loadString('amplify_outputs.json');
        safePrint(
            '[LOGIN_FLOW] [STEP 1.1] ✅ Config file read from root directory');
      }

      // Configure Amplify with the outputs
      safePrint('[LOGIN_FLOW] [STEP 1.2] Adding Amplify plugins...');
      await Amplify.addPlugins([
        AmplifyAuthCognito(),
        AmplifyAPI(),
        AmplifyStorageS3(),
      ]);
      safePrint(
          '[LOGIN_FLOW] [STEP 1.2] ✅ Plugins added: AuthCognito, API, StorageS3');

      safePrint(
          '[LOGIN_FLOW] [STEP 1.3] Configuring Amplify with config string...');
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

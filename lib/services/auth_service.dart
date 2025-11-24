import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:amplify_auth_cognito/amplify_auth_cognito.dart';
import 'file_logger.dart';

class AuthService {
  static Future<bool> checkIsEmployee() async {
    safePrint('[LOGIN_FLOW] [AUTH_SERVICE] checkIsEmployee() called');
    try {
      safePrint('[LOGIN_FLOW] [AUTH_SERVICE] Getting current user...');
      final user = await Amplify.Auth.getCurrentUser();
      safePrint('[LOGIN_FLOW] [AUTH_SERVICE] ✅ Current user: ${user.userId}');

      // Fetch auth session (React uses: fetchAuthSession({ forceRefresh: true }))
      // Note: Flutter's fetchAuthSession fetches fresh tokens by default
      safePrint(
          '[LOGIN_FLOW] [AUTH_SERVICE] Fetching auth session (fresh tokens)...');
      final session = await Amplify.Auth.fetchAuthSession();
      safePrint('[LOGIN_FLOW] [AUTH_SERVICE] ✅ Session fetched $session');

      if (session is CognitoAuthSession) {
        safePrint('[LOGIN_FLOW] [AUTH_SERVICE] Session is CognitoAuthSession $CognitoAuthSession');
        safePrint('[LOGIN_FLOW] [AUTH_SERVICE] Extracting ID token... ');
        final idToken = session.userPoolTokensResult.value.idToken;

        // Access claims as a map
        safePrint('[LOGIN_FLOW] [AUTH_SERVICE] Parsing token claims idToken... $idToken');
        final claimsMap = idToken.claims.toJson();
        safePrint('[LOGIN_FLOW] [AUTH_SERVICE] Claims keys: ${claimsMap.keys.toList()}');

        final groupsValue = claimsMap['cognito:groups'];
        safePrint('[LOGIN_FLOW] [AUTH_SERVICE] Groups value: $groupsValue (type: ${groupsValue.runtimeType})');

        // Normalize groups (EXACT SAME LOGIC AS REACT)
        // React: if (typeof groups === 'string') { groups = [groups]; } else if (!Array.isArray(groups)) { groups = []; }
        List<String> groups;
        if (groupsValue == null) {
          safePrint(
              '[LOGIN_FLOW] [AUTH_SERVICE] Groups is null, setting to empty array');
          groups = [];
        } else if (groupsValue is String) {
          // Convert string to array (React: if (typeof groups === 'string') groups = [groups])
          safePrint(
              '[LOGIN_FLOW] [AUTH_SERVICE] Groups is String: "$groupsValue", converting to array');
          groups = [groupsValue];
        } else if (groupsValue is List) {
          // Already an array
          safePrint('[LOGIN_FLOW] [AUTH_SERVICE] Groups is List: $groupsValue');
          groups = groupsValue.cast<String>();
        } else {
          // Not an array, set to empty (React: else if (!Array.isArray(groups)) groups = [])
          safePrint(
              '[LOGIN_FLOW] [AUTH_SERVICE] Groups is not array or string (type: ${groupsValue.runtimeType}), setting to empty array');
          groups = [];
        }

        safePrint('[LOGIN_FLOW] [AUTH_SERVICE] Normalized groups: $groups');

        // Check if 'Employees' is in groups (React: groups.includes('Employees'))
        final isEmployee = groups.contains('Employees');
        safePrint('[LOGIN_FLOW] [AUTH_SERVICE] Is Employee: $isEmployee');
        safePrint('[LOGIN_FLOW] [AUTH_SERVICE] ✅ Group check complete');

        // Log to file
        await FileLogger.logGroupCheck(
          isEmployee: isEmployee,
          groups: groups,
          claims: claimsMap,
        );

        return isEmployee;
      } else {
        safePrint(
            '[LOGIN_FLOW] [AUTH_SERVICE] ⚠️ Session is not CognitoAuthSession: ${session.runtimeType}');
      }

      safePrint('[LOGIN_FLOW] [AUTH_SERVICE] ❌ User is NOT an employee');
      await FileLogger.logGroupCheck(
        isEmployee: false,
        groups: [],
      );
      return false;
    } catch (e, stackTrace) {
      safePrint('[LOGIN_FLOW] [AUTH_SERVICE] ❌ ERROR checking user groups: $e');
      safePrint('[LOGIN_FLOW] [AUTH_SERVICE] ❌ Stack trace: $stackTrace');

      // Log error response
      await FileLogger.logCompleteAuthResponse(
        eventType: 'checkIsEmployee_Error',
        errorMessage: e.toString(),
        errorCode: e.runtimeType.toString(),
        stackTrace: stackTrace,
      );

      await FileLogger.logGroupCheck(
        isEmployee: false,
        groups: [],
      );
      return false;
    }
  }

  static Future<String?> getCurrentUserId() async {
    safePrint('[LOGIN_FLOW] [AUTH_SERVICE] getCurrentUserId() called');
    try {
      final user = await Amplify.Auth.getCurrentUser();
      safePrint('[LOGIN_FLOW] [AUTH_SERVICE] ✅ User ID: ${user.userId}');
      return user.userId;
    } catch (e) {
      safePrint(
          '[LOGIN_FLOW] [AUTH_SERVICE] ❌ ERROR getting current user ID: $e');
      return null;
    }
  }

  static Future<String?> getCurrentUsername() async {
    safePrint('[LOGIN_FLOW] [AUTH_SERVICE] getCurrentUsername() called');
    try {
      final user = await Amplify.Auth.getCurrentUser();
      safePrint('[LOGIN_FLOW] [AUTH_SERVICE] ✅ Username: ${user.username}');
      return user.username;
    } catch (e) {
      safePrint(
          '[LOGIN_FLOW] [AUTH_SERVICE] ❌ ERROR getting current username: $e');
      return null;
    }
  }

  static Future<void> signOut() async {
    safePrint('[LOGIN_FLOW] [AUTH_SERVICE] signOut() called');
    try {
      safePrint(
          '[LOGIN_FLOW] [AUTH_SERVICE] Calling Amplify.Auth.signOut()...');
      await Amplify.Auth.signOut();
      safePrint('[LOGIN_FLOW] [AUTH_SERVICE] ✅ Sign out successful');
    } catch (e) {
      safePrint('[LOGIN_FLOW] [AUTH_SERVICE] ❌ ERROR signing out: $e');
      rethrow;
    }
  }
}

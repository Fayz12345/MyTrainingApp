import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:amplify_auth_cognito/amplify_auth_cognito.dart';
import 'package:amplify_api/amplify_api.dart';
import 'file_logger.dart';
import 'dart:convert';

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
        safePrint(
            '[LOGIN_FLOW] [AUTH_SERVICE] Session is CognitoAuthSession $CognitoAuthSession');
        safePrint('[LOGIN_FLOW] [AUTH_SERVICE] Extracting ID token... ');
        final idToken = session.userPoolTokensResult.value.idToken;

        // Access claims as a map
        safePrint(
            '[LOGIN_FLOW] [AUTH_SERVICE] Parsing token claims idToken... $idToken');
        final claimsMap = idToken.claims.toJson();
        safePrint(
            '[LOGIN_FLOW] [AUTH_SERVICE] Claims keys: ${claimsMap.keys.toList()}');

        final groupsValue = claimsMap['cognito:groups'];
        safePrint(
            '[LOGIN_FLOW] [AUTH_SERVICE] Groups value: $groupsValue (type: ${groupsValue.runtimeType})');

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

  static Future<String?> getCurrentUserEmail() async {
    safePrint('[LOGIN_FLOW] [AUTH_SERVICE] getCurrentUserEmail() called');
    try {
      final session = await Amplify.Auth.fetchAuthSession();
      if (session is CognitoAuthSession) {
        final idToken = session.userPoolTokensResult.value.idToken;
        final claimsMap = idToken.claims.toJson();
        final email = claimsMap['email'] as String?;
        safePrint('[LOGIN_FLOW] [AUTH_SERVICE] ✅ Email: $email');
        return email;
      }
      return null;
    } catch (e) {
      safePrint(
          '[LOGIN_FLOW] [AUTH_SERVICE] ❌ ERROR getting current user email: $e');
      return null;
    }
  }

  static Future<String?> getEmployeeFullName() async {
    safePrint('[AUTH_SERVICE] getEmployeeFullName() called');
    try {
      final userId = await getCurrentUserId();
      if (userId == null) {
        safePrint('[AUTH_SERVICE] ❌ User ID is null');
        return null;
      }

      safePrint('[AUTH_SERVICE] Fetching employee data for userId: $userId');
      const query = '''
        query GetEmployeeName(\$userId: String!) {
          listEmployees(filter: { userId: { eq: \$userId } }) {
            items {
              id
              name
            }
          }
        }
      ''';

      final request = GraphQLRequest<String>(
        document: query,
        variables: {"userId": userId},
      );

      final response = await Amplify.API.query(request: request).response;
      final data = jsonDecode(response.data ?? '{}') as Map<String, dynamic>;
      
      final employees = data['listEmployees']?['items'] as List?;
      if (employees != null && employees.isNotEmpty) {
        final employee = employees[0] as Map<String, dynamic>;
        final name = employee['name'] as String?;
        safePrint('[AUTH_SERVICE] ✅ Employee full name: $name');
        return name;
      }

      safePrint('[AUTH_SERVICE] ⚠️ No employee record found');
      return null;
    } catch (e) {
      safePrint('[AUTH_SERVICE] ❌ ERROR getting employee full name: $e');
      return null;
    }
  }

  static Future<Map<String, String?>> getEmployeeInfo() async {
    safePrint('[AUTH_SERVICE] getEmployeeInfo() called');
    try {
      final userId = await getCurrentUserId();
      if (userId == null) {
        safePrint('[AUTH_SERVICE] ❌ User ID is null');
        return {'name': null, 'department': null};
      }

      safePrint('[AUTH_SERVICE] Fetching employee data for userId: $userId');
      const query = '''
        query GetEmployeeInfo(\$userId: String!) {
          listEmployees(filter: { userId: { eq: \$userId } }) {
            items {
              id
              name
              department
            }
          }
        }
      ''';

      final request = GraphQLRequest<String>(
        document: query,
        variables: {"userId": userId},
      );

      final response = await Amplify.API.query(request: request).response;
      final data = jsonDecode(response.data ?? '{}') as Map<String, dynamic>;
      
      final employees = data['listEmployees']?['items'] as List?;
      if (employees != null && employees.isNotEmpty) {
        final employee = employees[0] as Map<String, dynamic>;
        final name = employee['name'] as String?;
        final department = employee['department'] as String?;
        safePrint('[AUTH_SERVICE] ✅ Employee name: $name, department: $department');
        return {'name': name, 'department': department};
      }

      safePrint('[AUTH_SERVICE] ⚠️ No employee record found');
      return {'name': null, 'department': null};
    } catch (e) {
      safePrint('[AUTH_SERVICE] ❌ ERROR getting employee info: $e');
      return {'name': null, 'department': null};
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
// lkogin amnd  reg.
  static Future<void> signIn({
    required String email,
    required String password,
  }) async {
    safePrint('[LOGIN_FLOW] [AUTH_SERVICE] signIn() called');
    try {
      safePrint('[LOGIN_FLOW] [AUTH_SERVICE] Calling Amplify.Auth.signIn()...');
      final result = await Amplify.Auth.signIn(
        username: email,
        password: password,
      );
      safePrint('[LOGIN_FLOW] [AUTH_SERVICE] ✅ Sign in successful');
      safePrint('[LOGIN_FLOW] [AUTH_SERVICE] Sign in result: $result');

      // Check if sign in requires additional steps (e.g., new password required)
      if (result.isSignedIn) {
        safePrint('[LOGIN_FLOW] [AUTH_SERVICE] User is fully signed in');
      } else {
        safePrint(
            '[LOGIN_FLOW] [AUTH_SERVICE] Sign in requires additional steps');
        // Handle additional steps if needed (e.g., new password, MFA)
        throw Exception(
            'Sign in requires additional steps. Please check your email for verification.');
      }
    } catch (e) {
      safePrint('[LOGIN_FLOW] [AUTH_SERVICE] ❌ ERROR signing in: $e');
      // Provide user-friendly error messages
      if (e.toString().contains('NotAuthorizedException')) {
        throw Exception('Incorrect email or password. Please try again.');
      } else if (e.toString().contains('UserNotConfirmedException')) {
        throw Exception('Please verify your email address before signing in.');
      } else if (e.toString().contains('UserNotFoundException')) {
        throw Exception('No account found with this email address.');
      } else {
        rethrow;
      }
    }
  }


  static Future<void> signUp({
    required String email,
    required String password,
  }) async {
    safePrint('[LOGIN_FLOW] [AUTH_SERVICE] signUp() called');
    try {
      safePrint('[LOGIN_FLOW] [AUTH_SERVICE] Calling Amplify.Auth.signUp()...');
      final userAttributes = {
        AuthUserAttributeKey.email: email,
      };

      final result = await Amplify.Auth.signUp(
        username: email,
        password: password,
        options: SignUpOptions(
          userAttributes: userAttributes,
        ),
      );

      safePrint('[LOGIN_FLOW] [AUTH_SERVICE] ✅ Sign up successful');
      safePrint('[LOGIN_FLOW] [AUTH_SERVICE] Sign up result: $result');

      // Check if confirmation is required
      if (result.nextStep.signUpStep == AuthSignUpStep.confirmSignUp) {
        safePrint('[LOGIN_FLOW] [AUTH_SERVICE] Email confirmation required');
        throw Exception(
            'Please check your email for a verification code to complete registration.');
      }
    } catch (e) {
      safePrint('[LOGIN_FLOW] [AUTH_SERVICE] ❌ ERROR signing up: $e');
      // Provide user-friendly error messages
      if (e.toString().contains('UsernameExistsException')) {
        throw Exception(
            'An account with this email already exists. Please sign in instead.');
      } else if (e.toString().contains('InvalidPasswordException')) {
        throw Exception(
            'Password does not meet requirements. Please use a stronger password.');
      } else if (e.toString().contains('InvalidParameterException')) {
        throw Exception('Invalid email address. Please check and try again.');
      } else {
        rethrow;
      }
    }
  }

  static Future<void> resetPassword({
    required String email,
  }) async {
    safePrint('[LOGIN_FLOW] [AUTH_SERVICE] resetPassword() called');
    try {
      safePrint(
          '[LOGIN_FLOW] [AUTH_SERVICE] Calling Amplify.Auth.resetPassword()...');
      final result = await Amplify.Auth.resetPassword(
        username: email,
      );
      safePrint(
          '[LOGIN_FLOW] [AUTH_SERVICE] ✅ Reset password request successful');
      safePrint('[LOGIN_FLOW] [AUTH_SERVICE] Reset password result: $result');

      // Check if code delivery is required
      if (result.nextStep.updateStep ==
          AuthResetPasswordStep.confirmResetPasswordWithCode) {
        safePrint('[LOGIN_FLOW] [AUTH_SERVICE] Code delivery required');
      }
    } catch (e) {
      safePrint('[LOGIN_FLOW] [AUTH_SERVICE] ❌ ERROR resetting password: $e');
      // Provide user-friendly error messages
      if (e.toString().contains('UserNotFoundException')) {
        throw Exception('No account found with this email address.');
      } else if (e.toString().contains('LimitExceededException')) {
        throw Exception('Too many attempts. Please try again later.');
      } else {
        rethrow;
      }
    }
  }

  static Future<void> confirmResetPassword({
    required String email,
    required String newPassword,
    required String confirmationCode,
  }) async {
    safePrint('[LOGIN_FLOW] [AUTH_SERVICE] confirmResetPassword() called');
    try {
      safePrint(
          '[LOGIN_FLOW] [AUTH_SERVICE] Calling Amplify.Auth.confirmResetPassword()...');
      await Amplify.Auth.confirmResetPassword(
        username: email,
        newPassword: newPassword,
        confirmationCode: confirmationCode,
      );
      safePrint(
          '[LOGIN_FLOW] [AUTH_SERVICE] ✅ Password reset confirmed successfully');
    } catch (e) {
      safePrint(
          '[LOGIN_FLOW] [AUTH_SERVICE] ❌ ERROR confirming password reset: $e');
      // Provide user-friendly error messages
      if (e.toString().contains('CodeMismatchException')) {
        throw Exception(
            'Invalid verification code. Please check and try again.');
      } else if (e.toString().contains('ExpiredCodeException')) {
        throw Exception(
            'Verification code has expired. Please request a new one.');
      } else if (e.toString().contains('InvalidPasswordException')) {
        throw Exception(
            'Password does not meet requirements. Please use a stronger password.');
      } else {
        rethrow;
      }
    }
  }

  static Future<void> confirmSignUp({
    required String email,
    required String confirmationCode,
  }) async {
    safePrint('[LOGIN_FLOW] [AUTH_SERVICE] confirmSignUp() called');
    try {
      safePrint(
          '[LOGIN_FLOW] [AUTH_SERVICE] Calling Amplify.Auth.confirmSignUp()...');
      await Amplify.Auth.confirmSignUp(
        username: email,
        confirmationCode: confirmationCode,
      );
      safePrint('[LOGIN_FLOW] [AUTH_SERVICE] ✅ Sign up confirmed successfully');
    } catch (e) {
      safePrint('[LOGIN_FLOW] [AUTH_SERVICE] ❌ ERROR confirming sign up: $e');
      // Provide user-friendly error messages
      if (e.toString().contains('CodeMismatchException')) {
        throw Exception(
            'Invalid verification code. Please check and try again.');
      } else if (e.toString().contains('ExpiredCodeException')) {
        throw Exception(
            'Verification code has expired. Please request a new one.');
      } else if (e.toString().contains('NotAuthorizedException')) {
        throw Exception('This code has already been used.');
      } else {
        rethrow;
      }
    }
  }

  static Future<void> signInWithGoogle() async {
    safePrint('[LOGIN_FLOW] [AUTH_SERVICE] signInWithGoogle() called');
    try {
      safePrint(
          '[LOGIN_FLOW] [AUTH_SERVICE] Calling Amplify.Auth.signInWithWebUI() with Google provider...');
      final result = await Amplify.Auth.signInWithWebUI(
        provider: AuthProvider.google,
      );
      safePrint('[LOGIN_FLOW] [AUTH_SERVICE] ✅ Google login success: $result');
    } catch (e) {
      safePrint('[LOGIN_FLOW] [AUTH_SERVICE] ❌ Google login error: $e');
      // Provide user-friendly error messages
      if (e.toString().contains('UserCancelledException') ||
          e.toString().contains('UserCancelled')) {
        throw Exception('Sign in was cancelled.');
      } else if (e.toString().contains('NetworkException')) {
        throw Exception(
            'Network error. Please check your internet connection and try again.');
      } else if (e.toString().contains('InvalidAccountTypeException') ||
          e.toString().contains('No user pool registered')) {
        throw Exception('GOOGLE_LOGIN_NOT_AVAILABLE');
      } else {
        throw Exception('GOOGLE_LOGIN_NOT_AVAILABLE');
      }
    }
  }

  static Future<void> signInWithApple() async {
    safePrint('[LOGIN_FLOW] [AUTH_SERVICE] signInWithApple() called');
    try {
      safePrint(
          '[LOGIN_FLOW] [AUTH_SERVICE] Calling Amplify.Auth.signInWithWebUI() with Apple provider...');
      final result = await Amplify.Auth.signInWithWebUI(
        provider: AuthProvider.apple,
      );
      safePrint('[LOGIN_FLOW] [AUTH_SERVICE] ✅ Apple login success: $result');
    } catch (e) {
      safePrint('[LOGIN_FLOW] [AUTH_SERVICE] ❌ Apple login error: $e');
      // Provide user-friendly error messages
      if (e.toString().contains('UserCancelledException') ||
          e.toString().contains('UserCancelled')) {
        throw Exception('Sign in was cancelled.');
      } else if (e.toString().contains('NetworkException')) {
        throw Exception(
            'Network error. Please check your internet connection and try again.');
      } else if (e.toString().contains('InvalidAccountTypeException') ||
          e.toString().contains('No user pool registered')) {
        throw Exception('APPLE_LOGIN_NOT_AVAILABLE');
      } else {
        throw Exception('APPLE_LOGIN_NOT_AVAILABLE');
      }
    }
  }

}

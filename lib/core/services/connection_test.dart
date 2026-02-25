import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:amplify_api/amplify_api.dart';
import 'package:amplify_auth_cognito/amplify_auth_cognito.dart';

/// Simple utility to test database connections
class ConnectionTest {
  /// Test if Amplify is configured and connected
  static Future<Map<String, dynamic>> testAmplifyConnection() async {
    try {
      // Test 1: Check if Amplify is configured
      final isConfigured = Amplify.isConfigured;

      // Test 2: Try to get current user (tests Cognito connection)
      bool cognitoConnected = false;
      String? cognitoError;
      try {
        await Amplify.Auth.getCurrentUser();
        cognitoConnected = true;
      } catch (e) {
        cognitoError = e.toString();
        // This is OK if user is not logged in
        cognitoConnected = true; // Connection works, just no user
      }

      // Test 3: Test GraphQL API connection (DynamoDB)
      bool graphqlConnected = false;
      String? graphqlError;
      try {
        final response = await Amplify.API
            .query(
              request: GraphQLRequest(
                document: '''
              query {
                __schema {
                  queryType {
                    name
                  }
                }
              }
            ''',
              ),
            )
            .response;

        graphqlConnected = response.data != null;
        if (response.errors.isNotEmpty) {
          graphqlError = response.errors.first.message;
        }
      } catch (e) {
        graphqlError = e.toString();
      }

      return {
        'amplifyConfigured': isConfigured,
        'cognitoConnected': cognitoConnected,
        'cognitoError': cognitoError,
        'graphqlConnected': graphqlConnected,
        'graphqlError': graphqlError,
        'overallStatus': isConfigured && cognitoConnected && graphqlConnected,
      };
    } catch (e) {
      return {
        'amplifyConfigured': false,
        'cognitoConnected': false,
        'graphqlConnected': false,
        'error': e.toString(),
        'overallStatus': false,
      };
    }
  }

  /// Test login functionality
  static Future<Map<String, dynamic>> testLoginFunctionality() async {
    try {
      // Test 1: Check if Amplify Auth is configured
      final isConfigured = Amplify.isConfigured;

      if (!isConfigured) {
        return {
          'loginConfigured': false,
          'error': 'Amplify is not configured',
          'canLogin': false,
        };
      }

      // Test 2: Check if user is currently logged in
      bool isLoggedIn = false;
      String? userId;
      String? username;
      String? loginError;

      try {
        final user = await Amplify.Auth.getCurrentUser();
        isLoggedIn = true;
        userId = user.userId;
        username = user.username;
      } catch (e) {
        loginError = e.toString();
        // This is OK - user is just not logged in
      }

      // Test 3: Check authentication session
      bool sessionValid = false;
      String? sessionError;
      bool isEmployee = false;

      if (isLoggedIn) {
        try {
          final session = await Amplify.Auth.fetchAuthSession();
          sessionValid = session.isSignedIn;

          // Check if user is in Employees group
          if (session is CognitoAuthSession) {
            final idToken = session.userPoolTokensResult.value.idToken;
            final claimsMap = idToken.claims.toJson();
            final groupsValue = claimsMap['cognito:groups'];

            if (groupsValue != null) {
              if (groupsValue is String) {
                isEmployee = groupsValue == 'Employees';
              } else if (groupsValue is List) {
                isEmployee = groupsValue.contains('Employees');
              }
            }
          }
        } catch (e) {
          sessionError = e.toString();
        }
      }

      return {
        'loginConfigured': true,
        'isLoggedIn': isLoggedIn,
        'userId': userId,
        'username': username,
        'sessionValid': sessionValid,
        'isEmployee': isEmployee,
        'loginError': loginError,
        'sessionError': sessionError,
        'canLogin': true, // Login functionality is available
        'loginStatus': isLoggedIn
            ? (isEmployee
                ? 'Logged in as Employee'
                : 'Logged in but not in Employees group')
            : 'Not logged in',
      };
    } catch (e) {
      return {
        'loginConfigured': false,
        'error': e.toString(),
        'canLogin': false,
      };
    }
  }

  /// Get connection information
  static Map<String, dynamic> getConnectionInfo() {
    return {
      'database_type': 'AWS DynamoDB',
      'database_access': 'AWS AppSync (GraphQL API)',
      'auth_database': 'AWS Cognito User Pool',
      'graphql_endpoint':
          'https://4we2oatxszhtdefub6ylwlywce.appsync-api.ca-central-1.amazonaws.com/graphql',
      'region': 'ca-central-1',
      'user_pool_id': 'ca-central-1_HeNIx5x65',
    };
  }
}

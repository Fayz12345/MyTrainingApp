import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:amplify_flutter/amplify_flutter.dart' hide Emitter;
import 'package:amplify_auth_cognito/amplify_auth_cognito.dart';
import '../../services/auth_service.dart';
import '../../services/file_logger.dart';

part 'auth_event.dart';
part 'auth_state.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  AuthBloc() : super(const AuthInitial()) {
    on<CheckUserGroups>(_onCheckUserGroups);
    on<SignOut>(_onSignOut);
  }

  Future<void> _onCheckUserGroups(
    CheckUserGroups event,
    Emitter<AuthState> emit,
  ) async {
    safePrint('[LOGIN_FLOW] [STEP 2] AuthBloc: CheckUserGroups event received');
    safePrint('[LOGIN_FLOW] [STEP 2.1] Emitting AuthLoading state...');
    emit(const AuthLoading());

    try {
      // First check if user is authenticated
      safePrint('[LOGIN_FLOW] [STEP 2.2] Checking if user is authenticated...');
      try {
        final user = await Amplify.Auth.getCurrentUser();
        safePrint('[LOGIN_FLOW] [STEP 2.2] ✅ User is authenticated');
        safePrint('[LOGIN_FLOW] [STEP 2.2] User ID: ${user.userId}');
        safePrint('[LOGIN_FLOW] [STEP 2.2] Username: ${user.username}');
      } catch (e) {
        // User is not authenticated, let Authenticator handle it
        safePrint('[LOGIN_FLOW] [STEP 2.2] ❌ User is NOT authenticated: $e');
        safePrint(
            '[LOGIN_FLOW] [STEP 2.2] Emitting AuthUnauthenticated state (no user)');
        emit(const AuthUnauthenticated());
        return;
      }

      // User is authenticated, check their groups
      safePrint(
          '[LOGIN_FLOW] [STEP 2.3] User authenticated, checking employee group membership...');
      final isEmployee = await AuthService.checkIsEmployee();
      safePrint('[LOGIN_FLOW] [STEP 2.3] Employee check result: $isEmployee');

      if (!isEmployee) {
        safePrint('[LOGIN_FLOW] [STEP 2.3] ❌ User is NOT in Employees group');
        safePrint(
            '[LOGIN_FLOW] [STEP 2.3] Emitting AuthUnauthenticated state (not employee)');
        emit(const AuthUnauthenticated(
          message: 'Access denied. Employees only.',
        ));
        return;
      }

      safePrint(
          '[LOGIN_FLOW] [STEP 2.4] ✅ User is in Employees group, getting user details...');
      final username = await AuthService.getCurrentUsername();
      final userId = await AuthService.getCurrentUserId();
      safePrint('[LOGIN_FLOW] [STEP 2.4] Username: $username');
      safePrint('[LOGIN_FLOW] [STEP 2.4] User ID: $userId');

      // Get session data for logging
      try {
        final session = await Amplify.Auth.fetchAuthSession();
        Map<String, dynamic>? sessionData;
        Map<String, dynamic>? tokenData;
        List<String>? groups;

        if (session is CognitoAuthSession) {
          final idToken = session.userPoolTokensResult.value.idToken;
          final claimsMap = idToken.claims.toJson();
          final groupsValue = claimsMap['cognito:groups'];

          if (groupsValue is String) {
            groups = [groupsValue];
          } else if (groupsValue is List) {
            groups = groupsValue.cast<String>();
          }

          tokenData = {
            'token_type': 'ID Token',
            'issuer': claimsMap['iss'],
            'subject': claimsMap['sub'],
            'audience': claimsMap['aud'],
            'expiration': claimsMap['exp'],
            'issued_at': claimsMap['iat'],
            'auth_time': claimsMap['auth_time'],
          };

          sessionData = {
            'is_signed_in': session.isSignedIn,
          };
        }

        // Log authentication success to file
        await FileLogger.logAuthResult(
          success: true,
          userId: userId,
          username: username,
          groups: groups,
          sessionData: sessionData,
          tokenData: tokenData,
        );
      } catch (e) {
        safePrint(
            '[LOGIN_FLOW] [STEP 2.4] ⚠️ Error getting session data for logging: $e');
      }

      safePrint('[LOGIN_FLOW] [STEP 2.5] Emitting AuthAuthenticated state');
      emit(AuthAuthenticated(
        isEmployee: isEmployee,
        username: username,
        userId: userId,
      ));
      safePrint(
          '[LOGIN_FLOW] [STEP 2.5] ✅ Authentication successful! User can access app');
    } catch (e, stackTrace) {
      // If error checking groups, user might not be in Employees group
      safePrint('[LOGIN_FLOW] [STEP 2] ❌ ERROR checking user groups: $e');
      safePrint('[LOGIN_FLOW] [STEP 2] ❌ Stack trace: $stackTrace');
      safePrint(
          '[LOGIN_FLOW] [STEP 2] Emitting AuthUnauthenticated state (error)');

      // Log error response to file
      await FileLogger.logCompleteAuthResponse(
        eventType: 'CheckUserGroups_Error',
        errorMessage: e.toString(),
        errorCode: e.runtimeType.toString(),
        stackTrace: stackTrace,
      );

      await FileLogger.logAuthResult(
        success: false,
        error: e.toString(),
      );

      emit(const AuthUnauthenticated(
        message: 'Access denied. Employees only.',
      ));
    }
  }

  Future<void> _onSignOut(
    SignOut event,
    Emitter<AuthState> emit,
  ) async {
    safePrint('[LOGIN_FLOW] [SIGNOUT] SignOut event received');
    try {
      safePrint('[LOGIN_FLOW] [SIGNOUT] Calling AuthService.signOut()...');
      await AuthService.signOut();
      safePrint('[LOGIN_FLOW] [SIGNOUT] ✅ Sign out successful');
      safePrint('[LOGIN_FLOW] [SIGNOUT] Emitting AuthUnauthenticated state');
      emit(const AuthUnauthenticated());
    } catch (e) {
      safePrint('[LOGIN_FLOW] [SIGNOUT] ❌ ERROR signing out: $e');
      emit(AuthError('Failed to sign out: $e'));
    }
  }
}

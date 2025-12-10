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
    on<SignIn>(_onSignIn);
    on<SignUp>(_onSignUp);
    on<ConfirmSignUp>(_onConfirmSignUp);
    on<ResetPassword>(_onResetPassword);
    on<ConfirmResetPassword>(_onConfirmResetPassword);
    on<SignInWithGoogle>(_onSignInWithGoogle);
    on<SignInWithApple>(_onSignInWithApple);
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

  Future<void> _onSignIn(
    SignIn event,
    Emitter<AuthState> emit,
  ) async {
    safePrint('[LOGIN_FLOW] [SIGNIN] SignIn event received');
    emit(const AuthLoading());
    try {
      safePrint('[LOGIN_FLOW] [SIGNIN] Calling AuthService.signIn()...');
      await AuthService.signIn(
        email: event.email,
        password: event.password,
      );
      safePrint('[LOGIN_FLOW] [SIGNIN] ✅ Sign in successful');
      // After successful sign in, check user groups
      await _onCheckUserGroups(const CheckUserGroups(), emit);
    } catch (e) {
      safePrint('[LOGIN_FLOW] [SIGNIN] ❌ ERROR signing in: $e');
      emit(AuthError('Failed to sign in: ${e.toString()}'));
    }
  }

  Future<void> _onSignUp1(
    SignUp event,
    Emitter<AuthState> emit,
  ) async {
    safePrint('[LOGIN_FLOW] [SIGNUP] SignUp event received');
    emit(const AuthLoading());
    try {
      safePrint('[LOGIN_FLOW] [SIGNUP] Calling AuthService.signUp()...');
      await AuthService.signUp(
        email: event.email,
        password: event.password,
      );
      safePrint('[LOGIN_FLOW] [SIGNUP] ✅ Sign up successful');
      // After successful sign up, check user groups
      await _onCheckUserGroups(const CheckUserGroups(), emit);
    } catch (e) {
      safePrint('[LOGIN_FLOW] [SIGNUP] ❌ ERROR signing up: $e');
      // Check if this is a confirmation required error
      if (e.toString().contains('verification code')) {
        safePrint('[LOGIN_FLOW] [SIGNUP] Email confirmation required');
        emit(SignUpConfirmationRequired(
          email: event.email,
          password: event.password,
        ));
      } else {
        emit(AuthError('Failed to sign up: ${e.toString()}'));
      }
    }
  }



  Future<void> _onSignUp(
      SignUp event,
      Emitter<AuthState> emit,
      ) async {
    safePrint('[LOGIN_FLOW] [SIGNUP] SignUp event received');
    emit(const AuthLoading());
    try {
      safePrint('[LOGIN_FLOW] [SIGNUP] Calling AuthService.signUp()...');
      await AuthService.signUp(
        email: event.email,
        password: event.password,
      );
      safePrint('[LOGIN_FLOW] [SIGNUP] ✅ Sign up successful');
      // After successful sign up, check user groups
      await _onCheckUserGroups(const CheckUserGroups(), emit);
    } catch (e) {
      safePrint('[LOGIN_FLOW] [SIGNUP] ❌ ERROR signing up: $e');
      // Check if this is a confirmation required error
      if (e.toString().contains('verification code')) {
        safePrint('[LOGIN_FLOW] [SIGNUP] Email confirmation required');
        emit(SignUpConfirmationRequired(
          email: event.email,
          password: event.password,
        ));
      } else {
        emit(AuthError('Failed to sign up: ${e.toString()}'));
      }
    }
  }


/*
  Future<void> _onConfirmSignUp(
    ConfirmSignUp event,
    Emitter<AuthState> emit,
  ) async {
    safePrint('[LOGIN_FLOW] [CONFIRM_SIGNUP] ConfirmSignUp event received');
    emit(const AuthLoading());
    try {
      safePrint(
          '[LOGIN_FLOW] [CONFIRM_SIGNUP] Calling AuthService.confirmSignUp()...');
      await AuthService.confirmSignUp(
        email: event.email,
        confirmationCode: event.confirmationCode,
      );
      safePrint(
          '[LOGIN_FLOW] [CONFIRM_SIGNUP] ✅ Sign up confirmed successfully');

      // Emit success state - user needs to contact admin before accessing app
      safePrint(
          '[LOGIN_FLOW] [CONFIRM_SIGNUP] Account created successfully, showing success screen');
      emit(AccountCreatedSuccess(email: event.email));
    } catch (e) {
      safePrint('[LOGIN_FLOW] [CONFIRM_SIGNUP] ❌ ERROR confirming sign up: $e');
      emit(AuthError('Failed to confirm sign up: ${e.toString()}'));
    }
  }
 */


  Future<void> _onConfirmSignUp(
      ConfirmSignUp event,
      Emitter<AuthState> emit,
      ) async {
    safePrint('[LOGIN_FLOW] [CONFIRM_SIGNUP] ConfirmSignUp event received');
    emit(const AuthLoading());
    try {
      safePrint(
          '[LOGIN_FLOW] [CONFIRM_SIGNUP] Calling AuthService.confirmSignUp()...');
      await AuthService.confirmSignUp(
        email: event.email,
        confirmationCode: event.confirmationCode,
      );
      safePrint(
          '[LOGIN_FLOW] [CONFIRM_SIGNUP] ✅ Sign up confirmed successfully');

      // After successful confirmation, automatically sign in the user
      safePrint(
          '[LOGIN_FLOW] [CONFIRM_SIGNUP] Automatically signing in user...');
      await AuthService.signIn(
        email: event.email,
        password: event.password,
      );

      safePrint('[LOGIN_FLOW] [CONFIRM_SIGNUP] ✅ User signed in successfully');

      // After successful sign in, check user groups
      await _onCheckUserGroups(const CheckUserGroups(), emit);
    } catch (e) {
      safePrint('[LOGIN_FLOW] [CONFIRM_SIGNUP] ❌ ERROR confirming sign up: $e');
      emit(AuthError('Failed to confirm sign up: ${e.toString()}'));
    }
  }

  Future<void> _onResetPassword(
    ResetPassword event,
    Emitter<AuthState> emit,
  ) async {
    safePrint('[LOGIN_FLOW] [RESET_PASSWORD] ResetPassword event received');
    emit(const AuthLoading());
    try {
      safePrint(
          '[LOGIN_FLOW] [RESET_PASSWORD] Calling AuthService.resetPassword()...');
      await AuthService.resetPassword(email: event.email);
      safePrint(
          '[LOGIN_FLOW] [RESET_PASSWORD] ✅ Reset password request successful');
      emit(PasswordResetCodeSent(email: event.email));
    } catch (e) {
      safePrint('[LOGIN_FLOW] [RESET_PASSWORD] ❌ ERROR resetting password: $e');
      emit(AuthError('Failed to reset password: ${e.toString()}'));
    }
  }

  Future<void> _onConfirmResetPassword(
    ConfirmResetPassword event,
    Emitter<AuthState> emit,
  ) async {
    safePrint(
        '[LOGIN_FLOW] [CONFIRM_RESET_PASSWORD] ConfirmResetPassword event received');
    emit(const AuthLoading());
    try {
      safePrint(
          '[LOGIN_FLOW] [CONFIRM_RESET_PASSWORD] Calling AuthService.confirmResetPassword()...');
      await AuthService.confirmResetPassword(
        email: event.email,
        newPassword: event.newPassword,
        confirmationCode: event.confirmationCode,
      );
      safePrint(
          '[LOGIN_FLOW] [CONFIRM_RESET_PASSWORD] ✅ Password reset confirmed successfully');
      emit(const PasswordResetSuccess());
    } catch (e) {
      safePrint(
          '[LOGIN_FLOW] [CONFIRM_RESET_PASSWORD] ❌ ERROR confirming password reset: $e');
      emit(AuthError('Failed to confirm password reset: ${e.toString()}'));
    }
  }

  Future<void> _onSignInWithGoogle(
    SignInWithGoogle event,
    Emitter<AuthState> emit,
  ) async {
    safePrint('[LOGIN_FLOW] [SIGNIN_GOOGLE] SignInWithGoogle event received');
    emit(const AuthLoading());
    try {
      safePrint(
          '[LOGIN_FLOW] [SIGNIN_GOOGLE] Calling AuthService.signInWithGoogle()...');
      await AuthService.signInWithGoogle();
      safePrint('[LOGIN_FLOW] [SIGNIN_GOOGLE] ✅ Google sign in successful');
      // After successful sign in, check user groups
      await _onCheckUserGroups(const CheckUserGroups(), emit);
    } catch (e) {
      safePrint(
          '[LOGIN_FLOW] [SIGNIN_GOOGLE] ❌ ERROR signing in with Google: $e');
      // Don't show error if user cancelled
      if (e.toString().contains('cancelled') ||
          e.toString().contains('Cancelled')) {
        safePrint('[LOGIN_FLOW] [SIGNIN_GOOGLE] User cancelled sign in');
        emit(const AuthUnauthenticated());
      } else {
        // Pass through the error message (which may be GOOGLE_LOGIN_NOT_AVAILABLE)
        emit(AuthError(e.toString()));
      }
    }
  }

  Future<void> _onSignInWithApple(
    SignInWithApple event,
    Emitter<AuthState> emit,
  ) async {
    safePrint('[LOGIN_FLOW] [SIGNIN_APPLE] SignInWithApple event received');
    emit(const AuthLoading());
    try {
      safePrint(
          '[LOGIN_FLOW] [SIGNIN_APPLE] Calling AuthService.signInWithApple()...');
      await AuthService.signInWithApple();
      safePrint('[LOGIN_FLOW] [SIGNIN_APPLE] ✅ Apple sign in successful');
      // After successful sign in, check user groups
      await _onCheckUserGroups(const CheckUserGroups(), emit);
    } catch (e) {
      safePrint(
          '[LOGIN_FLOW] [SIGNIN_APPLE] ❌ ERROR signing in with Apple: $e');
      // Don't show error if user cancelled
      if (e.toString().contains('cancelled') ||
          e.toString().contains('Cancelled')) {
        safePrint('[LOGIN_FLOW] [SIGNIN_APPLE] User cancelled sign in');
        emit(const AuthUnauthenticated());
      } else {
        // Pass through the error message (which may be APPLE_LOGIN_NOT_AVAILABLE)
        emit(AuthError(e.toString()));
      }
    }
  }
}

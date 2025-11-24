import 'package:flutter/material.dart';
import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:amplify_authenticator/amplify_authenticator.dart';
import 'package:amplify_auth_cognito/amplify_auth_cognito.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'screens/course_list_screen.dart';
import 'screens/profile_screen.dart';
import 'services/amplify_service.dart';
import 'services/file_logger.dart';
import 'bloc/auth/auth_bloc.dart';

void main() async {
  safePrint('[LOGIN_FLOW] ========================================');
  safePrint('[LOGIN_FLOW] 🚀 APP STARTING');
  safePrint('[LOGIN_FLOW] ========================================');

  safePrint('[LOGIN_FLOW] Initializing Flutter binding...');
  WidgetsFlutterBinding.ensureInitialized();
  safePrint('[LOGIN_FLOW] ✅ Flutter binding initialized');

  try {
    // Initialize file logger
    safePrint('[LOGIN_FLOW] Initializing file logger...');
    await FileLogger.initialize();
    safePrint('[LOGIN_FLOW] ✅ File logger initialized');
    await FileLogger.log('APP STARTED', variables: {
      'timestamp': DateTime.now().toIso8601String(),
      'app_version': '1.0.0+1',
    });

    // Configure Amplify
    await AmplifyService.configure();
    safePrint('[LOGIN_FLOW] ✅ Amplify configured successfully');
    await FileLogger.log('AMPLIFY CONFIGURED', variables: {
      'status': 'success',
      'timestamp': DateTime.now().toIso8601String(),
    });
  } catch (e) {
    safePrint('[LOGIN_FLOW] ❌ ERROR configuring Amplify: $e');
    await FileLogger.log('AMPLIFY CONFIGURATION ERROR', variables: {
      'error': e.toString(),
      'timestamp': DateTime.now().toIso8601String(),
    });
  }

  safePrint('[LOGIN_FLOW] Running MyApp...');
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    safePrint('[LOGIN_FLOW] [MyApp] Building app widget...');
    safePrint(
        '[LOGIN_FLOW] [MyApp] Creating AuthBloc and triggering CheckUserGroups...');
    return MultiBlocProvider(
      providers: [
        BlocProvider(
          create: (context) {
            safePrint('[LOGIN_FLOW] [MyApp] Creating AuthBloc instance...');
            final bloc = AuthBloc();
            safePrint(
                '[LOGIN_FLOW] [MyApp] Triggering CheckUserGroups event...');
            bloc.add(const CheckUserGroups());
            return bloc;
          },
        ),
      ],
      child: Authenticator(
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          title: 'My Training App',
          theme: ThemeData(
            primarySwatch: Colors.blue,
            primaryColor: const Color(0xFF007AFF),
            useMaterial3: true,
          ),
          home: const AppContent(),
          builder: Authenticator.builder(),
        ),
      ),
    );
  }
}

class AppContent extends StatefulWidget {
  const AppContent({super.key});

  @override
  State<AppContent> createState() => _AppContentState();
}

class _AppContentState extends State<AppContent> {
  @override
  void initState() {
    super.initState();
    safePrint('[LOGIN_FLOW] [AppContent] Initializing...');

    // Listen to Amplify Hub events to track authentication
    safePrint('[LOGIN_FLOW] [AppContent] Setting up Amplify Hub listener...');
    final hubSubscription = Amplify.Hub.listen(HubChannel.Auth, (event) async {
      safePrint('[LOGIN_FLOW] ========================================');
      safePrint('[LOGIN_FLOW] [HUB] 🔔 Auth Hub Event Received');
      safePrint('[LOGIN_FLOW] [HUB] Event Type: ${event.type}');
      safePrint('[LOGIN_FLOW] [HUB] Event Payload: ${event.payload}');
      safePrint('[LOGIN_FLOW] [HUB] Event String: $event');
      safePrint('[LOGIN_FLOW] [HUB] Event Runtime Type: ${event.runtimeType}');

      // Log ALL events to file for debugging
      await FileLogger.log('HUB_EVENT', variables: {
        'event_type': event.type.toString(),
        'event_runtime_type': event.runtimeType.toString(),
        'event_payload': event.payload?.toString() ?? 'null',
        'event_string': event.toString(),
      });

      safePrint('[LOGIN_FLOW] ========================================');

      switch (event.type) {
        case AuthHubEventType.signedIn:
          safePrint('[LOGIN_FLOW] [HUB] ✅✅✅ USER SIGNED IN SUCCESSFULLY! ✅✅✅');
          safePrint('[LOGIN_FLOW] [HUB] Event data: ${event.payload}');

          // Log complete authentication response to file
          try {
            final user = await Amplify.Auth.getCurrentUser();
            final session = await Amplify.Auth.fetchAuthSession();

            // Prepare user data
            final userData = {
              'user_id': user.userId,
              'username': user.username,
            };

            // Prepare session response
            Map<String, dynamic>? sessionResponse;
            Map<String, dynamic>? tokenResponse;
            Map<String, dynamic>? cognitoResponse;
            List<String>? groups;

            if (session is CognitoAuthSession) {
              final idToken = session.userPoolTokensResult.value.idToken;
              final accessToken =
                  session.userPoolTokensResult.value.accessToken;
              final claimsMap = idToken.claims.toJson();
              final groupsValue = claimsMap['cognito:groups'];

              if (groupsValue is String) {
                groups = [groupsValue];
              } else if (groupsValue is List) {
                groups = groupsValue.cast<String>();
              }

              // Get access token claims
              final accessTokenClaims = accessToken.claims.toJson();

              // Complete token response
              tokenResponse = {
                'id_token': {
                  'token_type': 'ID Token',
                  'issuer': claimsMap['iss'],
                  'subject': claimsMap['sub'],
                  'audience': claimsMap['aud'],
                  'expiration': claimsMap['exp'],
                  'issued_at': claimsMap['iat'],
                  'auth_time': claimsMap['auth_time'],
                  'email': claimsMap['email'],
                  'email_verified': claimsMap['email_verified'],
                  'cognito_username': claimsMap['cognito:username'],
                  'cognito_groups': groups,
                  'token_use': claimsMap['token_use'],
                },
                'access_token': {
                  'token_type': 'Access Token',
                  'expiration': accessTokenClaims['exp'],
                  'issued_at': accessTokenClaims['iat'],
                  'scope': accessTokenClaims['scope'],
                },
                'refresh_token': {
                  'token_type': 'Refresh Token',
                  'present': true,
                },
              };

              // Complete session response
              sessionResponse = {
                'is_signed_in': session.isSignedIn,
                'session_type': 'CognitoAuthSession',
                'user_pool_tokens_available': true,
              };

              // Cognito response
              cognitoResponse = {
                'identity_id': session.identityIdResult.value,
                'has_tokens': true,
                'tokens_available': true,
              };

              // Log complete response
              await FileLogger.logCompleteAuthResponse(
                eventType: 'signedIn',
                hubEventPayload: event.payload is Map
                    ? Map<String, dynamic>.from(event.payload as Map)
                    : {'payload': event.payload.toString()},
                userData: userData,
                sessionResponse: sessionResponse,
                tokenResponse: tokenResponse,
                cognitoResponse: cognitoResponse,
              );

              // Also log simplified version
              await FileLogger.logAuthResult(
                success: true,
                userId: user.userId,
                username: user.username,
                groups: groups,
                sessionData: sessionResponse,
                tokenData: tokenResponse,
              );
            } else {
              // Session is not CognitoAuthSession
              sessionResponse = {
                'is_signed_in': session.isSignedIn,
                'session_type': session.runtimeType.toString(),
              };

              await FileLogger.logCompleteAuthResponse(
                eventType: 'signedIn',
                hubEventPayload: event.payload is Map
                    ? Map<String, dynamic>.from(event.payload as Map)
                    : {'payload': event.payload.toString()},
                userData: userData,
                sessionResponse: sessionResponse,
              );
            }
          } catch (e, stackTrace) {
            safePrint('[LOGIN_FLOW] [HUB] ⚠️ Error logging to file: $e');
            await FileLogger.logCompleteAuthResponse(
              eventType: 'signedIn',
              errorMessage: e.toString(),
              stackTrace: stackTrace,
            );
          }

          // Trigger group check after successful login
          if (mounted) {
            safePrint(
                '[LOGIN_FLOW] [HUB] Triggering CheckUserGroups after sign in...');
            Future.delayed(const Duration(milliseconds: 500), () {
              if (mounted) {
                context.read<AuthBloc>().add(const CheckUserGroups());
              }
            });
          }
          break;

        case AuthHubEventType.signedOut:
          safePrint('[LOGIN_FLOW] [HUB] 👋 User signed out');
          safePrint('[LOGIN_FLOW] [HUB] Event data: ${event.payload}');
          break;

        case AuthHubEventType.userDeleted:
          safePrint('[LOGIN_FLOW] [HUB] 🗑️ User deleted');
          safePrint('[LOGIN_FLOW] [HUB] Event data: ${event.payload}');
          break;

        default:
          safePrint('[LOGIN_FLOW] [HUB] ⚠️ Other auth event: ${event.type}');
          safePrint('[LOGIN_FLOW] [HUB] Event payload: ${event.payload}');
          safePrint('[LOGIN_FLOW] [HUB] Full event: $event');

          // Check if this is an error event
          final eventString = event.toString().toLowerCase();
          final payloadString = event.payload?.toString().toLowerCase() ?? '';

          if (eventString.contains('error') ||
              eventString.contains('exception') ||
              eventString.contains('failed') ||
              payloadString.contains('error') ||
              payloadString.contains('exception') ||
              payloadString.contains('incorrect') ||
              payloadString.contains('notauthorized')) {
            safePrint(
                '[LOGIN_FLOW] [HUB] ❌❌❌ AUTHENTICATION ERROR DETECTED! ❌❌❌');
            safePrint('[LOGIN_FLOW] [HUB] Error Event Type: ${event.type}');
            safePrint('[LOGIN_FLOW] [HUB] Error Details: ${event.payload}');

            // Extract error message
            String? errorMessage;
            String? errorCode;

            if (event.payload is Map) {
              final payloadMap = event.payload as Map;
              errorMessage = payloadMap['message']?.toString() ??
                  payloadMap['error']?.toString() ??
                  payloadMap.toString();
              errorCode = payloadMap['code']?.toString() ??
                  payloadMap['errorCode']?.toString();
            } else {
              errorMessage = event.payload?.toString();
            }

            // Log error to file with detailed information
            await FileLogger.logAuthenticationError(
              errorMessage: errorMessage ?? 'Unknown error',
              errorCode: errorCode ?? event.type.toString(),
              errorType: event.type.toString(),
              errorDetails: event.payload is Map
                  ? Map<String, dynamic>.from(event.payload as Map)
                  : {'payload': event.payload.toString()},
            );

            await FileLogger.logCompleteAuthResponse(
              eventType: 'Authentication_Error',
              hubEventPayload: event.payload is Map
                  ? Map<String, dynamic>.from(event.payload as Map)
                  : {'payload': event.payload.toString()},
              errorMessage: errorMessage ?? 'Unknown error',
              errorCode: errorCode ?? event.type.toString(),
            );

            await FileLogger.logAuthResult(
              success: false,
              error: errorMessage ?? 'Authentication failed',
            );
          }

          // Log all other auth events to file
          try {
            await FileLogger.logCompleteAuthResponse(
              eventType: event.type.toString(),
              hubEventPayload: event.payload is Map
                  ? Map<String, dynamic>.from(event.payload as Map)
                  : {'payload': event.payload.toString()},
            );
          } catch (e) {
            safePrint('[LOGIN_FLOW] [HUB] ⚠️ Error logging event to file: $e');
          }
      }
    });
    safePrint(
        '[LOGIN_FLOW] [AppContent] ✅ Hub listener set up (subscription: $hubSubscription)');

    // Also check initial auth state
    _checkInitialAuthState();
  }

  Future<void> _checkInitialAuthState() async {
    safePrint(
        '[LOGIN_FLOW] [AppContent] Checking initial authentication state...');
    try {
      final user = await Amplify.Auth.getCurrentUser();
      safePrint(
          '[LOGIN_FLOW] [AppContent] ✅ Initial check: User is authenticated');
      safePrint('[LOGIN_FLOW] [AppContent] User ID: ${user.userId}');
      safePrint('[LOGIN_FLOW] [AppContent] Username: ${user.username}');
      safePrint('[LOGIN_FLOW] [AppContent] Triggering CheckUserGroups...');
      if (mounted) {
        context.read<AuthBloc>().add(const CheckUserGroups());
      }
    } catch (e) {
      safePrint(
          '[LOGIN_FLOW] [AppContent] ❌ Initial check: User is NOT authenticated');
      safePrint('[LOGIN_FLOW] [AppContent] Error: $e');
      safePrint(
          '[LOGIN_FLOW] [AppContent] Authenticator will show login screen');
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthBloc, AuthState>(
      builder: (context, state) {
        safePrint(
            '[LOGIN_FLOW] [AppContent] Current state: ${state.runtimeType}');

        if (state is AuthLoading || state is AuthInitial) {
          safePrint('[LOGIN_FLOW] [AppContent] Showing loading screen...');
          return Scaffold(
            body: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const CircularProgressIndicator(),
                  const SizedBox(height: 16),
                  Text(
                    'Checking permissions...',
                    style: TextStyle(
                      fontSize: 16,
                      color: Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),
          );
        }

        if (state is AuthUnauthenticated) {
          safePrint('[LOGIN_FLOW] [AppContent] Showing unauthenticated screen');
          safePrint(
              '[LOGIN_FLOW] [AppContent] Message: ${state.message ?? 'Access denied. Employees only.'}');
          return Scaffold(
            body: Center(
              child: Padding(
                padding: const EdgeInsets.all(20.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      state.message ?? 'Access denied. Employees only.',
                      style: TextStyle(
                        fontSize: 18,
                        color: Colors.red[700],
                        fontWeight: FontWeight.bold,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Contact your manager for access.',
                      style: TextStyle(
                        fontSize: 16,
                        color: Colors.grey[600],
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ),
          );
        }

        if (state is AuthError) {
          safePrint('[LOGIN_FLOW] [AppContent] ❌ Showing error screen');
          safePrint(
              '[LOGIN_FLOW] [AppContent] Error message: ${state.message}');
          return Scaffold(
            body: Center(
              child: Padding(
                padding: const EdgeInsets.all(20.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      'Error: ${state.message}',
                      style: TextStyle(
                        fontSize: 18,
                        color: Colors.red[700],
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 20),
                    ElevatedButton(
                      onPressed: () {
                        context.read<AuthBloc>().add(const CheckUserGroups());
                      },
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            ),
          );
        }

        if (state is AuthAuthenticated) {
          safePrint('[LOGIN_FLOW] [AppContent] ✅ User authenticated!');
          safePrint('[LOGIN_FLOW] [AppContent] Username: ${state.username}');
          safePrint('[LOGIN_FLOW] [AppContent] User ID: ${state.userId}');
          safePrint(
              '[LOGIN_FLOW] [AppContent] Is Employee: ${state.isEmployee}');
          safePrint('[LOGIN_FLOW] [AppContent] Showing MainTabNavigator...');
          safePrint('[LOGIN_FLOW] ========================================');
          safePrint('[LOGIN_FLOW] ✅ LOGIN FLOW COMPLETE - USER LOGGED IN');
          safePrint('[LOGIN_FLOW] ========================================');
          return const MainTabNavigator();
        }

        safePrint(
            '[LOGIN_FLOW] [AppContent] ⚠️ Unknown state: ${state.runtimeType}');
        return const Scaffold(
          body: Center(
            child: Text('Unknown state'),
          ),
        );
      },
    );
  }
}

class MainTabNavigator extends StatelessWidget {
  const MainTabNavigator({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        body: const TabBarView(
          children: [
            CourseListScreen(),
            ProfileScreen(),
          ],
        ),
        bottomNavigationBar: TabBar(
          labelColor: const Color(0xFF007AFF),
          unselectedLabelColor: Colors.grey,
          indicatorColor: const Color(0xFF007AFF),
          tabs: const [
            Tab(
              icon: Icon(Icons.school),
              text: 'Courses',
            ),
            Tab(
              icon: Icon(Icons.person),
              text: 'Profile',
            ),
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:amplify_auth_cognito/amplify_auth_cognito.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'screens/course_list_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/login_screen.dart';
import 'screens/signup_screen.dart';
import 'screens/verification_screen.dart';
import 'screens/forgot_password_screen.dart';
import 'services/amplify_service.dart';
import 'services/file_logger.dart';
import 'bloc/auth/auth_bloc.dart';
import 'widgets/app_loader.dart';

/*
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
    await FileLogger.log(
      'APP STARTED',
      variables: {
        'timestamp': DateTime.now().toIso8601String(),
        'app_version': '1.0.0+1',
      },
    );

    // Configure Amplify
    await AmplifyService.configure();
    safePrint('[LOGIN_FLOW] ✅ Amplify configured successfully');
    await FileLogger.log(
      'AMPLIFY CONFIGURED',
      variables: {
        'status': 'success',
        'timestamp': DateTime.now().toIso8601String(),
      },
    );
  } catch (e) {
    safePrint('[LOGIN_FLOW] ❌ ERROR configuring Amplify: $e');
    await FileLogger.log(
      'AMPLIFY CONFIGURATION ERROR',
      variables: {
        'error': e.toString(),
        'timestamp': DateTime.now().toIso8601String(),
      },
    );
  }

  safePrint('[LOGIN_FLOW] Running MyApp...');
  runApp(const MyApp());
}
 */

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
    await FileLogger.log(
      'APP STARTED',
      variables: {
        'timestamp': DateTime.now().toIso8601String(),
        'app_version': '1.0.0+1',
      },
    );

    // Configure Amplify
    await AmplifyService.configure();
    safePrint('[LOGIN_FLOW] ✅ Amplify configured successfully');
    await FileLogger.log(
      'AMPLIFY CONFIGURED',
      variables: {
        'status': 'success',
        'timestamp': DateTime.now().toIso8601String(),
      },
    );
  } catch (e) {
    safePrint('[LOGIN_FLOW] ❌ ERROR configuring Amplify: $e');
    await FileLogger.log(
      'AMPLIFY CONFIGURATION ERROR',
      variables: {
        'error': e.toString(),
        'timestamp': DateTime.now().toIso8601String(),
      },
    );
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
      '[LOGIN_FLOW] [MyApp] Creating AuthBloc and triggering CheckUserGroups...',
    );
    return MultiBlocProvider(
      providers: [
        BlocProvider(
          create: (context) {
            safePrint('[LOGIN_FLOW] [MyApp] Creating AuthBloc instance...');
            final bloc = AuthBloc();
            safePrint(
              '[LOGIN_FLOW] [MyApp] Triggering CheckUserGroups event...',
            );
            bloc.add(const CheckUserGroups());
            return bloc;
          },
        ),
      ],
      child: Builder(
        builder: (context) {
          final authBloc = context.read<AuthBloc>();
          return MaterialApp(
            debugShowCheckedModeBanner: false,
            title: 'My Training App',
            theme: ThemeData(
              primarySwatch: Colors.blue,
              primaryColor: const Color(0xFF007AFF),
              useMaterial3: true,
            ),
            home: const AppContent(),
            onGenerateRoute: (settings) {
              switch (settings.name) {
                case '/login':
                  return MaterialPageRoute(
                    builder: (_) => BlocProvider.value(
                      value: authBloc,
                      child: const LoginScreen(),
                    ),
                  );
                case '/signup':
                  return MaterialPageRoute(
                    builder: (_) => BlocProvider.value(
                      value: authBloc,
                      child: const SignUpScreen(),
                    ),
                  );
                case '/verification':
                  final args = settings.arguments;
                  if (args is Map<String, dynamic>) {
                    final email = args['email'] as String?;
                    final password = args['password'] as String?;
                    if (email != null && password != null) {
                      return MaterialPageRoute(
                        builder: (_) => BlocProvider.value(
                          value: authBloc,
                          child: VerificationScreen(
                            email: email,
                            password: password,
                          ),
                        ),
                      );
                    }
                  }
                  return null;
                case '/forgot-password':
                  return MaterialPageRoute(
                    builder: (_) => BlocProvider.value(
                      value: authBloc,
                      child: const ForgotPasswordScreen(),
                    ),
                  );
                case '/home':
                case '/courses':
                  // Direct route to MainTabNavigator (CourseListScreen with bottom nav)
                  return MaterialPageRoute(
                    builder: (_) => BlocProvider.value(
                      value: authBloc,
                      child: const MainTabNavigator(),
                    ),
                  );
                default:
                  return null;
              }
            },
          );
        },
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
      await FileLogger.log(
        'HUB_EVENT',
        variables: {
          'event_type': event.type.toString(),
          'event_runtime_type': event.runtimeType.toString(),
          'event_payload': event.payload?.toString() ?? 'null',
          'event_string': event.toString(),
        },
      );

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
              '[LOGIN_FLOW] [HUB] Triggering CheckUserGroups after sign in...',
            );
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
              '[LOGIN_FLOW] [HUB] ❌❌❌ AUTHENTICATION ERROR DETECTED! ❌❌❌',
            );
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
      '[LOGIN_FLOW] [AppContent] ✅ Hub listener set up (subscription: $hubSubscription)',
    );

    // Also check initial auth state
    _checkInitialAuthState();
  }

  Future<void> _checkInitialAuthState() async {
    safePrint(
      '[LOGIN_FLOW] [AppContent] Checking initial authentication state...',
    );
    try {
      final user = await Amplify.Auth.getCurrentUser();
      safePrint(
        '[LOGIN_FLOW] [AppContent] ✅ Initial check: User is authenticated',
      );
      safePrint('[LOGIN_FLOW] [AppContent] User ID: ${user.userId}');
      safePrint('[LOGIN_FLOW] [AppContent] Username: ${user.username}');
      safePrint('[LOGIN_FLOW] [AppContent] Triggering CheckUserGroups...');
      if (mounted) {
        context.read<AuthBloc>().add(const CheckUserGroups());
      }
    } catch (e) {
      safePrint(
        '[LOGIN_FLOW] [AppContent] ❌ Initial check: User is NOT authenticated',
      );
      safePrint('[LOGIN_FLOW] [AppContent] Error: $e');
      safePrint(
        '[LOGIN_FLOW] [AppContent] Authenticator will show login screen',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    // Ensure we're listening to the same AuthBloc instance
    final authBloc = context.read<AuthBloc>();
    safePrint('[LOGIN_FLOW] [AppContent] Building with AuthBloc: $authBloc');
    safePrint(
        '[LOGIN_FLOW] [AppContent] Current bloc state: ${authBloc.state.runtimeType}');

    return BlocConsumer<AuthBloc, AuthState>(
      bloc: authBloc,
      listenWhen: (previous, current) {
        // Listen to all state changes for debugging
        safePrint(
            '[LOGIN_FLOW] [AppContent] Listener - Previous: ${previous.runtimeType}, Current: ${current.runtimeType}');
        return true;
      },
      listener: (context, state) {
        safePrint(
            '[LOGIN_FLOW] [AppContent] Listener triggered - State: ${state.runtimeType}');
        if (state is AuthAuthenticated) {
          safePrint(
              '[LOGIN_FLOW] [AppContent] ✅ Listener detected AuthAuthenticated!');
          // Clear navigation stack to ensure we're at the root (AppContent)
          // This will allow AppContent to rebuild and show MainTabNavigator
          safePrint(
              '[LOGIN_FLOW] [AppContent] Clearing navigation stack for authenticated user...');
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (context.mounted) {
              Navigator.of(context, rootNavigator: true).popUntil((route) {
                safePrint(
                    '[LOGIN_FLOW] [AppContent] Popping route: ${route.settings.name ?? route.runtimeType}');
                return route.isFirst;
              });
              safePrint(
                  '[LOGIN_FLOW] [AppContent] Navigation stack cleared, will rebuild with MainTabNavigator');
            }
          });
        }
        // When user logs out, clear navigation stack and ensure login screen is shown
        if (state is AuthUnauthenticated) {
          safePrint(
              '[LOGIN_FLOW] [AppContent] 👋 User logged out - clearing navigation stack');
          // Clear all navigation routes to ensure we're at the root
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (context.mounted) {
              Navigator.of(context, rootNavigator: true)
                  .popUntil((route) => route.isFirst);
            }
          });
        }
      },
      buildWhen: (previous, current) {
        safePrint(
            '[LOGIN_FLOW] [AppContent] buildWhen called - Previous: ${previous.runtimeType}, Current: ${current.runtimeType}');
        // Always rebuild on state changes
        final shouldRebuild = previous.runtimeType != current.runtimeType;
        safePrint('[LOGIN_FLOW] [AppContent] buildWhen result: $shouldRebuild');
        return true; // Always rebuild to ensure we catch state changes
      },
      builder: (context, state) {
        // Also read the current state directly from the bloc to ensure we have the latest
        final currentState = authBloc.state;
        safePrint(
          '[LOGIN_FLOW] [AppContent] Builder called - State from builder: ${state.runtimeType}',
        );
        safePrint(
          '[LOGIN_FLOW] [AppContent] Builder called - State from bloc: ${currentState.runtimeType}',
        );
        safePrint(
          '[LOGIN_FLOW] [AppContent] State details: $state',
        );

        // Use the state from bloc if it's different (shouldn't happen, but just in case)
        final effectiveState = currentState;

        if (effectiveState is AuthLoading || effectiveState is AuthInitial) {
          safePrint('[LOGIN_FLOW] [AppContent] Showing loading screen...');
          return const Scaffold(
            body: LoadingWidget(
              message: 'Checking permissions...',
            ),
          );
        }

        if (effectiveState is AuthUnauthenticated) {
          final unauthenticatedState = effectiveState;
          safePrint('[LOGIN_FLOW] [AppContent] Showing login screen');
          safePrint(
            '[LOGIN_FLOW] [AppContent] Message: ${unauthenticatedState.message ?? 'Please sign in'}',
          );
          // Show login screen if no specific error message, otherwise show error
          final message = unauthenticatedState.message;
          if (message != null &&
              (message.contains('Access denied') ||
                  message.contains('Employees only'))) {
            return Scaffold(
              body: Center(
                child: Padding(
                  padding: const EdgeInsets.all(20.0),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        message,
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
                        style: TextStyle(fontSize: 16, color: Colors.grey[600]),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 20),
                      ElevatedButton(
                        onPressed: () {
                          context.read<AuthBloc>().add(const SignOut());
                        },
                        child: const Text('Sign Out'),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }
          return const LoginScreen();
        }

        if (effectiveState is AuthError) {
          final errorState = effectiveState;
          safePrint('[LOGIN_FLOW] [AppContent] ❌ Showing error screen');
          safePrint(
            '[LOGIN_FLOW] [AppContent] Error message: ${errorState.message}',
          );

          // Check if it's a social login not available error
          final isSocialLoginError =
              errorState.message.contains('GOOGLE_LOGIN_NOT_AVAILABLE') ||
                  errorState.message.contains('APPLE_LOGIN_NOT_AVAILABLE') ||
                  errorState.message.contains('InvalidAccountTypeException') ||
                  errorState.message.contains('No user pool registered');

          return Scaffold(
            body: Center(
              child: Padding(
                padding: const EdgeInsets.all(20.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      isSocialLoginError
                          ? Icons.info_outline
                          : Icons.error_outline,
                      size: 64,
                      color: isSocialLoginError
                          ? Colors.orange[700]
                          : Colors.red[700],
                    ),
                    const SizedBox(height: 20),
                    Text(
                      isSocialLoginError
                          ? 'Social Login Not Available'
                          : 'Error',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: isSocialLoginError
                            ? Colors.orange[700]
                            : Colors.red[700],
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      isSocialLoginError
                          ? 'Access denied. Please try direct login with your email and password.'
                          : errorState.message,
                      style: TextStyle(
                        fontSize: 16,
                        color: Colors.grey[700],
                        height: 1.5,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 30),
                    if (isSocialLoginError)
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: () {
                            // Navigate to login screen
                            context
                                .read<AuthBloc>()
                                .add(const CheckUserGroups());
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF2C6EF2),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: const Text(
                            'Go to Login',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      )
                    else
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

        if (effectiveState is AuthAuthenticated) {
          final authState = effectiveState;
          safePrint('[LOGIN_FLOW] [AppContent] ✅ User authenticated!');
          safePrint(
              '[LOGIN_FLOW] [AppContent] Username: ${authState.username}');
          safePrint('[LOGIN_FLOW] [AppContent] User ID: ${authState.userId}');
          safePrint(
            '[LOGIN_FLOW] [AppContent] Is Employee: ${authState.isEmployee}',
          );
          safePrint('[LOGIN_FLOW] [AppContent] Showing MainTabNavigator...');
          safePrint(
              '[LOGIN_FLOW] [AppContent] MainTabNavigator will show CourseListScreen with bottom nav');
          safePrint('[LOGIN_FLOW] ========================================');
          safePrint('[LOGIN_FLOW] ✅ LOGIN FLOW COMPLETE - USER LOGGED IN');
          safePrint('[LOGIN_FLOW] ========================================');

          // Return MainTabNavigator which shows CourseListScreen with bottom navigation
          safePrint(
              '[LOGIN_FLOW] [AppContent] About to return MainTabNavigator widget...');
          final navigator = const MainTabNavigator();
          safePrint(
              '[LOGIN_FLOW] [AppContent] MainTabNavigator widget created, returning...');
          return navigator;
        }

        safePrint(
          '[LOGIN_FLOW] [AppContent] ⚠️ Unknown state: ${effectiveState.runtimeType}',
        );
        return Scaffold(
          body: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('Unknown state: ${effectiveState.runtimeType}'),
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
        );
      },
    );
  }
}

class MainTabNavigator extends StatelessWidget {
  const MainTabNavigator({super.key});

  @override
  Widget build(BuildContext context) {
    safePrint('[NAVIGATION] ========================================');
    safePrint('[NAVIGATION] 🚀 MainTabNavigator building...');
    safePrint(
        '[NAVIGATION] Setting up CourseListScreen and ProfileScreen with bottom nav');
    safePrint('[NAVIGATION] ========================================');

    return DefaultTabController(
      length: 2,
      initialIndex: 0, // Start with Courses tab
      child: Scaffold(
        body: const TabBarView(
          children: [
            CourseListScreen(), // First tab - Course List
            ProfileScreen(), // Second tab - Profile
          ],
        ),
        bottomNavigationBar: SafeArea(
          top: false,
          child: TabBar(
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
      ),
    );
  }
}

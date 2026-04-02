import 'package:flutter/material.dart';
import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:amplify_auth_cognito/amplify_auth_cognito.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'features/auth/presentation/screens/signup_screen.dart';
import 'features/course/presentation/screens/course_list_screen.dart';
import 'features/profile/presentation/screens/profile_screen.dart';
import 'features/auth/presentation/screens/login_screen.dart';
import 'features/auth/presentation/screens/social_login_error_screen.dart';
import 'core/services/amplify_service.dart';
import 'features/auth/services/file_logger.dart';
import 'features/auth/presentation/bloc/auth_bloc.dart';
import 'features/course/presentation/bloc/course_bloc.dart';
import 'features/learning_path/presentation/bloc/learning_path_bloc.dart';
import 'core/widgets/app_loader.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    // Initialize file logger

    await FileLogger.initialize();

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

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  late final AuthBloc _authBloc;
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    // Create AuthBloc once in initState - persists across hot reloads
    _authBloc = AuthBloc()..add(const CheckUserGroups());
    // Create router once in initState - persists across hot reloads
    _router = AppRouter.createRouter(_authBloc);
  }

  @override
  void dispose() {
    _authBloc.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider.value(value: _authBloc),
      ],
      child: MaterialApp.router(
        debugShowCheckedModeBanner: false,
        title: 'My Training App',
        theme: ThemeData(
          primarySwatch: Colors.blue,
          primaryColor: const Color(0xFF007AFF),
          useMaterial3: true,
          //fontFamily: AppTheme.defaultFontFamily,
          textTheme: AppTheme.getTextTheme(context),
        ),
        routerConfig: _router,
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

    final hubSubscription = Amplify.Hub.listen(HubChannel.Auth, (event) async {
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

      switch (event.type) {
        case AuthHubEventType.signedIn:
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
          break;

        case AuthHubEventType.userDeleted:
          break;

        default:

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


      if (mounted) {
        context.read<AuthBloc>().add(const CheckUserGroups());
      }
    } catch (e) {

      safePrint('[LOGIN_FLOW] [AppContent] Error: $e');

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
              // Use go_router to navigate to home
              context.go('/home');
              safePrint(
                  '[LOGIN_FLOW] [AppContent] Navigation stack cleared, will rebuild with MainTabNavigator');
            }
          });
        }
        // Handle verification required states - redirect to verification screen
        if (state is VerificationRequired) {
          safePrint(
              '[LOGIN_FLOW] [AppContent] Verification required - redirecting to verification screen');
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (context.mounted) {
              context.go(
                '/verification?email=${Uri.encodeComponent(state.email)}&password=${Uri.encodeComponent(state.password)}',
              );
            }
          });
        } else if (state is SignUpConfirmationRequired) {
          safePrint(
              '[LOGIN_FLOW] [AppContent] Sign up confirmation required - redirecting to verification screen');
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (context.mounted) {
              context.go(
                '/verification?email=${Uri.encodeComponent(state.email)}&password=${Uri.encodeComponent(state.password)}',
              );
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
              context.go('/');
            }
          });
        }
      },
      buildWhen: (previous, current) {
        final shouldRebuild = previous.runtimeType != current.runtimeType;
        safePrint('[LOGIN_FLOW] [AppContent] buildWhen result: $shouldRebuild');
        return true;
      },
      builder: (context, state) {
        final currentState = authBloc.state;
        safePrint(
          '[LOGIN_FLOW] [AppContent] Builder called - State from builder: ${state.runtimeType}, State details: $state State from bloc: ${currentState.runtimeType}',
        );
        final effectiveState = currentState;

        // Check if we're on login/signup route - never show loading screen for those
        bool isOnAuthScreen = false;
        try {
          final currentLocation = GoRouterState.of(context).uri.path;
          isOnAuthScreen =
              currentLocation == '/login' || currentLocation == '/signup';
        } catch (e) {
          // Route not available, continue
        }

        // If on auth screen, always show the auth screen (API calls happen in background)
        if (isOnAuthScreen) {
          try {
            final currentLocation = GoRouterState.of(context).uri.path;
            return currentLocation == '/login'
                ? const LoginScreen()
                : const SignUpScreen();
          } catch (e) {
            return const LoginScreen();
          }
        }

        // Only show loading screen for non-auth screens (like initial app load, group checks, etc.)
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

        // Handle verification required states - redirect to verification screen
        if (effectiveState is VerificationRequired) {
          safePrint(
              '[LOGIN_FLOW] [AppContent] Verification required - redirecting to verification screen');
          // Navigate to verification screen
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (context.mounted) {
              context.go(
                '/verification?email=${Uri.encodeComponent(effectiveState.email)}&password=${Uri.encodeComponent(effectiveState.password)}',
              );
            }
          });
          // Show loading while navigating
          return const Scaffold(
            body: LoadingWidget(
              message: 'Redirecting to verification...',
            ),
          );
        } else if (effectiveState is SignUpConfirmationRequired) {
          safePrint(
              '[LOGIN_FLOW] [AppContent] Sign up confirmation required - redirecting to verification screen');
          // Navigate to verification screen
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (context.mounted) {
              context.go(
                '/verification?email=${Uri.encodeComponent(effectiveState.email)}&password=${Uri.encodeComponent(effectiveState.password)}',
              );
            }
          });
          // Show loading while navigating
          return const Scaffold(
            body: LoadingWidget(
              message: 'Redirecting to verification...',
            ),
          );
        }

        if (effectiveState is AuthError) {
          final errorState = effectiveState;
          safePrint(
              '[LOGIN_FLOW] [AppContent] ❌ Error detected: ${errorState.message}');

          // Filter out social login errors - redirect to social login error screen
          final isSocialLoginError =
              errorState.message.contains('GOOGLE_LOGIN_NOT_AVAILABLE') ||
                  errorState.message.contains('APPLE_LOGIN_NOT_AVAILABLE') ||
                  errorState.message.contains('InvalidAccountTypeException') ||
                  errorState.message.contains('No user pool registered');

          if (isSocialLoginError) {
            return const SocialLoginErrorScreen();
          }

          // Check if error is related to login/signup - these should be handled by login/signup screens with SnackBar
          final isLoginSignupError =
              errorState.message.contains('Failed to sign in') ||
                  errorState.message.contains('Failed to sign up') ||
                  errorState.message.contains('Incorrect email') ||
                  errorState.message.contains('Incorrect username') ||
                  errorState.message.contains('password') ||
                  errorState.message.contains('UserNotFoundException') ||
                  errorState.message.contains('NotAuthorizedException') ||
                  errorState.message.contains('UserNotConfirmedException') ||
                  errorState.message.contains('UsernameExistsException');

          // If it's a login/signup error, show login screen - it will handle error with SnackBar
          if (isLoginSignupError) {
            safePrint(
                '[LOGIN_FLOW] [AppContent] Login/signup error detected - showing login screen with SnackBar');
            return const LoginScreen();
          }

          // Check current route - if on login/signup, show that screen instead of error
          try {
            final currentLocation = GoRouterState.of(context).uri.path;
            if (currentLocation == '/login' || currentLocation == '/signup') {
              safePrint(
                  '[LOGIN_FLOW] [AppContent] On login/signup route - showing screen with SnackBar');
              return currentLocation == '/login'
                  ? const LoginScreen()
                  : const SignUpScreen();
            }
          } catch (e) {
            safePrint('[LOGIN_FLOW] [AppContent] Could not get route: $e');
          }

          // Only show full-page error for non-login/signup errors on other screens
          safePrint('[LOGIN_FLOW] [AppContent] Showing full-page error screen');
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

          final navigator = const MainTabNavigator();
          safePrint(
              '[LOGIN_FLOW] [AppContent] MainTabNavigator widget created, returning...');
          return navigator;
        }

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

class MainTabNavigator extends StatefulWidget {
  const MainTabNavigator({super.key});

  @override
  State<MainTabNavigator> createState() => _MainTabNavigatorState();
}

class _MainTabNavigatorState extends State<MainTabNavigator> {
  late final CourseBloc _courseBloc;
  late final LearningPathBloc _learningPathBloc;

  @override
  void initState() {
    super.initState();
    // Create BLoCs once in initState - they will persist across hot reloads
    _courseBloc = CourseBloc();
    _learningPathBloc = LearningPathBloc();
  }

  @override
  void dispose() {
    // Properly dispose BLoCs to prevent memory leaks
    _courseBloc.close();
    _learningPathBloc.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Use BlocProvider.value to reuse existing BLoC instances
    // This ensures state persists across hot reloads
    return MultiBlocProvider(
      providers: [
        BlocProvider.value(value: _courseBloc),
        BlocProvider.value(value: _learningPathBloc),
      ],
      child: DefaultTabController(
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
      ),
    );
  }
}

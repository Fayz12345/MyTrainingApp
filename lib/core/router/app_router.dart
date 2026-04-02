import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/auth/presentation/screens/signup_screen.dart';
import '../../features/auth/presentation/screens/verification_screen.dart';
import '../../features/auth/presentation/screens/forgot_password_screen.dart';
import '../../features/auth/presentation/screens/reset_password_screen.dart';
import '../../features/auth/presentation/screens/account_created_success_screen.dart';
import '../../features/course/data/models/lesson_model.dart';
import '../../features/video_player/presentation/screens/video_player_screen.dart';
import '../../features/quiz/presentation/screens/quiz_screen.dart';
import '../../features/learning_path/presentation/screens/learning_path_progress_screen.dart';
import '../../features/course/presentation/screens/pdf_viewer_screen.dart';
import '../../features/course/presentation/screens/course_details_screen.dart';
import '../../features/course/presentation/screens/lesson_details_screen.dart';
import '../../features/course/presentation/bloc/lesson_details/lesson_details_bloc.dart';
import '../../features/course/presentation/screens/lesson_video_player_screen.dart';
import '../../features/profile/presentation/screens/edit_profile_screen.dart';
import '../../features/settings/presentation/screens/account_settings_screen.dart';
import '../../features/settings/presentation/screens/banking_information_screen.dart';
import '../../features/settings/presentation/screens/notifications_screen.dart';
import '../../features/settings/presentation/screens/help_support_screen.dart';
import '../../features/auth/presentation/screens/google_signin_test_screen.dart';
import '../../features/auth/presentation/screens/social_login_error_screen.dart';
import '../../main.dart';
import '../../features/auth/presentation/bloc/auth_bloc.dart';
import '../../features/quiz/presentation/bloc/quiz_bloc.dart';
import '../../features/learning_path/presentation/bloc/learning_path_bloc.dart';
import '../../features/video_player/presentation/bloc/video_player_bloc.dart';
import '../../features/course/presentation/bloc/course_bloc.dart';
import '../../features/course/data/models/course_model.dart';
import '../../features/learning_path/data/models/learning_path_model.dart';
import '../../features/course/services/quiz_completion_service.dart';
import 'package:amplify_flutter/amplify_flutter.dart' hide Emitter;

/// Custom page with smooth transitions
class CustomTransitionPage<T> extends Page<T> {
  final Widget child;
  final Widget Function(
    BuildContext,
    Animation<double>,
    Animation<double>,
    Widget,
  )? transitionsBuilder;

  const CustomTransitionPage({
    required super.key,
    required this.child,
    this.transitionsBuilder,
  });

  @override
  Route<T> createRoute(BuildContext context) {
    return PageRouteBuilder<T>(
      settings: this,
      pageBuilder: (context, animation, secondaryAnimation) => child,
      transitionsBuilder: transitionsBuilder ??
          (context, animation, secondaryAnimation, child) {
            // Default smooth fade + slide transition
            return FadeTransition(
              opacity: CurvedAnimation(
                parent: animation,
                curve: Curves.easeOutCubic,
              ),
              child: SlideTransition(
                position: Tween<Offset>(
                  begin: const Offset(0.0, 0.05),
                  end: Offset.zero,
                ).animate(
                  CurvedAnimation(
                    parent: animation,
                    curve: Curves.easeOutCubic,
                  ),
                ),
                child: child,
              ),
            );
          },
      transitionDuration: const Duration(milliseconds: 300),
      reverseTransitionDuration: const Duration(milliseconds: 250),
    );
  }
}

class AppRouter {
  static final GlobalKey<NavigatorState> navigatorKey =
      GlobalKey<NavigatorState>();

  static GoRouter createRouter(AuthBloc authBloc) {
    return GoRouter(
      navigatorKey: navigatorKey,
      initialLocation: '/',
      routes: [
        GoRoute(path: '/', builder: (context, state) => const AppContent()),
        GoRoute(
          path: '/login',
          builder: (context, state) =>
              BlocProvider.value(value: authBloc, child: const LoginScreen()),
        ),
        GoRoute(
          path: '/signup',
          builder: (context, state) =>
              BlocProvider.value(value: authBloc, child: const SignUpScreen()),
        ),
        GoRoute(
          path: '/verification',
          builder: (context, state) {
            final email = state.uri.queryParameters['email'] ?? '';
            final password = state.uri.queryParameters['password'] ?? '';
            return BlocProvider.value(
              value: authBloc,
              child: VerificationScreen(email: email, password: password),
            );
          },
        ),
        GoRoute(
          path: '/forgot-password',
          builder: (context, state) => BlocProvider.value(
            value: authBloc,
            child: const ForgotPasswordScreen(),
          ),
        ),
        GoRoute(
          path: '/reset-password',
          builder: (context, state) {
            final email = state.uri.queryParameters['email'] ?? '';
            return ResetPasswordScreen(email: email);
          },
        ),
        GoRoute(
          path: '/account-created-success',
          builder: (context, state) {
            final email = state.uri.queryParameters['email'] ?? '';
            return BlocProvider.value(
              value: authBloc,
              child: AccountCreatedSuccessScreen(email: email),
            );
          },
        ),
        GoRoute(
          path: '/home',
          builder: (context, state) => BlocProvider.value(
            value: authBloc,
            child: const MainTabNavigator(),
          ),
        ),
        GoRoute(
          path: '/courses',
          builder: (context, state) => BlocProvider.value(
            value: authBloc,
            child: const MainTabNavigator(),
          ),
        ),
        GoRoute(
          path: '/edit-profile',
          builder: (context, state) => const EditProfileScreen(),
        ),
        GoRoute(
          path: '/account-settings',
          builder: (context, state) => const AccountSettingsScreen(),
        ),
        GoRoute(
          path: '/banking-information',
          builder: (context, state) => const BankingInformationScreen(),
        ),
        GoRoute(
          path: '/notifications',
          builder: (context, state) => const NotificationsScreen(),
        ),
        GoRoute(
          path: '/help-support',
          builder: (context, state) => const HelpSupportScreen(),
        ),
        GoRoute(
          path: '/google-signin-test',
          builder: (context, state) => const GoogleSignInTestScreen(),
        ),
        GoRoute(
          path: '/social-login-error',
          builder: (context, state) => BlocProvider.value(
            value: authBloc,
            child: const SocialLoginErrorScreen(),
          ),
        ),
        GoRoute(
          path: '/video-player',
          builder: (context, state) {
            final course = state.extra as Course?;
            if (course == null) {
              return const Scaffold(
                body: Center(child: Text('Course not found')),
              );
            }
            // Provide VideoPlayerBloc for BLoC state management
            return BlocProvider(
              create: (context) {
                final bloc = VideoPlayerBloc();
                // Initialize video player with course data
                bloc.add(
                  InitializeVideoPlayer(
                    videoKey: course.videoKey!,
                    assignmentId: course.assignmentId,
                    courseId: course.id,
                    courseTitle: course.title,
                  ),
                );
                return bloc;
              },
              child: VideoPlayerScreen(
                course: course,
                onVideoComplete: () {
                  // Close video player screen first
                  context.pop();
                  // Then navigate to quiz screen (clear stack - can't go back)
                  if (course.assignmentId != null) {
                    // Small delay to ensure video player is fully closed
                    Future.delayed(const Duration(milliseconds: 100), () {
                      if (context.mounted) {
                        context.push(
                          '/quiz',
                          extra: {
                            'course': course,
                            'assignmentId': course.assignmentId!,
                          },
                        );
                      }
                    });
                  }
                },
                onClose: () {
                  context.pop();
                },
              ),
            );
          },
        ),
        GoRoute(
          path: '/course-details',
          pageBuilder: (context, state) {
            final course = state.extra as Course?;
            if (course == null) {
              return MaterialPage(
                child: const Scaffold(
                  body: Center(child: Text('Course not found')),
                ),
              );
            }
            return CustomTransitionPage(
              key: state.pageKey,
              child: CourseDetailsScreen(course: course),
              transitionsBuilder:
                  (context, animation, secondaryAnimation, child) {
                return FadeTransition(
                  opacity: animation,
                  child: SlideTransition(
                    position: Tween<Offset>(
                      begin: const Offset(0.0, 0.05),
                      end: Offset.zero,
                    ).animate(
                      CurvedAnimation(
                        parent: animation,
                        curve: Curves.easeOutCubic,
                      ),
                    ),
                    child: child,
                  ),
                );
              },
            );
          },
        ),
        GoRoute(
          path: '/lesson-details',
          pageBuilder: (context, state) {
            final extra = state.extra as Map<String, dynamic>?;
            if (extra == null) {
              return const MaterialPage(
                child: Scaffold(
                  body: Center(child: Text('Extra data not found')),
                ),
              );
            }
            final lesson = extra['lesson'] as Lesson?;
            final course = extra['course'] as Course?;
            if (lesson == null || course == null) {
              return const MaterialPage(
                child: Scaffold(
                  body: Center(child: Text('Lesson or Course not found')),
                ),
              );
            }
            return CustomTransitionPage(
              key: state.pageKey,
              child: BlocProvider(
                create: (_) => LessonDetailsBloc()
                  ..add(LessonDetailsStarted(lesson: lesson, course: course)),
                child: const LessonDetailsScreen(),
              ),
            );
          },
        ),
        GoRoute(
          path: '/lesson-video-player',
          pageBuilder: (context, state) {
            final extra = state.extra as Map<String, dynamic>?;
            if (extra == null) {
              return const MaterialPage(
                child: Scaffold(
                  body: Center(child: Text('Lesson video data not found')),
                ),
              );
            }
            final course = extra['course'] as Course?;
            final lesson = extra['lesson'] as Lesson?;
            final videoKey = extra['videoKey'] as String?;
            if (course == null || lesson == null || videoKey == null) {
              return const MaterialPage(
                child: Scaffold(
                  body: Center(child: Text('Lesson video data incomplete')),
                ),
              );
            }
            return CustomTransitionPage(
              key: state.pageKey,
              child: LessonVideoPlayerScreen(
                course: course,
                lesson: lesson,
                videoKey: videoKey,
              ),
            );
          },
        ),
        GoRoute(
          path: '/pdf-viewer',
          pageBuilder: (context, state) {
            // Handle both Course object and Map with course + callback
            Course? course;
            VoidCallback? onPdfViewed;
            Function(Course)? onPdfViewedAndReadyForQuiz;

            if (state.extra is Map) {
              final extra = state.extra as Map<String, dynamic>;
              course = extra['course'] as Course?;
              onPdfViewed = extra['onPdfViewed'] as VoidCallback?;
              onPdfViewedAndReadyForQuiz =
                  extra['onPdfViewedAndReadyForQuiz'] as Function(Course)?;
            } else {
              course = state.extra as Course?;
            }

            if (course == null || course.pdfKey == null) {
              return MaterialPage(
                child: const Scaffold(
                  body: Center(child: Text('PDF not found')),
                ),
              );
            }
            return CustomTransitionPage(
              key: state.pageKey,
              child: PdfViewerScreen(
                course: course,
                onPdfViewed: onPdfViewed,
                onPdfViewedAndReadyForQuiz: onPdfViewedAndReadyForQuiz,
              ),
              transitionsBuilder:
                  (context, animation, secondaryAnimation, child) {
                return FadeTransition(
                  opacity: animation,
                  child: SlideTransition(
                    position: Tween<Offset>(
                      begin: const Offset(0.0, 0.05),
                      end: Offset.zero,
                    ).animate(
                      CurvedAnimation(
                        parent: animation,
                        curve: Curves.easeOutCubic,
                      ),
                    ),
                    child: child,
                  ),
                );
              },
            );
          },
        ),
        GoRoute(
          path: '/quiz',
          pageBuilder: (context, state) {
            final extra = state.extra as Map<String, dynamic>?;
            if (extra == null) {
              return MaterialPage(
                child: const Scaffold(
                  body: Center(child: Text('Quiz data not found')),
                ),
              );
            }
            final course = extra['course'] as Course?;
            final assignmentId = extra['assignmentId'] as String?;
            final source = extra['source'] as String? ??
                'course_list'; // Default to course_list if not specified
            final learningPath = extra['learningPath'] as LearningPath?;
            if (course == null || assignmentId == null) {
              return MaterialPage(
                child: const Scaffold(
                  body: Center(child: Text('Quiz data incomplete')),
                ),
              );
            }
            // Create QuizBloc and load questions
            final quizBloc = QuizBloc();
            quizBloc.add(
              LoadQuizQuestions(
                course.id,
                progressKey: assignmentId,
                randomizeQuestions: course.randomizeQuestions ?? false,
                randomizeOptions: course.randomizeOptions ?? false,
                useQuestionPool: course.useQuestionPool ?? false,
                questionsToDisplay: course.questionsToDisplay,
              ),
            );
            return CustomTransitionPage(
              key: state.pageKey,
              child: BlocProvider.value(
                value: quizBloc,
                child: QuizScreen(
                  course: course,
                  assignmentId: assignmentId,
                  source: source,
                  learningPath: learningPath,
                  onQuizComplete: (score, passed) async {
                    safePrint(
                      '[QUIZ_NAVIGATION] ========================================',
                    );
                    safePrint(
                      '[QUIZ_NAVIGATION] Quiz completed - Score: $score, Passed: $passed',
                    );
                    safePrint('[QUIZ_NAVIGATION] Source: $source');
                    safePrint(
                      '[QUIZ_NAVIGATION] Learning Path: ${learningPath?.title ?? "N/A"}',
                    );
                    safePrint(
                      '[QUIZ_NAVIGATION] ========================================',
                    );

                    // ✅ Immediately call APIs when quiz passes (in success response)
                    if (passed) {
                      safePrint(
                        '[QUIZ_NAVIGATION] 🚀 Quiz passed! Immediately calling course list and learning path APIs...',
                      );

                      // Get BLoCs from navigator context
                      final navigatorContext =
                          AppRouter.navigatorKey.currentContext;
                      if (navigatorContext != null &&
                          navigatorContext.mounted) {
                        try {
                          final courseBloc =
                              navigatorContext.read<CourseBloc>();
                          final learningPathBloc =
                              navigatorContext.read<LearningPathBloc>();

                          safePrint(
                            '[QUIZ_NAVIGATION] ✅ BLoCs found, triggering refresh...',
                          );

                          // Immediately trigger API calls
                          courseBloc.add(const RefreshCourses());
                          learningPathBloc.add(const RefreshLearningPaths());

                          safePrint(
                            '[QUIZ_NAVIGATION] ✅ Refresh events dispatched',
                          );
                        } catch (e) {
                          safePrint(
                            '[QUIZ_NAVIGATION] ⚠️ Could not access BLoCs from navigator context: $e',
                          );
                          // Fallback to background refresh service
                          QuizCompletionService.triggerBackgroundRefresh(
                            quizPassed: passed,
                            delayMs: 1500,
                          );
                        }
                      } else {
                        safePrint(
                          '[QUIZ_NAVIGATION] ⚠️ Navigator context not available, using background refresh',
                        );
                        // Fallback to background refresh service
                        QuizCompletionService.triggerBackgroundRefresh(
                          quizPassed: passed,
                          delayMs: 1500,
                        );
                      }
                    }

                    Future.delayed(const Duration(milliseconds: 500), () {
                      if (!context.mounted) {
                        safePrint(
                          '[QUIZ_NAVIGATION] ⚠️ Context not mounted, skipping navigation',
                        );
                        return;
                      }

                      // Navigate based on source with flag to show loader
                      if (source == 'learning_path' && learningPath != null) {
                        // User came from learning path → Navigate back to learning path progress screen
                        safePrint(
                          '[QUIZ_NAVIGATION] 🎯 Navigating back to Learning Path: ${learningPath.title}',
                        );

                        // Pass flag to indicate returning from quiz
                        context.go(
                          '/learning-path-progress',
                          extra: {
                            'learningPath': learningPath,
                            'returningFromQuiz':
                                passed, // Show loader if quiz passed
                          },
                        );
                      } else {
                        // User came from course list → Navigate back to home (course list screen)
                        safePrint(
                          '[QUIZ_NAVIGATION] 🎯 Navigating back to Course List (Home)',
                        );

                        // Always pass flag when quiz passed to trigger refresh
                        if (passed) {
                          safePrint(
                            '[QUIZ_NAVIGATION] ✅ Quiz passed - navigating with refresh flag',
                          );
                          context.go('/home?returningFromQuiz=true');
                        } else {
                          context.go('/home');
                        }
                      }
                    });
                  },
                  onClose: () {
                    context.pop();
                  },
                ),
              ),
              transitionsBuilder:
                  (context, animation, secondaryAnimation, child) {
                return FadeTransition(
                  opacity: animation,
                  child: SlideTransition(
                    position: Tween<Offset>(
                      begin: const Offset(0.0, 0.1),
                      end: Offset.zero,
                    ).animate(
                      CurvedAnimation(
                        parent: animation,
                        curve: Curves.easeOutCubic,
                      ),
                    ),
                    child: child,
                  ),
                );
              },
            );
          },
        ),
        GoRoute(
          path: '/learning-path-progress',
          pageBuilder: (context, state) {
            // Handle both direct LearningPath and Map with LearningPath + flag
            LearningPath? learningPath;
            bool returningFromQuiz = false;

            if (state.extra is LearningPath) {
              learningPath = state.extra as LearningPath;
            } else if (state.extra is Map<String, dynamic>) {
              final extra = state.extra as Map<String, dynamic>;
              learningPath = extra['learningPath'] as LearningPath?;
              returningFromQuiz = extra['returningFromQuiz'] as bool? ?? false;
            }

            if (learningPath == null) {
              return MaterialPage(
                child: const Scaffold(
                  body: Center(child: Text('Learning path not found')),
                ),
              );
            }
            // Try to get existing BLoCs from parent context (MainTabNavigator)
            // If not available, create new ones
            LearningPathBloc learningPathBloc;
            CourseBloc courseBloc;

            try {
              learningPathBloc = context.read<LearningPathBloc>();
            } catch (e) {
              // Fallback: create new BLoC if not found in context
              learningPathBloc = LearningPathBloc();
            }

            try {
              courseBloc = context.read<CourseBloc>();
            } catch (e) {
              // Fallback: create new BLoC if not found in context
              courseBloc = CourseBloc();
            }

            return CustomTransitionPage(
              key: state.pageKey,
              child: MultiBlocProvider(
                providers: [
                  BlocProvider.value(value: learningPathBloc),
                  BlocProvider.value(value: courseBloc),
                ],
                child: LearningPathProgressScreen(
                  learningPath: learningPath,
                  returningFromQuiz: returningFromQuiz,
                ),
              ),
              transitionsBuilder:
                  (context, animation, secondaryAnimation, child) {
                return FadeTransition(
                  opacity: animation,
                  child: SlideTransition(
                    position: Tween<Offset>(
                      begin: const Offset(0.0, 0.05),
                      end: Offset.zero,
                    ).animate(
                      CurvedAnimation(
                        parent: animation,
                        curve: Curves.easeOutCubic,
                      ),
                    ),
                    child: child,
                  ),
                );
              },
            );
          },
        ),
      ],
    );
  }
}

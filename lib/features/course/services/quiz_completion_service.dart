import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:amplify_flutter/amplify_flutter.dart';
import '../../../core/router/app_router.dart';
import '../../learning_path/presentation/bloc/learning_path_bloc.dart';
import '../presentation/bloc/course_bloc.dart';

class QuizCompletionService {
  QuizCompletionService._(); // Private constructor

  static void triggerBackgroundRefresh({
    required bool quizPassed,
    int delayMs = 1500, // Wait for backend to update assignment status
    CourseBloc? courseBloc,
    LearningPathBloc? learningPathBloc,
    BuildContext? context,
  }) {
    if (!quizPassed) {
      safePrint(
          '[QUIZ_COMPLETION] Quiz not passed, skipping background refresh');
      return;
    }

    safePrint('[QUIZ_COMPLETION] ========================================');
    safePrint(
        '[QUIZ_COMPLETION] 🎯 Quiz passed! Triggering background API refresh...');
    safePrint('[QUIZ_COMPLETION] ========================================');

    // Wait for backend to update assignment status before refreshing
    Future.delayed(Duration(milliseconds: delayMs), () {
      _refreshApisInBackground(
        courseBloc: courseBloc,
        learningPathBloc: learningPathBloc,
        context: context,
      );
    });
  }

  /// Refresh APIs in background without blocking UI
  ///
  /// Note: BLoCs may not be accessible from quiz route context.
  /// ScreenRefreshMixin will handle refresh when user navigates back to screens.
  static void _refreshApisInBackground({
    CourseBloc? courseBloc,
    LearningPathBloc? learningPathBloc,
    BuildContext? context,
  }) {
    safePrint('[QUIZ_COMPLETION] [STEP 1] Starting background API refresh...');

    // Try to get BLoCs from provided parameters first
    CourseBloc? courseBlocToUse = courseBloc;
    LearningPathBloc? learningPathBlocToUse = learningPathBloc;

    // If not provided, try to get from context (may not work if BLoCs are scoped)
    if (context != null && context.mounted) {
      try {
        courseBlocToUse ??= context.read<CourseBloc>();
        safePrint('[QUIZ_COMPLETION] ✅ CourseBloc found in provided context');
      } catch (e) {
        // Expected - BLoCs are scoped to MainTabNavigator, not accessible from quiz route
        safePrint(
            '[QUIZ_COMPLETION] ℹ️ CourseBloc not in quiz route context (expected)');
      }

      try {
        learningPathBlocToUse ??= context.read<LearningPathBloc>();
        safePrint(
            '[QUIZ_COMPLETION] ✅ LearningPathBloc found in provided context');
      } catch (e) {
        // Expected - BLoCs are scoped to MainTabNavigator, not accessible from quiz route
        safePrint(
            '[QUIZ_COMPLETION] ℹ️ LearningPathBloc not in quiz route context (expected)');
      }
    }

    // Try global navigator context as fallback (usually won't work due to scoping)
    if (courseBlocToUse == null || learningPathBlocToUse == null) {
      final navigatorContext = AppRouter.navigatorKey.currentContext;
      if (navigatorContext != null && navigatorContext.mounted) {
        try {
          courseBlocToUse ??= navigatorContext.read<CourseBloc>();
          safePrint(
              '[QUIZ_COMPLETION] ✅ CourseBloc found in global navigator context');
        } catch (e) {
          safePrint(
              '[QUIZ_COMPLETION] ℹ️ CourseBloc not in global navigator context (expected)');
        }

        try {
          learningPathBlocToUse ??= navigatorContext.read<LearningPathBloc>();
          safePrint(
              '[QUIZ_COMPLETION] ✅ LearningPathBloc found in global navigator context');
        } catch (e) {
          safePrint(
              '[QUIZ_COMPLETION] ℹ️ LearningPathBloc not in global navigator context (expected)');
        }
      }
    }

    // Refresh Course List API if BLoC is available
    if (courseBlocToUse != null) {
      try {
        courseBlocToUse.add(const RefreshCourses());
        safePrint(
            '[QUIZ_COMPLETION] [STEP 2] ✅ RefreshCourses event dispatched');
      } catch (e) {
        safePrint(
            '[QUIZ_COMPLETION] [STEP 2] ❌ Error dispatching RefreshCourses: $e');
      }
    } else {
      safePrint(
          '[QUIZ_COMPLETION] [STEP 2] ℹ️ CourseBloc not accessible (will refresh via ScreenRefreshMixin)');
    }

    // Refresh Learning Path API if BLoC is available
    if (learningPathBlocToUse != null) {
      try {
        learningPathBlocToUse.add(const RefreshLearningPaths());
        safePrint(
            '[QUIZ_COMPLETION] [STEP 3] ✅ RefreshLearningPaths event dispatched');
      } catch (e) {
        safePrint(
            '[QUIZ_COMPLETION] [STEP 3] ❌ Error dispatching RefreshLearningPaths: $e');
      }
    } else {
      safePrint(
          '[QUIZ_COMPLETION] [STEP 3] ℹ️ LearningPathBloc not accessible (will refresh via ScreenRefreshMixin)');
    }

    safePrint(
        '[QUIZ_COMPLETION] [STEP 4] ✅ Background refresh attempt complete');
    safePrint('[QUIZ_COMPLETION] ========================================');
    safePrint(
        '[QUIZ_COMPLETION] ✅ ScreenRefreshMixin will refresh data when user navigates back');
    safePrint('[QUIZ_COMPLETION] ========================================');
  }

  /// Check if BLoCs are available in context
  static bool areBlocsAvailable() {
    final navigatorContext = AppRouter.navigatorKey.currentContext;
    if (navigatorContext == null || !navigatorContext.mounted) {
      return false;
    }

    try {
      navigatorContext.read<CourseBloc>();
      navigatorContext.read<LearningPathBloc>();
      return true;
    } catch (e) {
      return false;
    }
  }
}

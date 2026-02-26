import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../features/course/presentation/bloc/course_bloc.dart';
import '../../features/learning_path/presentation/bloc/learning_path_bloc.dart';
import 'package:amplify_flutter/amplify_flutter.dart';

/// Mixin to automatically refresh data when screen becomes visible
/// 
/// This ensures that when user navigates back to a screen after quiz completion,
/// the UI reflects the latest data from APIs.
mixin ScreenRefreshMixin<T extends StatefulWidget> on State<T> {
  bool _hasRefreshedOnVisible = false;

  /// Called when screen becomes visible
  /// Override this to add custom refresh logic
  void onScreenVisible() {
    // Default implementation - refresh both APIs
    _refreshData();
  }

  /// Refresh course and learning path data
  void _refreshData() {
    if (!mounted) return;

    safePrint('[SCREEN_REFRESH] 🔄 Refreshing data for ${widget.runtimeType}...');

    // Refresh Course List API
    try {
      final courseBloc = context.read<CourseBloc>();
      courseBloc.add(const RefreshCourses());
      safePrint('[SCREEN_REFRESH] ✅ RefreshCourses event dispatched');
    } catch (e) {
      safePrint('[SCREEN_REFRESH] ⚠️ CourseBloc not available: $e');
    }

    // Refresh Learning Path API
    try {
      final learningPathBloc = context.read<LearningPathBloc>();
      learningPathBloc.add(const RefreshLearningPaths());
      safePrint('[SCREEN_REFRESH] ✅ RefreshLearningPaths event dispatched');
    } catch (e) {
      safePrint('[SCREEN_REFRESH] ⚠️ LearningPathBloc not available: $e');
    }
  }

  /// Override didChangeDependencies to detect when screen becomes visible
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    
    // Refresh when screen becomes visible (after initial build)
    // This ensures fresh data when user navigates back
    if (!_hasRefreshedOnVisible) {
      _hasRefreshedOnVisible = true;
      // Delay refresh slightly to ensure context is fully ready
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          onScreenVisible();
        }
      });
    }
  }

  /// Reset refresh flag (useful for testing or manual refresh)
  void resetRefreshFlag() {
    _hasRefreshedOnVisible = false;
  }
}


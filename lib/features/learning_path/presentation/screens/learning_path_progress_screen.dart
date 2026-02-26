import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:go_router/go_router.dart';
import 'package:amplify_flutter/amplify_flutter.dart';
import '../../data/models/learning_path_model.dart';
import '../../../course/data/models/course_model.dart';
import '../../services/learning_path_service.dart';
import '../../../course/services/video_progress_service.dart';
import '../../../../core/services/activity_logger.dart';
import '../bloc/learning_path_bloc.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../course/presentation/bloc/course_bloc.dart';
import '../../../../core/mixins/screen_refresh_mixin.dart';
import '../../../../core/widgets/app_loader.dart';

class LearningPathProgressScreen extends StatefulWidget {
  final LearningPath learningPath;
  final bool returningFromQuiz;

  const LearningPathProgressScreen({
    super.key,
    required this.learningPath,
    this.returningFromQuiz = false,
  });

  @override
  State<LearningPathProgressScreen> createState() =>
      _LearningPathProgressScreenState();
}

class _LearningPathProgressScreenState extends State<LearningPathProgressScreen>
    with ScreenRefreshMixin {
  bool _isRefreshing = false; // Flag to prevent race conditions
  bool _isLoadingCourseAction =
      false; // Flag for loading state during course actions

  @override
  void initState() {
    super.initState();
    // Trigger refresh via BLoC after the first frame
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _refreshDataSafely();
      }
    });
  }

  @override
  void onScreenVisible() {
    // Refresh data when screen becomes visible again
    // This ensures UI shows updated data after quiz completion
    if (mounted) {
      _refreshDataSafely();
    }
  }

  /// Safely refresh data with proper error handling and race condition prevention
  Future<void> _refreshDataSafely() async {
    // Prevent multiple simultaneous refresh calls
    if (_isRefreshing) {
      return;
    }

    _isRefreshing = true;
    try {
      // Refresh learning paths
      if (mounted) {
        context.read<LearningPathBloc>().add(const RefreshLearningPaths());
      }

      // Also refresh courses to ensure both lists are updated
      // Use try-catch with proper error handling
      try {
        if (mounted) {
          context.read<CourseBloc>().add(const RefreshCourses());
        }
      } catch (e) {
        // CourseBloc might not be available - log but don't crash
        safePrint(
          '[LEARNING_PATH] ⚠️ CourseBloc not available: $e',
        );
        // Continue execution - learning path refresh is more important
      }
    } finally {
      // Reset flag after a delay to allow refresh to complete
      Future.delayed(const Duration(milliseconds: 500), () {
        if (mounted) {
          _isRefreshing = false;
        }
      });
    }
  }

  Widget _getStatusIcon(CourseStatus status) {
    switch (status) {
      case CourseStatus.completed:
        return const Icon(
          Icons.check_circle,
          color: AppColors.completedGreen,
          size: 24,
        );
      case CourseStatus.inProgress:
        return const Icon(
          Icons.pause_circle_filled,
          color: AppColors.primaryBlue,
          size: 24,
        );
      case CourseStatus.locked:
        return const Icon(
          Icons.lock,
          color: Colors.grey,
          size: 24,
        );
      case CourseStatus.notStarted:
        return Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
              color: AppColors.continueOrange,
              width: 2,
            ),
          ),
        );
    }
  }

  Color _getStatusColor(CourseStatus status) {
    switch (status) {
      case CourseStatus.completed:
        return AppColors.completedGreen;
      case CourseStatus.inProgress:
        return AppColors.primaryBlue;
      case CourseStatus.notStarted:
        return AppColors.continueOrange;
      case CourseStatus.locked:
        return Colors.grey;
    }
  }

  Color _getStatusBackgroundColor(CourseStatus status) {
    switch (status) {
      case CourseStatus.completed:
        return AppColors.lightGreenBackground;
      case CourseStatus.inProgress:
        return AppColors.lightBlueBackground;
      case CourseStatus.notStarted:
        return AppColors.lightOrangeBackground;
      case CourseStatus.locked:
        return Colors.grey[100]!;
    }
  }

  String _getStatusText(CourseStatus status) {
    switch (status) {
      case CourseStatus.completed:
        return 'Completed';
      case CourseStatus.inProgress:
        return 'In Progress';
      case CourseStatus.locked:
        return 'Locked';
      case CourseStatus.notStarted:
        return 'Not Started';
    }
  }

  Future<void> _handleCourseTap(
      PathCourse pathCourse, LearningPath path) async {
    // Prevent multiple simultaneous taps
    if (_isLoadingCourseAction) {
      return;
    }

    final course = pathCourse.course;

    // If completed, allow review
    if (pathCourse.status == CourseStatus.completed) {
      //_showCompletedCourseDialog(context, course);
      return;
    }

    // Check if course is clickable (handles locked courses)
    if (!LearningPathService.isCourseClickable(pathCourse, path)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Complete previous course to unlock this one'),
          backgroundColor: AppColors.warningOrange,
          duration: Duration(seconds: 2),
        ),
      );
      return;
    }

    // Show loading state
    setState(() {
      _isLoadingCourseAction = true;
    });

    try {
      // Check if video is completed with timeout
      final progressKey = course.assignmentId ?? course.id;
      final isVideoCompleted = await VideoProgressService.isVideoCompleted(
        progressKey,
      ).timeout(
        const Duration(seconds: 5),
        onTimeout: () {
          safePrint(
            '[LEARNING_PATH] ⚠️ Timeout checking video completion status',
          );
          return false;
        },
      );

      if (isVideoCompleted) {
        // Navigate to quiz
        _startQuiz(context, course);
      } else {
        // Log course start
        ActivityLogger.logCourseStart(
          courseId: course.id,
          courseTitle: course.title,
          assignmentId: course.assignmentId,
        );

        // Log video start
        if (course.videoKey != null) {
          ActivityLogger.logVideoStart(
            courseId: course.id,
            courseTitle: course.title,
            videoKey: course.videoKey!,
            assignmentId: course.assignmentId,
          );
        }

        // Navigate to video player
        await context.push('/video-player', extra: course);

        // After video player closes, check if video was completed
        if (mounted) {
          final isVideoCompletedAfter =
              await VideoProgressService.isVideoCompleted(progressKey).timeout(
            const Duration(seconds: 5),
            onTimeout: () {
              safePrint(
                '[LEARNING_PATH] ⚠️ Timeout checking video completion after viewing',
              );
              return false;
            },
          );

          // If video was completed, navigate to quiz
          if (isVideoCompletedAfter) {
            // Small delay to ensure dialog is closed
            await Future.delayed(const Duration(milliseconds: 300));
            if (mounted) {
              _startQuiz(context, course);
            }
          }

          // Immediately refresh paths to update UI with latest progress
          await _refreshDataSafely();
        }
      }
    } catch (e) {
      safePrint('[LEARNING_PATH] ⚠️ Error handling course tap: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: ${e.toString()}'),
            backgroundColor: AppColors.errorRed,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } finally {
      // Reset loading state
      if (mounted) {
        setState(() {
          _isLoadingCourseAction = false;
        });
      }
    }
  }

  void _showCompletedCourseDialog(BuildContext context, Course course) {
    showDialog(
      context: context,
      barrierColor: Colors.black54,
      builder: (context) => Dialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
        ),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Success Icon
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: AppColors.lightGreenBackground,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.check_circle,
                  size: 48,
                  color: AppColors.completedGreen,
                ),
              ),
              const SizedBox(height: 20),
              // Title
              DefaultTextStyle(
                style: TextStyle(decoration: TextDecoration.none),
                child: Text(
                  course.title,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textBlack87,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(height: 12),
              // Message
              DefaultTextStyle(
                style: TextStyle(decoration: TextDecoration.none),
                child: const Text(
                  'You have already completed this course!',
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.grey,
                    height: 1.5,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(height: 24),
              // Review Video Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    context.pop();
                    _reviewVideo(context, course);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.startCourseBackground,
                    foregroundColor: AppColors.startCourseForeground,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 0,
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.play_circle_outline, size: 20),
                      SizedBox(width: 8),
                      DefaultTextStyle(
                        style: TextStyle(decoration: TextDecoration.none),
                        child: Text(
                          'Review Video',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              // Review Quiz Button
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () {
                    context.pop();
                    _reviewQuiz(context, course);
                  },
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppColors.primaryBlue),
                    foregroundColor: AppColors.primaryBlue,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.quiz, size: 20),
                      SizedBox(width: 8),
                      DefaultTextStyle(
                        style: TextStyle(decoration: TextDecoration.none),
                        child: Text(
                          'Review Quiz',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 8),
              // Close Button
              TextButton(
                onPressed: () => context.pop(),
                child: const Text(
                  'Close',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _reviewVideo(BuildContext context, Course course) async {
    await context.push('/video-player', extra: course);

    // Wait a bit for any state updates to complete
    await Future.delayed(const Duration(milliseconds: 300));

    // Immediately refresh data to update UI with latest progress
    if (mounted) {
      await _refreshDataSafely();
    }
  }

  Future<void> _reviewQuiz(BuildContext context, Course course) async {
    if (course.assignmentId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Assignment ID not found'),
          backgroundColor: AppColors.errorRed,
        ),
      );
      return;
    }

    // Get current learning path from state
    LearningPath? currentPath;
    try {
      final learningPathBloc = context.read<LearningPathBloc>();
      final learningPathState = learningPathBloc.state;
      if (learningPathState is LearningPathLoaded) {
        currentPath = learningPathState.paths.firstWhere(
          (p) => p.id == widget.learningPath.id,
          orElse: () => widget.learningPath,
        );
      } else {
        currentPath = widget.learningPath;
      }
    } catch (e) {
      safePrint('[LEARNING_PATH] ⚠️ Error getting learning path: $e');
      currentPath = widget.learningPath;
    }

    await context.push(
      '/quiz',
      extra: {
        'course': course,
        'assignmentId': course.assignmentId!,
        'source':
            'learning_path', // Track that quiz was started from learning path
        'learningPath': currentPath, // Pass learning path for navigation back
      },
    );

    // Wait for backend to update assignment status after quiz completion
    await Future.delayed(const Duration(milliseconds: 1500));

    // Immediately refresh data to update UI with latest progress
    if (mounted) {
      await _refreshDataSafely();
    }
  }

  Future<void> _startQuiz(BuildContext context, Course course) async {
    if (course.assignmentId == null) {
      return;
    }

    // Log quiz start
    ActivityLogger.logQuizStart(
      courseId: course.id,
      courseTitle: course.title,
      assignmentId: course.assignmentId!,
    );

    // Get current learning path from state with error handling
    LearningPath? currentPath;
    try {
      final learningPathBloc = context.read<LearningPathBloc>();
      final learningPathState = learningPathBloc.state;
      if (learningPathState is LearningPathLoaded) {
        currentPath = learningPathState.paths.firstWhere(
          (p) => p.id == widget.learningPath.id,
          orElse: () => widget.learningPath,
        );
      } else {
        currentPath = widget.learningPath;
      }
    } catch (e) {
      safePrint('[LEARNING_PATH] ⚠️ Error getting learning path: $e');
      currentPath = widget.learningPath;
    }

    await context.push(
      '/quiz',
      extra: {
        'course': course,
        'assignmentId': course.assignmentId!,
        'source':
            'learning_path', // Track that quiz was started from learning path
        'learningPath': currentPath, // Pass learning path for navigation back
      },
    );

    // Wait for backend to update assignment status after quiz completion
    await Future.delayed(const Duration(milliseconds: 1500));

    // Immediately refresh data to update UI with latest progress
    if (mounted) {
      await _refreshDataSafely();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
        color: AppColors.lightGrayBackground,
        child: BlocConsumer<LearningPathBloc, LearningPathState>(
          listener: (context, state) {
            // Handle state changes - refresh when data is loaded
            if (state is LearningPathLoaded) {
              // Data loaded successfully, ensure UI is updated
              if (mounted) {
                setState(() {
                  // Trigger UI rebuild to show updated progress
                });
              }
            }
          },
          builder: (context, state) {
            // Show loader when returning from quiz until lists are updated
            // Also show loader during course actions
            CourseState? courseState;
            try {
              courseState = context.watch<CourseBloc>().state;
            } catch (e) {
              // CourseBloc might not be available - continue without it
              safePrint(
                  '[LEARNING_PATH] ⚠️ CourseBloc not available in builder: $e');
            }

            final shouldShowLoader = widget.returningFromQuiz &&
                (state is LearningPathLoading ||
                    courseState is CourseLoading ||
                    !(state is LearningPathLoaded &&
                        courseState is CourseLoaded));

            // Also show loader during course actions
            final showActionLoader = _isLoadingCourseAction;

            // Show shimmer loader for initial data loading
            if (state is LearningPathLoading &&
                !shouldShowLoader &&
                !showActionLoader) {
              return _buildShimmerLoader(context);
            }

            // Show normal loader for button actions (returning from quiz or course action)
            if (shouldShowLoader || showActionLoader) {
              return CustomScrollView(
                slivers: [
                  _buildNavigationBar(context),
                  SliverFillRemaining(
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const CircularProgressIndicator(
                            valueColor: AlwaysStoppedAnimation<Color>(
                              AppColors.primaryBlueAlt,
                            ),
                          ),
                          const SizedBox(height: 16),
                          DefaultTextStyle(
                            style: TextStyle(decoration: TextDecoration.none),
                            child: Text(
                              showActionLoader
                                  ? 'Loading course...'
                                  : widget.returningFromQuiz
                                      ? 'Updating course list...'
                                      : 'Loading learning path...',
                              style: TextStyle(
                                fontSize: 16,
                                color: AppColors.textSecondary,
                                fontWeight: FontWeight.w500,
                                decoration: TextDecoration.none,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              );
            }

            if (state is LearningPathError) {
              return CustomScrollView(
                slivers: [
                  _buildNavigationBar(context),
                  SliverFillRemaining(
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24.0),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.error_outline,
                              size: 64,
                              color: AppColors.red(700),
                            ),
                            const SizedBox(height: 16),
                            DefaultTextStyle(
                              style: TextStyle(decoration: TextDecoration.none),
                              child: Text(
                                'Error Loading Learning Path',
                                style: TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.red(700),
                                  decoration: TextDecoration.none,
                                ),
                              ),
                            ),
                            const SizedBox(height: 12),
                            DefaultTextStyle(
                              style: TextStyle(decoration: TextDecoration.none),
                              child: Text(
                                state.message,
                                style: TextStyle(
                                  fontSize: 14,
                                  color: AppColors.grey(600),
                                  decoration: TextDecoration.none,
                                ),
                                textAlign: TextAlign.center,
                              ),
                            ),
                            const SizedBox(height: 32),
                            ElevatedButton.icon(
                              onPressed: () {
                                context
                                    .read<LearningPathBloc>()
                                    .add(const RefreshLearningPaths());
                                context
                                    .read<CourseBloc>()
                                    .add(const RefreshCourses());
                              },
                              icon: const Icon(Icons.refresh, size: 20),
                              label: const Text('Retry'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.primaryBlue,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 32,
                                  vertical: 14,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              );
            }

            // Find the current path from the loaded paths
            final LearningPath currentPath;
            if (state is LearningPathLoaded) {
              currentPath = state.paths.firstWhere(
                (p) => p.id == widget.learningPath.id,
                orElse: () => widget.learningPath,
              );
            } else {
              currentPath = widget.learningPath;
            }
            return LayoutBuilder(
              builder: (context, constraints) {
                final dims = AppTheme.getDimensions(context);
                final isTablet = dims.isTablet;
                final isSmallScreen = dims.isSmallScreen;
                final screenWidth = constraints.maxWidth;
                final horizontalPadding =
                    isTablet ? (screenWidth * 0.1).clamp(16.0, 48.0) : 16.0;
                final cardPadding =
                    isTablet ? 24.0 : (isSmallScreen ? 16.0 : 20.0);

                return CustomScrollView(
                  physics: const BouncingScrollPhysics(
                    parent: AlwaysScrollableScrollPhysics(),
                  ),
                  slivers: [
                    _buildNavigationBar(context),

                    // Pull-to-refresh
                    CupertinoSliverRefreshControl(
                      onRefresh: () async {
                        // Use safe refresh to prevent race conditions
                        await _refreshDataSafely();
                        // Wait a bit more to ensure refresh completes
                        await Future.delayed(const Duration(milliseconds: 500));
                      },
                    ),

                    // Content
                    SliverPadding(
                      padding: EdgeInsets.symmetric(
                        horizontal: horizontalPadding,
                        vertical: 16.0,
                      ),
                      sliver: SliverList(
                        delegate: SliverChildListDelegate([
                          ConstrainedBox(
                            constraints: BoxConstraints(
                              maxWidth: isTablet ? 800 : double.infinity,
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Path Header
                                Container(
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(16),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withOpacity(0.05),
                                        blurRadius: 10,
                                        offset: const Offset(0, 5),
                                      ),
                                    ],
                                  ),
                                  padding: EdgeInsets.all(cardPadding),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      DefaultTextStyle(
                                        style: const TextStyle(
                                          decoration: TextDecoration.none,
                                        ),
                                        child: Text(
                                          currentPath.title,
                                          style: TextStyle(
                                              fontSize: isTablet
                                                  ? 20
                                                  : (isSmallScreen ? 16 : 18),
                                              fontWeight: FontWeight.bold,
                                              color: AppColors.textBlack87,
                                              decoration: TextDecoration.none),
                                        ),
                                      ),
                                      if (currentPath.description != null) ...[
                                        SizedBox(height: isSmallScreen ? 6 : 8),
                                        DefaultTextStyle(
                                          style: const TextStyle(
                                            decoration: TextDecoration.none,
                                          ),
                                          child: Text(
                                            currentPath.description!,
                                            style: TextStyle(
                                                fontSize: isTablet
                                                    ? 14
                                                    : (isSmallScreen ? 11 : 12),
                                                color: AppColors.textSecondary,
                                                decoration: TextDecoration.none,
                                                height: 1.3),
                                          ),
                                        ),
                                      ],
                                      SizedBox(height: isSmallScreen ? 16 : 20),
                                      // Progress Info
                                      LayoutBuilder(
                                        builder: (context, constraints) {
                                          final isNarrow =
                                              constraints.maxWidth < 300;
                                          return isNarrow
                                              ? Row(
                                                  crossAxisAlignment:
                                                      CrossAxisAlignment.start,
                                                  mainAxisAlignment:
                                                      MainAxisAlignment.start,
                                                  children: [
                                                    DefaultTextStyle(
                                                      style: TextStyle(
                                                          decoration:
                                                              TextDecoration
                                                                  .none),
                                                      child: Text(
                                                        '${currentPath.completedCount} of ${currentPath.totalCount} courses',
                                                        style: TextStyle(
                                                          fontSize: isTablet
                                                              ? 18
                                                              : (isSmallScreen
                                                                  ? 14
                                                                  : 16),
                                                          fontWeight:
                                                              FontWeight.w600,
                                                          color: AppColors
                                                              .textBlack87,
                                                          decoration:
                                                              TextDecoration
                                                                  .none,
                                                        ),
                                                      ),
                                                    ),
                                                    // const SizedBox(height: 8),
                                                    Spacer(),
                                                    Container(
                                                      padding: const EdgeInsets
                                                          .symmetric(
                                                        horizontal: 10,
                                                        vertical: 6,
                                                      ),
                                                      margin: const EdgeInsets
                                                          .symmetric(
                                                          //horizontal: 12,
                                                          //vertical: 6,
                                                          ),
                                                      decoration: BoxDecoration(
                                                        color: AppColors
                                                            .lightBlueBackground,
                                                        borderRadius:
                                                            BorderRadius
                                                                .circular(20),
                                                      ),
                                                      child: DefaultTextStyle(
                                                        style: TextStyle(
                                                            decoration:
                                                                TextDecoration
                                                                    .none),
                                                        child: Text(
                                                          '${currentPath.progressPercentage.toStringAsFixed(0)}%',
                                                          style: TextStyle(
                                                            fontSize: isTablet
                                                                ? 18
                                                                : 16,
                                                            fontWeight:
                                                                FontWeight.bold,
                                                            color: AppColors
                                                                .primaryBlueAlt,
                                                            decoration:
                                                                TextDecoration
                                                                    .none,
                                                          ),
                                                        ),
                                                      ),
                                                    ),
                                                  ],
                                                )
                                              : Row(
                                                  mainAxisAlignment:
                                                      MainAxisAlignment
                                                          .spaceBetween,
                                                  children: [
                                                    Flexible(
                                                      child: DefaultTextStyle(
                                                        style: TextStyle(
                                                            decoration:
                                                                TextDecoration
                                                                    .none),
                                                        child: Text(
                                                          '${currentPath.completedCount} of ${currentPath.totalCount} courses',
                                                          style: TextStyle(
                                                            fontSize: isTablet
                                                                ? 18
                                                                : (isSmallScreen
                                                                    ? 14
                                                                    : 16),
                                                            fontWeight:
                                                                FontWeight.w600,
                                                            color: AppColors
                                                                .textBlack87,
                                                            decoration:
                                                                TextDecoration
                                                                    .none,
                                                          ),
                                                        ),
                                                      ),
                                                    ),
                                                    const SizedBox(width: 12),
                                                    Container(
                                                      padding: const EdgeInsets
                                                          .symmetric(
                                                        horizontal: 12,
                                                        vertical: 6,
                                                      ),
                                                      margin: const EdgeInsets
                                                          .symmetric(
                                                          //horizontal: 12,
                                                          // vertical: 6,
                                                          ),
                                                      decoration: BoxDecoration(
                                                        color: AppColors
                                                            .lightBlueBackground,
                                                        borderRadius:
                                                            BorderRadius
                                                                .circular(20),
                                                      ),
                                                      child: DefaultTextStyle(
                                                        style: TextStyle(
                                                            decoration:
                                                                TextDecoration
                                                                    .none),
                                                        child: Text(
                                                          '${currentPath.progressPercentage.toStringAsFixed(0)}%',
                                                          style: TextStyle(
                                                            fontSize: isTablet
                                                                ? 18
                                                                : 16,
                                                            fontWeight:
                                                                FontWeight.bold,
                                                            color: AppColors
                                                                .primaryBlueAlt,
                                                            decoration:
                                                                TextDecoration
                                                                    .none,
                                                          ),
                                                        ),
                                                      ),
                                                    ),
                                                  ],
                                                );
                                        },
                                      ),
                                      SizedBox(height: isSmallScreen ? 12 : 8),
                                      // Progress Bar
                                      ClipRRect(
                                        borderRadius: BorderRadius.circular(8),
                                        child: LinearProgressIndicator(
                                          value:
                                              currentPath.progressPercentage /
                                                  100,
                                          backgroundColor: AppColors.grey(200),
                                          valueColor:
                                              const AlwaysStoppedAnimation<
                                                  Color>(
                                            AppColors.primaryBlueAlt,
                                          ),
                                          minHeight: isTablet
                                              ? 12
                                              : (isSmallScreen ? 8 : 10),
                                        ),
                                      ),
                                      SizedBox(height: isSmallScreen ? 12 : 16),

                                      Wrap(
                                        spacing: isSmallScreen ? 6 : 8,
                                        runSpacing: isSmallScreen ? 6 : 8,
                                        children: [
                                          Container(
                                            width: isTablet
                                                ? 100
                                                : (isSmallScreen ? 75 : 85),
                                            padding: EdgeInsets.symmetric(
                                              horizontal: 8,
                                              vertical: isSmallScreen ? 6 : 10,
                                            ),
                                            decoration: BoxDecoration(
                                              color: currentPath.isSequential
                                                  ? Colors.blue[100]
                                                  : Colors.green[100],
                                              borderRadius:
                                                  BorderRadius.circular(10),
                                            ),
                                            child: Center(
                                              child: DefaultTextStyle(
                                                style: TextStyle(
                                                    decoration:
                                                        TextDecoration.none),
                                                child: Text(
                                                  currentPath.isSequential
                                                      ? 'Sequential'
                                                      : 'Flexible',
                                                  style: TextStyle(
                                                      fontSize: isTablet
                                                          ? 12
                                                          : (isSmallScreen
                                                              ? 10
                                                              : 11),
                                                      fontWeight:
                                                          FontWeight.w600,
                                                      color: Colors.black,
                                                      decoration:
                                                          TextDecoration.none),
                                                  textAlign: TextAlign.center,
                                                ),
                                              ),
                                            ),
                                          ),

                                          /*
    Chip(
      label: Text(
        path.isSequential ? 'Sequential' : 'Flexible',
        style: TextStyle(
          fontSize: isTablet ? 12 : (isSmallScreen ? 10 : 11),
          fontWeight: FontWeight.w600,
        ),
      ),
      backgroundColor: path.isSequential
          ? Colors.blue[100]
          : Colors.green[100],
      padding: EdgeInsets.symmetric(
      //  horizontal: isTablet ? 10 : 8,
        vertical: isSmallScreen ? 4 : 6,
      ),
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
    ),
*/
                                          if (currentPath.version != null)
                                            Container(
                                              padding: EdgeInsets.symmetric(
                                                horizontal: isTablet ? 12 : 10,
                                                vertical: isSmallScreen ? 4 : 6,
                                              ),
                                              decoration: BoxDecoration(
                                                color: AppColors.primaryBlueAlt
                                                    .withOpacity(0.1),
                                                borderRadius:
                                                    BorderRadius.circular(12),
                                                border: Border.all(
                                                  color: AppColors
                                                      .primaryBlueAlt
                                                      .withOpacity(0.3),
                                                  width: 1,
                                                ),
                                              ),
                                              child: DefaultTextStyle(
                                                style: TextStyle(
                                                    decoration:
                                                        TextDecoration.none),
                                                child: Text(
                                                  'v${currentPath.version}',
                                                  style: TextStyle(
                                                    fontSize: isTablet
                                                        ? 13
                                                        : (isSmallScreen
                                                            ? 10
                                                            : 12),
                                                    fontWeight: FontWeight.w700,
                                                    color: AppColors
                                                        .primaryBlueAlt,
                                                    letterSpacing: 0.5,
                                                    decoration:
                                                        TextDecoration.none,
                                                  ),
                                                ),
                                              ),
                                            ),
                                          if (currentPath.dueDate != null)
                                            Material(
                                              color: Colors.transparent,
                                              child: Chip(
                                                avatar: const Icon(
                                                  Icons.calendar_today,
                                                  size: 14,
                                                  color:
                                                      AppColors.warningOrange,
                                                ),
                                                label: DefaultTextStyle(
                                                  style: TextStyle(
                                                      decoration:
                                                          TextDecoration.none),
                                                  child: Text(
                                                    'Due: ${_formatDate(currentPath.dueDate!)}',
                                                    style: const TextStyle(
                                                        fontSize: 11,
                                                        fontWeight:
                                                            FontWeight.w600,
                                                        decoration:
                                                            TextDecoration.none,
                                                        color: Colors.black),
                                                  ),
                                                ),
                                                backgroundColor:
                                                    Colors.orange[100],
                                                //    padding: const EdgeInsets.symmetric(horizontal: 8),
                                                materialTapTargetSize:
                                                    MaterialTapTargetSize
                                                        .shrinkWrap,
                                              ),
                                            ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                                SizedBox(height: isSmallScreen ? 16 : 24),
                                // Courses List
                                DefaultTextStyle(
                                  style: TextStyle(
                                      decoration: TextDecoration.none),
                                  child: Text(
                                    'Courses',
                                    style: TextStyle(
                                      fontSize: isTablet
                                          ? 24
                                          : (isSmallScreen ? 18 : 20),
                                      fontWeight: FontWeight.bold,
                                      color: AppColors.textBlack87,
                                      decoration: TextDecoration.none,
                                    ),
                                  ),
                                ),
                                SizedBox(height: isSmallScreen ? 12 : 16),
                                // Build course list with sections: In Progress and Completed
                                if (currentPath.courses.isEmpty)
                                  _buildEmptyCoursesState(context)
                                else
                                  ..._buildCourseListWithSections(
                                      currentPath, dims),
                              ],
                            ),
                          ),
                        ]),
                      ),
                    ),
                  ],
                );
              },
            );
          },
        ));
  }

  /// Build shimmer loader for learning path screen
  Widget _buildShimmerLoader(BuildContext context) {
    return CustomScrollView(
      slivers: [
        _buildNavigationBar(context),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          sliver: SliverList(
            delegate: SliverChildListDelegate([
              // Path header skeleton
              const LearningPathSkeletonLoader(),
              const SizedBox(height: 16),
              // Course cards skeletons
              ...List.generate(
                  4,
                  (index) => Padding(
                        padding: EdgeInsets.only(bottom: index == 3 ? 0 : 12),
                        child: const LearningPathSkeletonLoader(),
                      )),
            ]),
          ),
        ),
      ],
    );
  }

  /// Build empty state when learning path has no courses
  Widget _buildEmptyCoursesState(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.school_outlined,
            size: 64,
            color: AppColors.grey(400),
          ),
          const SizedBox(height: 16),
          Text(
            'No Courses in This Path',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: AppColors.grey(700),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'This learning path doesn\'t have any courses yet',
            style: TextStyle(
              fontSize: 14,
              color: AppColors.grey(500),
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: () {
              context
                  .read<LearningPathBloc>()
                  .add(const RefreshLearningPaths());
              context.read<CourseBloc>().add(const RefreshCourses());
            },
            icon: const Icon(Icons.refresh, size: 20),
            label: const Text('Retry'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primaryBlue,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(
                horizontal: 32,
                vertical: 14,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ],
      ),
    );
  }

  CupertinoSliverNavigationBar _buildNavigationBar(BuildContext context) {
    return CupertinoSliverNavigationBar(
      largeTitle: const Text(
        'Learning Path',
        style: TextStyle(
          //fontSize: 28,
          fontWeight: FontWeight.w500,
          color: AppColors.textBlack87,
        ),
      ),
      backgroundColor: AppColors.lightGrayBackground.withOpacity(0.95),
      border: null,
      stretch: true,
      leading: CupertinoButton(
        padding: EdgeInsets.zero,
        onPressed: () {
          // Navigate to home instead of pop (since we use context.go which replaces stack)
          if (context.canPop()) {
            //context.pop();
            context.go('/home');
          } else {
            context.go('/home');
          }
        },
        child: Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: AppColors.white,
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: AppColors.shadowColor,
                blurRadius: 8,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: const Icon(
            CupertinoIcons.back,
            color: AppColors.textBlack87,
            size: 20,
          ),
        ),
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.month}/${date.day}/${date.year}';
  }

  /// Build course list with sections: In Progress and Completed
  List<Widget> _buildCourseListWithSections(
    LearningPath path,
    ResponsiveDimensions dims,
  ) {
    final isTablet = dims.isTablet;
    final isSmallScreen = dims.isSmallScreen;

    // Separate courses into two sections
    final inProgressCourses = path.courses.where((pathCourse) {
      return pathCourse.status != CourseStatus.completed;
    }).toList();

    final completedCourses = path.courses.where((pathCourse) {
      return pathCourse.status == CourseStatus.completed;
    }).toList();

    final List<Widget> widgets = [];

    // In Progress Section
    if (inProgressCourses.isNotEmpty) {
      widgets.addAll(
        inProgressCourses
            .map((pathCourse) => _buildCourseCard(pathCourse, path, dims)),
      );
    }

    // Completed Section
    if (completedCourses.isNotEmpty) {
      if (inProgressCourses.isNotEmpty) {
        widgets.add(SizedBox(height: isSmallScreen ? 24 : 12));
      }

      //widgets.add(SizedBox(height: isSmallScreen ? 12 : 16));
      widgets.addAll(
        completedCourses
            .map((pathCourse) => _buildCourseCard(pathCourse, path, dims)),
      );
    }

    return widgets;
  }

  Widget _buildCourseCard(
    PathCourse pathCourse,
    LearningPath path,
    ResponsiveDimensions dims,
  ) {
    final isTablet = dims.isTablet;
    final isSmallScreen = dims.isSmallScreen;
    final course = pathCourse.course;

    // Use service methods for all business logic
    final isLocked = pathCourse.status == CourseStatus.locked;
    final isCurrentCourse = LearningPathService.isCurrentCourse(
      pathCourse,
      path,
    );
    final isClickable = LearningPathService.isCourseClickable(
      pathCourse,
      path,
    );

    return Container(
      margin: EdgeInsets.only(bottom: isSmallScreen ? 10 : 12),
      decoration: BoxDecoration(
        color: isLocked
            ? Colors.grey[50] // Grayed out background for locked courses
            : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: isCurrentCourse
            ? Border.all(
                color: AppColors.primaryBlueAlt,
                width: 2,
              )
            : isLocked
                ? Border.all(
                    color: Colors.grey[300]!,
                    width: 1,
                  )
                : null,
        boxShadow: [
          BoxShadow(
            color: isCurrentCourse
                ? AppColors.primaryBlueAlt.withOpacity(0.1)
                : isLocked
                    ? Colors.grey.withOpacity(0.1)
                    : Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: isClickable ? () => _handleCourseTap(pathCourse, path) : null,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding:
                EdgeInsets.all(isTablet ? 20.0 : (isSmallScreen ? 12.0 : 16.0)),
            child: Row(
              children: [
                // Status Icon
                Container(
                  width: isTablet ? 56 : (isSmallScreen ? 40 : 48),
                  height: isTablet ? 56 : (isSmallScreen ? 40 : 48),
                  decoration: BoxDecoration(
                    color: _getStatusBackgroundColor(pathCourse.status),
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: _getStatusIcon(pathCourse.status),
                  ),
                ),
                SizedBox(width: isTablet ? 20 : (isSmallScreen ? 12 : 16)),
                // Course Info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: DefaultTextStyle(
                              style: TextStyle(decoration: TextDecoration.none),
                              child: Text(
                                course.title,
                                style: TextStyle(
                                  fontSize:
                                      isTablet ? 18 : (isSmallScreen ? 14 : 16),
                                  fontWeight: FontWeight.w600,
                                  color: isLocked
                                      ? AppColors.textSecondary
                                      : AppColors.textBlack87,
                                ),
                              ),
                            ),
                          ),
                          /*
                          if (isCurrentCourse)
                            Container(
                              padding: EdgeInsets.symmetric(
                                horizontal: isTablet ? 10 : 8,
                                vertical: isSmallScreen ? 3 : 4,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.lightBlueBackground,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                'Current',
                                style: TextStyle(
                                  fontSize:
                                      isTablet ? 12 : (isSmallScreen ? 10 : 11),
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.primaryBlueAlt,
                                ),
                              ),
                            ),
                        */
                        ],
                      ),
                      SizedBox(height: isSmallScreen ? 4 : 6),
                      Row(
                        children: [
                          Flexible(
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: _getStatusBackgroundColor(
                                    pathCourse.status),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: DefaultTextStyle(
                                style:
                                    TextStyle(decoration: TextDecoration.none),
                                child: Text(
                                  _getStatusText(pathCourse.status),
                                  style: TextStyle(
                                    fontSize: isTablet
                                        ? 13
                                        : (isSmallScreen ? 11 : 12),
                                    color: _getStatusColor(pathCourse.status),
                                    fontWeight: FontWeight.w600,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ),
                          ),
                          if (course.duration != null) ...[
                            const SizedBox(width: 8),
                            Flexible(
                              child: DefaultTextStyle(
                                style:
                                    TextStyle(decoration: TextDecoration.none),
                                child: Text(
                                  '• ${course.duration}',
                                  style: TextStyle(
                                    fontSize: isTablet
                                        ? 13
                                        : (isSmallScreen ? 11 : 12),
                                    color: isLocked
                                        ? AppColors.textSecondary
                                            .withOpacity(0.6)
                                        : AppColors.textSecondary,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      if (isLocked && path.isSequential) ...[
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            Icon(
                              Icons.info_outline,
                              size: 14,
                              color: AppColors.textSecondary,
                            ),
                            const SizedBox(width: 4),
                            Expanded(
                              child: DefaultTextStyle(
                                style:
                                    TextStyle(decoration: TextDecoration.none),
                                child: Text(
                                  'Complete previous course to unlock',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: AppColors.textSecondary,
                                    fontStyle: FontStyle.italic,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
                // Arrow Icon or Lock Icon
                Icon(
                  Icons.chevron_right,
                  color: AppColors.textSecondary,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:go_router/go_router.dart';
import 'package:amplify_flutter/amplify_flutter.dart';
import '../../data/models/learning_path_model.dart';
import '../../../course/data/models/course_model.dart';
import '../../services/learning_path_service.dart';
import '../bloc/learning_path_bloc.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../course/presentation/bloc/course_bloc.dart';
import '../../../course/presentation/course_list/course_list_filter.dart';
import '../../../course/presentation/widgets/course_list/course_lesson_list_section.dart';
import '../../../course/services/combined_progress_calculator.dart';
import '../../../course/services/course_image_preload_service.dart';
import '../../../course/services/lesson_completion_service.dart';
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

class _LearningPathProgressScreenState
    extends State<LearningPathProgressScreen> {
  bool _isRefreshing = false; // Flag to prevent race conditions
  final Map<String, String> _imageUrlCache = {};
  int _lessonProgressRebuildCounter = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _loadDataIfNeeded();
      if (mounted) _preloadPathCourseImages();
    });
  }

  void _preloadPathCourseImages() {
    if (!mounted) return;
    final courses = widget.learningPath.courses.map((pc) => pc.course).toList();
    CourseImagePreloadService.preloadForCourses(
      courses: courses,
      imageUrlCache: _imageUrlCache,
      context: context,
      isMounted: () => mounted,
      scheduleSetState: (fn) => setState(fn),
    );
  }

  /// Load data only when blocs are Initial/Error; otherwise use existing data.
  Future<void> _loadDataIfNeeded() async {
    if (_isRefreshing || !mounted) return;
    // If caller already passed learning-path data (CourseListScreen path card),
    // render from passed model and avoid entry-time API calls/reloads.
    if (widget.learningPath.courses.isNotEmpty && !widget.returningFromQuiz) {
      return;
    }
    final learningPathState = context.read<LearningPathBloc>().state;
    final needLoad = learningPathState is LearningPathInitial ||
        learningPathState is LearningPathError;
    if (!needLoad) return;

    _isRefreshing = true;
    try {
      if (mounted) {
        // Use load (not refresh) when bloc has no data yet — same as home screen.
        context.read<LearningPathBloc>().add(const LoadLearningPaths());
      }
      try {
        if (mounted) {
          final courseState = context.read<CourseBloc>().state;
          if (courseState is CourseInitial || courseState is CourseError) {
            context.read<CourseBloc>().add(const LoadCourses());
          }
        }
      } catch (e) {
        safePrint('[LEARNING_PATH] ⚠️ CourseBloc not available: $e');
      }
    } finally {
      Future.delayed(const Duration(milliseconds: 500), () {
        if (mounted) _isRefreshing = false;
      });
    }
  }

  /// Explicit refresh (retry, after quiz, etc.).
  Future<void> _refreshDataSafely() async {
    if (_isRefreshing || !mounted) return;
    _isRefreshing = true;
    try {
      if (mounted) {
        context.read<LearningPathBloc>().add(const RefreshLearningPaths());
      }
      try {
        if (mounted) {
          context.read<CourseBloc>().add(const RefreshCourses());
        }
      } catch (e) {
        safePrint('[LEARNING_PATH] ⚠️ CourseBloc not available: $e');
      }
    } finally {
      Future.delayed(const Duration(milliseconds: 500), () {
        if (mounted) _isRefreshing = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
        color: AppColors.lightGrayBackground,
        child: BlocBuilder<LearningPathBloc, LearningPathState>(
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

            // Show shimmer loader for initial data loading
            if (state is LearningPathLoading && !shouldShowLoader) {
              return _buildShimmerLoader(context);
            }

            // Show normal loader when returning from quiz until lists are updated
            if (shouldShowLoader) {
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
                              widget.returningFromQuiz
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
                                      if (currentPath.isCertificationPath ||
                                          currentPath.mandatoryForScheduling ==
                                              true ||
                                          currentPath.certificationUiSubtitle !=
                                              null) ...[
                                        SizedBox(
                                            height: isSmallScreen ? 10 : 12),
                                        Wrap(
                                          spacing: 8,
                                          runSpacing: 8,
                                          children: [
                                            if (currentPath.isCertificationPath)
                                              Container(
                                                padding: EdgeInsets.symmetric(
                                                  horizontal:
                                                      isTablet ? 12 : 10,
                                                  vertical:
                                                      isSmallScreen ? 4 : 5,
                                                ),
                                                decoration: BoxDecoration(
                                                  color: AppColors
                                                      .lightOrangeBackground,
                                                  borderRadius:
                                                      BorderRadius.circular(10),
                                                  border: Border.all(
                                                    color: AppColors
                                                        .continueOrange
                                                        .withValues(
                                                            alpha: 0.35),
                                                  ),
                                                ),
                                                child: Text(
                                                  'Certification',
                                                  style: TextStyle(
                                                    fontSize: isTablet
                                                        ? 13
                                                        : (isSmallScreen
                                                            ? 11
                                                            : 12),
                                                    fontWeight: FontWeight.w700,
                                                    color: AppColors
                                                        .continueOrange,
                                                    decoration:
                                                        TextDecoration.none,
                                                  ),
                                                ),
                                              ),
                                            if (currentPath
                                                    .mandatoryForScheduling ==
                                                true)
                                              Container(
                                                padding: EdgeInsets.symmetric(
                                                  horizontal:
                                                      isTablet ? 12 : 10,
                                                  vertical:
                                                      isSmallScreen ? 4 : 5,
                                                ),
                                                decoration: BoxDecoration(
                                                  color: AppColors
                                                      .lightBlueBackground,
                                                  borderRadius:
                                                      BorderRadius.circular(10),
                                                  border: Border.all(
                                                    color: AppColors.primaryBlue
                                                        .withValues(
                                                            alpha: 0.25),
                                                  ),
                                                ),
                                                child: Text(
                                                  'Scheduling',
                                                  style: TextStyle(
                                                    fontSize: isTablet
                                                        ? 13
                                                        : (isSmallScreen
                                                            ? 11
                                                            : 12),
                                                    fontWeight: FontWeight.w700,
                                                    color:
                                                        AppColors.primaryBlue,
                                                    decoration:
                                                        TextDecoration.none,
                                                  ),
                                                ),
                                              ),
                                          ],
                                        ),
                                        if (currentPath
                                                .certificationUiSubtitle !=
                                            null) ...[
                                          SizedBox(
                                              height: isSmallScreen ? 6 : 8),
                                          DefaultTextStyle(
                                            style: const TextStyle(
                                              decoration: TextDecoration.none,
                                            ),
                                            child: Text(
                                              currentPath
                                                  .certificationUiSubtitle!,
                                              style: TextStyle(
                                                fontSize: isTablet
                                                    ? 14
                                                    : (isSmallScreen ? 12 : 13),
                                                fontWeight: FontWeight.w600,
                                                color: currentPath
                                                                .daysUntilCertificationExpires !=
                                                            null &&
                                                        currentPath
                                                                .daysUntilCertificationExpires! <
                                                            0
                                                    ? AppColors.errorRed
                                                    : AppColors.textSecondary,
                                                decoration: TextDecoration.none,
                                              ),
                                            ),
                                          ),
                                        ],
                                        if (currentPath.assignment
                                                    ?.certificationStatus !=
                                                null &&
                                            currentPath
                                                .assignment!
                                                .certificationStatus!
                                                .isNotEmpty) ...[
                                          SizedBox(
                                              height: isSmallScreen ? 4 : 6),
                                          DefaultTextStyle(
                                            style: const TextStyle(
                                              decoration: TextDecoration.none,
                                            ),
                                            child: Text(
                                              'Certification status: ${currentPath.assignment!.certificationStatus}',
                                              style: TextStyle(
                                                fontSize: isTablet
                                                    ? 12
                                                    : (isSmallScreen ? 10 : 11),
                                                color: AppColors.textSecondary,
                                                decoration: TextDecoration.none,
                                              ),
                                            ),
                                          ),
                                        ],
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

  /// Same card layout as the home [CourseListScreen] course card: thumbnail,
  /// description, [CourseLessonListSection], tags, Start Quiz, completed badge.
  /// Tap opens [CourseDetailsScreen] (aligned with course list flow).
  Widget _buildCourseCard(
    PathCourse pathCourse,
    LearningPath path,
    ResponsiveDimensions dims,
  ) {
    final isSmallScreen = dims.isSmallScreen;
    final course = pathCourse.course;
    final cacheKey = course.assignmentId ?? course.id;

    final isLocked = pathCourse.status == CourseStatus.locked;
    final isCurrentCourse = LearningPathService.isCurrentCourse(
      pathCourse,
      path,
    );
    final isClickable = LearningPathService.isCourseClickable(
      pathCourse,
      path,
    );

    final courseDone = course.assignmentStatus == 'completed' ||
        pathCourse.status == CourseStatus.completed;

    return Padding(
      padding: EdgeInsets.only(bottom: isSmallScreen ? 10 : 12),
      child: Opacity(
        opacity: isLocked ? 0.72 : 1.0,
        child: Material(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(28),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: () {
              if (!isClickable) {
                if (isLocked) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content:
                          Text('Complete previous course to unlock this one'),
                      backgroundColor: AppColors.warningOrange,
                      duration: Duration(seconds: 2),
                    ),
                  );
                }
                return;
              }
              context.push('/course-details', extra: course).then((_) {
                if (mounted) {
                  _lessonProgressRebuildCounter++;
                  setState(() {});
                }
              });
            },
            borderRadius: BorderRadius.circular(28),
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(28),
                border: isCurrentCourse
                    ? Border.all(
                        color: AppColors.primaryBlueAlt,
                        width: 2,
                      )
                    : null,
                boxShadow: [
                  BoxShadow(
                    color: isCurrentCourse
                        ? AppColors.primaryBlueAlt.withValues(alpha: 0.12)
                        : Colors.black.withValues(alpha: 0.05),
                    blurRadius: 20,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              course.title,
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textBlack87,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              CourseListFilter.description(course),
                              style: const TextStyle(
                                fontSize: 14,
                                height: 1.4,
                                color: AppColors.textSecondary,
                              ),
                            ),
                            if (isLocked && path.isSequential) ...[
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  Icon(
                                    Icons.lock_outline,
                                    size: 16,
                                    color: AppColors.textSecondary,
                                  ),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      'Complete the previous course to unlock',
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: AppColors.textSecondary,
                                        fontStyle: FontStyle.italic,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(width: 16),
                      _buildLpCourseThumbnail(course),
                    ],
                  ),
                  if (course.lessons.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    CourseLessonListSection(
                      course: course,
                      progressRebuildKey: _lessonProgressRebuildCounter,
                      onAfterLessonReturn: (pathProgressChanged) {
                        if (!mounted) return;
                        _lessonProgressRebuildCounter++;
                        setState(() {});
                        if (pathProgressChanged) {
                          _refreshDataSafely();
                        }
                      },
                    ),
                  ],
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _learningPathCourseTags(course)
                        .map(
                          (tag) => Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: courseDone
                                  ? AppColors.grey(200)
                                  : AppColors.lightBlueBackground,
                              borderRadius: BorderRadius.circular(24),
                            ),
                            child: Text(
                              tag,
                              style: TextStyle(
                                color: courseDone
                                    ? AppColors.grey(600)
                                    : AppColors.primaryBlue,
                                fontWeight: FontWeight.w600,
                                fontSize: 12,
                              ),
                            ),
                          ),
                        )
                        .toList(),
                  ),
                  const SizedBox(height: 16),
                  if (!courseDone && course.assignmentId != null)
                    FutureBuilder<Set<String>>(
                      future: LessonCompletionService.getCompletedLessonIds(
                          cacheKey),
                      builder: (context, lessonSnapshot) {
                        final doneIds = lessonSnapshot.data ?? {};
                        final allLessonsCompleted = course.lessons.isNotEmpty &&
                            course.lessons
                                .every((lesson) => doneIds.contains(lesson.id));
                        if (!allLessonsCompleted) {
                          return const SizedBox.shrink();
                        }
                        return SizedBox(
                          width: double.infinity,
                          height: 50,
                          child: ElevatedButton(
                            style: OutlinedButton.styleFrom(
                              side: const BorderSide(
                                color: AppColors.continueOrange,
                              ),
                              foregroundColor: AppColors.continueOrange,
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              backgroundColor: AppColors.continueOrange,
                            ),
                            onPressed: () {
                              context.push(
                                '/quiz',
                                extra: {
                                  'course': course,
                                  'assignmentId': course.assignmentId!,
                                  'source': 'learning_path',
                                  'learningPath': path,
                                },
                              );
                            },
                            child: const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  Icons.quiz,
                                  size: 20,
                                  color: AppColors.white,
                                ),
                                SizedBox(width: 8),
                                Text(
                                  'Start Quiz',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.white,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  FutureBuilder<double>(
                    key: ValueKey(
                      'lp_course_prog_${cacheKey}_$_lessonProgressRebuildCounter',
                    ),
                    future: CombinedProgressCalculator.calculatePercent(course),
                    builder: (context, snapshot) {
                      if (snapshot.connectionState == ConnectionState.waiting) {
                        return const SizedBox(
                          height: 44,
                          child: Center(
                            child: SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                          ),
                        );
                      }
                      final calculatedProgress = snapshot.data ?? 0.0;
                      final isActuallyCompleted =
                          courseDone || calculatedProgress >= 100.0;
                      if (!isActuallyCompleted) {
                        return const SizedBox.shrink();
                      }
                      return Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.lightGreenBackground,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.check_circle,
                                size: 16,
                                color: AppColors.completedGreen,
                              ),
                              SizedBox(width: 6),
                              Text(
                                'Completed',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.completedGreen,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  List<String> _learningPathCourseTags(Course course) {
    final tags = <String>[];
    final d = course.duration?.trim();
    if (d != null && d.isNotEmpty) tags.add(d);
    final c = course.category?.trim();
    if (c != null && c.isNotEmpty) tags.add(c);
    return tags;
  }

  Widget _buildLpCourseThumbnail(Course course) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: SizedBox(
        width: 80,
        height: 80,
        child: course.imageKey != null
            ? _imageUrlCache.containsKey(course.imageKey)
                ? DecoratedBox(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      image: DecorationImage(
                        image: NetworkImage(_imageUrlCache[course.imageKey]!),
                        fit: BoxFit.cover,
                      ),
                    ),
                  )
                : Container(
                    decoration: BoxDecoration(
                      color: AppColors.grey(200),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.image, color: Colors.grey),
                  )
            : Container(
                decoration: BoxDecoration(
                  color: AppColors.grey(200),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.image_not_supported,
                  color: Colors.grey,
                ),
              ),
      ),
    );
  }
}

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:amplify_flutter/amplify_flutter.dart';
import '../../data/models/course_model.dart';
import '../bloc/course_bloc.dart';
import '../../../../core/widgets/app_loader.dart';
import '../../services/video_progress_service.dart';
import '../../services/quiz_service.dart';
import '../../../../core/services/storage_service.dart';
import '../../services/pdf_progress_service.dart';
import '../../../../core/services/activity_logger.dart';
import '../../../learning_path/presentation/bloc/learning_path_bloc.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../widgets/content_type_indicator.dart';
import '../widgets/pdf_viewer_helper.dart';
import '../course_list/course_list_filter.dart';
import '../course_list/course_list_category_helper.dart';
import '../course_list/course_list_refresh_helper.dart';
import '../widgets/course_list/course_list_error_view.dart';
import '../widgets/course_list/course_list_shimmer.dart';
import '../widgets/course_list/course_list_empty_state.dart';
import '../widgets/course_list/course_lesson_list_section.dart';
import '../widgets/course_list/learning_paths_course_list_section.dart';
import '../../services/combined_progress_calculator.dart';
import '../../services/course_image_preload_service.dart';
import '../../services/lesson_completion_service.dart';

class CourseListScreen extends StatelessWidget {
  const CourseListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    safePrint('[COURSE_API] [UI] 🎯 CourseListScreen building...');
    return const CourseListContent();
  }
}

class CourseListContent extends StatefulWidget {
  const CourseListContent({super.key});

  @override
  State<CourseListContent> createState() => _CourseListContentState();
}

class _CourseListContentState extends State<CourseListContent> {
  final TextEditingController _searchController = TextEditingController();
  final ValueNotifier<bool> _isSearchActiveNotifier = ValueNotifier<bool>(
    false,
  );
  final ValueNotifier<String> _searchQueryNotifier = ValueNotifier<String>('');
  bool _isSearchActive = false; // Keep for filtering
  String _searchQuery = ''; // Keep for filtering
  Timer? _searchDebounceTimer;
  final Map<String, double> _courseProgress = {};
  final Map<String, bool> _videoCompleted = {};
  int _progressRebuildCounter = 0; // Counter to force FutureBuilder rebuilds
  /// Per-course invalidation: only the clicked course re-runs progress (shows loader).
  final Map<String, int> _courseProgressInvalidationCounter = {};
  final Map<String, String> _imageUrlCache =
      {}; // Cache for preloaded image URLs
  bool _hasRefreshedFromQuiz = false; // Flag to prevent duplicate refreshes
  final Set<String> _coursesUpdatingStatus =
      {}; // Track courses waiting for backend status update

  @override
  void initState() {
    super.initState();
    _initializeData();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Check if returning from quiz and trigger refresh
    final routerState = GoRouterState.of(context);
    final returningFromQuiz =
        routerState.uri.queryParameters['returningFromQuiz'] == 'true';

    if (returningFromQuiz && mounted && !_hasRefreshedFromQuiz) {
      _hasRefreshedFromQuiz = true; // Set flag to prevent duplicate refreshes
      safePrint('[COURSE_LIST] 🔄 Returning from quiz - triggering refresh...');
      // Trigger refresh to update course list with latest data
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          context.read<CourseBloc>().add(const RefreshCourses());
          context.read<LearningPathBloc>().add(const RefreshLearningPaths());
          safePrint('[COURSE_LIST] ✅ Refresh triggered after quiz completion');

          // Clear cached progress to force recalculation
          _courseProgress.clear();
          _videoCompleted.clear();
          _progressRebuildCounter++;
        }
      });
    } else if (!returningFromQuiz) {
      // Reset flag when not returning from quiz
      _hasRefreshedFromQuiz = false;
    }
  }

  void _initializeData() {
    final courseBloc = context.read<CourseBloc>();
    final courseState = courseBloc.state;

    safePrint(
      '[COURSE_API] [UI] 🔍 Current CourseBloc state: ${courseState.runtimeType}',
    );

    if (courseState is CourseInitial) {
      safePrint('[COURSE_API] [UI] Initial state detected, loading courses...');
      courseBloc.add(const LoadCourses());
    } else if (courseState is CourseLoaded) {
      safePrint(
        '[COURSE_API] [UI] ✅ Courses already loaded (${courseState.courses.length} courses), skipping LoadCourses event',
      );
    } else if (courseState is CourseLoading) {
      safePrint(
        '[COURSE_API] [UI] ⏳ Courses are already loading, skipping LoadCourses event',
      );
    } else {
      safePrint(
        '[COURSE_API] [UI] Courses in state: ${courseState.runtimeType}, skipping LoadCourses event',
      );
    }

    // Trigger learning paths load via BLoC
    final learningPathBloc = context.read<LearningPathBloc>();
    final learningPathState = learningPathBloc.state;

    safePrint(
      '[LEARNING_PATH] [UI] 🔍 Current LearningPathBloc state: ${learningPathState.runtimeType}',
    );

    if (learningPathState is LearningPathInitial) {
      safePrint(
        '[LEARNING_PATH] [UI] Initial state detected, loading learning paths...',
      );
      learningPathBloc.add(const LoadLearningPaths());
    } else if (learningPathState is LearningPathLoaded) {
      safePrint(
        '[LEARNING_PATH] [UI] ✅ Learning paths already loaded (${learningPathState.paths.length} paths), skipping LoadLearningPaths event',
      );
    } else if (learningPathState is LearningPathLoading) {
      safePrint(
        '[LEARNING_PATH] [UI] ⏳ Learning paths are already loading, skipping LoadLearningPaths event',
      );
    } else {
      safePrint(
        '[LEARNING_PATH] [UI] Learning paths in state: ${learningPathState.runtimeType}, skipping LoadLearningPaths event',
      );
    }
  }

  @override
  void reassemble() {
    super.reassemble();
    // Hot reload detected - BLoC state checks in _initializeData() will prevent reloading
    safePrint(
      '[COURSE_API] [UI] 🔄 Hot reload detected - BLoC state checks will prevent unnecessary reloads',
    );
  }

  Future<void> _refreshCoursesAndLearningPaths(BuildContext context) async {
    await CourseListRefreshHelper.refreshCoursesAndLearningPaths(
      context: context,
      mounted: mounted,
      onCachesInvalidated: () {
        if (!mounted) return;
        _courseProgress.clear();
        _videoCompleted.clear();
        _progressRebuildCounter++;
        setState(() {});
      },
    );
  }

  Future<void> _refreshCourseProgress(List<Course> courses) async {
    // Update progress for all courses when course list is loaded
    // This ensures progress is calculated and cached before categorization runs
    final progressFutures = <Future<void>>[];

    for (final course in courses) {
      // Use assignmentId for cache keys
      final cacheKey = course.assignmentId ?? course.id;

      // Check if we need to recalculate progress
      // Only clear cache if:
      // 1. Progress doesn't exist yet
      // 2. Assignment status changed to completed
      // 3. Video completion status is not cached
      final hasProgress = _courseProgress.containsKey(cacheKey);
      final hasVideoStatus = _videoCompleted.containsKey(cacheKey);
      final isNowCompleted = course.assignmentStatus == 'completed';
      final wasCompleted = _courseProgress[cacheKey] == 1.0;

      // Only clear and recalculate if needed
      if (!hasProgress ||
          !hasVideoStatus ||
          (isNowCompleted && !wasCompleted)) {
        // Clear cache to force recalculation
        _courseProgress.remove(cacheKey);
        _videoCompleted.remove(cacheKey);
        // Update progress with current assignmentStatus (async)
        progressFutures.add(_updateCourseProgress(course));
      } else {
        // Progress exists and is valid, just ensure video status is up to date
        // This is a lightweight check that doesn't require full recalculation
        final progressKey = course.assignmentId ?? course.id;
        progressFutures.add(
          VideoProgressService.isVideoCompleted(progressKey)
              .then((isCompleted) {
            if (mounted && _videoCompleted[cacheKey] != isCompleted) {
              _videoCompleted[cacheKey] = isCompleted;
              // If video status changed, we might need to recalculate progress
              if (isCompleted &&
                  _courseProgress[cacheKey] != null &&
                  _courseProgress[cacheKey]! < 0.5) {
                // Video was just completed, recalculate progress
                _courseProgress.remove(cacheKey);
                return _updateCourseProgress(course);
              }
            }
          }),
        );
      }

      // If course is completed, remove from updating status set
      if (course.assignmentStatus == 'completed') {
        _coursesUpdatingStatus.remove(cacheKey);
      }
    }

    // Wait for all progress updates to complete before rebuilding UI
    await Future.wait(progressFutures);

    // Preload all image URLs when courses are refreshed (background loading)
    _preloadImageUrls(courses);

    // Force UI rebuild after refreshing all progress
    if (mounted) {
      _progressRebuildCounter++;
      setState(() {});
    }
  }

  Future<void> _preloadImageUrls(List<Course> courses) async {
    await CourseImagePreloadService.preloadForCourses(
      courses: courses,
      imageUrlCache: _imageUrlCache,
      context: context,
      isMounted: () => mounted,
      scheduleSetState: setState,
    );
  }

  void _onFullyCompleteProgress(String cacheKey) {
    if (_coursesUpdatingStatus.contains(cacheKey) && mounted) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          setState(() {
            _coursesUpdatingStatus.remove(cacheKey);
          });
        }
      });
    }
  }

  Future<void> _updateCourseProgress(Course course) async {
    // Use assignmentId for cache keys (each assignment has its own progress)
    final cacheKey = course.assignmentId ?? course.id;

    // Use assignmentId for progress tracking
    final progressKey = course.assignmentId ?? course.id;
    final isVideoCompleted = await VideoProgressService.isVideoCompleted(
      progressKey,
    );
    _videoCompleted[cacheKey] = isVideoCompleted;

    // Check if assignment is fully completed
    final bool isAssignmentCompleted = course.assignmentStatus == 'completed';

    // If assignment is fully completed, don't calculate progress (will show "Completed" text instead)
    if (isAssignmentCompleted) {
      _courseProgress[cacheKey] = 1.0; // 100% for completed
      if (mounted) {
        setState(() {});
      }
      return;
    }

    final progress = await CombinedProgressCalculator.calculatePercent(
      course,
      onFullyComplete: _onFullyCompleteProgress,
    );
    _courseProgress[cacheKey] = progress / 100.0; // Store as 0.0-1.0
    safePrint(
      '[PROGRESS] [CourseList] Course ${course.id} (Assignment: ${course.assignmentId}): Calculated progress = ${progress}% (stored as ${_courseProgress[cacheKey]})',
    );

    // If progress reaches 100%, update status to completed
    if (progress >= 100.0 && !isAssignmentCompleted) {
      // Note: Status update should be handled by quiz submission
      // This is just for UI display
    }

    if (mounted) {
      setState(() {});
    }
  }

  @override
  void dispose() {
    _searchDebounceTimer?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _toggleSearch() {
    // Update ValueNotifier - only search header widget will rebuild
    _isSearchActive = !_isSearchActive;
    _isSearchActiveNotifier.value = _isSearchActive;

    if (!_isSearchActive) {
      _searchDebounceTimer?.cancel();
      _searchController.clear();
      _searchQuery = '';
      _searchQueryNotifier.value = '';
    }
    // No setState() - ValueNotifier listeners will handle UI updates
  }

  void _onSearchChanged(String query) {
    // Cancel any existing timer
    _searchDebounceTimer?.cancel();

    // Start a new timer that will update the search query after 300ms of inactivity
    _searchDebounceTimer = Timer(const Duration(milliseconds: 300), () {
      if (mounted) {
        setState(() {
          _searchQuery = query.toLowerCase().trim();
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    // Check if returning from quiz
    final routerState = GoRouterState.of(context);
    final returningFromQuiz =
        routerState.uri.queryParameters['returningFromQuiz'] == 'true';

    return Container(
      color: AppColors.lightGrayBackground,
      child: BlocConsumer<CourseBloc, CourseState>(
        listener: (context, state) {
          if (state is CourseLoaded) {
            // Recalculate local progress when server course list updates.
            unawaited(_refreshCourseProgress(state.courses));

            // If returning from quiz, clear the query parameter after data is loaded
            final routerState = GoRouterState.of(context);
            final returningFromQuiz =
                routerState.uri.queryParameters['returningFromQuiz'] == 'true';

            if (returningFromQuiz && mounted) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted) {
                  // Remove query parameter to prevent repeated refreshes
                  // Use a small delay to ensure UI has updated
                  Future.delayed(const Duration(milliseconds: 100), () {
                    if (mounted) {
                      final currentUri = GoRouterState.of(context).uri;
                      if (currentUri.queryParameters.containsKey(
                        'returningFromQuiz',
                      )) {
                        // Navigate to same route without query parameter
                        context.go('/home');
                        safePrint(
                          '[COURSE_LIST] ✅ Removed returningFromQuiz parameter',
                        );
                      }
                    }
                  });
                }
              });
            }
          }
        },
        builder: (context, state) {
          if (state is CourseError) {
            return CourseListErrorView(
              message: state.message,
              onPullToRefresh: () => _refreshCoursesAndLearningPaths(context),
            );
          }

          // Show loader when returning from quiz until list is updated (normal loader for button action)
          final shouldShowLoader = returningFromQuiz &&
              (state is CourseLoading || state is! CourseLoaded);

          // Show normal loader when returning from quiz (button action)
          if (shouldShowLoader) {
            return LoadingWidget(
              message: 'Updating course list...',
            );
          }

          // Rebuild when LearningPathBloc changes so we hide shimmer as soon as both APIs complete
          return BlocBuilder<LearningPathBloc, LearningPathState>(
            builder: (context, learningPathState) {
              final isLearningPathLoading =
                  learningPathState is LearningPathLoading ||
                      learningPathState is LearningPathInitial;
              final isCourseLoading = state is CourseLoading;
              final isInitialLoading = isCourseLoading ||
                  (state is CourseLoaded && isLearningPathLoading);

              if (isInitialLoading) {
                return const CourseListShimmer();
              }

              if (state is CourseLoaded) {
                final courses = state.courses;
                final filteredCourses =
                    CourseListFilter.filterByQuery(courses, _searchQuery);
                final categorizedCourses = CourseListCategoryHelper.categorize(
                  courses: filteredCourses,
                  courseProgress: _courseProgress,
                  videoCompleted: _videoCompleted,
                );

                return _buildCupertinoSliverScreen(
                  context,
                  courses,
                  filteredCourses,
                  categorizedCourses,
                );
              }
              return const CourseListShimmer();
            },
          );
        },
      ),
    );
  }

  /// Build main screen with CupertinoSliverNavigationBar
  Widget _buildCupertinoSliverScreen(
    BuildContext context,
    List<Course> courses,
    List<Course> filteredCourses,
    Map<String, List<Course>> categorizedCourses,
  ) {
    return CustomScrollView(
      physics: const BouncingScrollPhysics(
        parent: AlwaysScrollableScrollPhysics(),
      ),
      slivers: [
        // Must be first: otherwise overscroll is absorbed by the nav bar stretch
        // and no refresh spinner appears (see CupertinoSliverRefreshControl docs).
        CupertinoSliverRefreshControl(
          onRefresh: () => _refreshCoursesAndLearningPaths(context),
        ),
        // CupertinoSliverNavigationBar - iOS-style large title navigation bar
        ValueListenableBuilder<bool>(
          valueListenable: _isSearchActiveNotifier,
          builder: (context, isSearchActive, _) {
            return CupertinoSliverNavigationBar(
              largeTitle: const Text(
                'Courses',
                style: TextStyle(
                  //   fontSize: 28,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textBlack87,
                ),
              ),
              backgroundColor: AppColors.lightGrayBackground.withOpacity(0.95),
              border: null, // Remove default border
              stretch: true, // Enable stretch effect on overscroll
              // Trailing widget (right side) - Search or Close button
              trailing: CupertinoButton(
                padding: EdgeInsets.zero,
                onPressed: _toggleSearch,
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
                  child: Icon(
                    isSearchActive
                        ? CupertinoIcons.xmark
                        : CupertinoIcons.search,
                    color: AppColors.textBlack87,
                    size: isSearchActive ? 18 : 20,
                  ),
                ),
              ),
            );
          },
        ),

        // Search bar (shown when search is active)
        ValueListenableBuilder<bool>(
          valueListenable: _isSearchActiveNotifier,
          builder: (context, isSearchActive, _) {
            if (!isSearchActive)
              return const SliverToBoxAdapter(child: SizedBox.shrink());

            return SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
                child: ValueListenableBuilder<String>(
                  valueListenable: _searchQueryNotifier,
                  builder: (context, searchQuery, _) {
                    return CupertinoSearchTextField(
                      controller: _searchController,
                      onChanged: _onSearchChanged,
                      autofocus: true,
                      placeholder: 'Search courses...',
                      style: const TextStyle(
                        color: AppColors.textBlack87,
                        fontSize: 16,
                      ),
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
                    );
                  },
                ),
              ),
            );
          },
        ),

        // Content
        // Show learning paths section even if filteredCourses is empty
        // Only show empty state if both courses and learning paths are empty
        BlocBuilder<LearningPathBloc, LearningPathState>(
          builder: (context, learningPathState) {
            // Check if there are any learning paths
            final hasLearningPaths = learningPathState is LearningPathLoaded &&
                learningPathState.paths.isNotEmpty;

            // If no courses AND no learning paths, show empty state
            if (filteredCourses.isEmpty && !hasLearningPaths) {
              return SliverFillRemaining(
                hasScrollBody: false,
                child: CourseListEmptyState(rawCoursesCount: courses.length),
              );
            }

            // Otherwise, show content (learning paths and/or courses)
            return SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  const LearningPathsCourseListSection(),

                  // In Progress Section
                  if (categorizedCourses['in_progress']!.isNotEmpty) ...[
                    ...categorizedCourses['in_progress']!
                        .map(
                          (course) => Padding(
                            padding: const EdgeInsets.only(top: 12),
                            child: _buildCourseCard(context, course),
                          ),
                        )
                        .toList(),
                  ],

                  // Start Training Section
                  if (categorizedCourses['start_training']!.isNotEmpty) ...[
                    ...categorizedCourses['start_training']!
                        .map(
                          (course) => Padding(
                            padding: const EdgeInsets.only(top: 12),
                            child: _buildCourseCard(context, course),
                          ),
                        )
                        .toList(),
                  ],

                  // Completed Section
                  if (categorizedCourses['completed']!.isNotEmpty) ...[
                    ...categorizedCourses['completed']!
                        .map(
                          (course) => Padding(
                            padding: const EdgeInsets.only(top: 12),
                            child: _buildCourseCard(context, course),
                          ),
                        )
                        .toList(),
                  ],
                ]),
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _buildCourseCard(BuildContext context, Course course) {
    // Check video completion status
    // Use assignmentId for cache keys
    final cacheKey = course.assignmentId ?? course.id;
    final bool videoCompleted = _videoCompleted[cacheKey] ?? false;
    // Check completion status - both assignment status and cached progress
    final double cachedProgress = _courseProgress[cacheKey] ?? 0.0;
    final bool isCompleted = course.assignmentStatus == 'completed' ||
        cachedProgress >= 1.0; // Both video AND quiz completed

    return InkWell(
      onTap: () {
        // Navigate to course details screen
        context.push('/course-details', extra: course).then((_) {
          // Do not refresh on return; use existing data. Refresh only on pull-to-refresh or retry.
          if (mounted) {
            // Invalidate only this course so its progress may be recalculated when needed
            final cacheKey = course.assignmentId ?? course.id;
            _courseProgress.remove(cacheKey);
            _videoCompleted.remove(cacheKey);
            _progressRebuildCounter++;
            setState(() {});
          }
        });
      },
      borderRadius: BorderRadius.circular(28),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(28),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
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
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              course.title,
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textBlack87,
                              ),
                            ),
                          ),
                          //const SizedBox(width: 8),
                          // Content type icons - using reusable widget
                          //ContentTypeIndicator(course: course),
                        ],
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
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                _buildCourseThumbnail(course),
              ],
            ),
            if (course.lessons.isNotEmpty) ...[
              const SizedBox(height: 12),
              CourseLessonListSection(
                course: course,
                progressRebuildKey: _progressRebuildCounter,
                onAfterLessonReturn: (pathProgressChanged) {
                  if (!mounted) return;
                  _progressRebuildCounter++;
                  setState(() {});
                  if (pathProgressChanged) {
                    context.read<LearningPathBloc>().add(
                          const RefreshLearningPaths(),
                        );
                  }
                },
              ),
            ],
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _buildTags(course)
                  .map(
                    (tag) => Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: isCompleted
                            ? AppColors.grey(200)
                            : AppColors.lightBlueBackground,
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: Text(
                        tag,
                        style: TextStyle(
                          color: isCompleted
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

            //const SizedBox(height: 16),

            // Content type icons - using reusable widget
            //ContentTypeIndicator(course: course, isCompleted: isCompleted),
            const SizedBox(height: 16),

            // show start quiz btn
            if (!isCompleted)
              FutureBuilder<Set<String>>(
                future: LessonCompletionService.getCompletedLessonIds(cacheKey),
                builder: (context, lessonSnapshot) {
                  final doneIds = lessonSnapshot.data ?? {};

                  final allLessonsCompleted = course.lessons.isNotEmpty &&
                      course.lessons
                          .every((lesson) => doneIds.contains(lesson.id));

                  if (!allLessonsCompleted) {
                    return SizedBox.shrink(); // ❌ Hide button
                  }

                  // ✅ Show Start Quiz button
                  return SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      style: OutlinedButton.styleFrom(
                          side:
                              const BorderSide(color: AppColors.continueOrange),
                          foregroundColor: AppColors.continueOrange,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          backgroundColor: AppColors.continueOrange),
                      onPressed: () {
                        // 👉 Navigate to Quiz Screen
                        context.push(
                          '/quiz',
                          //extra: {'courseId': course.id,},
                          extra: {
                            'course': course,
                            'assignmentId': course.assignmentId!
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
                                color: AppColors.white),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),

            FutureBuilder<double>(
              key: ValueKey(
                'course_state_${course.assignmentId ?? course.id}_${course.assignmentStatus}_$_progressRebuildCounter}_${_courseProgressInvalidationCounter[cacheKey] ?? 0}',
              ),
              future: _courseProgress.containsKey(cacheKey)
                  ? Future.value(_courseProgress[cacheKey]! * 100)
                  : CombinedProgressCalculator.calculatePercent(
                      course,
                      onFullyComplete: _onFullyCompleteProgress,
                    ),
              builder: (context, snapshot) {
                final cacheKey = course.assignmentId ?? course.id;
                final isUpdatingStatus =
                    _coursesUpdatingStatus.contains(cacheKey);

                // If still loading, show loading state
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return SizedBox(
                    height: 50,
                    child: Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const CircularProgressIndicator(),
                          if (isUpdatingStatus) ...[
                            const SizedBox(height: 8),
                            Text(
                              'Updating course status...',
                              style: TextStyle(
                                fontSize: 12,
                                color: AppColors.grey(600),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  );
                }

                final calculatedProgress = snapshot.data ?? 0.0;

                // Double-check completion status using both assignment status and calculated progress
                // This ensures we catch cases where assignment status hasn't updated yet but quiz is passed
                final bool isActuallyCompleted =
                    isCompleted || calculatedProgress >= 100.0;

                if (isActuallyCompleted) {
                  // STATE 4: Complete
                  return _buildCompleteState(context, course);
                }
                return SizedBox.shrink();
              },
            ),
          ],
        ),
      ),
    );
  }

  /// STATE 4: Complete - Course fully completed
  Widget _buildCompleteState(BuildContext context, Course course) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Status badge
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
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

        /// const SizedBox(height: 16),
        // Review button
/*
 SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: () => _viewCourseDetails(context, course),
            icon: const Icon(Icons.refresh, size: 20),
            label: const Text(
              'Review Course',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
            ),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.completedButtonForeground,
              side: const BorderSide(
                color: AppColors.completedGreen,
                width: 1.5,
              ),
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ),
 */
      ],
    );
  }

  Widget _buildCourseThumbnail(Course course) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: Container(
        width: 80,
        height: 80,
        child: course.imageKey != null
            ? _imageUrlCache.containsKey(course.imageKey)
                ? Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      image: DecorationImage(
                        image: NetworkImage(_imageUrlCache[course.imageKey]!),
                        fit: BoxFit.cover,
                      ),
                    ),
                  )
                : Container(
                    // Placeholder while image is being preloaded (shouldn't show if preloading works)
                    decoration: BoxDecoration(
                      color: Colors.grey[200],
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.image, color: Colors.grey),
                  )
            : Container(
                decoration: BoxDecoration(
                  color: Colors.grey[200],
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

  List<String> _buildTags(Course course) {
    String? category = course.category;
    return [_estimateDuration(course), category!];
  }

  String _estimateDuration(Course course) {
    final minutes = (course.duration);
    return '$minutes';
  }
}

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:amplify_flutter/amplify_flutter.dart';
import '../../data/models/course_model.dart';
import '../../../learning_path/data/models/learning_path_model.dart';
import '../bloc/course_bloc.dart';
import '../../../../core/widgets/app_loader.dart';
import '../../services/video_progress_service.dart';
import '../../services/quiz_progress_service.dart';
import '../../services/quiz_service.dart';
import '../../../../core/services/storage_service.dart';
import '../../services/pdf_progress_service.dart';
import '../../../../core/services/activity_logger.dart';
import '../../../learning_path/presentation/bloc/learning_path_bloc.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/mixins/screen_refresh_mixin.dart';
import '../widgets/content_type_indicator.dart';
import '../widgets/pdf_requirement_banner.dart';
import '../widgets/pdf_viewer_helper.dart';

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

class _CourseListContentState extends State<CourseListContent>
    with ScreenRefreshMixin {
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
    _loadVideoProgress();

    // Only load courses if BLoC state is initial (not already loaded)
    // This check ensures we don't reload on hot reload
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

  @override
  void onScreenVisible() {
    // Refresh data when screen becomes visible again
    // This ensures UI shows updated data after quiz completion
    if (mounted) {
      try {
        context.read<CourseBloc>().add(const RefreshCourses());
        context.read<LearningPathBloc>().add(const RefreshLearningPaths());
        safePrint('[COURSE_LIST] ✅ Refreshed data on screen visibility');
      } catch (e) {
        safePrint('[COURSE_LIST] ⚠️ Error refreshing on visibility: $e');
      }
    }
  }

  Future<void> _loadVideoProgress() async {
    // This will be called when courses are loaded
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
    // Check if there are any images to load
    final imagesToLoad = courses
        .where(
          (course) =>
              course.imageKey != null &&
              !_imageUrlCache.containsKey(course.imageKey),
        )
        .toList();

    // If no images to load, return immediately
    if (imagesToLoad.isEmpty) {
      return;
    }

    // Get BuildContext for precaching images
    final context = this.context;
    if (!mounted) return;

    final urlFutures = <Future<MapEntry<String, String>?>>[];
    for (final course in imagesToLoad) {
      urlFutures.add(
        StorageService.getImageUrl(course.imageKey!)
            .then<MapEntry<String, String>?>(
          (url) => MapEntry(course.imageKey!, url),
        )
            .catchError((e) {
          safePrint('Error getting image URL for ${course.title}: $e');
          return null;
        }),
      );
    }

    // Wait for all URLs to be fetched (with timeout to prevent infinite waiting)
    try {
      final urlResults = await Future.wait(
        urlFutures,
      ).timeout(const Duration(seconds: 30));

      // Batch update the URL cache - filter out null results
      final urlCacheUpdates = <String, String>{};
      for (final result in urlResults) {
        if (result != null) {
          urlCacheUpdates[result.key] = result.value;
        }
      }

      // Update cache in a single setState call
      if (mounted && urlCacheUpdates.isNotEmpty) {
        setState(() {
          _imageUrlCache.addAll(urlCacheUpdates);
        });
      }

      // Precache images into Flutter's image cache for instant display
      if (mounted) {
        final precacheFutures = <Future<void>>[];
        for (final entry in urlCacheUpdates.entries) {
          precacheFutures.add(
            precacheImage(NetworkImage(entry.value), context).catchError((e) {
              safePrint('Error precaching image ${entry.key}: $e');
              // Continue precaching other images even if one fails
            }),
          );
        }

        // Wait for all images to be precached (with timeout)
        try {
          await Future.wait(
            precacheFutures,
          ).timeout(const Duration(seconds: 30));
          safePrint(
            '✅ Successfully precached ${precacheFutures.length} images',
          );
        } catch (e) {
          if (e.toString().contains('TimeoutException') ||
              e.toString().contains('timeout')) {
            safePrint('Image precaching timed out after 30 seconds');
          } else {
            safePrint('Error during image precaching: $e');
          }
        }
      }
    } catch (e) {
      if (e.toString().contains('TimeoutException') ||
          e.toString().contains('timeout')) {
        safePrint('Image URL fetching timed out after 30 seconds');
      } else {
        safePrint('Error during image URL fetching: $e');
      }
    }

    // Images are now precached and ready to display
  }

  Future<double> _calculateCombinedProgress(Course course) async {
    // Check if assignment is fully completed
    final bool isAssignmentCompleted = course.assignmentStatus == 'completed';
    if (isAssignmentCompleted) {
      safePrint(
        '[PROGRESS] [CourseList] Course ${course.id} is completed (assignmentStatus: completed)',
      );
      // Remove from updating status if it was there
      final cacheKey = course.assignmentId ?? course.id;
      if (_coursesUpdatingStatus.contains(cacheKey) && mounted) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) {
            setState(() {
              _coursesUpdatingStatus.remove(cacheKey);
            });
          }
        });
      }
      return 100.0;
    }

    // Also check if quiz result exists (quiz was passed) - this handles cases
    // where assignment status hasn't been refreshed yet but quiz was completed
    if (course.assignmentId != null) {
      try {
        final hasPassedQuiz = await QuizService.hasQuizResult(
          course.assignmentId!,
        );
        if (hasPassedQuiz) {
          // Quiz was passed, so course should be 100% complete
          safePrint(
            '[PROGRESS] [CourseList] Course ${course.id} has passed quiz, returning 100%',
          );
          // Remove from updating status if it was there
          final cacheKey = course.assignmentId ?? course.id;
          if (_coursesUpdatingStatus.contains(cacheKey) && mounted) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) {
                setState(() {
                  _coursesUpdatingStatus.remove(cacheKey);
                });
              }
            });
          }
          return 100.0;
        }
      } catch (e) {
        safePrint('[PROGRESS] [CourseList] Error checking quiz result: $e');
      }
    }

    double videoProgress = 0.0; // 0-50%
    double quizProgress = 0.0; // 51-100%

    // Use assignmentId for progress tracking (each assignment has its own progress)
    // Fall back to course.id if assignmentId is not available
    final progressKey = course.assignmentId ?? course.id;

    // Calculate video progress (0-50%)
    final isVideoCompleted = await VideoProgressService.isVideoCompleted(
      progressKey,
    );
    if (isVideoCompleted) {
      videoProgress = 50.0; // Video fully watched = 50%
    } else {
      final savedPosition = await VideoProgressService.getVideoProgress(
        progressKey,
      );
      if (savedPosition != null) {
        // First try to get the actual saved video duration
        Duration? videoDuration = await VideoProgressService.getVideoDuration(
          progressKey,
        );

        // If no saved duration, fall back to parsing course.duration string
        if (videoDuration == null || videoDuration.inMilliseconds == 0) {
          // Parse duration string like "1hr 30 Mins" or "45 Min" into total minutes
          int estimatedDurationMinutes = 30; // Default fallback
          if (course.duration != null) {
            final durationStr = course.duration!.toLowerCase();
            int hours = 0;
            int minutes = 0;

            // Extract hours (look for "hr" or "hour")
            final hourMatch = RegExp(
              r'(\d+)\s*(?:hr|hour|h)',
            ).firstMatch(durationStr);
            if (hourMatch != null) {
              hours = int.tryParse(hourMatch.group(1) ?? '0') ?? 0;
            }

            // Extract minutes (look for "min" or "mins" or just numbers after hours)
            final minMatch = RegExp(
              r'(\d+)\s*(?:min|mins|minute|minutes|m)(?!\s*(?:hr|hour|h))',
            ).firstMatch(durationStr);
            if (minMatch != null) {
              minutes = int.tryParse(minMatch.group(1) ?? '0') ?? 0;
            } else if (hours == 0) {
              // If no hours found and no explicit "min", try to parse as just minutes
              final allNumbers = RegExp(r'\d+').allMatches(durationStr);
              if (allNumbers.isNotEmpty) {
                minutes = int.tryParse(allNumbers.first.group(0) ?? '0') ?? 0;
              }
            }

            estimatedDurationMinutes = (hours * 60) + minutes;
            if (estimatedDurationMinutes == 0) {
              estimatedDurationMinutes = 30; // Fallback if parsing fails
            }
          }
          videoDuration = Duration(minutes: estimatedDurationMinutes);
        }

        if (videoDuration.inMilliseconds > 0) {
          // Calculate video progress as percentage of 50%
          final videoProgressPercent =
              (savedPosition.inMilliseconds / videoDuration.inMilliseconds)
                  .clamp(0.0, 1.0);
          videoProgress = videoProgressPercent * 50.0; // Scale to 0-50%

          // Debug logging
          safePrint(
            '[PROGRESS] [CourseList] Video progress calculation for ${course.title}:',
          );
          safePrint('  - Assignment ID: ${course.assignmentId ?? "N/A"}');
          safePrint('  - Progress Key: $progressKey');
          safePrint(
            '  - Using saved duration: ${videoDuration.inSeconds}s (${videoDuration.inMinutes}m ${videoDuration.inSeconds % 60}s)',
          );
          safePrint('  - Course duration string: "${course.duration}"');
          safePrint(
            '  - Saved position: ${savedPosition.inSeconds}s (${savedPosition.inMinutes}m ${savedPosition.inSeconds % 60}s)',
          );
          safePrint(
            '  - Video progress: ${(videoProgressPercent * 100).toStringAsFixed(2)}% of video',
          );
          safePrint(
            '  - Course progress (video portion): ${videoProgress.toStringAsFixed(2)}%',
          );
        }
      }
    }

    // Calculate quiz progress (51-100%)
    // Only calculate quiz progress if video is completed
    if (isVideoCompleted) {
      try {
        final quizQuestions = await QuizService.getQuizQuestions(course.id);
        final totalQuestions = quizQuestions.length;

        if (totalQuestions > 0) {
          final quizProgressData = await QuizProgressService.getQuizProgress(
            progressKey,
          );
          if (quizProgressData != null) {
            final answers = quizProgressData['answers'] as List<int>;
            // Count answered questions (answers that are not -1)
            final answeredQuestions =
                answers.where((answer) => answer != -1).length;
            // Calculate quiz progress: 50% base + (answered/total) * 50%
            // This gives range: 50% (no answers) to 100% (all answered)
            final quizProgressPercent = answeredQuestions / totalQuestions;
            quizProgress =
                50.0 + (quizProgressPercent * 50.0); // Range: 50-100%
          } else {
            // Video complete but quiz not started yet
            quizProgress = 50.0; // Stay at 50% (video completion point)
          }
        } else {
          // No quiz questions, so if video is done, course is 100% complete
          quizProgress = 100.0;
        }
      } catch (e) {
        // If quiz fetch fails and video is complete, stay at 50%
        quizProgress = 50.0;
      }
    }

    // Combined progress: video (0-50%) + quiz (51-100%)
    // If video is complete, use quiz progress (50-100%); otherwise use video progress (0-50%)
    final combinedProgress = isVideoCompleted ? quizProgress : videoProgress;

    final finalProgress = combinedProgress.clamp(0.0, 100.0);
    safePrint(
      '[PROGRESS] [CourseList] Final combined progress for ${course.title}: ${finalProgress.toStringAsFixed(2)}% (Video: ${videoProgress.toStringAsFixed(2)}%, Quiz: ${quizProgress.toStringAsFixed(2)}%, IsCompleted: $isVideoCompleted)',
    );

    return finalProgress;
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

    // Calculate combined progress (video + quiz)
    final progress = await _calculateCombinedProgress(course);
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

  List<Course> _filterCourses(List<Course> courses) {
    if (_searchQuery.isEmpty) {
      return courses;
    }
    return courses.where((course) {
      final title = course.title.toLowerCase();
      final description = _buildDescription(course).toLowerCase();
      return title.contains(_searchQuery) || description.contains(_searchQuery);
    }).toList();
  }

  void _viewCourseDetails(BuildContext context, Course course) {
    if (course.assignmentStatus == 'completed') {
      _showCompletedCourseDialog(context, course);
    } else {
      _showStartCourseDialog(context, course);
    }
  }

  /// Helper method to check if course has quiz questions
  Future<bool> _hasQuiz(Course course) async {
    try {
      final questions = await QuizService.getQuizQuestions(course.id);
      return questions.isNotEmpty;
    } catch (e) {
      safePrint('[CourseList] Error checking quiz: $e');
      return false;
    }
  }

  void _showStartCourseDialog(BuildContext context, Course course) {
    showDialog(
      context: context,
      barrierColor: Colors.black54,
      builder: (context) => FutureBuilder<bool>(
        future: _hasQuiz(course),
        builder: (context, quizSnapshot) {
          final hasQuiz = quizSnapshot.data ?? false;

          // Determine course case
          final hasVideo = course.hasVideo;
          final hasPdf = course.hasPdf;

          // Case 1: Video + Quiz (No PDF)
          final isCase1 = hasVideo && hasQuiz && !hasPdf;
          // Case 2: PDF + Quiz (No Video)
          final isCase2 = hasPdf && hasQuiz && !hasVideo;
          // Case 3: Video + PDF + Quiz
          final isCase3 = hasVideo && hasPdf && hasQuiz;

          return Dialog(
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
                  // Icon
                  course.imageKey != null
                      ? _imageUrlCache.containsKey(course.imageKey)
                          ? Container(
                              width: 70,
                              height: 70,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(12),
                                image: DecorationImage(
                                  image: NetworkImage(
                                    _imageUrlCache[course.imageKey]!,
                                  ),
                                  fit: BoxFit.cover,
                                ),
                              ),
                            )
                          : FutureBuilder<String>(
                              future: StorageService.getImageUrl(
                                course.imageKey!,
                              ),
                              builder: (context, snapshot) {
                                if (snapshot.connectionState ==
                                    ConnectionState.waiting) {
                                  return Container(
                                    width: 70,
                                    height: 70,
                                    decoration: BoxDecoration(
                                      color: AppColors.grey(200),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: const Icon(
                                      Icons.image,
                                      color: Colors.grey,
                                    ),
                                  );
                                }
                                if (snapshot.hasError || !snapshot.hasData) {
                                  return Container(
                                    width: 70,
                                    height: 70,
                                    decoration: BoxDecoration(
                                      color: AppColors.grey(200),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: const Icon(
                                      Icons.image_not_supported,
                                      color: Colors.grey,
                                    ),
                                  );
                                }
                                // Cache the URL
                                if (snapshot.hasData) {
                                  WidgetsBinding.instance
                                      .addPostFrameCallback((_) {
                                    if (mounted &&
                                        !_imageUrlCache.containsKey(
                                          course.imageKey,
                                        )) {
                                      setState(() {
                                        _imageUrlCache[course.imageKey!] =
                                            snapshot.data!;
                                      });
                                    }
                                  });
                                }
                                return Container(
                                  width: 70,
                                  height: 70,
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(12),
                                    image: DecorationImage(
                                      image: NetworkImage(snapshot.data!),
                                      fit: BoxFit.cover,
                                    ),
                                  ),
                                );
                              },
                            )
                      : Container(
                          width: 70,
                          height: 70,
                          decoration: BoxDecoration(
                            color: AppColors.grey(200),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(
                            Icons.image_not_supported,
                            color: Colors.grey,
                          ),
                        ),
                  const SizedBox(height: 10),
                  // Title
                  Text(
                    course.title,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textBlack87,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 10),
                  // Message - dynamic based on content type
                  Text(
                    isCase1
                        ? 'Ready to start your training?'
                        : isCase2
                            ? 'This course includes a PDF document for review.'
                            : isCase3
                                ? 'This course includes video training and a PDF document.'
                                : course.hasBothContent
                                    ? 'This course includes video training and a PDF document.'
                                    : course.hasVideo
                                        ? 'Ready to start your training?'
                                        : course.hasPdf
                                            ? 'This course includes a PDF document for review.'
                                            : 'No content available for this course.',
                    style: const TextStyle(
                      fontSize: 16,
                      color: Colors.grey,
                      height: 1.5,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 14),

                  // CASE 1: Video + Quiz (No PDF) - Show only "Start Training" button
                  if (isCase1)
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () {
                          context.pop();
                          _startVideo(context, course);
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
                            Icon(Icons.play_arrow, size: 20),
                            SizedBox(width: 8),
                            Text(
                              'Start Training',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                  // CASE 2: PDF + Quiz (No Video) - Show "View PDF Document" and "Start Quiz" buttons
                  if (isCase2) ...[
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () {
                          context.pop();
                          _openPdfViewer(context, course);
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.red[600],
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          elevation: 0,
                        ),
                        child: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.picture_as_pdf, size: 20),
                            SizedBox(width: 8),
                            Text(
                              'View PDF Document',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton(
                        onPressed: () async {
                          // Check if PDF must be viewed before quiz
                          final mustViewPdf =
                              await PdfViewerHelper.mustViewPdfBeforeQuiz(
                            course,
                          );
                          if (mustViewPdf) {
                            // Show validation message
                            if (mounted) {
                              Navigator.of(
                                context,
                              ).pop(); // Close current dialog
                              _showPdfRequiredDialog(context, course);
                            }
                            return;
                          }
                          context.pop();
                          _startQuiz(context, course);
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
                            Text(
                              'Start Quiz',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],

                  // CASE 3: Video + PDF + Quiz - Show "Start Training" and "View PDF Document" buttons
                  if (isCase3) ...[
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () {
                          context.pop();
                          _startVideo(context, course);
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
                            Icon(Icons.play_arrow, size: 20),
                            SizedBox(width: 8),
                            Text(
                              'Start Training',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () {
                          context.pop();
                          _openPdfViewer(context, course);
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.red[600],
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          elevation: 0,
                        ),
                        child: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.picture_as_pdf, size: 20),
                            SizedBox(width: 8),
                            Text(
                              'View PDF Document',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],

                  // Fallback for courses without quiz or with other combinations
                  if (!isCase1 && !isCase2 && !isCase3) ...[
                    if (course.hasVideo)
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: () {
                            context.pop();
                            _startVideo(context, course);
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
                              Icon(Icons.play_arrow, size: 20),
                              SizedBox(width: 8),
                              Text(
                                'Start Training',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    if (course.hasPdf) ...[
                      if (course.hasVideo) const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: () {
                            context.pop();
                            _openPdfViewer(context, course);
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.red[600],
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            elevation: 0,
                          ),
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.picture_as_pdf, size: 20),
                              SizedBox(width: 8),
                              Text(
                                'View PDF Document',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                    if (!course.hasVideo && !course.hasPdf)
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: () {
                            context.pop();
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.grey[300],
                            foregroundColor: Colors.grey[700],
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            elevation: 0,
                          ),
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.info_outline, size: 20),
                              SizedBox(width: 8),
                              Text(
                                'No Content Available',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    // Show "Skip to Quiz" only if quiz exists and not in the three main cases
                    if (hasQuiz) ...[
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton(
                          onPressed: () {
                            context.pop();
                            _startQuiz(context, course);
                          },
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(
                              color: AppColors.primaryBlue,
                            ),
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
                              Text(
                                'Skip to Quiz',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ],

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
          );
        },
      ),
    );
  }

  /// Show dialog when PDF is required but not viewed (for Case 2)
  void _showPdfRequiredDialog(BuildContext context, Course course) {
    showDialog(
      context: context,
      barrierColor: Colors.black54,
      builder: (context) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Icon
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: Colors.orange[50],
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.picture_as_pdf,
                  size: 40,
                  color: Colors.orange[600],
                ),
              ),
              const SizedBox(height: 20),
              // Title
              const Text(
                'PDF Document Required',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textBlack87,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              // Message
              Text(
                PdfViewerHelper.getPdfRequirementMessage(course),
                style: const TextStyle(
                  fontSize: 15,
                  color: Colors.grey,
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                PdfViewerHelper.getPdfRequirementExplanation(),
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.grey[500],
                  height: 1.4,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              // Buttons
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.of(context).pop(),
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: Colors.grey[300]!),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: Text(
                        'Cancel',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: Colors.grey[700],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton(
                      onPressed: () {
                        Navigator.of(context).pop();
                        _openPdfViewer(context, course);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.red[600],
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        elevation: 0,
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.picture_as_pdf, size: 20),
                          SizedBox(width: 8),
                          Text(
                            'View PDF',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showCompletedCourseDialog(BuildContext context, Course course) {
    showDialog(
      context: context,
      barrierColor: Colors.black54,
      builder: (context) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: Container(
          padding: const EdgeInsets.all(24),
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
                  color: Colors.green.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.check_circle,
                  size: 48,
                  color: Colors.green,
                ),
              ),
              const SizedBox(height: 20),
              // Title
              Text(
                course.title,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textBlack87,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              // Message
              const Text(
                'You have already completed this course!',
                style: TextStyle(fontSize: 16, color: Colors.grey, height: 1.5),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              // Primary Button - Review Training
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
                      Icon(Icons.refresh, size: 20),
                      SizedBox(width: 8),
                      Text(
                        'Review Training',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              if (course.hasPdf) ...[
                const SizedBox(height: 12),
                // PDF Button
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: () {
                      context.pop();
                      _openPdfViewer(context, course);
                    },
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Colors.red, width: 1.5),
                      foregroundColor: Colors.red[600],
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.picture_as_pdf, size: 20),
                        SizedBox(width: 8),
                        Text(
                          'View PDF Document',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 12),
              // Secondary Button - Review Quiz
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
                      Text(
                        'Review Quiz',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
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

  void _startVideo(BuildContext context, Course course) async {
    final progressKey = course.assignmentId ?? course.id;
    final isVideoCompleted = await VideoProgressService.isVideoCompleted(
      progressKey,
    );

    if (isVideoCompleted) {
      _startQuiz(context, course);
      return;
    }

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

    await context.push('/video-player', extra: course);

    final isVideoCompletedAfter = await VideoProgressService.isVideoCompleted(
      progressKey,
    );
    if (isVideoCompletedAfter && mounted) {
      Future.delayed(const Duration(milliseconds: 500), () {
        if (mounted) {
          _startQuiz(context, course);
        }
      });
    }

    // Wait a bit for any state updates to complete
    await Future.delayed(const Duration(milliseconds: 300));

    // Refresh progress IMMEDIATELY after returning from video
    // This ensures the cache is updated before categorization runs
    await _updateCourseProgress(course);

    // Force UI rebuild IMMEDIATELY to show updated progress and move course to in-progress section
    // This must happen before any course list refresh to ensure categorization sees the updated progress
    if (mounted) {
      _progressRebuildCounter++;
      setState(() {});
    }

    // Small delay to ensure UI has updated with new categorization
    await Future.delayed(const Duration(milliseconds: 200));

    // Refresh course list in background to get latest data (non-blocking)
    // This refresh will update the course list but won't interfere with the immediate UI update
    if (mounted) {
      context.read<CourseBloc>().add(const RefreshCourses());
    }
  }

  /// Review video only (for completed courses) - does not auto-navigate to quiz
  void _reviewVideo(BuildContext context, Course course) async {
    await context.push('/video-player', extra: course);

    // Wait a bit for any state updates to complete
    await Future.delayed(const Duration(milliseconds: 300));

    // Refresh course list first to get latest data
    if (mounted) {
      context.read<CourseBloc>().add(const RefreshCourses());
    }

    // Wait for course list to refresh, then update progress
    await Future.delayed(const Duration(milliseconds: 500));

    // Refresh progress after returning from video
    await _updateCourseProgress(course);
    // Clear the cached progress for this course to force FutureBuilder to recalculate
    final cacheKey = course.assignmentId ?? course.id;
    _courseProgress.remove(cacheKey);
    _videoCompleted.remove(cacheKey);
    // Increment rebuild counter to force FutureBuilder to rebuild with new key
    _progressRebuildCounter++;
    // Force UI rebuild by calling setState
    if (mounted) {
      setState(() {});
    }
  }

  /// Review quiz only (for completed courses) - opens quiz directly without video
  void _reviewQuiz(BuildContext context, Course course) async {
    if (course.assignmentId == null) return;

    await context.push(
      '/quiz',
      extra: {'course': course, 'assignmentId': course.assignmentId!},
    );

    // Mark course as updating status
    final cacheKey = course.assignmentId ?? course.id;
    if (mounted) {
      setState(() {
        _coursesUpdatingStatus.add(cacheKey);
      });
    }

    // Wait longer for backend to update assignment status after quiz completion
    // Increased delay to ensure backend has processed any updates
    await Future.delayed(const Duration(milliseconds: 1500));

    if (mounted) {
      // Refresh course list first to get latest data with updated assignment status
      context.read<CourseBloc>().add(const RefreshCourses());
      safePrint('[COURSE_LIST] ✅ Refreshing courses after quiz review');
    }

    // Wait for course data to refresh before updating progress
    await Future.delayed(const Duration(milliseconds: 500));

    // Refresh progress after returning from quiz
    await _updateCourseProgress(course);
    // Clear the cached progress for this course to force FutureBuilder to recalculate
    _courseProgress.remove(cacheKey);
    _videoCompleted.remove(cacheKey);
    // Increment rebuild counter to force FutureBuilder to rebuild with new key
    _progressRebuildCounter++;
    // Force UI rebuild by calling setState
    if (mounted) {
      setState(() {});
    }
  }

  void _startQuiz(BuildContext context, Course course) async {
    if (course.assignmentId == null) return;

    // Log quiz start
    ActivityLogger.logQuizStart(
      courseId: course.id,
      courseTitle: course.title,
      assignmentId: course.assignmentId!,
    );

    // Check if PDF must be viewed before quiz (if course has PDF)
    final mustViewPdf = await PdfViewerHelper.mustViewPdfBeforeQuiz(course);

    if (mustViewPdf) {
      // Show user-friendly dialog that PDF must be viewed first
      if (mounted) {
        showDialog(
          context: context,
          barrierColor: Colors.black54,
          builder: (context) => Dialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(24),
            ),
            child: Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Icon
                  Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      color: Colors.orange[50],
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.picture_as_pdf,
                      size: 40,
                      color: Colors.orange[600],
                    ),
                  ),
                  const SizedBox(height: 20),
                  // Title
                  Text(
                    'PDF Document Required',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: Colors.grey[800],
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  // Message - using helper for consistent messaging
                  Text(
                    PdfViewerHelper.getPdfRequirementMessage(course),
                    style: TextStyle(
                      fontSize: 15,
                      color: Colors.grey[600],
                      height: 1.5,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    PdfViewerHelper.getPdfRequirementExplanation(),
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.grey[500],
                      height: 1.4,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),
                  // Buttons
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => Navigator.of(context).pop(),
                          style: OutlinedButton.styleFrom(
                            side: BorderSide(color: Colors.grey[300]!),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: Text(
                            'Cancel',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: Colors.grey[700],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        flex: 2,
                        child: ElevatedButton(
                          onPressed: () {
                            Navigator.of(context).pop();
                            _openPdfViewer(context, course);
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.red[600],
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            elevation: 0,
                          ),
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.picture_as_pdf, size: 20),
                              SizedBox(width: 8),
                              Text(
                                'View PDF',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      }
      return;
    }

    await context.push(
      '/quiz',
      extra: {
        'course': course,
        'assignmentId': course.assignmentId!,
        'source': 'course_list', // Track that quiz was started from course list
      },
    );

    // Mark course as updating status
    final cacheKey = course.assignmentId ?? course.id;
    if (mounted) {
      setState(() {
        _coursesUpdatingStatus.add(cacheKey);
      });

      // Set a timeout to remove from updating status after 10 seconds
      // This prevents courses from being stuck in "updating" state if backend is very slow
      Future.delayed(const Duration(seconds: 10), () {
        if (mounted && _coursesUpdatingStatus.contains(cacheKey)) {
          setState(() {
            _coursesUpdatingStatus.remove(cacheKey);
          });
          safePrint(
            '[COURSE_LIST] ⚠️ Timeout: Removed course from updating status after 10 seconds',
          );
        }
      });
    }

    // Wait longer for backend to update assignment status after quiz completion
    // Increased delay to ensure backend has processed the completion
    await Future.delayed(const Duration(milliseconds: 1500));

    if (mounted) {
      // Refresh courses API to update course list with latest data
      context.read<CourseBloc>().add(const RefreshCourses());
      safePrint('[COURSE_LIST] ✅ Refreshing courses after quiz completion');

      // Also refresh learning paths API to ensure learning path progress is updated
      try {
        context.read<LearningPathBloc>().add(const RefreshLearningPaths());
        safePrint(
          '[COURSE_LIST] ✅ Refreshing learning paths after quiz completion',
        );
      } catch (e) {
        safePrint('[COURSE_LIST] ⚠️ LearningPathBloc not available: $e');
      }

      // Wait for course data to refresh before clearing cache
      await Future.delayed(const Duration(milliseconds: 500));

      // Clear cached progress to force recalculation with fresh data
      _courseProgress.remove(cacheKey);
      _videoCompleted.remove(cacheKey);
      _progressRebuildCounter++;

      // Check if assignment status is now updated, if so remove from updating set
      // We'll check this in the FutureBuilder by verifying the status
      // For now, keep it in updating set and let the FutureBuilder handle it

      // Force UI rebuild
      setState(() {});
    }
  }

  Map<String, List<Course>> _categorizeCourses(List<Course> courses) {
    final Map<String, List<Course>> categorized = {
      'in_progress': [],
      'start_training': [],
      'completed': [],
    };

    for (final course in courses) {
      // Use assignmentId for cache keys
      final cacheKey = course.assignmentId ?? course.id;
      final bool videoCompleted = _videoCompleted[cacheKey] ?? false;
      final double progress = _courseProgress[cacheKey] ?? 0.0;

      // Check completion status - use both assignment status and progress
      // This ensures we catch cases where assignment status hasn't updated yet but quiz is passed
      final bool isCompleted =
          course.assignmentStatus == 'completed' || progress >= 1.0;

      if (isCompleted) {
        categorized['completed']!.add(course);
      } else if (progress > 0 || videoCompleted) {
        categorized['in_progress']!.add(course);
      } else {
        categorized['start_training']!.add(course);
      }
    }

    // Sort courses within each category:
    // - In Progress: Sort by progress (highest first), then by video completion status
    // - Start Training: Keep original order
    // - Completed: Keep original order
    categorized['in_progress']!.sort((a, b) {
      final cacheKeyA = a.assignmentId ?? a.id;
      final cacheKeyB = b.assignmentId ?? b.id;
      final progressA = _courseProgress[cacheKeyA] ?? 0.0;
      final progressB = _courseProgress[cacheKeyB] ?? 0.0;
      final videoCompletedA = _videoCompleted[cacheKeyA] ?? false;
      final videoCompletedB = _videoCompleted[cacheKeyB] ?? false;

      // First sort by video completion (completed videos first)
      if (videoCompletedA != videoCompletedB) {
        return videoCompletedB ? 1 : -1;
      }
      // Then sort by progress (highest first)
      return progressB.compareTo(progressA);
    });

    return categorized;
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
            // Refresh progress for all courses when course list is loaded
            // This ensures progress is calculated and cached for categorization
            // Don't await - let it run in background and update UI when done
            _refreshCourseProgress(state.courses);

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
            return _buildErrorState(context, state.message);
          }

          // Show loader when returning from quiz until list is updated (normal loader for button action)
          final shouldShowLoader = returningFromQuiz &&
              (state is CourseLoading || state is! CourseLoaded);

          // Show shimmer loader for initial data loading, normal loader for button actions
          if (state is CourseLoading && !shouldShowLoader) {
            return _buildShimmerLoader(context);
          }

          // Show normal loader when returning from quiz (button action)
          if (shouldShowLoader) {
            return LoadingWidget(
              message: 'Updating course list...',
            );
          }

          if (state is CourseLoaded) {
            final courses = state.courses;
            final filteredCourses = _filterCourses(courses);
            final categorizedCourses = _categorizeCourses(filteredCourses);

            // Don't block UI for image preloading - let images load in background
            // Images will show as they load, providing better UX

            return _buildCupertinoSliverScreen(
              context,
              courses,
              filteredCourses,
              categorizedCourses,
            );
          }
          return _buildShimmerLoader(context);
        },
      ),
    );
  }

  /// Build error state widget with retry button
  Widget _buildErrorState(BuildContext context, String message) {
    return CustomScrollView(
      slivers: [
        CupertinoSliverNavigationBar(
          largeTitle: const Text(
            'Courses',
            style: TextStyle(
              fontWeight: FontWeight.w500,
              color: AppColors.textBlack87,
            ),
          ),
          backgroundColor: AppColors.lightGrayBackground.withOpacity(0.95),
          border: null,
        ),
        SliverFillRemaining(
          hasScrollBody: false,
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
                  Text(
                    'Error Loading Courses',
                    style: TextStyle(
                      color: AppColors.red(700),
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    message,
                    style: TextStyle(
                      color: AppColors.grey(600),
                      fontSize: 14,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 32),
                  ElevatedButton.icon(
                    onPressed: () {
                      context.read<CourseBloc>().add(const LoadCourses());
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

  /// Build shimmer loader for course list
  Widget _buildShimmerLoader(BuildContext context) {
    return CustomScrollView(
      slivers: [
        CupertinoSliverNavigationBar(
          largeTitle: const Text(
            'Courses',
            style: TextStyle(
              fontWeight: FontWeight.w500,
              color: AppColors.textBlack87,
            ),
          ),
          backgroundColor: AppColors.lightGrayBackground.withOpacity(0.95),
          border: null,
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                return Padding(
                  padding: EdgeInsets.only(top: index == 0 ? 0 : 12),
                  child: const CourseCardSkeletonLoader(),
                );
              },
              childCount: 6, // Show 6 skeleton cards
            ),
          ),
        ),
      ],
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

        // Pull-to-refresh indicator
        CupertinoSliverRefreshControl(
          onRefresh: () async {
            context.read<CourseBloc>().add(const RefreshCourses());
            context.read<LearningPathBloc>().add(const RefreshLearningPaths());
            await Future.delayed(const Duration(milliseconds: 500));
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
                child: _buildEmptyStateContent(context, courses.length),
              );
            }

            // Otherwise, show content (learning paths and/or courses)
            return SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  // My Learning Paths Section
                  _buildLearningPathsSection(context),

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

  /// Empty state content for sliver
  Widget _buildEmptyStateContent(BuildContext context, int count) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 32, 20, 32),
      child: Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.school_outlined,
              size: 64,
              color: AppColors.grey(400),
            ),
            const SizedBox(height: 16),
            Text(
              'No Courses Found',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: AppColors.grey(700),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Check back later for new courses or try refreshing',
              style: TextStyle(
                fontSize: 14,
                color: AppColors.grey(500),
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () {
                safePrint(
                  '[COURSE_API] [UI] 🔄 User clicked Retry button (empty state)',
                );
                safePrint('[COURSE_API] [UI] Current courses count: $count');
                context.read<CourseBloc>().add(const RefreshCourses());
                context
                    .read<LearningPathBloc>()
                    .add(const RefreshLearningPaths());
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
    );
  }

  // _buildEmptyState is replaced by _buildEmptyStateContent for sliver-based layout

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
        context.push('/course-details', extra: course).then((_) async {
          // Wait a bit for any state updates to complete
          await Future.delayed(const Duration(milliseconds: 300));

          // Refresh courses when returning from course details
          if (mounted) {
            context.read<CourseBloc>().add(const RefreshCourses());

            // Wait for course data to refresh
            await Future.delayed(const Duration(milliseconds: 500));

            // Invalidate only this course so only this card shows loader (not all cards)
            final cacheKey = course.assignmentId ?? course.id;
            _courseProgress.remove(cacheKey);
            _videoCompleted.remove(cacheKey);
            _courseProgressInvalidationCounter[cacheKey] =
                (_courseProgressInvalidationCounter[cacheKey] ?? 0) + 1;
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
                        _buildDescription(course),
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

            const SizedBox(height: 16),

            // Content type icons - using reusable widget
            ContentTypeIndicator(course: course, isCompleted: isCompleted),
            const SizedBox(height: 16),

            // State indicator and action button section
            // Use cached progress when available so only the clicked card shows loader
            FutureBuilder<double>(
              key: ValueKey(
                'course_state_${course.assignmentId ?? course.id}_${course.assignmentStatus}_$_progressRebuildCounter}_${_courseProgressInvalidationCounter[cacheKey] ?? 0}',
              ),
              future: _courseProgress.containsKey(cacheKey)
                  ? Future.value(_courseProgress[cacheKey]! * 100)
                  : _calculateCombinedProgress(course),
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

                // If status is confirmed updated (completed or progress is 100%), remove from updating set
                if (isActuallyCompleted && isUpdatingStatus) {
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (mounted) {
                      setState(() {
                        _coursesUpdatingStatus.remove(cacheKey);
                      });
                    }
                  });
                }

                // Show updating indicator if status is being updated
                if (isUpdatingStatus && !isActuallyCompleted) {
                  return Column(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.lightOrangeBackground,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: AppColors.continueOrange.withOpacity(0.3),
                            width: 1,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation<Color>(
                                  AppColors.continueOrange,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            const Text(
                              'Updating course status...',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: AppColors.continueOrange,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      // Show current progress while updating
                      if (calculatedProgress > 0.0)
                        _buildInProgressState(
                          context,
                          course,
                          calculatedProgress,
                          videoCompleted,
                        )
                      else
                        _buildStartCourseState(context, course),
                    ],
                  );
                }

                if (isActuallyCompleted) {
                  // STATE 4: Complete
                  return _buildCompleteState(context, course);
                } else if (videoCompleted && !isActuallyCompleted) {
                  // STATE 3: Continue (Video done, quiz pending)
                  return _buildContinueState(
                    context,
                    course,
                    calculatedProgress,
                  );
                } else if (calculatedProgress > 0.0) {
                  // STATE 2: In Progress (Started but not completed)
                  return _buildInProgressState(
                    context,
                    course,
                    calculatedProgress,
                    videoCompleted,
                  );
                } else {
                  // STATE 1: Start Course (Not started)
                  return _buildStartCourseState(context, course);
                }
              },
            ),
          ],
        ),
      ),
    );
  }

  /// STATE 1: Start Course - Course hasn't been started yet
  Widget _buildStartCourseState(BuildContext context, Course course) {
    final isCase2 = course.hasPdf && !course.hasVideo;
    return FutureBuilder<bool>(
      key: ValueKey('start_course_${course.id}_${_progressRebuildCounter}'),
      future: isCase2
          ? Future.wait([
              _hasQuiz(course),
              PdfProgressService.hasViewedPdf(course.assignmentId ?? course.id),
            ]).then((results) => results[0] && results[1])
          : Future.value(false),
      builder: (context, snapshot) {
        final showStartQuiz = snapshot.data ?? false;

        if (showStartQuiz) {
          return SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => _startQuiz(context, course),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.continueButtonBackground,
                foregroundColor: AppColors.continueButtonForeground,
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.quiz, size: 24),
                  SizedBox(width: 8),
                  Text(
                    'Start Quiz',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.5,
                    ),
                  ),
                  SizedBox(width: 8),
                  Icon(Icons.arrow_forward_sharp, size: 20),
                ],
              ),
            ),
          );
        }
        return SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () => _viewCourseDetails(context, course),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.startCourseBackground,
              foregroundColor: AppColors.startCourseForeground,
              elevation: 0,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.play_circle_outline, size: 24),
                SizedBox(width: 8),
                Text(
                  'Start Course',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.5,
                  ),
                ),
                SizedBox(width: 8),
                Icon(Icons.arrow_forward_sharp, size: 20),
              ],
            ),
          ),
        );
      },
    );
  }

  /// STATE 2: In Progress - Course has been started but not completed
  Widget _buildInProgressState(
    BuildContext context,
    Course course,
    double progress,
    bool videoCompleted,
  ) {
    final progressPercent = (progress / 100.0).clamp(0.0, 1.0);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Status badge
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: AppColors.lightBlueBackground,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.access_time, size: 16, color: AppColors.primaryBlue),
              const SizedBox(width: 6),
              const Text(
                'In Progress',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primaryBlue,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        // Progress bar
        InkWell(
          onTap: () {
            if (videoCompleted) {
              _startQuiz(context, course);
            } else {
              _startVideo(context, course);
            }
          },
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Progress',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textBlack87,
                    ),
                  ),
                  Text(
                    '${progress.round()}%',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primaryBlue,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: LinearProgressIndicator(
                  value: progressPercent,
                  minHeight: 10,
                  backgroundColor: AppColors.grey(200),
                  valueColor: const AlwaysStoppedAnimation<Color>(
                    AppColors.primaryBlue,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        // Continue button - dynamically shows based on PDF viewing status
        FutureBuilder<bool>(
          future: PdfViewerHelper.mustViewPdfBeforeQuiz(course),
          builder: (context, snapshot) {
            final mustViewPdf = snapshot.data ?? false;
            final buttonText = videoCompleted
                ? (mustViewPdf ? 'View PDF' : 'Take Quiz')
                : 'Continue';
            final buttonIcon = videoCompleted
                ? (mustViewPdf ? Icons.picture_as_pdf : Icons.quiz)
                : Icons.play_circle_outline;

            return SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () async {
                  if (videoCompleted) {
                    // Check if PDF needs to be viewed first using helper
                    final mustViewPdfCheck =
                        await PdfViewerHelper.mustViewPdfBeforeQuiz(course);
                    if (mustViewPdfCheck) {
                      _openPdfViewer(context, course);
                      return;
                    }
                    _startQuiz(context, course);
                  } else {
                    _startVideo(context, course);
                  }
                },
                style: OutlinedButton.styleFrom(
                  foregroundColor: mustViewPdf && videoCompleted
                      ? Colors.red[600]
                      : AppColors.primaryBlue,
                  side: BorderSide(
                    color: mustViewPdf && videoCompleted
                        ? Colors.red[600]!
                        : AppColors.primaryBlue,
                    width: 1.5,
                  ),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(buttonIcon, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      buttonText,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ],
    );
  }

  /// STATE 3: Continue - Video completed, quiz pending
  Widget _buildContinueState(
    BuildContext context,
    Course course,
    double progress,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Status badge
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: AppColors.lightOrangeBackground,
            borderRadius: BorderRadius.circular(20),
          ),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.video_library,
                size: 16,
                color: AppColors.continueOrange,
              ),
              SizedBox(width: 6),
              Text(
                'Video Completed',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.continueOrange,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        // Progress bar
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Progress',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textBlack87,
                  ),
                ),
                Text(
                  '${progress.round()}%',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.continueOrange,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(
                value: (progress / 100.0).clamp(0.0, 1.0),
                minHeight: 10,
                backgroundColor: AppColors.grey(200),
                valueColor: const AlwaysStoppedAnimation<Color>(
                  AppColors.continueOrange,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        // Check if PDF needs to be viewed first
        FutureBuilder<bool>(
          future: course.hasPdf
              ? PdfProgressService.hasViewedPdf(
                  course.assignmentId ?? course.id,
                )
              : Future.value(true),
          builder: (context, snapshot) {
            final hasViewedPdf = snapshot.data ?? true;
            final needsPdfView = course.hasPdf && !hasViewedPdf;

            if (needsPdfView) {
              // Show PDF button first
              return Column(
                children: [
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () => _openPdfViewer(context, course),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.red[600],
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.picture_as_pdf, size: 22),
                          SizedBox(width: 8),
                          Text(
                            'View PDF Document',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.5,
                            ),
                          ),
                          SizedBox(width: 8),
                          Icon(Icons.arrow_forward_sharp, size: 20),
                        ],
                      ),
                    ),
                  ),
                  //const SizedBox(height: 12),
                  // Use reusable PDF requirement banner widget
                  //PdfRequirementBanner(course: course),
                ],
              );
            }

            // Show Continue to Quiz button
            return SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => _startQuiz(context, course),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.continueButtonBackground,
                  foregroundColor: AppColors.continueButtonForeground,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.quiz, size: 22),
                    SizedBox(width: 8),
                    Text(
                      'Continue to Quiz',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.5,
                      ),
                    ),
                    SizedBox(width: 8),
                    Icon(Icons.arrow_forward_sharp, size: 20),
                  ],
                ),
              ),
            );
          },
        ),
      ],
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
        const SizedBox(height: 16),
        // Review button
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

  String _buildDescription(Course course) {
    return '${course.description}';
  }

  String _estimateDuration(Course course) {
    final minutes = (course.duration);
    return '$minutes';
  }

  /// Open PDF viewer for course
  /// Handles PDF viewing and updates course progress after viewing
  Future<void> _openPdfViewer(BuildContext context, Course course) async {
    if (course.pdfKey == null) {
      // Show error if PDF is not available
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Row(
              children: [
                Icon(Icons.error_outline, color: Colors.white, size: 20),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'PDF document is not available for this course.',
                    style: TextStyle(fontSize: 14),
                  ),
                ),
              ],
            ),
            backgroundColor: Colors.red[600],
            behavior: SnackBarBehavior.floating,
            margin: const EdgeInsets.all(16),
          ),
        );
      }
      return;
    }

    // Log course start
    ActivityLogger.logCourseStart(
      courseId: course.id,
      courseTitle: course.title,
      assignmentId: course.assignmentId,
    );

    // Log PDF open
    ActivityLogger.logPdfOpen(
      courseId: course.id,
      courseTitle: course.title,
      pdfKey: course.pdfKey!,
      assignmentId: course.assignmentId,
    );

    final progressKey = course.assignmentId ?? course.id;
    final hasViewedPdf = await PdfProgressService.hasViewedPdf(progressKey);

    // Navigate to PDF viewer with callback to handle quiz start after PDF is viewed
    await context.push(
      '/pdf-viewer',
      extra: {
        'course': course,
        'onPdfViewedAndReadyForQuiz': (Course viewedCourse) async {
          // This callback is called when user confirms "Yes, Done" in PDF viewer
          // Update course progress first
          await _updateCourseProgress(viewedCourse);
          final cacheKey = viewedCourse.assignmentId ?? viewedCourse.id;
          _courseProgress.remove(cacheKey);
          _progressRebuildCounter++;

          if (mounted) {
            setState(() {});

            // Show success message
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: const Row(
                  children: [
                    Icon(Icons.check_circle, color: Colors.white, size: 20),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'PDF document viewed successfully. Starting quiz...',
                        style: TextStyle(fontSize: 14),
                      ),
                    ),
                  ],
                ),
                backgroundColor: Colors.green[600],
                behavior: SnackBarBehavior.floating,
                margin: const EdgeInsets.all(16),
                duration: const Duration(seconds: 2),
              ),
            );

            // Small delay to show message, then start quiz
            await Future.delayed(const Duration(milliseconds: 500));

            // Start quiz - this will check PDF status and navigate to quiz
            if (mounted) {
              _startQuiz(context, viewedCourse);
            }
          }
        },
      },
    );

    // Check if PDF was viewed after returning (for cases where callback wasn't used)
    final viewedAfter = await PdfProgressService.hasViewedPdf(progressKey);
    if (!hasViewedPdf && viewedAfter) {
      // PDF was just viewed, show confirmation dialog
      if (mounted) {
        // Show confirmation dialog
        final confirmed = await showDialog<bool>(
          context: context,
          barrierColor: Colors.black54,
          builder: (context) => Dialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(24),
            ),
            child: Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Icon
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: Colors.green.withOpacity(0.1),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.check_circle,
                      color: Colors.green,
                      size: 32,
                    ),
                  ),
                  const SizedBox(height: 20),
                  // Title
                  Text(
                    'PDF Viewed Successfully!',
                    style: TextStyle(
                      fontSize:
                          20 * AppTheme.getDimensions(context).textScaleFactor,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textBlack87,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  // Message
                  Text(
                    'You have completed viewing the PDF document. Ready to start the quiz?',
                    style: TextStyle(
                      fontSize:
                          15 * AppTheme.getDimensions(context).textScaleFactor,
                      color: Colors.grey[700],
                      height: 1.4,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),
                  // Buttons
                  Row(
                    children: [
                      // Later button
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => Navigator.of(context).pop(false),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.grey[700],
                            side: BorderSide(
                              color: Colors.grey[300]!,
                              width: 1.5,
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: const Text(
                            'Later',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      // Start Quiz button
                      Expanded(
                        flex: 2,
                        child: ElevatedButton(
                          onPressed: () => Navigator.of(context).pop(true),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primaryBlue,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            elevation: 0,
                          ),
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.quiz, size: 20),
                              SizedBox(width: 8),
                              Text(
                                'Start Quiz',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );

        // Refresh course progress
        await _updateCourseProgress(course);
        final cacheKey = course.assignmentId ?? course.id;
        _courseProgress.remove(cacheKey);
        _progressRebuildCounter++;

        if (mounted) {
          setState(() {}); // Update UI to show "Start Quiz" button
        }

        // If user confirmed, start quiz
        if (confirmed == true && mounted) {
          await Future.delayed(const Duration(milliseconds: 300));
          if (mounted) {
            _startQuiz(context, course);
          }
        }
      }
    }
  }

  Widget _buildLearningPathsSection(BuildContext context) {
    return BlocBuilder<LearningPathBloc, LearningPathState>(
      builder: (context, state) {
        if (state is LearningPathLoading) {
          // Show skeleton loader instead of full LoadingWidget
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Builder(
                builder: (context) {
                  final dims = AppTheme.getDimensions(context);
                  final isTablet = dims.isTablet;
                  final isSmallScreen = dims.isSmallScreen;
                  return Text(
                    'My Learning Paths',
                    style: TextStyle(
                      fontSize: isTablet ? 24 : (isSmallScreen ? 18 : 20),
                      fontWeight: FontWeight.bold,
                      color: AppColors.textBlack87,
                    ),
                  );
                },
              ),
              SizedBox(
                height: AppTheme.getDimensions(context).isSmallScreen ? 10 : 12,
              ),
              const LearningPathSkeletonLoader(),
            ],
          );
        }

        if (state is LearningPathError) {
          return const SizedBox.shrink(); // Hide on error
        }

        if (state is LearningPathLoaded) {
          final allPaths = state.paths;
          if (allPaths.isEmpty) {
            return const SizedBox.shrink();
          }

          // Separate active and completed paths
          final activePaths =
              allPaths.where((path) => !path.isCompleted).toList();
          final completedPaths =
              allPaths.where((path) => path.isCompleted).toList();

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Active Learning Paths Section
              if (activePaths.isNotEmpty) ...[
                Builder(
                  builder: (context) {
                    final dims = AppTheme.getDimensions(context);
                    final isTablet = dims.isTablet;
                    final isSmallScreen = dims.isSmallScreen;
                    return Text(
                      'My Learning Paths',
                      style: TextStyle(
                        fontSize: isTablet ? 24 : (isSmallScreen ? 18 : 20),
                        fontWeight: FontWeight.bold,
                        color: AppColors.textBlack87,
                      ),
                    );
                  },
                ),
                SizedBox(
                  height:
                      AppTheme.getDimensions(context).isSmallScreen ? 10 : 12,
                ),
                ...activePaths.map((path) {
                  return Padding(
                    padding: EdgeInsets.only(
                      bottom: AppTheme.getDimensions(context).isSmallScreen
                          ? 10
                          : 12,
                    ),
                    child: _buildLearningPathCard(context, path),
                  );
                }),
              ],
              // Completed Training Section
              if (completedPaths.isNotEmpty) ...[
                if (activePaths.isNotEmpty)
                  SizedBox(
                    height:
                        AppTheme.getDimensions(context).isSmallScreen ? 16 : 24,
                  ),
                Builder(
                  builder: (context) {
                    final dims = AppTheme.getDimensions(context);
                    final isTablet = dims.isTablet;
                    final isSmallScreen = dims.isSmallScreen;
                    return Text(
                      'Completed Training',
                      style: TextStyle(
                        fontSize: isTablet ? 24 : (isSmallScreen ? 18 : 20),
                        fontWeight: FontWeight.bold,
                        color: AppColors.textBlack87,
                      ),
                    );
                  },
                ),
                SizedBox(
                  height:
                      AppTheme.getDimensions(context).isSmallScreen ? 10 : 12,
                ),
                ...completedPaths.map((path) {
                  return Padding(
                    padding: EdgeInsets.only(
                      bottom: AppTheme.getDimensions(context).isSmallScreen
                          ? 10
                          : 12,
                    ),
                    child: _buildLearningPathCard(
                      context,
                      path,
                      isCompleted: true,
                    ),
                  );
                }),
              ],
            ],
          );
        }

        return const SizedBox.shrink();
      },
    );
  }

  Widget _buildLearningPathCard(
    BuildContext context,
    LearningPath path, {
    bool isCompleted = false,
  }) {
    // Capture the bloc instance before the closure
    final learningPathBloc = context.read<LearningPathBloc>();
    final dims = AppTheme.getDimensions(context);
    final isTablet = dims.isTablet;
    final isSmallScreen = dims.isSmallScreen;

    return Container(
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
      child: InkWell(
        onTap: () {
          context.push('/learning-path-progress', extra: path).then((_) {
            // Refresh paths when returning
            learningPathBloc.add(const RefreshLearningPaths());
          });
        },
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: EdgeInsets.all(
            isTablet ? 20.0 : (isSmallScreen ? 12.0 : 16.0),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                path.title,
                                style: TextStyle(
                                  fontSize:
                                      isTablet ? 20 : (isSmallScreen ? 16 : 18),
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.textBlack87,
                                ),
                              ),
                            ),
                            if (isCompleted)
                              Container(
                                padding: EdgeInsets.symmetric(
                                  horizontal: isTablet ? 10 : 8,
                                  vertical: isSmallScreen ? 3 : 4,
                                ),
                                decoration: BoxDecoration(
                                  color: AppColors.lightGreenBackground,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      Icons.check_circle,
                                      size: isTablet
                                          ? 16
                                          : (isSmallScreen ? 12 : 14),
                                      color: AppColors.completedGreen,
                                    ),
                                    SizedBox(width: isSmallScreen ? 3 : 4),
                                    Text(
                                      'Completed',
                                      style: TextStyle(
                                        fontSize: isTablet
                                            ? 12
                                            : (isSmallScreen ? 10 : 11),
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.completedGreen,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                        if (path.description != null) ...[
                          SizedBox(height: isSmallScreen ? 3 : 4),
                          Text(
                            path.description!,
                            style: TextStyle(
                              fontSize:
                                  isTablet ? 14 : (isSmallScreen ? 11 : 12),
                              color: AppColors.textSecondary,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ],
                    ),
                  ),
                  Icon(
                    Icons.chevron_right,
                    size: isTablet ? 28 : (isSmallScreen ? 20 : 24),
                    color: AppColors.grey(400),
                  ),
                ],
              ),
              SizedBox(height: isSmallScreen ? 10 : 12),
              // Progress Info
              LayoutBuilder(
                builder: (context, constraints) {
                  final isNarrow = constraints.maxWidth < 300;
                  return isNarrow
                      ? Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${path.completedCount} of ${path.totalCount} courses',
                              style: TextStyle(
                                fontSize:
                                    isTablet ? 16 : (isSmallScreen ? 12 : 14),
                                color: AppColors.grey(700),
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            // const SizedBox(width: 8),
                            Spacer(),
                            Container(
                              padding: EdgeInsets.symmetric(
                                horizontal: isTablet ? 12 : 10,
                                vertical: isSmallScreen ? 3 : 4,
                              ),
                              decoration: BoxDecoration(
                                color: isCompleted
                                    ? AppColors.lightGreenBackground
                                    : AppColors.lightBlueBackground,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                '${path.progressPercentage.toStringAsFixed(0)}%',
                                style: TextStyle(
                                  fontSize:
                                      isTablet ? 16 : (isSmallScreen ? 12 : 14),
                                  fontWeight: FontWeight.bold,
                                  color: isCompleted
                                      ? AppColors.completedGreen
                                      : AppColors.primaryBlueAlt,
                                ),
                              ),
                            ),
                          ],
                        )
                      : Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Flexible(
                              child: Text(
                                '${path.completedCount} of ${path.totalCount} courses completed',
                                style: TextStyle(
                                  fontSize:
                                      isTablet ? 16 : (isSmallScreen ? 12 : 14),
                                  color: AppColors.grey(700),
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Container(
                              padding: EdgeInsets.symmetric(
                                horizontal: isTablet ? 12 : 10,
                                vertical: isSmallScreen ? 3 : 4,
                              ),
                              decoration: BoxDecoration(
                                color: isCompleted
                                    ? AppColors.lightGreenBackground
                                    : AppColors.lightBlueBackground,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                '${path.progressPercentage.toStringAsFixed(0)}%',
                                style: TextStyle(
                                  fontSize:
                                      isTablet ? 16 : (isSmallScreen ? 12 : 14),
                                  fontWeight: FontWeight.bold,
                                  color: isCompleted
                                      ? AppColors.completedGreen
                                      : AppColors.primaryBlueAlt,
                                ),
                              ),
                            ),
                          ],
                        );
                },
              ),
              SizedBox(height: isSmallScreen ? 10 : 12),
              // Progress Bar
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: LinearProgressIndicator(
                  value: path.progressPercentage / 100,
                  backgroundColor: AppColors.grey(200),
                  valueColor: AlwaysStoppedAnimation<Color>(
                    isCompleted
                        ? AppColors.completedGreen
                        : AppColors.primaryBlueAlt,
                  ),
                  minHeight: isTablet ? 10 : (isSmallScreen ? 6 : 8),
                ),
              ),
              SizedBox(height: isSmallScreen ? 10 : 12),
              // Path Type Badge, Version, and Due Date
              Wrap(
                spacing: isSmallScreen ? 6 : 8,
                runSpacing: isSmallScreen ? 6 : 8,
                children: [
                  Container(
                    width: isTablet ? 100 : (isSmallScreen ? 75 : 85),
                    padding: EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: isSmallScreen ? 6 : 8,
                    ),
                    decoration: BoxDecoration(
                      color: path.isSequential
                          ? Colors.blue[100]
                          : Colors.green[100],
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Center(
                      child: Text(
                        path.isSequential ? 'Sequential' : 'Flexible',
                        style: TextStyle(
                          fontSize: isTablet ? 12 : (isSmallScreen ? 10 : 11),
                          fontWeight: FontWeight.w600,
                        ),
                        textAlign: TextAlign.center,
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
                  if (path.version != null)
                    Container(
                      padding: EdgeInsets.symmetric(
                        horizontal: isTablet ? 12 : 10,
                        vertical: isSmallScreen ? 4 : 6,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primaryBlueAlt.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: AppColors.primaryBlueAlt.withOpacity(0.3),
                          width: 1,
                        ),
                      ),
                      child: Text(
                        'v${path.version}',
                        style: TextStyle(
                          fontSize: isTablet ? 13 : (isSmallScreen ? 10 : 12),
                          fontWeight: FontWeight.w700,
                          color: AppColors.primaryBlueAlt,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  if (path.dueDate != null)
                    Chip(
                      avatar: const Icon(
                        Icons.calendar_today,
                        size: 14,
                        color: AppColors.warningOrange,
                      ),
                      label: Text(
                        'Due: ${_formatDate(path.dueDate!)}',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      backgroundColor: Colors.orange[100],
                      //    padding: const EdgeInsets.symmetric(horizontal: 8),
                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.month}/${date.day}/${date.year}';
  }
}

// Search header is now integrated into CupertinoSliverNavigationBar

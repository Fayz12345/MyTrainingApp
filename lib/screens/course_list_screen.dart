import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:amplify_flutter/amplify_flutter.dart';
import '../models/course_model.dart';
import '../bloc/course/course_bloc.dart';
import '../bloc/quiz/quiz_bloc.dart';
import '../widgets/app_loader.dart';
import '../services/video_progress_service.dart';
import '../services/quiz_progress_service.dart';
import '../services/quiz_service.dart';
import '../services/storage_service.dart';
import 'video_player_screen.dart';
import 'quiz_screen.dart';

class CourseListScreen extends StatelessWidget {
  const CourseListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    safePrint('[COURSE_API] [UI] ========================================');
    safePrint('[COURSE_API] [UI] 🎯 CourseListScreen building...');
    safePrint(
        '[COURSE_API] [UI] Creating CourseBloc and triggering LoadCourses event...');
    safePrint(
        '[COURSE_API] [UI] This will initiate the API call to fetch course list');
    safePrint('[COURSE_API] [UI] ========================================');
    return BlocProvider(
      create: (context) {
        final bloc = CourseBloc();
        safePrint(
            '[COURSE_API] [UI] CourseBloc created, adding LoadCourses event...');
        bloc.add(const LoadCourses());
        safePrint('[COURSE_API] [UI] ✅ LoadCourses event added to bloc');
        return bloc;
      },
      child: const CourseListContent(),
    );
  }
}

class CourseListContent extends StatefulWidget {
  const CourseListContent({super.key});

  @override
  State<CourseListContent> createState() => _CourseListContentState();
}

class _CourseListContentState extends State<CourseListContent> {
  final TextEditingController _searchController = TextEditingController();
  bool _isSearchActive = false;
  String _searchQuery = '';
  final Map<String, double> _courseProgress = {};
  final Map<String, bool> _videoCompleted = {};
  int _progressRebuildCounter = 0; // Counter to force FutureBuilder rebuilds
  final Map<String, String> _imageUrlCache =
      {}; // Cache for preloaded image URLs
  bool _isLoadingImages = false; // Track if images are being preloaded

  @override
  void initState() {
    super.initState();
    _loadVideoProgress();
  }

  Future<void> _loadVideoProgress() async {
    // This will be called when courses are loaded
  }

  void _refreshCourseProgress(List<Course> courses) {
    // Clear cached progress to force recalculation with updated assignmentStatus
    for (final course in courses) {
      // Use assignmentId for cache keys
      final cacheKey = course.assignmentId ?? course.id;
      // Remove cached progress so it gets recalculated with new assignmentStatus
      _courseProgress.remove(cacheKey);
      _videoCompleted.remove(cacheKey);
      // Update progress with new assignmentStatus
      _updateCourseProgress(course);
    }
    // Preload all image URLs when courses are refreshed - this will set _isLoadingImages
    _preloadImageUrls(courses);
  }

  /// Preload all image URLs for courses to avoid FutureBuilder loaders
  Future<void> _preloadImageUrls(List<Course> courses) async {
    // Check if there are any images to load
    final imagesToLoad = courses
        .where((course) =>
            course.imageKey != null &&
            !_imageUrlCache.containsKey(course.imageKey))
        .toList();

    // If no images to load, set loading to false and return immediately
    if (imagesToLoad.isEmpty) {
      if (mounted) {
        setState(() {
          _isLoadingImages = false;
        });
      }
      return;
    }

    // Set loading state to true - show loader while images are loading
    if (mounted) {
      setState(() {
        _isLoadingImages = true;
      });
    }

    final futures = <Future<void>>[];
    for (final course in imagesToLoad) {
      futures.add(
        StorageService.getImageUrl(course.imageKey!).then((url) {
          if (mounted) {
            setState(() {
              _imageUrlCache[course.imageKey!] = url;
            });
          }
        }).catchError((e) {
          safePrint('Error preloading image for ${course.title}: $e');
          // Even if one image fails, continue loading others
        }),
      );
    }

    // Wait for all images to load (with timeout to prevent infinite waiting)
    try {
      await Future.wait(futures).timeout(
        const Duration(seconds: 30),
      );
    } catch (e) {
      if (e.toString().contains('TimeoutException') ||
          e.toString().contains('timeout')) {
        safePrint('Image preloading timed out after 30 seconds');
      } else {
        safePrint('Error during image preloading: $e');
      }
    }

    // Set loading state to false - now show all content at once
    if (mounted) {
      setState(() {
        _isLoadingImages = false;
      });
    }
  }

  /// Calculate combined progress: Video (0-50%) + Quiz (51-100%)
  Future<double> _calculateCombinedProgress(Course course) async {
    // Check if assignment is fully completed
    final bool isAssignmentCompleted = course.assignmentStatus == 'completed';
    if (isAssignmentCompleted) {
      return 100.0;
    }

    // Also check if quiz result exists (quiz was passed) - this handles cases
    // where assignment status hasn't been refreshed yet but quiz was completed
    if (course.assignmentId != null) {
      final hasPassedQuiz =
          await QuizService.hasQuizResult(course.assignmentId!);
      if (hasPassedQuiz) {
        // Quiz was passed, so course should be 100% complete
        return 100.0;
      }
    }

    double videoProgress = 0.0; // 0-50%
    double quizProgress = 0.0; // 51-100%

    // Use assignmentId for progress tracking (each assignment has its own progress)
    // Fall back to course.id if assignmentId is not available
    final progressKey = course.assignmentId ?? course.id;

    // Calculate video progress (0-50%)
    final isVideoCompleted =
        await VideoProgressService.isVideoCompleted(progressKey);
    if (isVideoCompleted) {
      videoProgress = 50.0; // Video fully watched = 50%
    } else {
      final savedPosition =
          await VideoProgressService.getVideoProgress(progressKey);
      if (savedPosition != null) {
        // First try to get the actual saved video duration
        Duration? videoDuration =
            await VideoProgressService.getVideoDuration(progressKey);

        // If no saved duration, fall back to parsing course.duration string
        if (videoDuration == null || videoDuration.inMilliseconds == 0) {
          // Parse duration string like "1hr 30 Mins" or "45 Min" into total minutes
          int estimatedDurationMinutes = 30; // Default fallback
          if (course.duration != null) {
            final durationStr = course.duration!.toLowerCase();
            int hours = 0;
            int minutes = 0;

            // Extract hours (look for "hr" or "hour")
            final hourMatch =
                RegExp(r'(\d+)\s*(?:hr|hour|h)').firstMatch(durationStr);
            if (hourMatch != null) {
              hours = int.tryParse(hourMatch.group(1) ?? '0') ?? 0;
            }

            // Extract minutes (look for "min" or "mins" or just numbers after hours)
            final minMatch = RegExp(
                    r'(\d+)\s*(?:min|mins|minute|minutes|m)(?!\s*(?:hr|hour|h))')
                .firstMatch(durationStr);
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
              '[PROGRESS] [CourseList] Video progress calculation for ${course.title}:');
          safePrint('  - Assignment ID: ${course.assignmentId ?? "N/A"}');
          safePrint('  - Progress Key: $progressKey');
          safePrint(
              '  - Using saved duration: ${videoDuration.inSeconds}s (${videoDuration.inMinutes}m ${videoDuration.inSeconds % 60}s)');
          safePrint('  - Course duration string: "${course.duration}"');
          safePrint(
              '  - Saved position: ${savedPosition.inSeconds}s (${savedPosition.inMinutes}m ${savedPosition.inSeconds % 60}s)');
          safePrint(
              '  - Video progress: ${(videoProgressPercent * 100).toStringAsFixed(2)}% of video');
          safePrint(
              '  - Course progress (video portion): ${videoProgress.toStringAsFixed(2)}%');
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
          final quizProgressData =
              await QuizProgressService.getQuizProgress(progressKey);
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
        '[PROGRESS] [CourseList] Final combined progress for ${course.title}: ${finalProgress.toStringAsFixed(2)}% (Video: ${videoProgress.toStringAsFixed(2)}%, Quiz: ${quizProgress.toStringAsFixed(2)}%, IsCompleted: $isVideoCompleted)');

    return finalProgress;
  }

  Future<void> _updateCourseProgress(Course course) async {
    // Use assignmentId for cache keys (each assignment has its own progress)
    final cacheKey = course.assignmentId ?? course.id;

    // Use assignmentId for progress tracking
    final progressKey = course.assignmentId ?? course.id;
    final isVideoCompleted =
        await VideoProgressService.isVideoCompleted(progressKey);
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
        '[PROGRESS] [CourseList] Course ${course.id} (Assignment: ${course.assignmentId}): Calculated progress = ${progress}% (stored as ${_courseProgress[cacheKey]})');

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
    _searchController.dispose();
    super.dispose();
  }

  void _toggleSearch() {
    setState(() {
      _isSearchActive = !_isSearchActive;
      if (!_isSearchActive) {
        _searchController.clear();
        _searchQuery = '';
      }
    });
  }

  void _onSearchChanged(String query) {
    setState(() {
      _searchQuery = query.toLowerCase().trim();
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

  void _showStartCourseDialog(BuildContext context, Course course) {
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
                                  _imageUrlCache[course.imageKey]!),
                              fit: BoxFit.cover,
                            ),
                          ),
                        )
                      : FutureBuilder<String>(
                          future: StorageService.getImageUrl(course.imageKey!),
                          builder: (context, snapshot) {
                            if (snapshot.connectionState ==
                                ConnectionState.waiting) {
                              return Container(
                                width: 70,
                                height: 70,
                                decoration: BoxDecoration(
                                  color: Colors.grey[200],
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child:
                                    const Icon(Icons.image, color: Colors.grey),
                              );
                            }
                            if (snapshot.hasError || !snapshot.hasData) {
                              return Container(
                                width: 70,
                                height: 70,
                                decoration: BoxDecoration(
                                  color: Colors.grey[200],
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: const Icon(Icons.image_not_supported,
                                    color: Colors.grey),
                              );
                            }
                            // Cache the URL
                            if (snapshot.hasData) {
                              WidgetsBinding.instance.addPostFrameCallback((_) {
                                if (mounted &&
                                    !_imageUrlCache
                                        .containsKey(course.imageKey)) {
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
                        color: Colors.grey[200],
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.image_not_supported,
                          color: Colors.grey),
                    ),
              const SizedBox(height: 10),
              // Title
              Text(
                course.title,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 10),
              // Message
              const Text(
                'Ready to start your training?',
                style: TextStyle(
                  fontSize: 16,
                  color: Colors.grey,
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 14),
              // Primary Button - Start Training
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.pop(context);
                    _startVideo(context, course);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2C6EF2),
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
              /*
              const SizedBox(height: 12),
              // Secondary Button - Skip to Quiz
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () {
                    Navigator.pop(context);
                    _startQuiz(context, course);
                  },
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFF2C6EF2)),
                    foregroundColor: const Color(0xFF2C6EF2),
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
             */
              const SizedBox(height: 8),
              // Close Button
              TextButton(
                onPressed: () => Navigator.pop(context),
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

  void _showCompletedCourseDialog(BuildContext context, Course course) {
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
                  color: Colors.black87,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              // Message
              const Text(
                'You have already completed this course!',
                style: TextStyle(
                  fontSize: 16,
                  color: Colors.grey,
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              // Primary Button - Review Training
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.pop(context);
                    _reviewVideo(context, course);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2C6EF2),
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
              const SizedBox(height: 12),
              // Secondary Button - Review Quiz
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () {
                    Navigator.pop(context);
                    _reviewQuiz(context, course);
                  },
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFF2C6EF2)),
                    foregroundColor: const Color(0xFF2C6EF2),
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
                onPressed: () => Navigator.pop(context),
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
    // Check if video is already completed
    // Use assignmentId for progress tracking (each assignment has its own progress)
    final progressKey = course.assignmentId ?? course.id;
    final isVideoCompleted =
        await VideoProgressService.isVideoCompleted(progressKey);

    if (isVideoCompleted) {
      // If video is completed, go directly to quiz
      _startQuiz(context, course);
      return;
    }

    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => VideoPlayerScreen(
          course: course,
          onVideoComplete: () {
            Navigator.pop(context);
            Future.delayed(const Duration(milliseconds: 500), () {
              _startQuiz(context, course);
            });
          },
          onClose: () {
            Navigator.pop(context);
          },
        ),
      ),
    );

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
      // Also refresh course list to update UI
      context.read<CourseBloc>().add(const RefreshCourses());
    }
  }

  /// Review video only (for completed courses) - does not auto-navigate to quiz
  void _reviewVideo(BuildContext context, Course course) async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => VideoPlayerScreen(
          course: course,
          onVideoComplete: () {
            // For review mode, just close the video player - don't navigate to quiz
            Navigator.pop(context);
          },
          onClose: () {
            Navigator.pop(context);
          },
        ),
      ),
    );

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
      // Also refresh course list to update UI
      context.read<CourseBloc>().add(const RefreshCourses());
    }
  }

  /// Review quiz only (for completed courses) - opens quiz directly without video
  void _reviewQuiz(BuildContext context, Course course) {
    if (course.assignmentId == null) return;

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => BlocProvider(
          create: (context) => QuizBloc()
            ..add(LoadQuizQuestions(
              course.id, // For fetching questions
              progressKey: course.assignmentId ??
                  course.id, // For saving/loading progress
            )),
          child: QuizScreen(
            course: course,
            assignmentId: course.assignmentId!,
            onQuizComplete: (score, passed) {
              Navigator.pop(context);
              // For review mode, just show the result - don't update assignment status
              _showQuizResult(context, score, passed);
            },
            onClose: () {
              Navigator.pop(context);
              // Refresh progress when returning from quiz (even if not completed)
              // This updates the progress bar if user answered some questions
              _updateCourseProgress(course);
              if (mounted) {
                context.read<CourseBloc>().add(const RefreshCourses());
              }
            },
          ),
        ),
      ),
    );
  }

  void _startQuiz(BuildContext context, Course course) {
    if (course.assignmentId == null) return;

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => BlocProvider(
          create: (context) => QuizBloc()
            ..add(LoadQuizQuestions(
              course.id, // For fetching questions
              progressKey: course.assignmentId ??
                  course.id, // For saving/loading progress
            )),
          child: QuizScreen(
            course: course,
            assignmentId: course.assignmentId!,
            onQuizComplete: (score, passed) {
              Navigator.pop(context);
              // If quiz was passed, immediately update progress to 100%
              // This ensures UI shows correct progress even before course list refreshes
              if (passed && course.assignmentId != null) {
                final cacheKey = course.assignmentId ?? course.id;
                _courseProgress[cacheKey] = 1.0; // Set to 100%
                if (mounted) {
                  setState(() {});
                }
              }
              // Don't refresh here - let the OK button in dialog handle the refresh
              // This ensures we wait long enough for backend to process the update
              _showQuizResult(context, score, passed);
            },
            onClose: () {
              Navigator.pop(context);
              // Refresh progress when returning from quiz (even if not completed)
              // This updates the progress bar if user answered some questions
              _updateCourseProgress(course);
              if (mounted) {
                context.read<CourseBloc>().add(const RefreshCourses());
              }
            },
          ),
        ),
      ),
    );
  }

  void _showQuizResult(BuildContext context, int score, bool passed) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Quiz Complete!'),
        content: Text(
          'You scored $score%${passed ? ' and passed!' : '. You can retake the quiz anytime.'}',
        ),
        actions: [
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              // Wait longer to ensure backend has fully processed the assignment update
              // This ensures the assignmentStatus is updated to 'completed' before we refresh
              await Future.delayed(const Duration(milliseconds: 2000));
              if (context.mounted) {
                // Refresh course list to fetch updated assignmentStatus and update UI
                context.read<CourseBloc>().add(const RefreshCourses());
              }
            },
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  Map<String, List<Course>> _categorizeCourses(List<Course> courses) {
    final Map<String, List<Course>> categorized = {
      'in_progress': [],
      'start_training': [],
      'completed': [],
    };

    for (final course in courses) {
      final bool isCompleted = course.assignmentStatus == 'completed';
      // Use assignmentId for cache keys
      final cacheKey = course.assignmentId ?? course.id;
      final bool videoCompleted = _videoCompleted[cacheKey] ?? false;
      final double progress = _courseProgress[cacheKey] ?? 0.0;

      if (isCompleted) {
        categorized['completed']!.add(course);
      } else if (progress > 0 || videoCompleted) {
        categorized['in_progress']!.add(course);
      } else {
        categorized['start_training']!.add(course);
      }
    }

    return categorized;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFF6F7FB),
      child: SafeArea(
        top: true,
        bottom: false,
        child: BlocConsumer<CourseBloc, CourseState>(
          listener: (context, state) {
            if (state is CourseLoaded) {
              _refreshCourseProgress(state.courses);
            }
          },
          builder: (context, state) {
            if (state is CourseError) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(20.0),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        'An Error Occurred:',
                        style: TextStyle(
                          color: Colors.red[700],
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        state.message,
                        style: TextStyle(
                          color: Colors.red[600],
                          fontSize: 12,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 20),
                      ElevatedButton(
                        onPressed: () {
                          context.read<CourseBloc>().add(const LoadCourses());
                        },
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              );
            }
            if (state is CourseLoading) {
              return const LoadingWidget(
                message: 'Loading your courses...',
              );
            }
            if (state is CourseLoaded) {
              final courses = state.courses;
              final filteredCourses = _filterCourses(courses);
              final categorizedCourses = _categorizeCourses(filteredCourses);

              // Show loader while images are being preloaded
              if (_isLoadingImages) {
                return const LoadingWidget(
                  message: 'Loading course images...',
                );
              }

              return Column(
                children: [
                  // Fixed header at top
                  Container(
                    padding: const EdgeInsets.fromLTRB(20, 24, 20, 16),
                    color: const Color(0xFFF6F7FB),
                    child: _buildHeader(context),
                  ),
                  // Scrollable course list below header
                  Expanded(
                    child: RefreshIndicator(
                      color: const Color(0xFF2C6EF2),
                      onRefresh: () async {
                        context.read<CourseBloc>().add(const RefreshCourses());
                        await Future.delayed(const Duration(milliseconds: 500));
                      },
                      child: filteredCourses.isEmpty
                          ? _buildEmptyState(context, courses.length)
                          : SingleChildScrollView(
                              physics: const AlwaysScrollableScrollPhysics(),
                              padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
                              child: Column(
                                children: [
                                  // In Progress Section
                                  if (categorizedCourses['in_progress']!
                                      .isNotEmpty) ...[
                                    const SizedBox(height: 12),
                                    ...categorizedCourses['in_progress']!
                                        .map((course) => Padding(
                                              padding: const EdgeInsets.only(
                                                  top: 16),
                                              child: _buildCourseCard(
                                                  context, course),
                                            ))
                                        .toList(),
                                  ],
                                  // Start Training Section
                                  if (categorizedCourses['start_training']!
                                      .isNotEmpty) ...[
                                    const SizedBox(height: 24),
                                    ...categorizedCourses['start_training']!
                                        .map((course) => Padding(
                                              padding: const EdgeInsets.only(
                                                  top: 16),
                                              child: _buildCourseCard(
                                                  context, course),
                                            ))
                                        .toList(),
                                  ],
                                  // Completed Section
                                  if (categorizedCourses['completed']!
                                      .isNotEmpty) ...[
                                    const SizedBox(height: 24),
                                    ...categorizedCourses['completed']!
                                        .map((course) => Padding(
                                              padding: const EdgeInsets.only(
                                                  top: 16),
                                              child: _buildCourseCard(
                                                  context, course),
                                            ))
                                        .toList(),
                                  ],
                                ],
                              ),
                            ),
                    ),
                  ),
                ],
              );
            }
            return const Center(
              child: CircularProgressIndicator(),
            );
          },
        ),
      ),
    );
  }

  @override
  Widget build1(BuildContext context) {
    return Container(
      color: const Color(0xFFF6F7FB),
      child: SafeArea(
        top: true,
        bottom:
            false, // Bottom is handled by parent Scaffold's bottomNavigationBar
        child: BlocConsumer<CourseBloc, CourseState>(
          listener: (context, state) {
            // When courses are loaded/refreshed, update progress for all courses
            if (state is CourseLoaded) {
              // Refresh progress to reflect updated assignmentStatus
              _refreshCourseProgress(state.courses);
            }
          },
          builder: (context, state) {
            if (state is CourseError) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(20.0),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        'An Error Occurred:',
                        style: TextStyle(
                          color: Colors.red[700],
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        state.message,
                        style: TextStyle(
                          color: Colors.red[600],
                          fontSize: 12,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 20),
                      ElevatedButton(
                        onPressed: () {
                          context.read<CourseBloc>().add(const LoadCourses());
                        },
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              );
            }

            if (state is CourseLoading) {
              return const LoadingWidget(
                message: 'Loading your courses...',
              );
            }

            if (state is CourseLoaded) {
              final courses = state.courses;
              final filteredCourses = _filterCourses(courses);

              // Show loader while images are being preloaded
              if (_isLoadingImages) {
                return const LoadingWidget(
                  message: 'Loading course images...',
                );
              }

              return Column(
                children: [
                  // Fixed header at top
                  Container(
                    padding: const EdgeInsets.fromLTRB(20, 24, 20, 16),
                    color: const Color(0xFFF6F7FB),
                    child: _buildHeader(context),
                  ),
                  // Scrollable course list below header
                  Expanded(
                    child: RefreshIndicator(
                      color: const Color(0xFF2C6EF2),
                      onRefresh: () async {
                        safePrint(
                            '[COURSE_API] [UI] ========================================');
                        safePrint(
                            '[COURSE_API] [UI] 🔄 User triggered pull-to-refresh');
                        safePrint(
                            '[COURSE_API] [UI] Adding RefreshCourses event to bloc...');
                        safePrint(
                            '[COURSE_API] [UI] This will trigger API call to refresh course list');
                        safePrint(
                            '[COURSE_API] [UI] ========================================');
                        context.read<CourseBloc>().add(const RefreshCourses());
                        await Future.delayed(const Duration(milliseconds: 500));
                      },
                      child: filteredCourses.isEmpty && _searchQuery.isNotEmpty
                          ? _buildNoSearchResults(context)
                          : filteredCourses.isEmpty
                              ? _buildEmptyState(context, courses.length)
                              : ListView.builder(
                                  physics:
                                      const AlwaysScrollableScrollPhysics(),
                                  padding:
                                      const EdgeInsets.fromLTRB(20, 0, 20, 32),
                                  itemCount: filteredCourses.length,
                                  itemBuilder: (context, index) {
                                    final course = filteredCourses[index];
                                    return Padding(
                                      padding: const EdgeInsets.only(top: 16),
                                      child: _buildCourseCard(context, course),
                                    );
                                  },
                                ),
                    ),
                  ),
                ],
              );
            }

            return const Center(
              child: CircularProgressIndicator(),
            );
          },
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const SizedBox(width: 24),
            const Text(
              'Courses',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w700,
              ),
            ),
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 10,
                    offset: const Offset(0, 5),
                  ),
                ],
              ),
              child: IconButton(
                icon: Icon(_isSearchActive ? Icons.close : Icons.search),
                onPressed: _toggleSearch,
                color: Colors.black87,
              ),
            )
          ],
        ),
        if (_isSearchActive) ...[
          const SizedBox(height: 16),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 10,
                  offset: const Offset(0, 5),
                ),
              ],
            ),
            child: TextField(
              controller: _searchController,
              onChanged: _onSearchChanged,
              autofocus: true,
              decoration: InputDecoration(
                hintText: 'Search courses...',
                prefixIcon: const Icon(Icons.search, color: Color(0xFF2C6EF2)),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 20),
                        onPressed: () {
                          _searchController.clear();
                          _onSearchChanged('');
                        },
                        color: Colors.grey,
                      )
                    : null,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide.none,
                ),
                filled: true,
                fillColor: Colors.white,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
              ),
              style: const TextStyle(
                fontSize: 16,
                color: Colors.black87,
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildNoSearchResults(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
      children: [
        const SizedBox(height: 32),
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.search_off,
                size: 64,
                color: Colors.grey[400],
              ),
              const SizedBox(height: 16),
              Text(
                'No courses found',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.grey[700],
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Try searching with different keywords',
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey[500],
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyState(BuildContext context, int count) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
      children: [
        const SizedBox(height: 32),
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                'No training assigned',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.grey[700],
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Check back later for new courses',
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey[500],
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2C6EF2),
                  foregroundColor: Colors.white,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                onPressed: () {
                  safePrint(
                      '[COURSE_API] [UI] 🔄 User clicked Refresh button (empty state)');
                  safePrint('[COURSE_API] [UI] Current courses count: $count');
                  context.read<CourseBloc>().add(const RefreshCourses());
                },
                child: const Text('Refresh'),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildCourseCard(BuildContext context, Course course) {
    // Check video completion status
    // Use assignmentId for cache keys
    final cacheKey = course.assignmentId ?? course.id;
    final bool videoCompleted = _videoCompleted[cacheKey] ?? false;
    final bool isCompleted =
        course.assignmentStatus == 'completed'; // Both video AND quiz completed

    // Calculate progress using the same method as profile screen
    // Use FutureBuilder to ensure progress is calculated fresh each time, matching profile screen
    // This ensures both screens show the same progress values

    return Container(
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
                    Text(
                      course.title,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _buildDescription(course),
                      style: const TextStyle(
                        fontSize: 14,
                        height: 1.4,
                        color: Color(0xFF7A8092),
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
                    padding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: isCompleted
                          ? Colors.grey[200]
                          : Color(0xFFE8F0FF), //Color(0xFFE8F0FF)
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: Text(
                      tag,
                      style: TextStyle(
                        color: isCompleted
                            ? Colors.grey[600]
                            : Color(0xFF2C6EF2), //Color(0xFF2C6EF2)
                        fontWeight: FontWeight.w600,
                        fontSize: 12,
                      ),
                    ),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 10),

          // Show "Completed" text only when BOTH video AND quiz are completed
          if (isCompleted)
            Row(
              children: [
                const Icon(Icons.check_circle, color: Colors.green),
                const SizedBox(width: 8),
                const Text(
                  'Completed',
                  style: TextStyle(
                    fontSize: 15,
                    color: Colors.green,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            )
          // Show progress bar - use FutureBuilder to calculate progress fresh (same as profile screen)
          else if (!isCompleted)
            FutureBuilder<double>(
              key: ValueKey(
                  'progress_${course.assignmentId ?? course.id}_${course.assignmentStatus}_$_progressRebuildCounter'),
              future: _calculateCombinedProgress(course),
              builder: (context, snapshot) {
                // Use calculated progress (0-100%) divided by 100 for display (0.0-1.0)
                final calculatedProgress = (snapshot.data ?? 0.0) / 100.0;
                // Only show progress bar if progress > 0
                if (calculatedProgress <= 0.0) {
                  return const SizedBox.shrink();
                }
                return InkWell(
                  onTap: () {
                    // Clicking progress bar resumes video
                    if (videoCompleted) {
                      // If video completed, start quiz
                      _startQuiz(context, course);
                    } else {
                      // Otherwise, resume video
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
                            'In Progress',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Text(
                            '${(calculatedProgress * 100).round()}% ',
                            style: const TextStyle(
                              //   fontSize: 15,
                              color: Colors.black54,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: LinearProgressIndicator(
                          value: calculatedProgress,
                          minHeight: 8,
                          backgroundColor: Colors.black12,
                          valueColor: const AlwaysStoppedAnimation<Color>(
                            Color(0xFF2C6EF2),
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            )
          else
            const SizedBox.shrink(),
          const SizedBox(height: 10),
          // Show "Start Course" button only if course hasn't started (not completed and video not started)
          if (!isCompleted && !videoCompleted)
            FutureBuilder<double>(
              key: ValueKey(
                  'start_button_${course.assignmentId ?? course.id}_$_progressRebuildCounter'),
              future: _calculateCombinedProgress(course),
              builder: (context, snapshot) {
                final calculatedProgress = snapshot.data ?? 0.0;
                // Only show button if progress is 0 (course not started)
                if (calculatedProgress > 0.0) {
                  return const SizedBox.shrink();
                }
                return SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => _viewCourseDetails(context, course),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2C6EF2),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'Start Course',
                          style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.5),
                        ),
                        SizedBox(width: 8),
                        Icon(
                          Icons.arrow_forward_sharp,
                          size: 25,
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          if (isCompleted)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: () => _viewCourseDetails(context, course),
                icon: Icon(Icons.refresh, color: Colors.green[700]),
                label: Text(
                  'Review Course',
                  style: TextStyle(
                    color: Colors.green[700],
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
        ],
      ),
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
                child:
                    const Icon(Icons.image_not_supported, color: Colors.grey),
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

  Widget _buildSectionHeader(String title) {
    return Row(
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Colors.black87,
          ),
        ),
        const Expanded(child: Divider()),
      ],
    );
  }
}

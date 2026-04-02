import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:amplify_flutter/amplify_flutter.dart';
import '../../data/models/course_model.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/services/storage_service.dart';
import '../../services/video_progress_service.dart';
import '../../services/pdf_progress_service.dart';
import '../../services/quiz_service.dart';
import '../../../../core/services/activity_logger.dart';
import '../widgets/pdf_viewer_helper.dart';
import '../../services/lesson_completion_service.dart';

class CourseDetailsScreen extends StatefulWidget {
  final Course course;

  const CourseDetailsScreen({
    super.key,
    required this.course,
  });

  @override
  State<CourseDetailsScreen> createState() => _CourseDetailsScreenState();
}

class _CourseDetailsScreenState extends State<CourseDetailsScreen> {
  String? _imageUrl;
  bool _isLoadingImage = true;
  int _progressRebuildCounter = 0;
  final Map<String, bool> _videoCompleted = {};

  @override
  void initState() {
    super.initState();
    _loadImage();
    _loadVideoProgress();
  }

  Future<void> _loadImage() async {
    if (widget.course.imageKey != null) {
      try {
        final url = await StorageService.getImageUrl(widget.course.imageKey!);
        if (mounted) {
          setState(() {
            _imageUrl = url;
            _isLoadingImage = false;
          });
        }
      } catch (e) {
        safePrint('[CourseDetails] Error loading image: $e');
        if (mounted) {
          setState(() {
            _isLoadingImage = false;
          });
        }
      }
    } else {
      setState(() {
        _isLoadingImage = false;
      });
    }
  }

  Future<void> _loadVideoProgress() async {
    final progressKey = widget.course.assignmentId ?? widget.course.id;
    final isCompleted =
        await VideoProgressService.isVideoCompleted(progressKey);
    if (mounted) {
      setState(() {
        _videoCompleted[progressKey] = isCompleted;
      });
    }
  }

  Future<bool> _hasQuiz(Course course) async {
    try {
      final questions = await QuizService.getQuizQuestions(course.id);
      return questions.isNotEmpty;
    } catch (e) {
      safePrint('[CourseDetails] Error checking quiz: $e');
      return false;
    }
  }

  Future<double> _calculateProgress(Course course) async {
    final progressKey = course.assignmentId ?? course.id;
    double progress = 0.0;

    // Video progress (50% weight)
    if (course.hasVideo) {
      final isVideoCompleted =
          await VideoProgressService.isVideoCompleted(progressKey);
      if (isVideoCompleted) {
        progress += 50.0;
      }
    }

    // PDF progress (25% weight if no video, 0% if video exists)
    if (course.hasPdf) {
      final hasViewedPdf = await PdfProgressService.hasViewedPdf(progressKey);
      if (hasViewedPdf) {
        if (!course.hasVideo) {
          progress += 25.0;
        }
      }
    }

    // Quiz progress (50% weight if no video, 25% if video exists)
    final hasQuiz = await _hasQuiz(course);
    if (hasQuiz) {
      // Check if quiz is completed
      if (course.assignmentId != null) {
        final hasQuizResult =
            await QuizService.hasQuizResult(course.assignmentId!);
        if (hasQuizResult) {
          if (course.hasVideo) {
            progress += 50.0;
          } else {
            progress += 75.0;
          }
        }
      }
    }

    return progress.clamp(0.0, 100.0);
  }

  void _startVideo(BuildContext context, Course course) async {
    final progressKey = course.assignmentId ?? course.id;
    final isVideoCompleted =
        await VideoProgressService.isVideoCompleted(progressKey);

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

    // Refresh progress after returning from video
    await _refreshProgress();
  }

  void _openPdfViewer(BuildContext context, Course course) async {
    if (course.pdfKey == null) {
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

    await context.push(
      '/pdf-viewer',
      extra: {
        'course': course,
        'onPdfViewedAndReadyForQuiz': (Course viewedCourse) async {
          await _refreshProgress();
          if (mounted) {
            setState(() {});
          }
        },
      },
    );

    // Refresh progress after returning
    await _refreshProgress();
  }

  void _startQuiz(BuildContext context, Course course) async {
    if (course.assignmentId == null) return;

    final lessonsOk = await LessonCompletionService.areAllLessonsCompleted(
      course,
    );
    if (!lessonsOk) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text(
              'Complete all lessons before starting the quiz.',
            ),
            behavior: SnackBarBehavior.floating,
            margin: const EdgeInsets.all(16),
          ),
        );
      }
      return;
    }

    // Check if PDF must be viewed before quiz
    final mustViewPdf = await PdfViewerHelper.mustViewPdfBeforeQuiz(course);

    if (mustViewPdf) {
      if (mounted) {
        _showPdfRequiredDialog(context, course);
      }
      return;
    }

    // Log quiz start
    ActivityLogger.logQuizStart(
      courseId: course.id,
      courseTitle: course.title,
      assignmentId: course.assignmentId!,
    );

    await context.push(
      '/quiz',
      extra: {
        'course': course,
        'assignmentId': course.assignmentId!,
        'source': 'course_details',
      },
    );

    // Refresh progress after returning
    await _refreshProgress();
  }

  Future<void> _refreshProgress() async {
    final progressKey = widget.course.assignmentId ?? widget.course.id;
    final isCompleted =
        await VideoProgressService.isVideoCompleted(progressKey);
    if (mounted) {
      setState(() {
        _videoCompleted[progressKey] = isCompleted;
        _progressRebuildCounter++;
      });
    }
  }

  void _showPdfRequiredDialog(BuildContext context, Course course) {
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

  @override
  Widget build(BuildContext context) {
    final course = widget.course;
    final progressKey = course.assignmentId ?? course.id;
    final isCourseCompleted = course.assignmentStatus == 'completed';

    return SafeArea(
      child: Scaffold(
        backgroundColor: AppColors.lightGrayBackground,
        body: SafeArea(
          child: CustomScrollView(
            slivers: [
              // App Bar with Course Image
              SliverAppBar(
                expandedHeight: 280,
                pinned: true,
                backgroundColor: Colors.white,
                elevation: 0,
                leading: Container(
                  margin: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.1),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: IconButton(
                    icon: const Icon(Icons.arrow_back,
                        color: AppColors.textBlack87),
                    onPressed: () => context.pop(),
                  ),
                ),
                flexibleSpace: FlexibleSpaceBar(
                  background: _isLoadingImage
                      ? Container(
                          color: AppColors.grey(200),
                          child: const Center(
                            child: CircularProgressIndicator(),
                          ),
                        )
                      : _imageUrl != null
                          ? Stack(
                              fit: StackFit.expand,
                              children: [
                                Image.network(
                                  _imageUrl!,
                                  fit: BoxFit.cover,
                                  errorBuilder: (context, error, stackTrace) {
                                    return Container(
                                      color: AppColors.grey(200),
                                      child: const Center(
                                        child: Icon(
                                          Icons.image_not_supported,
                                          size: 64,
                                          color: Colors.grey,
                                        ),
                                      ),
                                    );
                                  },
                                ),
                                // Gradient overlay for better text readability
                                Container(
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      begin: Alignment.topCenter,
                                      end: Alignment.bottomCenter,
                                      colors: [
                                        Colors.transparent,
                                        Colors.black.withOpacity(0.3),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            )
                          : Container(
                              color: AppColors.grey(200),
                              child: const Center(
                                child: Icon(
                                  Icons.image_not_supported,
                                  size: 64,
                                  color: Colors.grey,
                                ),
                              ),
                            ),
                ),
              ),

              // Course Content
              SliverToBoxAdapter(
                child: Container(
                  decoration: const BoxDecoration(
                    color: AppColors.lightGrayBackground,
                    borderRadius: BorderRadius.only(
                      topLeft: Radius.circular(28),
                      topRight: Radius.circular(28),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Course Title and Description Card
                      Container(
                        width: double.infinity,
                        margin: const EdgeInsets.symmetric(
                            horizontal: 20, vertical: 20),
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.05),
                              blurRadius: 20,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // Title
                            Text(
                              course.title,
                              style: const TextStyle(
                                fontSize: 26,
                                fontWeight: FontWeight.bold,
                                color: AppColors.textBlack87,
                                height: 1.2,
                              ),
                              maxLines: 3,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 12),

                            // Description
                            if (course.description != null &&
                                course.description!.isNotEmpty) ...[
                              Text(
                                course.description!,
                                style: const TextStyle(
                                  fontSize: 16,
                                  height: 1.6,
                                  color: AppColors.textSecondary,
                                ),
                                maxLines: 4,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],

                            // Progress Section
                            /*
                            FutureBuilder<double>(
                              key: ValueKey(
                                  'progress_${course.id}_$_progressRebuildCounter'),
                              future: _calculateProgress(course),
                              builder: (context, snapshot) {
                                final progress = snapshot.data ?? 0.0;
                                return Container(
                                  padding: const EdgeInsets.all(20),
                                  decoration: BoxDecoration(
                                    color: AppColors.lightBlueBackground,
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.spaceBetween,
                                        children: [
                                          const Row(
                                            children: [
                                              Icon(
                                                Icons.track_changes,
                                                size: 20,
                                                color: AppColors.primaryBlue,
                                              ),
                                              SizedBox(width: 8),
                                              Text(
                                                'Course Progress',
                                                style: TextStyle(
                                                  fontSize: 16,
                                                  fontWeight: FontWeight.w700,
                                                  color: AppColors.textBlack87,
                                                ),
                                              ),
                                            ],
                                          ),
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                                horizontal: 12, vertical: 6),
                                            decoration: BoxDecoration(
                                              color: AppColors.primaryBlue,
                                              borderRadius:
                                                  BorderRadius.circular(20),
                                            ),
                                            child: Text(
                                              '${progress.round()}%',
                                              style: const TextStyle(
                                                fontSize: 16,
                                                fontWeight: FontWeight.w700,
                                                color: Colors.white,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 16),
                                      ClipRRect(
                                        borderRadius: BorderRadius.circular(12),
                                        child: LinearProgressIndicator(
                                          value: (progress / 100.0).clamp(0.0, 1.0),
                                          minHeight: 12,
                                          backgroundColor: Colors.white,
                                          valueColor:
                                              const AlwaysStoppedAnimation<Color>(
                                            AppColors.primaryBlue,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              },
                            ),
                            */
                          ],
                        ),
                      ),

                      // Lessons Section
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Row(
                              children: [
                                Icon(
                                  Icons.menu_book_rounded,
                                  size: 24,
                                  color: AppColors.primaryBlue,
                                ),
                                SizedBox(width: 12),
                                Text(
                                  'Lessons',
                                  style: TextStyle(
                                    fontSize: 22,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.textBlack87,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 20),
                            FutureBuilder<Set<String>>(
                              key: ValueKey(
                                'course_details_lessons_${course.assignmentId ?? course.id}_$_progressRebuildCounter',
                              ),
                              future: LessonCompletionService.getCompletedLessonIds(
                                progressKey,
                              ),
                              builder: (context, lessonSnapshot) {
                                final doneIds = lessonSnapshot.data ?? <String>{};
                                final sortedLessons = [...course.lessons]
                                  ..sort((a, b) => a.order.compareTo(b.order));
                                final allLessonsCompleted = sortedLessons.isNotEmpty &&
                                    sortedLessons.every(
                                      (lesson) => doneIds.contains(lesson.id),
                                    );

                                return Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.all(16),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(20),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withOpacity(0.05),
                                        blurRadius: 20,
                                        offset: const Offset(0, 4),
                                      ),
                                    ],
                                  ),
                                  child: Column(
                                    children: [
                                      for (var i = 0; i < sortedLessons.length; i++) ...[
                                        _buildLessonItem(
                                          context: context,
                                          title: sortedLessons[i].title,
                                          index: i + 1,
                                          isCompleted: doneIds.contains(sortedLessons[i].id),
                                          onTap: () async {
                                            await context.push(
                                              '/lesson-details',
                                              extra: {
                                                'lesson': sortedLessons[i],
                                                'course': course,
                                              },
                                            );
                                            await _refreshProgress();
                                          },
                                        ),
                                        if (i < sortedLessons.length - 1)
                                          Divider(
                                            height: 20,
                                            color: AppColors.borderLightGray,
                                          ),
                                      ],
                                      if (sortedLessons.isNotEmpty)
                                        Divider(
                                          height: 20,
                                          color: AppColors.borderLightGray,
                                        ),
                                      FutureBuilder<bool>(
                                        future: _hasQuiz(course),
                                        builder: (context, quizSnapshot) {
                                          if (!(quizSnapshot.data ?? false)) {
                                            return const SizedBox.shrink();
                                          }
                                          return _buildLessonItem(
                                            context: context,
                                            title: 'Quiz Assessment',
                                            index: sortedLessons.length + 1,
                                            isCompleted: isCourseCompleted,
                                            isDisabled: !allLessonsCompleted,
                                            subtitle: allLessonsCompleted
                                                ? 'Test your knowledge'
                                                : 'Complete all lessons to unlock',
                                            icon: Icons.quiz,
                                            onTap: () => _startQuiz(context, course),
                                          );
                                        },
                                      ),
                                    ],
                                  ),
                                );
                              },
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 24),

                      // Course Information Section
                      if (course.duration != null ||
                          course.category != null) ...[
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Row(
                                children: [
                                  Icon(
                                    Icons.info_outline,
                                    size: 24,
                                    color: AppColors.primaryBlue,
                                  ),
                                  SizedBox(width: 12),
                                  Text(
                                    'Course Information',
                                    style: TextStyle(
                                      fontSize: 22,
                                      fontWeight: FontWeight.bold,
                                      color: AppColors.textBlack87,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 20),
                            ],
                          ),
                        ),
                        Container(
                          width: double.infinity,
                          margin: const EdgeInsets.symmetric(horizontal: 20),
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(20),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.05),
                                blurRadius: 20,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (course.duration != null)
                                _buildInfoRow(Icons.access_time, 'Duration',
                                    course.duration!),
                              if (course.duration != null &&
                                  course.category != null)
                                const Divider(height: 32),
                              if (course.category != null)
                                _buildInfoRow(Icons.category, 'Category',
                                    course.category!),
                            ],
                          ),
                        ),
                        const SizedBox(height: 32),
                      ],

                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLessonItem({
    required BuildContext context,
    required String title,
    required int index,
    required VoidCallback onTap,
    bool isCompleted = false,
    bool isDisabled = false,
    String? subtitle,
    IconData? icon,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: isDisabled ? null : onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: isCompleted
                      ? AppColors.completedGreen.withOpacity(0.12)
                      : AppColors.lightBlueBackground,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: isCompleted
                        ? AppColors.completedGreen.withOpacity(0.35)
                        : AppColors.borderLightGray,
                  ),
                ),
                child: Center(
                  child: isCompleted
                      ? const Icon(
                          Icons.check,
                          size: 18,
                          color: AppColors.completedGreen,
                        )
                      : icon != null
                          ? Icon(
                              icon,
                              size: 18,
                              color: isDisabled
                                  ? AppColors.grey(400)
                                  : AppColors.primaryBlue,
                            )
                          : Text(
                              '$index',
                              style: TextStyle(
                                fontWeight: FontWeight.w700,
                                color: isDisabled
                                    ? AppColors.grey(400)
                                    : AppColors.primaryBlue,
                              ),
                            ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: isDisabled
                            ? AppColors.grey(400)
                            : AppColors.textBlack87,
                      ),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: TextStyle(
                          fontSize: 13,
                          color: isDisabled
                              ? AppColors.grey(400)
                              : AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right_rounded,
                color: isDisabled ? AppColors.grey(350) : AppColors.grey(500),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEnhancedContentCard({
    required BuildContext context,
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    required VoidCallback onTap,
    bool isCompleted = false,
    bool isRequired = false,
    bool isOptional = false,
    bool isDisabled = false,
    bool? pdfViewed,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: isDisabled ? null : onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isDisabled
                  ? AppColors.borderLightGray
                  : isCompleted
                      ? color.withOpacity(0.4)
                      : color.withOpacity(0.2),
              width: isCompleted ? 2.5 : 2,
            ),
            boxShadow: [
              BoxShadow(
                color: isDisabled
                    ? Colors.black.withOpacity(0.03)
                    : color.withOpacity(0.1),
                blurRadius: 15,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            children: [
              // Icon Container
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  gradient: isDisabled
                      ? null
                      : isCompleted
                          ? LinearGradient(
                              colors: [
                                color,
                                color.withOpacity(0.7),
                              ],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            )
                          : null,
                  color: isDisabled
                      ? AppColors.grey(100)
                      : isCompleted
                          ? null
                          : color.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: isCompleted
                      ? [
                          BoxShadow(
                            color: color.withOpacity(0.3),
                            blurRadius: 8,
                            offset: const Offset(0, 4),
                          ),
                        ]
                      : null,
                ),
                child: Icon(
                  icon,
                  color: isDisabled
                      ? AppColors.grey(400)
                      : isCompleted
                          ? Colors.white
                          : color,
                  size: 32,
                ),
              ),
              const SizedBox(width: 20),
              // Content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            title,
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: isDisabled
                                  ? AppColors.grey(400)
                                  : AppColors.textBlack87,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),

                        /*
                        if (isCompleted)
                          Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: color.withOpacity(0.15),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              Icons.check_circle,
                              color: color,
                              size: 20,
                            ),
                          ),
                        */
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            subtitle,
                            style: TextStyle(
                              fontSize: 14,
                              height: 1.4,
                              color: isDisabled
                                  ? AppColors.grey(400)
                                  : AppColors.textSecondary,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        // Show "Required" badge only if PDF is not viewed
                        if (isRequired && (pdfViewed == null || !pdfViewed))
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: Colors.orange[50],
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: Colors.orange[200]!,
                                width: 1,
                              ),
                            ),
                            child: Text(
                              'Required',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: Colors.orange[700],
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                        /*
                        if (isOptional)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: AppColors.lightBlueBackground,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: AppColors.primaryBlue.withOpacity(0.3),
                                width: 1,
                              ),
                            ),
                            child: Text(
                              'Optional',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: AppColors.primaryBlue,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                       */
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              // Arrow Icon
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color:
                      isDisabled ? AppColors.grey(100) : color.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.arrow_forward_ios,
                  color: isDisabled ? AppColors.grey(400) : color,
                  size: 16,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: AppColors.lightBlueBackground,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, size: 22, color: AppColors.primaryBlue),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textBlack87,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

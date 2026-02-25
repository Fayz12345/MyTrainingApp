import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/constants/app_constants.dart';
import '../../data/models/course_model.dart';


class CourseCard extends StatelessWidget {
  final Course course;
  final double progress;
  final bool isCompleted;
  final bool videoCompleted;
  final VoidCallback? onTap;
  final VoidCallback? onStartCourse;
  final VoidCallback? onContinue;
  final VoidCallback? onTakeQuiz;
  final VoidCallback? onReview;

  const CourseCard({
    super.key,
    required this.course,
    required this.progress,
    required this.isCompleted,
    required this.videoCompleted,
    this.onTap,
    this.onStartCourse,
    this.onContinue,
    this.onTakeQuiz,
    this.onReview,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(AppConstants.cardBorderRadius),
        boxShadow: [
          BoxShadow(
            color: AppColors.shadowColor,
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildHeader(),
          const SizedBox(height: 16),
          _buildTags(),
          const SizedBox(height: 16),
          _buildStateSection(context),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
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
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                course.description ?? '',
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
        _buildThumbnail(),
      ],
    );
  }

  Widget _buildThumbnail() {
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: Container(
        width: 80,
        height: 80,
        color: AppColors.lightGrayBackground,
        child: course.imageKey != null
            ? const Icon(Icons.image, color: AppColors.textSecondary)
            : const Icon(Icons.image_not_supported,
                color: AppColors.textSecondary),
      ),
    );
  }

  Widget _buildTags() {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        _buildTag(course.duration ?? 'N/A'),
        if (course.category != null) _buildTag(course.category!),
      ],
    );
  }

  Widget _buildTag(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      decoration: BoxDecoration(
        color:
            isCompleted ? AppColors.grey(200) : AppColors.lightBlueBackground,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: isCompleted ? AppColors.grey(600) : AppColors.primaryBlue,
          fontWeight: FontWeight.w600,
          fontSize: 12,
        ),
      ),
    );
  }

  Widget _buildStateSection(BuildContext context) {
    if (isCompleted) {
      return _buildCompleteState();
    } else if (videoCompleted && !isCompleted) {
      return _buildContinueState(progress);
    } else if (progress > 0.0) {
      return _buildInProgressState(progress);
    } else {
      return _buildStartCourseState();
    }
  }

  Widget _buildStartCourseState() {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: onStartCourse,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.startCourseBackground,
          foregroundColor: AppColors.startCourseForeground,
          elevation: 0,
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius:
                BorderRadius.circular(AppConstants.defaultBorderRadius),
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
  }

  Widget _buildInProgressState(double progress) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: AppColors.lightBlueBackground,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.access_time,
                size: 16,
                color: AppColors.primaryBlue,
              ),
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
        _buildProgressBar(progress, AppColors.primaryBlue),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton(
            onPressed: videoCompleted ? onTakeQuiz : onContinue,
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.primaryBlue,
              side: const BorderSide(color: AppColors.primaryBlue, width: 1.5),
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius:
                    BorderRadius.circular(AppConstants.defaultBorderRadius),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  videoCompleted ? Icons.quiz : Icons.play_circle_outline,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Text(
                  videoCompleted ? 'Take Quiz' : 'Continue',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildContinueState(double progress) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
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
        _buildProgressBar(progress, AppColors.continueOrange),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: onTakeQuiz,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.continueButtonBackground,
              foregroundColor: AppColors.continueButtonForeground,
              elevation: 0,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius:
                    BorderRadius.circular(AppConstants.defaultBorderRadius),
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
        ),
      ],
    );
  }

  Widget _buildCompleteState() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
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
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: onReview,
            icon: const Icon(Icons.refresh, size: 20),
            label: const Text(
              'Review Course',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
              ),
            ),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.completedButtonForeground,
              side:
                  const BorderSide(color: AppColors.completedGreen, width: 1.5),
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius:
                    BorderRadius.circular(AppConstants.defaultBorderRadius),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildProgressBar(double progress, Color color) {
    return Column(
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
                color: AppColors.textPrimary,
              ),
            ),
            Text(
              '${progress.round()}%',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: color,
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
            valueColor: AlwaysStoppedAnimation<Color>(color),
          ),
        ),
      ],
    );
  }
}

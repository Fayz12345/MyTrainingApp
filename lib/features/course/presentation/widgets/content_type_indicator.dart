import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../data/models/course_model.dart';

/// Widget to display content type indicators (Video, PDF, or Both)
/// Provides clear visual feedback about course content types
class ContentTypeIndicator extends StatelessWidget {
  final Course course;
  final bool showLabels;
  final bool isCompleted;

  const ContentTypeIndicator({
    super.key,
    required this.course,
    this.showLabels = true,
    this.isCompleted = false,
  });

  @override
  Widget build(BuildContext context) {
    final hasVideo = course.hasVideo;
    final hasPdf = course.hasPdf;

    if (!hasVideo && !hasPdf) {
      return const SizedBox.shrink();
    }

    return Tooltip(
      message: _getContentTypeTooltip(),
      child: _buildContentTypeBadge(
        hasVideo: hasVideo,
        hasPdf: hasPdf,
      ),
    );
  }

  Widget _buildContentTypeBadge({
    required bool hasVideo,
    required bool hasPdf,
  }) {
    // If both video and PDF exist, show combined badge
    if (hasVideo && hasPdf) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isCompleted ? AppColors.grey(100) : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isCompleted
                ? AppColors.grey(300)!
                : AppColors.primaryBlue.withOpacity(0.3),
            width: 1.5,
          ),
        ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
            Icon(
              Icons.videocam,
              size: 16,
              color: isCompleted ? AppColors.grey(500) : AppColors.primaryBlue,
            ),
            const SizedBox(width: 4),
            Icon(
              Icons.picture_as_pdf,
              size: 16,
              color: isCompleted ? AppColors.grey(500) : Colors.red[600],
            ),
            if (showLabels) ...[
              const SizedBox(width: 6),
              Text(
                'Video & PDF',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: isCompleted
                      ? AppColors.grey(600)
                      : AppColors.primaryBlue,
                ),
              ),
            ],
        ],
      ),
    );
  }

    // If only video exists
    if (hasVideo) {
    return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
          color: isCompleted ? AppColors.grey(100) : Colors.white,
          borderRadius: BorderRadius.circular(20),
        border: Border.all(
            color: isCompleted
                ? AppColors.grey(300)!
                : AppColors.primaryBlue.withOpacity(0.3),
            width: 1.5,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.play_circle_filled,
            size: 16,
              color: isCompleted ? AppColors.grey(500) : AppColors.primaryBlue,
          ),
          if (showLabels) ...[
              const SizedBox(width: 6),
            Text(
              'Video',
              style: TextStyle(
                  fontSize: 12,
                fontWeight: FontWeight.w600,
                  color: isCompleted
                      ? AppColors.grey(600)
                      : AppColors.primaryBlue,
                ),
              ),
          ],
        ],
      ),
    );
  }

    // If only PDF exists
    if (hasPdf) {
    return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
          color: isCompleted ? AppColors.grey(100) : Colors.white,
          borderRadius: BorderRadius.circular(20),
        border: Border.all(
            color: isCompleted
                ? AppColors.grey(300)!
                : Colors.red[600]!.withOpacity(0.3),
            width: 1.5,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.picture_as_pdf,
            size: 16,
              color: isCompleted ? AppColors.grey(500) : Colors.red[600],
          ),
          if (showLabels) ...[
              const SizedBox(width: 6),
            Text(
              'PDF',
              style: TextStyle(
                  fontSize: 12,
                fontWeight: FontWeight.w600,
                  color: isCompleted ? AppColors.grey(600) : Colors.red[600],
                ),
              ),
          ],
        ],
      ),
    );
    }

    return const SizedBox.shrink();
  }

  String _getContentTypeTooltip() {
    if (course.hasBothContent) {
      return 'This course contains both video and PDF content';
    } else if (course.hasVideo) {
      return 'This course contains video content';
    } else if (course.hasPdf) {
      return 'This course contains PDF document';
    }
    return 'Course content';
  }
}

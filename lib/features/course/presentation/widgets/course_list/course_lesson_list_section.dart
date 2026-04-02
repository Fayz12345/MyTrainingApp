import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../../core/theme/app_colors.dart';
import '../../../data/models/course_model.dart';
import '../../../services/lesson_completion_service.dart';

/// Lesson list used on course cards (home list and learning path), above duration/category tags.

class CourseLessonListSection extends StatelessWidget {
  const CourseLessonListSection({
    super.key,
    required this.course,
    required this.progressRebuildKey,
    required this.onAfterLessonReturn,
  });

  final Course course;
  final int progressRebuildKey;


  final void Function(bool pathProgressChanged) onAfterLessonReturn;

  @override
  Widget build(BuildContext context) {
    final sorted = [...course.lessons]
      ..sort((a, b) => a.order.compareTo(b.order));
    final scopeKey = course.assignmentId ?? course.id;
    return FutureBuilder<Set<String>>(
      key: ValueKey('lesson_colors_${scopeKey}_$progressRebuildKey'),
      future: LessonCompletionService.getCompletedLessonIds(scopeKey),
      builder: (context, snapshot) {
        final doneIds = snapshot.data ?? const <String>{};
        final completedCount =
            sorted.where((l) => doneIds.contains(l.id)).length;
        return Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
          decoration: BoxDecoration(
            color: AppColors.lightGrayBackground,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.borderLightGray),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    Icons.menu_book_rounded,
                    size: 20,
                    color: AppColors.primaryBlue,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Lessons',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textBlack87,
                        letterSpacing: 0.2,
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: AppColors.borderLightGray,
                      ),
                    ),
                    child: Text(
                      '$completedCount / ${sorted.length}',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                'Tap a lesson to open',
                style: TextStyle(
                  fontSize: 11,
                  height: 1.3,
                  color: AppColors.textSecondary.withValues(alpha: 0.9),
                ),
              ),
              const SizedBox(height: 8),
              for (var i = 0; i < sorted.length; i++) ...[
                if (i > 0)
                  Divider(
                    height: 1,
                    thickness: 1,
                    color: AppColors.borderLightGray,
                    indent: 48,
                  ),
                Material(
                  color: Colors.transparent,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: () {
                      context.push<bool>(
                        '/lesson-details',
                        extra: {'lesson': sorted[i], 'course': course},
                      ).then((result) {
                        onAfterLessonReturn(result == true);
                      });
                    },
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        mainAxisAlignment: MainAxisAlignment.start,
                        children: [
                          _LessonIndexBadge(
                            index: i + 1,
                            isDone: doneIds.contains(sorted[i].id),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              sorted[i].title,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 14,
                                height: 1.35,
                                fontWeight: doneIds.contains(sorted[i].id)
                                    ? FontWeight.w500
                                    : FontWeight.w600,
                                color: doneIds.contains(sorted[i].id)
                                    ? AppColors.textSecondary
                                    : AppColors.textBlack87,
                              ),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.only(left: 4, top: 2),
                            child: Icon(
                              Icons.chevron_right_rounded,
                              size: 22,
                              color: AppColors.grey(400),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _LessonIndexBadge extends StatelessWidget {
  const _LessonIndexBadge({
    required this.index,
    required this.isDone,
  });

  final int index;
  final bool isDone;

  @override
  Widget build(BuildContext context) {
    const size = 32.0;
    if (isDone) {
      return Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: AppColors.completedBadgeBackground,
          shape: BoxShape.circle,
          border: Border.all(
            color: AppColors.completedGreen.withValues(alpha: 0.35),
          ),
        ),
        child: const Icon(
          Icons.check,
          size: 18,
          color: AppColors.completedGreen,
        ),
      );
    }
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppColors.white,
        shape: BoxShape.circle,
        border: Border.all(
          color: AppColors.primaryBlue,
          width: 1.5,
        ),
      ),
      child: Text(
        '$index',
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w800,
          color: AppColors.primaryBlue,
        ),
      ),
    );
  }
}

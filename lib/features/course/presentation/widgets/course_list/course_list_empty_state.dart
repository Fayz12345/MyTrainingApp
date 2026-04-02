import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:amplify_flutter/amplify_flutter.dart';

import '../../../../../core/theme/app_colors.dart';
import '../../bloc/course_bloc.dart';
import '../../../../learning_path/presentation/bloc/learning_path_bloc.dart';

class CourseListEmptyState extends StatelessWidget {
  const CourseListEmptyState({
    super.key,
    required this.rawCoursesCount,
  });

  final int rawCoursesCount;

  @override
  Widget build(BuildContext context) {
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
                  '[COURSE_API] [UI] Retry (empty state), count: $rawCoursesCount',
                );
                context.read<CourseBloc>().add(const RefreshCourses());
                context.read<LearningPathBloc>().add(
                      const RefreshLearningPaths(),
                    );
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
}

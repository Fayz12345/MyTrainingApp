import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../../core/theme/app_colors.dart';
import '../../bloc/course_bloc.dart';

/// Full-screen error layout for the course list tab (sliver + pull-to-refresh).
class CourseListErrorView extends StatelessWidget {
  const CourseListErrorView({
    super.key,
    required this.message,
    required this.onPullToRefresh,
  });

  final String message;
  final Future<void> Function() onPullToRefresh;

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      physics: const BouncingScrollPhysics(
        parent: AlwaysScrollableScrollPhysics(),
      ),
      slivers: [
        CupertinoSliverRefreshControl(onRefresh: onPullToRefresh),
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
}

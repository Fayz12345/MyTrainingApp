import 'package:flutter/cupertino.dart';

import '../../../../../core/theme/app_colors.dart';
import '../../../../../core/widgets/app_loader.dart';

/// Placeholder scroll while courses / paths first load.
class CourseListShimmer extends StatelessWidget {
  const CourseListShimmer({super.key});

  @override
  Widget build(BuildContext context) {
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
              childCount: 6,
            ),
          ),
        ),
      ],
    );
  }
}

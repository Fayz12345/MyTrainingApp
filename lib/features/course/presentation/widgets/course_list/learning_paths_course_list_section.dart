import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../../core/theme/app_colors.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../core/widgets/app_loader.dart';
import '../../../../learning_path/data/models/learning_path_model.dart';
import '../../../../learning_path/presentation/bloc/learning_path_bloc.dart';

String formatLearningPathDueDate(DateTime date) {
  return '${date.month}/${date.day}/${date.year}';
}

/// Learning paths block for the course list home scroll (reads [LearningPathBloc]).
class LearningPathsCourseListSection extends StatelessWidget {
  const LearningPathsCourseListSection({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<LearningPathBloc, LearningPathState>(
      builder: (context, state) {
        if (state is LearningPathLoading) {
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
          return const SizedBox.shrink();
        }

        if (state is LearningPathLoaded) {
          final allPaths = state.paths;
          if (allPaths.isEmpty) {
            return const SizedBox.shrink();
          }

          final activePaths =
              allPaths.where((path) => !path.isCompleted).toList();
          final completedPaths =
              allPaths.where((path) => path.isCompleted).toList();

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
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
                    child: LearningPathSummaryCard(path: path),
                  );
                }),
              ],
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
                    child: LearningPathSummaryCard(
                      path: path,
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
}

class LearningPathSummaryCard extends StatelessWidget {
  const LearningPathSummaryCard({
    super.key,
    required this.path,
    this.isCompleted = false,
  });

  final LearningPath path;
  final bool isCompleted;

  @override
  Widget build(BuildContext context) {
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
          context.push('/learning-path-progress', extra: path);
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
                        if (path.isCertificationPath ||
                            path.mandatoryForScheduling == true ||
                            path.certificationUiSubtitle != null) ...[
                          SizedBox(height: isSmallScreen ? 8 : 10),
                          Wrap(
                            spacing: 6,
                            runSpacing: 6,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              if (path.isCertificationPath)
                                Container(
                                  padding: EdgeInsets.symmetric(
                                    horizontal: isTablet ? 10 : 8,
                                    vertical: isSmallScreen ? 3 : 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: AppColors.lightOrangeBackground,
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(
                                      color: AppColors.continueOrange
                                          .withValues(alpha: 0.35),
                                    ),
                                  ),
                                  child: Text(
                                    'Certification',
                                    style: TextStyle(
                                      fontSize: isTablet
                                          ? 12
                                          : (isSmallScreen ? 10 : 11),
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.continueOrange,
                                    ),
                                  ),
                                ),
                              if (path.mandatoryForScheduling == true)
                                Container(
                                  padding: EdgeInsets.symmetric(
                                    horizontal: isTablet ? 10 : 8,
                                    vertical: isSmallScreen ? 3 : 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: AppColors.lightBlueBackground,
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(
                                      color: AppColors.primaryBlue
                                          .withValues(alpha: 0.25),
                                    ),
                                  ),
                                  child: Text(
                                    'Scheduling',
                                    style: TextStyle(
                                      fontSize: isTablet
                                          ? 12
                                          : (isSmallScreen ? 10 : 11),
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.primaryBlue,
                                    ),
                                  ),
                                ),
                              if (path.certificationUiSubtitle != null)
                                Text(
                                  path.certificationUiSubtitle!,
                                  style: TextStyle(
                                    fontSize: isTablet
                                        ? 13
                                        : (isSmallScreen ? 11 : 12),
                                    color: path.daysUntilCertificationExpires !=
                                                null &&
                                            path.daysUntilCertificationExpires! <
                                                0
                                        ? AppColors.errorRed
                                        : AppColors.textSecondary,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                            ],
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
                            const Spacer(),
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
                        'Due: ${formatLearningPathDueDate(path.dueDate!)}',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      backgroundColor: Colors.orange[100],
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
}

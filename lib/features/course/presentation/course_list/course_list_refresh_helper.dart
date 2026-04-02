import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../bloc/course_bloc.dart';
import '../../../learning_path/presentation/bloc/learning_path_bloc.dart';

class CourseListRefreshHelper {
  CourseListRefreshHelper._();

  static Future<void> refreshCoursesAndLearningPaths({
    required BuildContext context,
    required bool mounted,
    required void Function() onCachesInvalidated,
  }) async {
    if (!mounted) return;
    final courseBloc = context.read<CourseBloc>();
    final learningPathBloc = context.read<LearningPathBloc>();

    final courseDone = courseBloc.stream.firstWhere(
      (s) => s is CourseLoaded || s is CourseError,
    );
    final pathDone = learningPathBloc.stream.firstWhere(
      (s) => s is LearningPathLoaded || s is LearningPathError,
    );

    courseBloc.add(const RefreshCourses());
    learningPathBloc.add(const RefreshLearningPaths());

    await Future.wait([courseDone, pathDone]);

    if (!mounted) return;
    onCachesInvalidated();
  }
}

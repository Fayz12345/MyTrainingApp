import '../../data/models/course_model.dart';

class CourseListCategoryHelper {
  CourseListCategoryHelper._();

  static const String inProgress = 'in_progress';
  static const String startTraining = 'start_training';
  static const String completed = 'completed';

  static Map<String, List<Course>> categorize({
    required List<Course> courses,
    required Map<String, double> courseProgress,
    required Map<String, bool> videoCompleted,
  }) {
    final categorized = <String, List<Course>>{
      inProgress: [],
      startTraining: [],
      completed: [],
    };

    for (final course in courses) {
      final cacheKey = course.assignmentId ?? course.id;
      final videoDone = videoCompleted[cacheKey] ?? false;
      final progress = courseProgress[cacheKey] ?? 0.0;

      final isDone =
          course.assignmentStatus == 'completed' || progress >= 1.0;

      if (isDone) {
        categorized[completed]!.add(course);
      } else if (progress > 0 || videoDone) {
        categorized[inProgress]!.add(course);
      } else {
        categorized[startTraining]!.add(course);
      }
    }

    categorized[inProgress]!.sort((a, b) {
      final keyA = a.assignmentId ?? a.id;
      final keyB = b.assignmentId ?? b.id;
      final pA = courseProgress[keyA] ?? 0.0;
      final pB = courseProgress[keyB] ?? 0.0;
      final vA = videoCompleted[keyA] ?? false;
      final vB = videoCompleted[keyB] ?? false;
      if (vA != vB) return vB ? 1 : -1;
      return pB.compareTo(pA);
    });

    return categorized;
  }
}

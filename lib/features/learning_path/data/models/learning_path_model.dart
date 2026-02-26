import '../../../course/data/models/course_model.dart';

/// Represents a course within a learning path
class PathCourse {
  final Course course;
  final int order; // Order in the path (for sequential paths)
  final CourseStatus status;

  PathCourse({
    required this.course,
    required this.order,
    required this.status,
  });
}

/// Course status within a learning path
enum CourseStatus {
  completed, // ✓ Completed
  inProgress, // ⏸ In Progress
  locked, // 🔒 Locked (for sequential paths)
  notStarted, // ○ Not Started
}

/// Represents a learning path containing multiple courses
class LearningPath {
  final String id; // Path identifier (usually the tag value)
  final String title;
  final String? description;
  final List<PathCourse> courses;
  final bool isSequential; // true for sequential, false for flexible
  final DateTime? dueDate; // Optional due date for the path
  final int completedCount;
  final int totalCount;
  final double progressPercentage; // 0-100
  final bool isCompleted; // All courses completed
  final int? version; // Learning path version

  LearningPath({
    required this.id,
    required this.title,
    this.description,
    required this.courses,
    required this.isSequential,
    this.dueDate,
    required this.completedCount,
    required this.totalCount,
    required this.progressPercentage,
    required this.isCompleted,
    this.version,
  });

  /// Calculate progress from courses
  static LearningPath calculateProgress({
    required String id,
    required String title,
    String? description,
    required List<Course> courses,
    required bool isSequential,
    DateTime? dueDate,
  }) {
    // Sort courses by createdAt for order (if sequential)
    final sortedCourses = List<Course>.from(courses);
    if (isSequential) {
      sortedCourses.sort((a, b) => a.createdAt.compareTo(b.createdAt));
    }

    final pathCourses = <PathCourse>[];
    int completedCount = 0;
    bool previousCompleted = true; // For sequential paths

    for (int i = 0; i < sortedCourses.length; i++) {
      final course = sortedCourses[i];
      final isCompleted = course.assignmentStatus == 'completed';

      if (isCompleted) {
        completedCount++;
      }

      CourseStatus status;
      if (isCompleted) {
        status = CourseStatus.completed;
        previousCompleted = true;
      } else if (isSequential && !previousCompleted) {
        // In sequential paths, lock courses if previous isn't completed
        status = CourseStatus.locked;
      } else if (course.assignmentStatus == 'assigned') {
        // Check if course has been started (has progress)
        status = CourseStatus.inProgress;
      } else {
        status = CourseStatus.notStarted;
        if (isSequential) {
          previousCompleted = false;
        }
      }

      pathCourses.add(PathCourse(
        course: course,
        order: i + 1,
        status: status,
      ));
    }

    final totalCount = courses.length;
    final progressPercentage =
        totalCount > 0 ? (completedCount / totalCount) * 100 : 0.0;
    final isCompleted = completedCount == totalCount && totalCount > 0;

    return LearningPath(
      id: id,
      title: title,
      description: description,
      courses: pathCourses,
      isSequential: isSequential,
      dueDate: dueDate,
      completedCount: completedCount,
      totalCount: totalCount,
      progressPercentage: progressPercentage,
      isCompleted: isCompleted,
      version: null, // Legacy method doesn't have version
    );
  }
}

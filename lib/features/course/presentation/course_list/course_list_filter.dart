import '../../data/models/course_model.dart';


class CourseListFilter {
  CourseListFilter._();

  static String description(Course course) {
    if (course.description != null && course.description!.trim().isNotEmpty) {
      return course.description!.trim();
    }
    return 'Tap to view course details and start learning.';
  }

  static List<Course> filterByQuery(List<Course> courses, String query) {
    final q = query.toLowerCase().trim();
    if (q.isEmpty) return courses;
    return courses.where((course) {
      final title = course.title.toLowerCase();
      final desc = description(course).toLowerCase();
      return title.contains(q) || desc.contains(q);
    }).toList();
  }
}

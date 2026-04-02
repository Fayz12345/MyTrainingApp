import 'dart:async';
import '../../data/models/course_model.dart';

abstract class CourseRepository {
  /// Get all assigned courses for current user
  Future<List<Course>> getAssignedCourses();

  /// Check if quiz result exists for assignment
  Future<bool> hasQuizResult(String assignmentId);

  /// Check if video is completed
  Future<bool> isVideoCompleted(String progressKey);

  /// Get saved video progress position
  Future<Duration?> getVideoProgress(String progressKey);

  /// Get saved video duration
  Future<Duration?> getVideoDuration(String progressKey);

  /// Get quiz questions for a course
  Future<List<dynamic>> getQuizQuestions(String courseId);

  /// Get quiz progress data
  Future<Map<String, dynamic>?> getQuizProgress(String progressKey);
}

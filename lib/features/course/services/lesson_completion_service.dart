import 'dart:convert';

import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../data/models/course_model.dart';

/// Local completion flags per assignment/course scope (not from API).
///
/// Used when [Course.lessons] is non-empty: quiz is only offered after all
/// lessons are marked complete on the device.
class LessonCompletionService {
  LessonCompletionService._();

  static const String _keyPrefix = 'lesson_done_v1_';

  static String _storageKey(String scopeKey) => '$_keyPrefix$scopeKey';

  /// [scopeKey] should be [Course.assignmentId] ?? [Course.id].
  static Future<Set<String>> getCompletedLessonIds(String scopeKey) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_storageKey(scopeKey));
      if (raw == null || raw.isEmpty) return {};
      final decoded = jsonDecode(raw);
      if (decoded is! List) return {};
      return decoded.map((e) => e.toString()).toSet();
    } catch (e) {
      safePrint('[LESSON_COMPLETION] getCompletedLessonIds: $e');
      return {};
    }
  }

  static Future<void> markLessonCompleted(
    String scopeKey,
    String lessonId,
  ) async {
    try {
      final done = await getCompletedLessonIds(scopeKey);
      done.add(lessonId);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        _storageKey(scopeKey),
        jsonEncode(done.toList()),
      );
      safePrint(
        '[LESSON_COMPLETION] marked lesson $lessonId for scope $scopeKey',
      );
    } catch (e) {
      safePrint('[LESSON_COMPLETION] markLessonCompleted: $e');
    }
  }

  /// When [course.lessons] is empty, returns true (legacy single-block courses).
  static Future<bool> areAllLessonsCompleted(Course course) async {
    if (course.lessons.isEmpty) return true;
    final scopeKey = course.assignmentId ?? course.id;
    final done = await getCompletedLessonIds(scopeKey);
    for (final lesson in course.lessons) {
      if (!done.contains(lesson.id)) return false;
    }
    return true;
  }
}

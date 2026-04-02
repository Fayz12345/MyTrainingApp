import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class LessonContentProgressService {
  LessonContentProgressService._();

  static const String _videoPrefix = 'lesson_video_done_v1_';
  static const String _pdfPrefix = 'lesson_pdf_done_v1_';

  static String _videoKey(String scopeKey) => '$_videoPrefix$scopeKey';
  static String _pdfKey(String scopeKey) => '$_pdfPrefix$scopeKey';

  static Future<Set<String>> _readSet(String key) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(key);
    if (raw == null || raw.isEmpty) return {};
    final decoded = jsonDecode(raw);
    if (decoded is! List) return {};
    return decoded.map((e) => e.toString()).toSet();
  }

  static Future<void> _writeSet(String key, Set<String> values) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(key, jsonEncode(values.toList()));
  }

  static Future<bool> isLessonVideoViewed(
      String scopeKey, String lessonId) async {
    final done = await _readSet(_videoKey(scopeKey));
    return done.contains(lessonId);
  }

  static Future<bool> isLessonPdfViewed(
      String scopeKey, String lessonId) async {
    final done = await _readSet(_pdfKey(scopeKey));
    return done.contains(lessonId);
  }

  static Future<void> markLessonVideoViewed(
      String scopeKey, String lessonId) async {
    final done = await _readSet(_videoKey(scopeKey));
    done.add(lessonId);
    await _writeSet(_videoKey(scopeKey), done);
  }

  static Future<void> markLessonPdfViewed(
      String scopeKey, String lessonId) async {
    final done = await _readSet(_pdfKey(scopeKey));
    done.add(lessonId);
    await _writeSet(_pdfKey(scopeKey), done);
  }
}

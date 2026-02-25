import 'package:shared_preferences/shared_preferences.dart';
import 'package:amplify_flutter/amplify_flutter.dart';

/// Service to track PDF view status for courses
class PdfProgressService {
  static const String _viewedPrefix = 'pdf_viewed_';

  /// Mark PDF as viewed for a course
  static Future<void> markPdfViewed(String courseId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('$_viewedPrefix$courseId', true);
      safePrint('[PDF_PROGRESS_SERVICE] ✅ Marked PDF as viewed: Key="$courseId"');
    } catch (e) {
      safePrint('[PDF_PROGRESS_SERVICE] ❌ Error marking PDF as viewed: $e');
    }
  }

  /// Check if PDF has been viewed for a course
  static Future<bool> hasViewedPdf(String courseId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final viewed = prefs.getBool('$_viewedPrefix$courseId') ?? false;
      safePrint('[PDF_PROGRESS_SERVICE] ✅ PDF view status: Key="$courseId", Viewed=$viewed');
      return viewed;
    } catch (e) {
      safePrint('[PDF_PROGRESS_SERVICE] ❌ Error checking PDF view status: $e');
      return false;
    }
  }

  /// Clear PDF view status for a course
  static Future<void> clearPdfViewStatus(String courseId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('$_viewedPrefix$courseId');
      safePrint('[PDF_PROGRESS_SERVICE] ✅ Cleared PDF view status: Key="$courseId"');
    } catch (e) {
      safePrint('[PDF_PROGRESS_SERVICE] ❌ Error clearing PDF view status: $e');
    }
  }
}


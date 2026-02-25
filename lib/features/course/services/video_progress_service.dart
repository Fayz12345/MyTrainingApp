import 'package:shared_preferences/shared_preferences.dart';
import 'package:amplify_flutter/amplify_flutter.dart';

class VideoProgressService {
  static const String _progressPrefix = 'video_progress_';
  static const String _completedPrefix = 'video_completed_';
  static const String _durationPrefix = 'video_duration_';

  static Future<void> saveVideoProgress(String courseId, Duration position,
      {Duration? duration}) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setInt('$_progressPrefix$courseId', position.inMilliseconds);
      // Also save the actual video duration if provided
      if (duration != null && duration.inMilliseconds > 0) {
        await prefs.setInt(
            '$_durationPrefix$courseId', duration.inMilliseconds);
        safePrint('[VIDEO_PROGRESS_SERVICE] ✅ Saved progress: Key="$courseId", Position=${position.inSeconds}s (${position.inMinutes}m ${position.inSeconds % 60}s), Duration=${duration.inSeconds}s (${duration.inMinutes}m ${duration.inSeconds % 60}s)');
      } else {
        safePrint('[VIDEO_PROGRESS_SERVICE] ✅ Saved progress: Key="$courseId", Position=${position.inSeconds}s (${position.inMinutes}m ${position.inSeconds % 60}s), Milliseconds=${position.inMilliseconds}ms');
      }
    } catch (e) {
      print('>>> VideoProgressService: Error saving progress: $e');
    }
  }

  /// Get saved video duration for a course
  static Future<Duration?> getVideoDuration(String courseId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final milliseconds = prefs.getInt('$_durationPrefix$courseId');
      if (milliseconds != null && milliseconds > 0) {
        final duration = Duration(milliseconds: milliseconds);
        safePrint(
            '[VIDEO_PROGRESS_SERVICE] ✅ Loaded duration: Key="$courseId", Duration=${duration.inSeconds}s (${duration.inMinutes}m ${duration.inSeconds % 60}s)');
        return duration;
      }
      return null;
    } catch (e) {
      print('>>> VideoProgressService: Error loading duration: $e');
      return null;
    }
  }

  static Future<Duration?> getVideoProgress(String courseId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final milliseconds = prefs.getInt('$_progressPrefix$courseId');
      if (milliseconds != null) {
        final duration = Duration(milliseconds: milliseconds);
        safePrint('[VIDEO_PROGRESS_SERVICE] ✅ Loaded progress: Key="$courseId", Position=${duration.inSeconds}s (${duration.inMinutes}m ${duration.inSeconds % 60}s), Milliseconds=${milliseconds}ms');
        return duration;
      }
      safePrint('[VIDEO_PROGRESS_SERVICE] ⚠️ No saved progress found for Key="$courseId"');
      return null;
    } catch (e) {
      print('>>> VideoProgressService: Error loading progress: $e');
      return null;
    }
  }

  static Future<void> markVideoCompleted(String courseId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('$_completedPrefix$courseId', true);
    } catch (e) {
      print('>>> VideoProgressService: Error marking video as completed: $e');
    }
  }


  static Future<bool> isVideoCompleted(String courseId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final completed = prefs.getBool('$_completedPrefix$courseId') ?? false;
      return completed;
    } catch (e) {
      print('>>> VideoProgressService: Error checking completion status: $e');
      return false;
    }
  }

  static Future<double> getVideoProgressPercentage(
      String courseId, Duration totalDuration) async {
    try {
      final savedPosition = await getVideoProgress(courseId);
      if (savedPosition == null || totalDuration.inMilliseconds == 0) {
        return 0.0;
      }
      final percentage =
          (savedPosition.inMilliseconds / totalDuration.inMilliseconds)
              .clamp(0.0, 1.0);
      return percentage;
    } catch (e) {
      print('>>> VideoProgressService: Error calculating progress percentage: $e');
      return 0.0;
    }
  }

  static Future<void> clearVideoProgress(String courseId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('$_progressPrefix$courseId');
      await prefs.remove('$_completedPrefix$courseId');
      await prefs.remove('$_durationPrefix$courseId');
    } catch (e) {
      print('>>> VideoProgressService: Error clearing progress: $e');
    }
  }
}

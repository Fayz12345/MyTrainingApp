import 'dart:io';
import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:intl/intl.dart';
import '../../features/auth/services/auth_service.dart';

/// Service to log user activities and upload them to S3
/// Follows the same format as FileLogger for consistency
class ActivityLogger {
  static final DateFormat _dateFormat = DateFormat('yyyy-MM-dd HH:mm:ss.SSS');
  static final DateFormat _dateOnlyFormat = DateFormat('yyyy-MM-dd');

  /// Log user activity and upload to S3
  /// Activities are stored daily in log/YYYY-MM-DD/activity_log.txt
  static Future<void> logActivity(
    String activityType, {
    Map<String, dynamic>? variables,
  }) async {
    try {
      final timestamp = _dateFormat.format(DateTime.now());
      final dateOnly = _dateOnlyFormat.format(DateTime.now());

      // Get user info
      final userId = await AuthService.getCurrentUserId();
      final username = await AuthService.getCurrentUsername();
      final email = await AuthService.getCurrentUserEmail();

      // Build log entry following FileLogger format
      final logEntry = StringBuffer();
      logEntry.writeln('[$timestamp] $activityType');
      logEntry.writeln('Variables:');
      logEntry.writeln('  user_id: ${userId ?? 'N/A'}');
      logEntry.writeln('  username: ${username ?? 'N/A'}');
      logEntry.writeln('  email: ${email ?? 'N/A'}');

      if (variables != null && variables.isNotEmpty) {
        variables.forEach((key, value) {
          // Mask sensitive data
          String displayValue = _maskSensitiveData(key, value);
          logEntry.writeln('  $key: $displayValue');
        });
      }

      logEntry.writeln('---');
      logEntry.writeln(''); // Add blank line between entries

      // Upload to S3
      // Path: log/YYYY-MM-DD/activity_log.txt
      final logPath = 'log/$dateOnly/activity_log.txt';

      safePrint('[ACTIVITY_LOGGER] 📝 Logging activity: $activityType');
      safePrint('[ACTIVITY_LOGGER] 📁 S3 Path: $logPath');

      // Create a temporary file with the log entry
      final tempDir = Directory.systemTemp;
      final tempFile = File(
        '${tempDir.path}/activity_log_${DateTime.now().millisecondsSinceEpoch}.txt',
      );
      await tempFile.writeAsString(logEntry.toString(), mode: FileMode.append);

      // Upload to S3 (append mode by reading existing file, appending, and uploading)
      try {
        // Try to get existing log file from S3
        String existingContent = '';
        final downloadTempFilePath =
            '${tempDir.path}/download_${DateTime.now().millisecondsSinceEpoch}.txt';
        final downloadTempFile = File(downloadTempFilePath);

        try {
          await Amplify.Storage.downloadFile(
            path: StoragePath.fromString(logPath),
            localFile: AWSFile.fromPath(downloadTempFilePath),
          ).result;

          // If file exists, read it
          if (await downloadTempFile.exists()) {
            existingContent = await downloadTempFile.readAsString();
            // Clean up download temp file
            try {
              await downloadTempFile.delete();
            } catch (e) {
              // Ignore cleanup errors
            }
          }
        } catch (e) {
          // File doesn't exist yet, that's okay - we'll create it
          safePrint(
            '[ACTIVITY_LOGGER] ℹ️ No existing log file found, creating new one',
          );
          // Clean up download temp file if it exists
          try {
            if (await downloadTempFile.exists()) {
              await downloadTempFile.delete();
            }
          } catch (e) {
            // Ignore cleanup errors
          }
        }

        // Append new entry to existing content
        final fullContent = existingContent + logEntry.toString();

        // Write full content to temp file
        await tempFile.writeAsString(fullContent);

        // Upload to S3
        await Amplify.Storage.uploadFile(
          path: StoragePath.fromString(logPath),
          localFile: AWSFile.fromPath(tempFile.path),
        ).result;

        safePrint('[ACTIVITY_LOGGER] ✅ Activity logged successfully to S3');

        // Clean up temp file
        try {
          if (await tempFile.exists()) {
            await tempFile.delete();
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      } catch (uploadError) {
        safePrint('[ACTIVITY_LOGGER] ⚠️ Failed to upload to S3: $uploadError');
        safePrint('[ACTIVITY_LOGGER] 📝 Log entry (for debugging):');
        safePrint(logEntry.toString());
        // Don't throw - logging failures shouldn't break the app
      }
    } catch (e, stackTrace) {
      safePrint('[ACTIVITY_LOGGER] ❌ Error logging activity: $e');
      safePrint('[ACTIVITY_LOGGER] Stack trace: $stackTrace');
      // Don't throw - logging failures shouldn't break the app
    }
  }

  /// Mask sensitive data (passwords, tokens)
  static String _maskSensitiveData(String key, dynamic value) {
    final sensitiveKeys = ['password', 'token', 'secret', 'key', 'credential'];
    final lowerKey = key.toLowerCase();

    if (sensitiveKeys.any((sensitive) => lowerKey.contains(sensitive))) {
      if (value is String && value.isNotEmpty) {
        return '***MASKED*** (length: ${value.length})';
      }
      return '***MASKED***';
    }

    return value.toString();
  }

  /// Log user login
  static Future<void> logUserLogin({
    String? loginMethod,
    bool? success,
    String? error,
  }) async {
    await logActivity(
      'USER_LOGIN',
      variables: {
        'login_method': loginMethod ?? 'email',
        'success': success ?? true,
        if (error != null) 'error': error,
        'timestamp': DateTime.now().toIso8601String(),
      },
    );
  }

  /// Log course start
  static Future<void> logCourseStart({
    required String courseId,
    required String courseTitle,
    String? assignmentId,
  }) async {
    await logActivity(
      'COURSE_START',
      variables: {
        'course_id': courseId,
        'course_title': courseTitle,
        if (assignmentId != null) 'assignment_id': assignmentId,
        'timestamp': DateTime.now().toIso8601String(),
      },
    );
  }

  /// Log course completion
  static Future<void> logCourseCompletion({
    required String courseId,
    required String courseTitle,
    String? assignmentId,
    int? score,
    bool? passed,
  }) async {
    await logActivity(
      'COURSE_COMPLETION',
      variables: {
        'course_id': courseId,
        'course_title': courseTitle,
        if (assignmentId != null) 'assignment_id': assignmentId,
        if (score != null) 'score': score,
        if (passed != null) 'passed': passed,
        'timestamp': DateTime.now().toIso8601String(),
      },
    );
  }

  /// Log quiz start
  static Future<void> logQuizStart({
    required String courseId,
    required String courseTitle,
    required String assignmentId,
  }) async {
    await logActivity(
      'QUIZ_START',
      variables: {
        'course_id': courseId,
        'course_title': courseTitle,
        'assignment_id': assignmentId,
        'timestamp': DateTime.now().toIso8601String(),
      },
    );
  }

  /// Log quiz completion
  static Future<void> logQuizCompletion({
    required String courseId,
    required String courseTitle,
    required String assignmentId,
    required int score,
    required bool passed,
  }) async {
    await logActivity(
      'QUIZ_COMPLETION',
      variables: {
        'course_id': courseId,
        'course_title': courseTitle,
        'assignment_id': assignmentId,
        'score': score,
        'passed': passed,
        'timestamp': DateTime.now().toIso8601String(),
      },
    );
  }

  /// Log video start
  static Future<void> logVideoStart({
    required String courseId,
    required String courseTitle,
    required String videoKey,
    String? assignmentId,
  }) async {
    await logActivity(
      'VIDEO_START',
      variables: {
        'course_id': courseId,
        'course_title': courseTitle,
        'video_key': videoKey,
        if (assignmentId != null) 'assignment_id': assignmentId,
        'timestamp': DateTime.now().toIso8601String(),
      },
    );
  }

  /// Log video completion
  static Future<void> logVideoCompletion({
    required String courseId,
    required String courseTitle,
    required String videoKey,
    String? assignmentId,
    int? durationSeconds,
  }) async {
    await logActivity(
      'VIDEO_COMPLETION',
      variables: {
        'course_id': courseId,
        'course_title': courseTitle,
        'video_key': videoKey,
        if (assignmentId != null) 'assignment_id': assignmentId,
        if (durationSeconds != null) 'duration_seconds': durationSeconds,
        'timestamp': DateTime.now().toIso8601String(),
      },
    );
  }

  /// Log PDF open
  static Future<void> logPdfOpen({
    required String courseId,
    required String courseTitle,
    required String pdfKey,
    String? assignmentId,
  }) async {
    await logActivity(
      'PDF_OPEN',
      variables: {
        'course_id': courseId,
        'course_title': courseTitle,
        'pdf_key': pdfKey,
        if (assignmentId != null) 'assignment_id': assignmentId,
        'timestamp': DateTime.now().toIso8601String(),
      },
    );
  }

  /// Log PDF completion
  static Future<void> logPdfCompletion({
    required String courseId,
    required String courseTitle,
    required String pdfKey,
    String? assignmentId,
    int? viewDurationSeconds,
  }) async {
    await logActivity(
      'PDF_COMPLETION',
      variables: {
        'course_id': courseId,
        'course_title': courseTitle,
        'pdf_key': pdfKey,
        if (assignmentId != null) 'assignment_id': assignmentId,
        if (viewDurationSeconds != null)
          'view_duration_seconds': viewDurationSeconds,
        'timestamp': DateTime.now().toIso8601String(),
      },
    );
  }
}

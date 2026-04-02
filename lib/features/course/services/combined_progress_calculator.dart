import 'package:amplify_flutter/amplify_flutter.dart';

import '../data/models/course_model.dart';
import 'quiz_service.dart';
import 'quiz_progress_service.dart';
import 'video_progress_service.dart';

/// Computes 0–100% training progress for a course (video + quiz), independent of UI.
///
/// Mirrors list-screen logic; prefer aligning long-term with [CalculateProgressUseCase].
class CombinedProgressCalculator {
  CombinedProgressCalculator._();

  /// Optional [onFullyComplete] when assignment is done or quiz passed (for UI cleanup).
  static Future<double> calculatePercent(
    Course course, {
    void Function(String cacheKey)? onFullyComplete,
  }) async {
    final cacheKey = course.assignmentId ?? course.id;

    final isAssignmentCompleted = course.assignmentStatus == 'completed';
    if (isAssignmentCompleted) {
      safePrint(
        '[PROGRESS] Course ${course.id} completed (assignmentStatus)',
      );
      onFullyComplete?.call(cacheKey);
      return 100.0;
    }

    if (course.assignmentId != null) {
      try {
        final hasPassedQuiz =
            await QuizService.hasQuizResult(course.assignmentId!);
        if (hasPassedQuiz) {
          safePrint(
            '[PROGRESS] Course ${course.id} has passed quiz → 100%',
          );
          onFullyComplete?.call(cacheKey);
          return 100.0;
        }
      } catch (e) {
        safePrint('[PROGRESS] Error checking quiz result: $e');
      }
    }

    var videoProgress = 0.0;
    var quizProgress = 0.0;
    final progressKey = course.assignmentId ?? course.id;

    final isVideoCompleted =
        await VideoProgressService.isVideoCompleted(progressKey);
    if (isVideoCompleted) {
      videoProgress = 50.0;
    } else {
      final savedPosition =
          await VideoProgressService.getVideoProgress(progressKey);
      if (savedPosition != null) {
        var videoDuration =
            await VideoProgressService.getVideoDuration(progressKey);

        if (videoDuration == null || videoDuration.inMilliseconds == 0) {
          videoDuration =
              Duration(minutes: _estimatedMinutesFromCourse(course));
        }

        if (videoDuration.inMilliseconds > 0) {
          final videoProgressPercent =
              (savedPosition.inMilliseconds / videoDuration.inMilliseconds)
                  .clamp(0.0, 1.0);
          videoProgress = videoProgressPercent * 50.0;
          safePrint(
            '[PROGRESS] ${course.title}: video ${(videoProgressPercent * 100).toStringAsFixed(2)}% → $videoProgress% of course bar',
          );
        }
      }
    }

    if (isVideoCompleted) {
      try {
        final quizQuestions = await QuizService.getQuizQuestions(course.id);
        final totalQuestions = quizQuestions.length;

        if (totalQuestions > 0) {
          final quizProgressData =
              await QuizProgressService.getQuizProgress(progressKey);
          if (quizProgressData != null) {
            final answers = quizProgressData['answers'] as List<int>;
            final answeredQuestions =
                answers.where((answer) => answer != -1).length;
            final quizProgressPercent = answeredQuestions / totalQuestions;
            quizProgress = 50.0 + (quizProgressPercent * 50.0);
          } else {
            quizProgress = 50.0;
          }
        } else {
          quizProgress = 100.0;
        }
      } catch (e) {
        quizProgress = 50.0;
      }
    }

    final combinedProgress = isVideoCompleted ? quizProgress : videoProgress;
    final finalProgress = combinedProgress.clamp(0.0, 100.0);
    safePrint(
      '[PROGRESS] ${course.title}: final ${finalProgress.toStringAsFixed(2)}%',
    );
    return finalProgress;
  }

  static int _estimatedMinutesFromCourse(Course course) {
    var estimatedDurationMinutes = 30;
    if (course.duration != null) {
      final durationStr = course.duration!.toLowerCase();
      var hours = 0;
      var minutes = 0;

      final hourMatch =
          RegExp(r'(\d+)\s*(?:hr|hour|h)').firstMatch(durationStr);
      if (hourMatch != null) {
        hours = int.tryParse(hourMatch.group(1) ?? '0') ?? 0;
      }

      final minMatch = RegExp(
        r'(\d+)\s*(?:min|mins|minute|minutes|m)(?!\s*(?:hr|hour|h))',
      ).firstMatch(durationStr);
      if (minMatch != null) {
        minutes = int.tryParse(minMatch.group(1) ?? '0') ?? 0;
      } else if (hours == 0) {
        final allNumbers = RegExp(r'\d+').allMatches(durationStr);
        if (allNumbers.isNotEmpty) {
          minutes = int.tryParse(allNumbers.first.group(0) ?? '0') ?? 0;
        }
      }

      estimatedDurationMinutes = (hours * 60) + minutes;
      if (estimatedDurationMinutes == 0) {
        estimatedDurationMinutes = 30;
      }
    }
    return estimatedDurationMinutes;
  }
}

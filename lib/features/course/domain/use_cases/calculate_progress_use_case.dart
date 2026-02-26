import '../../data/models/course_model.dart';
import '../../domain/repositories/course_repository.dart';
import '../../../../core/constants/app_constants.dart';

class CalculateProgressUseCase {
  final CourseRepository _repository;

  CalculateProgressUseCase(this._repository);
  Future<double> execute(Course course) async {
    // Check if assignment is fully completed
    final bool isAssignmentCompleted = course.assignmentStatus == 'completed';
    if (isAssignmentCompleted) {
      return 100.0;
    }

    // Check if quiz result exists (quiz was passed)
    if (course.assignmentId != null) {
      final hasPassedQuiz =
          await _repository.hasQuizResult(course.assignmentId!);
      if (hasPassedQuiz) {
        return 100.0;
      }
    }

    final progressKey = course.assignmentId ?? course.id;
    double videoProgress = 0.0; // 0-50%
    double quizProgress = 0.0; // 51-100%

    // Calculate video progress (0-50%)
    final isVideoCompleted = await _repository.isVideoCompleted(progressKey);
    if (isVideoCompleted) {
      videoProgress = AppConstants.videoProgressPortion * 100; // 50%
    } else {
      final savedPosition = await _repository.getVideoProgress(progressKey);
      if (savedPosition != null) {
        final videoDuration = await _repository.getVideoDuration(progressKey) ??
            _parseDurationFromCourse(course);

        if (videoDuration.inMilliseconds > 0) {
          final videoProgressPercent =
              (savedPosition.inMilliseconds / videoDuration.inMilliseconds)
                  .clamp(0.0, 1.0);
          videoProgress = videoProgressPercent *
              (AppConstants.videoProgressPortion * 100); // Scale to 0-50%
        }
      }
    }

    // Calculate quiz progress (51-100%)
    if (isVideoCompleted) {
      try {
        final quizQuestions = await _repository.getQuizQuestions(course.id);
        final totalQuestions = quizQuestions.length;

        if (totalQuestions > 0) {
          final quizProgressData =
              await _repository.getQuizProgress(progressKey);
          if (quizProgressData != null) {
            final answers = quizProgressData['answers'] as List<int>;
            final answeredQuestions =
                answers.where((answer) => answer != -1).length;
            final quizProgressPercent = answeredQuestions / totalQuestions;
            quizProgress = (AppConstants.videoProgressPortion * 100) +
                (quizProgressPercent *
                    (AppConstants.quizProgressPortion * 100));
          } else {
            quizProgress =
                AppConstants.videoProgressPortion * 100; // Stay at 50%
          }
        } else {
          quizProgress = 100.0; // No quiz, so if video is done, course is 100%
        }
      } catch (e) {
        quizProgress = AppConstants.videoProgressPortion * 100;
      }
    }

    // Combine progress
    final combinedProgress = isVideoCompleted ? quizProgress : videoProgress;
    return combinedProgress.clamp(0.0, 100.0);
  }

  /// Parse duration string like "1hr 30 Mins" into Duration
  Duration _parseDurationFromCourse(Course course) {
    int estimatedDurationMinutes = 30; // Default fallback
    if (course.duration != null) {
      final durationStr = course.duration!.toLowerCase();
      int hours = 0;
      int minutes = 0;

      final hourMatch =
          RegExp(r'(\d+)\s*(?:hr|hour|h)').firstMatch(durationStr);
      if (hourMatch != null) {
        hours = int.tryParse(hourMatch.group(1) ?? '0') ?? 0;
      }

      final minMatch =
          RegExp(r'(\d+)\s*(?:min|mins|minute|minutes|m)(?!\s*(?:hr|hour|h))')
              .firstMatch(durationStr);
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
    return Duration(minutes: estimatedDurationMinutes);
  }
}

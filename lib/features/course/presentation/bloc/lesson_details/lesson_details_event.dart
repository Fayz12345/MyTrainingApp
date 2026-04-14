part of 'lesson_details_bloc.dart';

abstract class LessonDetailsEvent extends Equatable {
  const LessonDetailsEvent();

  @override
  List<Object?> get props => [];
}

class LessonDetailsStarted extends LessonDetailsEvent {
  const LessonDetailsStarted({
    required this.lesson,
    required this.course,
  });

  final Lesson lesson;
  final Course course;

  @override
  List<Object?> get props => [lesson, course];
}

class LessonVideoMarkedWatched extends LessonDetailsEvent {
  const LessonVideoMarkedWatched();
}

class LessonPdfMarkedViewed extends LessonDetailsEvent {
  const LessonPdfMarkedViewed();
}

class LessonPdfSyncFromStorage extends LessonDetailsEvent {
  const LessonPdfSyncFromStorage();
}

class LessonDetailsRefreshCompletion extends LessonDetailsEvent {
  const LessonDetailsRefreshCompletion();
}

/// Fired when the learner has read a text-only lesson (reached bottom or
/// content fits on screen without scrolling).
class LessonTextOnlyEngaged extends LessonDetailsEvent {
  const LessonTextOnlyEngaged();
}

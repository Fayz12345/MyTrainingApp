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

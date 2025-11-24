part of 'quiz_bloc.dart';

abstract class QuizEvent extends Equatable {
  const QuizEvent();

  @override
  List<Object?> get props => [];
}

class LoadQuizQuestions extends QuizEvent {
  final String courseId;

  const LoadQuizQuestions(this.courseId);

  @override
  List<Object?> get props => [courseId];
}

class SelectAnswer extends QuizEvent {
  final int questionIndex;
  final int answerIndex;

  const SelectAnswer({
    required this.questionIndex,
    required this.answerIndex,
  });

  @override
  List<Object?> get props => [questionIndex, answerIndex];
}

class NextQuestion extends QuizEvent {
  const NextQuestion();
}

class PreviousQuestion extends QuizEvent {
  const PreviousQuestion();
}

class SubmitQuiz extends QuizEvent {
  final String assignmentId;
  final int passingScore;

  const SubmitQuiz({
    required this.assignmentId,
    required this.passingScore,
  });

  @override
  List<Object?> get props => [assignmentId, passingScore];
}

class ResetQuiz extends QuizEvent {
  const ResetQuiz();
}

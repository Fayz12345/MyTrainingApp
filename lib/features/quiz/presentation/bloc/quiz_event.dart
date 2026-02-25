part of 'quiz_bloc.dart';

abstract class QuizEvent extends Equatable {
  const QuizEvent();

  @override
  List<Object?> get props => [];
}

class LoadQuizQuestions extends QuizEvent {
  final String courseId; // For fetching questions
  final String?
      progressKey; // For saving/loading progress (assignmentId or courseId)
  final bool randomizeQuestions; // Whether to randomize question order
  final bool randomizeOptions; // Whether to randomize answer options order
  final bool useQuestionPool; // Whether to use question pool mode
  final int? questionsToDisplay; // Number of questions to select from pool

  const LoadQuizQuestions(
    this.courseId, {
    this.progressKey,
    this.randomizeQuestions = false,
    this.randomizeOptions = false,
    this.useQuestionPool = false,
    this.questionsToDisplay,
  });

  @override
  List<Object?> get props => [courseId, progressKey, randomizeQuestions, randomizeOptions, useQuestionPool, questionsToDisplay];
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

class SelectTextAnswer extends QuizEvent {
  final int questionIndex;
  final String textAnswer;

  const SelectTextAnswer({
    required this.questionIndex,
    required this.textAnswer,
  });

  @override
  List<Object?> get props => [questionIndex, textAnswer];
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

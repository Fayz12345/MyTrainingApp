part of 'quiz_bloc.dart';

abstract class QuizState extends Equatable {
  const QuizState();

  @override
  List<Object?> get props => [];
}

class QuizInitial extends QuizState {
  const QuizInitial();
}

class QuizLoading extends QuizState {
  const QuizLoading();
}

class QuizLoaded extends QuizState {
  final List<QuizQuestion> questions;
  final List<int> answers; // For multiple choice and True/False questions
  final List<String> textAnswers; // For fill-in-the-blank questions
  final int currentQuestionIndex;

  const QuizLoaded({
    required this.questions,
    required this.answers,
    this.textAnswers = const [],
    this.currentQuestionIndex = 0,
  });

  QuizLoaded copyWith({
    List<QuizQuestion>? questions,
    List<int>? answers,
    List<String>? textAnswers,
    int? currentQuestionIndex,
  }) {
    return QuizLoaded(
      questions: questions ?? this.questions,
      answers: answers ?? this.answers,
      textAnswers: textAnswers ?? this.textAnswers,
      currentQuestionIndex: currentQuestionIndex ?? this.currentQuestionIndex,
    );
  }

  @override
  List<Object?> get props => [questions, answers, textAnswers, currentQuestionIndex];
}

class QuizSubmitting extends QuizState {
  final List<QuizQuestion> questions;
  final List<int> answers;
  final List<String> textAnswers;

  const QuizSubmitting({
    required this.questions,
    required this.answers,
    this.textAnswers = const [],
  });

  @override
  List<Object?> get props => [questions, answers, textAnswers];
}

class QuizResults extends QuizState {
  final int score;
  final bool passed;
  final List<QuizQuestion> questions;
  final List<int> answers;
  final List<String> textAnswers;

  const QuizResults({
    required this.score,
    required this.passed,
    required this.questions,
    required this.answers,
    this.textAnswers = const [],
  });

  @override
  List<Object?> get props => [score, passed, questions, answers, textAnswers];
}

class QuizError extends QuizState {
  final String message;

  const QuizError(this.message);

  @override
  List<Object?> get props => [message];
}

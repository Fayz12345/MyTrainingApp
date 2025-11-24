import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../../models/quiz_question_model.dart';
import '../../services/quiz_service.dart';

part 'quiz_event.dart';
part 'quiz_state.dart';

class QuizBloc extends Bloc<QuizEvent, QuizState> {
  QuizBloc() : super(const QuizInitial()) {
    on<LoadQuizQuestions>(_onLoadQuizQuestions);
    on<SelectAnswer>(_onSelectAnswer);
    on<NextQuestion>(_onNextQuestion);
    on<PreviousQuestion>(_onPreviousQuestion);
    on<SubmitQuiz>(_onSubmitQuiz);
    on<ResetQuiz>(_onResetQuiz);
  }

  Future<void> _onLoadQuizQuestions(
    LoadQuizQuestions event,
    Emitter<QuizState> emit,
  ) async {
    emit(const QuizLoading());
    try {
      final questions = await QuizService.getQuizQuestions(event.courseId);
      emit(QuizLoaded(
        questions: questions,
        answers: List.filled(questions.length, -1),
        currentQuestionIndex: 0,
      ));
    } catch (e) {
      emit(QuizError(e.toString()));
    }
  }

  void _onSelectAnswer(
    SelectAnswer event,
    Emitter<QuizState> emit,
  ) {
    if (state is QuizLoaded) {
      final currentState = state as QuizLoaded;
      final newAnswers = List<int>.from(currentState.answers);
      newAnswers[event.questionIndex] = event.answerIndex;

      emit(currentState.copyWith(answers: newAnswers));
    }
  }

  void _onNextQuestion(
    NextQuestion event,
    Emitter<QuizState> emit,
  ) {
    if (state is QuizLoaded) {
      final currentState = state as QuizLoaded;
      if (currentState.currentQuestionIndex <
          currentState.questions.length - 1) {
        emit(currentState.copyWith(
          currentQuestionIndex: currentState.currentQuestionIndex + 1,
        ));
      }
    }
  }

  void _onPreviousQuestion(
    PreviousQuestion event,
    Emitter<QuizState> emit,
  ) {
    if (state is QuizLoaded) {
      final currentState = state as QuizLoaded;
      if (currentState.currentQuestionIndex > 0) {
        emit(currentState.copyWith(
          currentQuestionIndex: currentState.currentQuestionIndex - 1,
        ));
      }
    }
  }

  Future<void> _onSubmitQuiz(
    SubmitQuiz event,
    Emitter<QuizState> emit,
  ) async {
    if (state is QuizLoaded) {
      final currentState = state as QuizLoaded;
      emit(QuizSubmitting(
        questions: currentState.questions,
        answers: currentState.answers,
      ));

      try {
        // Calculate score
        int correctAnswers = 0;
        for (int i = 0; i < currentState.questions.length; i++) {
          if (currentState.answers[i] ==
              currentState.questions[i].correctAnswer) {
            correctAnswers++;
          }
        }

        final score =
            ((correctAnswers / currentState.questions.length) * 100).round();
        final passed = score >= event.passingScore;

        // Save result
        await QuizService.saveQuizResult(
          assignmentId: event.assignmentId,
          score: score,
          passed: passed,
        );

        emit(QuizResults(
          score: score,
          passed: passed,
          questions: currentState.questions,
          answers: currentState.answers,
        ));
      } catch (e) {
        emit(QuizError('Failed to submit quiz: $e'));
      }
    }
  }

  void _onResetQuiz(
    ResetQuiz event,
    Emitter<QuizState> emit,
  ) {
    if (state is QuizResults || state is QuizLoaded) {
      final questions = (state is QuizResults)
          ? (state as QuizResults).questions
          : (state as QuizLoaded).questions;

      emit(QuizLoaded(
        questions: questions,
        answers: List.filled(questions.length, -1),
        currentQuestionIndex: 0,
      ));
    }
  }
}

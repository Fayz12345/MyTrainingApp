import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../../models/quiz_question_model.dart';
import '../../services/quiz_service.dart';
import '../../services/quiz_progress_service.dart';

part 'quiz_event.dart';
part 'quiz_state.dart';

class QuizBloc extends Bloc<QuizEvent, QuizState> {
  String? _currentCourseId; // For fetching questions
  String?
      _currentProgressKey; // For saving/loading progress (assignmentId or courseId)

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
      if (questions.isEmpty) {
        emit(const QuizError('No questions available for this quiz.'));
        return;
      }

      // Store courseId for fetching questions and progressKey for saving/loading progress
      _currentCourseId = event.courseId;
      // Use assignmentId for progress tracking if provided, otherwise use courseId
      _currentProgressKey = event.progressKey ?? event.courseId;

      // Try to load saved progress using progressKey (assignmentId)
      final savedProgress =
          await QuizProgressService.getQuizProgress(_currentProgressKey!);
      int startIndex = 0;
      List<int> savedAnswers = List.filled(questions.length, -1);

      if (savedProgress != null) {
        startIndex = savedProgress['currentQuestionIndex'] as int;
        final savedAnswersList = savedProgress['answers'] as List;
        // Ensure answers list matches questions length
        savedAnswers = List<int>.from(savedAnswersList);
        if (savedAnswers.length != questions.length) {
          savedAnswers = List.filled(questions.length, -1);
          for (int i = 0;
              i < savedAnswersList.length && i < questions.length;
              i++) {
            savedAnswers[i] = savedAnswersList[i] as int;
          }
        }
        print(
            '>>> QuizBloc: Resuming from saved progress - question $startIndex');
      } else {
        print('>>> QuizBloc: Starting quiz from beginning');
      }

      emit(QuizLoaded(
        questions: questions,
        answers: savedAnswers,
        currentQuestionIndex: startIndex.clamp(0, questions.length - 1),
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
      if (event.questionIndex >= 0 &&
          event.questionIndex < currentState.questions.length &&
          event.answerIndex >= 0 &&
          event.answerIndex <
              currentState.questions[event.questionIndex].options.length) {
        final newAnswers = List<int>.from(currentState.answers);
        newAnswers[event.questionIndex] = event.answerIndex;

        final newState = currentState.copyWith(answers: newAnswers);
        emit(newState);

        // Save progress after answer is selected
        _saveProgress(newState);
      }
    }
  }

  Future<void> _saveProgress(QuizLoaded state) async {
    if (_currentProgressKey != null) {
      await QuizProgressService.saveQuizProgress(
        courseId:
            _currentProgressKey!, // Use progressKey (assignmentId) for saving
        currentQuestionIndex: state.currentQuestionIndex,
        answers: state.answers,
      );
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
        final newState = currentState.copyWith(
          currentQuestionIndex: currentState.currentQuestionIndex + 1,
        );
        emit(newState);
        _saveProgress(newState);
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
    print('>>> QuizBloc: _onSubmitQuiz called');
    print('>>> Assignment ID: ${event.assignmentId}');
    print('>>> Passing Score: ${event.passingScore}');

    if (state is QuizLoaded) {
      final currentState = state as QuizLoaded;

      print('>>> Quiz State: QuizLoaded');
      print('>>> Total Questions: ${currentState.questions.length}');
      print('>>> Answers List: ${currentState.answers}');

      // Safety check: ensure questions list is not empty
      if (currentState.questions.isEmpty) {
        print('>>> ERROR: No questions available');
        emit(const QuizError('Cannot submit quiz: No questions available.'));
        return;
      }

      print('>>> Emitting QuizSubmitting state...');
      emit(QuizSubmitting(
        questions: currentState.questions,
        answers: currentState.answers,
      ));

      try {
        // Calculate score
        print('>>> Calculating score...');
        int correctAnswers = 0;
        for (int i = 0; i < currentState.questions.length; i++) {
          final userAnswer =
              i < currentState.answers.length ? currentState.answers[i] : -1;
          final correctAnswer = currentState.questions[i].correctAnswer;
          final isCorrect = userAnswer == correctAnswer;

          print(
              '>>> Question $i: User Answer=$userAnswer, Correct=$correctAnswer, IsCorrect=$isCorrect');

          if (isCorrect) {
            correctAnswers++;
          }
        }

        final score =
            ((correctAnswers / currentState.questions.length) * 100).round();
        final passed = score >= event.passingScore;

        print('>>> Score Calculation Complete:');
        print(
            '>>>   Correct Answers: $correctAnswers / ${currentState.questions.length}');
        print('>>>   Score: $score%');
        print('>>>   Passed: $passed (Required: ${event.passingScore}%)');

        // Save result
        print('>>> Calling QuizService.saveQuizResult...');
        await QuizService.saveQuizResult(
          assignmentId: event.assignmentId,
          score: score,
          passed: passed,
        );
        print('>>> QuizService.saveQuizResult completed successfully');

        // Clear quiz progress after successful submission
        if (_currentProgressKey != null) {
          await QuizProgressService.clearQuizProgress(_currentProgressKey!);
        }

        print('>>> Emitting QuizResults state...');
        emit(QuizResults(
          score: score,
          passed: passed,
          questions: currentState.questions,
          answers: currentState.answers,
        ));
        print('>>> Quiz submission completed successfully!');
        print('=== QUIZ SUBMISSION COMPLETE ===');
      } catch (e, stackTrace) {
        print('>>> ERROR in quiz submission: $e');
        print('>>> Stack trace: $stackTrace');
        emit(QuizError('Failed to submit quiz: $e'));
      }
    } else {
      print(
          '>>> ERROR: State is not QuizLoaded, current state: ${state.runtimeType}');
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

      if (questions.isEmpty) {
        emit(const QuizError('Cannot reset quiz: No questions available.'));
        return;
      }

      // Clear saved progress when resetting
      if (_currentProgressKey != null) {
        QuizProgressService.clearQuizProgress(_currentProgressKey!);
      }

      emit(QuizLoaded(
        questions: questions,
        answers: List.filled(questions.length, -1),
        currentQuestionIndex: 0,
      ));
    }
  }
}

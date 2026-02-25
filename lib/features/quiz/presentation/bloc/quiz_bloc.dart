import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import 'dart:math';
import '../../data/models/quiz_question_model.dart';
import '../../../course/services/quiz_service.dart';
import '../../../course/services/quiz_progress_service.dart';

part 'quiz_event.dart';
part 'quiz_state.dart';

class QuizBloc extends Bloc<QuizEvent, QuizState> {
  String? _currentCourseId; // For fetching questions
  String?
      _currentProgressKey; // For saving/loading progress (assignmentId or courseId)
  List<int>?
      _questionOrderMapping; // Original index -> shuffled index mapping (for randomized quizzes)
  List<ShuffledQuestionOptions>?
      _optionMappings; // Option mappings for each question (for randomized options)
  List<QuizQuestion>?
      _originalQuestions; // Store original questions for grading
  List<String>?
      _selectedQuestionIds; // IDs of questions selected from pool (for question pool mode)

  QuizBloc() : super(const QuizInitial()) {
    on<LoadQuizQuestions>(_onLoadQuizQuestions);
    on<SelectAnswer>(_onSelectAnswer);
    on<SelectTextAnswer>(_onSelectTextAnswer);
    on<NextQuestion>(_onNextQuestion);
    on<PreviousQuestion>(_onPreviousQuestion);
    on<SubmitQuiz>(_onSubmitQuiz);
    on<ResetQuiz>(_onResetQuiz);
  }

  /// Create a QuizQuestion with shuffled options for display
  /// The correctAnswer is updated to match the shuffled position
  QuizQuestion _createQuestionWithShuffledOptions(
    QuizQuestion originalQuestion,
    ShuffledQuestionOptions shuffledOptions,
  ) {
    return QuizQuestion(
      id: originalQuestion.id,
      courseId: originalQuestion.courseId,
      question: originalQuestion.question,
      options: shuffledOptions.shuffledOptions, // Shuffled options for display
      correctAnswer: shuffledOptions
          .shuffledCorrectAnswer, // Correct answer in shuffled position
      createdAt: originalQuestion.createdAt,
      updatedAt: originalQuestion.updatedAt,
    );
  }

  Future<void> _onLoadQuizQuestions(
    LoadQuizQuestions event,
    Emitter<QuizState> emit,
  ) async {
    emit(const QuizLoading());
    try {
      // Debug: Log randomization settings
      print('[QuizBloc] Randomization settings:');
      print('[QuizBloc]   - randomizeQuestions: ${event.randomizeQuestions}');
      print('[QuizBloc]   - randomizeOptions: ${event.randomizeOptions}');
      print('[QuizBloc]   - useQuestionPool: ${event.useQuestionPool}');
      print('[QuizBloc]   - questionsToDisplay: ${event.questionsToDisplay}');

      // Fetch all questions from the pool
      var allQuestions = await QuizService.getQuizQuestions(event.courseId);
      if (allQuestions.isEmpty) {
        emit(const QuizError('No questions available for this quiz.'));
        return;
      }

      // Filter out inactive questions (isActive == false)
      allQuestions = allQuestions.where((q) {
        // Assume questions are active by default if isActive field is not present
        // This will be handled in QuizQuestion.fromJson if we add isActive field
        return true; // For now, include all questions
      }).toList();

      // Handle question pool mode
      List<QuizQuestion> questions;
      List<String>? selectedQuestionIds;

      if (event.useQuestionPool && event.questionsToDisplay != null) {
        final questionsToSelect = event.questionsToDisplay!;

        if (allQuestions.length < questionsToSelect) {
          print(
              '[QuizBloc] Warning: Pool has ${allQuestions.length} questions but ${questionsToSelect} requested. Using all available questions.');
          questions = List.from(allQuestions);
          selectedQuestionIds = questions.map((q) => q.id).toList();
        } else {
          // Check if quiz has been completed before loading saved question selection
          bool hasCompletedQuizForPool = false;
          if (event.progressKey != null) {
            try {
              hasCompletedQuizForPool =
                  await QuizService.hasQuizResult(event.progressKey!);
            } catch (e) {
              print('[QuizBloc] Error checking quiz result for pool: $e');
            }
          }

          // Try to load previously selected questions from saved progress
          // Only if quiz hasn't been completed (for resuming in-progress quiz)
          List<String>? savedSelectedIds;
          if (!hasCompletedQuizForPool) {
            final savedProgress = await QuizProgressService.getQuizProgress(
                event.progressKey ?? event.courseId);

            if (savedProgress != null &&
                savedProgress['selectedQuestionIds'] != null) {
              savedSelectedIds = List<String>.from(
                  savedProgress['selectedQuestionIds'] as List);
              print(
                  '[QuizBloc] Found saved selected question IDs: $savedSelectedIds');
            }
          } else {
            print(
                '[QuizBloc] Quiz completed - generating new random question selection from pool.');
          }

          // If we have saved selection and it's valid, use it (for resume)
          // Otherwise, create new random selection
          if (!hasCompletedQuizForPool &&
              savedSelectedIds != null &&
              savedSelectedIds.length == questionsToSelect &&
              savedSelectedIds
                  .every((id) => allQuestions.any((q) => q.id == id))) {
            // Use saved selection
            selectedQuestionIds = savedSelectedIds;
            questions = savedSelectedIds
                .map((id) => allQuestions.firstWhere((q) => q.id == id))
                .toList();
            print(
                '[QuizBloc] Resuming with saved question selection: ${selectedQuestionIds.length} questions');
          } else {
            // Create new random selection
            final availableIds = allQuestions.map((q) => q.id).toList();
            availableIds.shuffle(Random.secure()); // Use secure random

            selectedQuestionIds = availableIds.take(questionsToSelect).toList();
            questions = selectedQuestionIds
                .map((id) => allQuestions.firstWhere((q) => q.id == id))
                .toList();

            print(
                '[QuizBloc] Selected ${questions.length} questions from pool of ${allQuestions.length}: $selectedQuestionIds');
          }
        }
      } else {
        // No question pool - use all questions
        questions = List.from(allQuestions);
        selectedQuestionIds = null;
      }

      if (questions.isEmpty) {
        emit(const QuizError('No questions available for this quiz.'));
        return;
      }

      // Store courseId for fetching questions and progressKey for saving/loading progress
      _currentCourseId = event.courseId;
      // Use assignmentId for progress tracking if provided, otherwise use courseId
      _currentProgressKey = event.progressKey ?? event.courseId;

      // Store selected question IDs for question pool mode
      _selectedQuestionIds = selectedQuestionIds;

      // Store original questions for grading (these are the selected questions)
      _originalQuestions = List.from(questions);

      // Check if quiz has been completed (has a result)
      // If completed, we should NOT use saved progress - generate new random order for retake
      bool hasCompletedQuiz = false;
      if (event.progressKey != null) {
        try {
          hasCompletedQuiz =
              await QuizService.hasQuizResult(event.progressKey!);
          if (hasCompletedQuiz) {
            print(
                '[QuizBloc] Quiz has been completed. Clearing saved progress and generating new random order.');
            // Clear any saved progress for a new attempt
            await QuizProgressService.clearQuizProgress(_currentProgressKey!);
          }
        } catch (e) {
          print('[QuizBloc] Error checking quiz result: $e');
          // Continue anyway - assume no completed result
        }
      }

      // Try to load saved progress using progressKey (assignmentId)
      // Only load if quiz hasn't been completed (for resuming in-progress quiz)
      Map<String, dynamic>? savedProgress;
      if (!hasCompletedQuiz) {
        savedProgress =
            await QuizProgressService.getQuizProgress(_currentProgressKey!);
      } else {
        print(
            '[QuizBloc] Skipping saved progress load - quiz was completed, starting fresh attempt.');
      }

      List<QuizQuestion> displayQuestions = List.from(questions);
      List<int>? questionOrder;
      List<ShuffledQuestionOptions>? optionMappings;
      int startIndex = 0;
      List<int> savedAnswers = List.filled(questions.length, -1);
      List<String> savedTextAnswers = List.filled(questions.length, '');

      // Temporary variable to hold non-null option mappings
      List<ShuffledQuestionOptions>? tempOptionMappings;

      // Handle question randomization
      if (event.randomizeQuestions) {
        if (savedProgress != null &&
            savedProgress['questionOrder'] != null &&
            !hasCompletedQuiz) {
          // Resume with saved question order (consistent during session)
          questionOrder =
              List<int>.from(savedProgress['questionOrder'] as List);
          _questionOrderMapping = questionOrder;

          // Reconstruct shuffled questions from saved order
          displayQuestions = questionOrder
              .map((originalIndex) => questions[originalIndex])
              .toList();

          print(
              '>>> QuizBloc: Resuming randomized quiz with saved order: $questionOrder');
        } else {
          // New quiz session - create random order
          questionOrder = List.generate(questions.length, (i) => i);
          questionOrder.shuffle(Random.secure()); // Use secure random
          _questionOrderMapping = questionOrder;

          // Shuffle questions according to random order
          displayQuestions = questionOrder
              .map((originalIndex) => questions[originalIndex])
              .toList();

          print(
              '>>> QuizBloc: Randomized quiz questions. Order: $questionOrder');
        }
      } else {
        // No randomization - use original order
        questionOrder = List.generate(questions.length, (i) => i);
        _questionOrderMapping = null;
        print('>>> QuizBloc: Questions in original order (no randomization)');
      }

      // Handle option randomization
      if (event.randomizeOptions) {
        if (savedProgress != null &&
            savedProgress['optionOrders'] != null &&
            !hasCompletedQuiz) {
          // Resume with saved option orders (consistent during session)
          final savedOptionOrders = savedProgress['optionOrders'] as List;

          // Validate saved option orders match number of questions
          if (savedOptionOrders.length != displayQuestions.length) {
            print(
                '[QuizBloc] ⚠️ Saved option orders count (${savedOptionOrders.length}) doesn\'t match questions count (${displayQuestions.length}). Regenerating...');
            // Regenerate option mappings
            final newOptionMappings = displayQuestions.map((question) {
              return question.createShuffledOptions();
            }).toList();
            optionMappings = newOptionMappings;
            tempOptionMappings = newOptionMappings;
            _optionMappings = optionMappings;

            // Update display questions with shuffled options
            final finalMappings = tempOptionMappings;
            displayQuestions = displayQuestions.asMap().entries.map((entry) {
              final index = entry.key;
              final question = entry.value;
              if (index < finalMappings.length) {
                return _createQuestionWithShuffledOptions(
                    question, finalMappings[index]);
              }
              return question;
            }).toList();

            print(
                '>>> QuizBloc: Regenerated randomized options due to mismatch');
          } else {
            // Saved option orders count matches - proceed with validation
            optionMappings = savedOptionOrders.asMap().entries.map((entry) {
              final displayIndex = entry.key;
              final orderList = entry.value;
              final order = List<int>.from(orderList as List);

              // Use original question (before any shuffling) to get correct options
              final originalQuestionIndex = _questionOrderMapping != null &&
                      displayIndex < _questionOrderMapping!.length
                  ? _questionOrderMapping![displayIndex]
                  : displayIndex;
              final originalQuestion = questions[originalQuestionIndex];

              // Validate saved order - ensure all indices are within bounds
              final validOrder = order
                  .where((idx) =>
                      idx >= 0 && idx < originalQuestion.options.length)
                  .toList();

              // If order is invalid or incomplete, regenerate it
              if (validOrder.length != originalQuestion.options.length) {
                print(
                    '[QuizBloc] ⚠️ Saved option order invalid for question $displayIndex. Regenerating...');
                // Regenerate valid order
                final newOrder =
                    List.generate(originalQuestion.options.length, (i) => i);
                newOrder.shuffle(Random.secure());
                final shuffledOptions = newOrder
                    .map((originalIndex) =>
                        originalQuestion.options[originalIndex])
                    .toList();
                final shuffledCorrectAnswer =
                    newOrder.indexOf(originalQuestion.correctAnswer as int);

                return ShuffledQuestionOptions(
                  shuffledOptions: shuffledOptions,
                  optionOrderMapping: newOrder,
                  shuffledCorrectAnswer: shuffledCorrectAnswer,
                );
              }

              // Reconstruct shuffled options from saved order (now validated)
              final shuffledOptions = validOrder
                  .map((originalIndex) =>
                      originalQuestion.options[originalIndex])
                  .toList();
              final shuffledCorrectAnswer =
                  validOrder.indexOf(originalQuestion.correctAnswer as int);

              return ShuffledQuestionOptions(
                shuffledOptions: shuffledOptions,
                optionOrderMapping: order,
                shuffledCorrectAnswer: shuffledCorrectAnswer,
              );
            }).toList();

            tempOptionMappings = optionMappings;
            _optionMappings = optionMappings;

            // Update display questions with shuffled options
            final finalMappings = tempOptionMappings;
            displayQuestions = displayQuestions.asMap().entries.map((entry) {
              final index = entry.key;
              final question = entry.value;
              if (index < finalMappings.length) {
                // Create a new question with shuffled options for display
                return _createQuestionWithShuffledOptions(
                    question, finalMappings[index]);
              }
              return question;
            }).toList();

            print(
                '>>> QuizBloc: Resuming randomized options with saved orders');
          }
        } else {
          // New quiz session - create random option orders
          final newOptionMappings = displayQuestions.map((question) {
            return question.createShuffledOptions();
          }).toList();

          optionMappings = newOptionMappings;
          tempOptionMappings = newOptionMappings;
          _optionMappings = optionMappings;

          // Update display questions with shuffled options
          final finalMappings2 = tempOptionMappings;
          displayQuestions = displayQuestions.asMap().entries.map((entry) {
            final index = entry.key;
            final question = entry.value;
            if (index < finalMappings2.length) {
              return _createQuestionWithShuffledOptions(
                  question, finalMappings2[index]);
            }
            return question;
          }).toList();

          print('>>> QuizBloc: Randomized answer options for all questions');
        }
      } else {
        // No option randomization
        _optionMappings = null;
        print('>>> QuizBloc: Options in original order (no randomization)');
      }

      // Load saved answers if available
      // Note: Saved answers are stored in shuffled format (matching display)
      if (savedProgress != null) {
        startIndex = savedProgress['currentQuestionIndex'] as int;
        final savedAnswersList = savedProgress['answers'] as List;
        // Ensure answers list matches questions length
        savedAnswers = List<int>.from(savedAnswersList);
        if (savedAnswers.length != displayQuestions.length) {
          savedAnswers = List.filled(displayQuestions.length, -1);
          for (int i = 0;
              i < savedAnswersList.length && i < displayQuestions.length;
              i++) {
            savedAnswers[i] = savedAnswersList[i] as int;
          }
        }

        // Validate saved answer indices - ensure they're within bounds for each question
        for (int i = 0;
            i < savedAnswers.length && i < displayQuestions.length;
            i++) {
          final answerIndex = savedAnswers[i];
          if (answerIndex >= 0) {
            final question = displayQuestions[i];
            // For fill-in-the-blank, answer index doesn't apply (use textAnswers instead)
            if (!question.isFillBlank &&
                answerIndex >= question.options.length) {
              print(
                  '[QuizBloc] ⚠️ Invalid saved answer index $answerIndex for question $i (has ${question.options.length} options). Resetting to -1.');
              savedAnswers[i] = -1; // Reset invalid answer
            }
          }
        }

        // Load text answers if available
        final savedTextAnswersList = savedProgress['textAnswers'] as List?;
        if (savedTextAnswersList != null) {
          savedTextAnswers = List<String>.from(
              savedTextAnswersList.map((a) => a?.toString() ?? ''));
          if (savedTextAnswers.length != displayQuestions.length) {
            savedTextAnswers = List.filled(displayQuestions.length, '');
            for (int i = 0;
                i < savedTextAnswersList.length && i < displayQuestions.length;
                i++) {
              savedTextAnswers[i] = savedTextAnswersList[i]?.toString() ?? '';
            }
          }
        }

        print(
            '>>> QuizBloc: Resuming from saved progress - question $startIndex, answers in shuffled format: $savedAnswers, textAnswers: $savedTextAnswers');
      } else {
        print('>>> QuizBloc: Starting quiz from beginning');
      }

      emit(QuizLoaded(
        questions: displayQuestions, // Shuffled questions for display
        answers: savedAnswers,
        textAnswers: savedTextAnswers,
        currentQuestionIndex: startIndex.clamp(0, displayQuestions.length - 1),
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

        // Store answer in shuffled format (what user sees)
        // This matches the question's correctAnswer which is also in shuffled format
        // We'll map back to original format only when grading
        newAnswers[event.questionIndex] = event.answerIndex;

        print(
            '>>> QuizBloc: Stored answer index $event.answerIndex for question $event.questionIndex (in shuffled format)');

        final newState = currentState.copyWith(answers: newAnswers);
        emit(newState);

        // Save progress after answer is selected
        _saveProgress(newState);
      }
    }
  }

  void _onSelectTextAnswer(
    SelectTextAnswer event,
    Emitter<QuizState> emit,
  ) {
    if (state is QuizLoaded) {
      final currentState = state as QuizLoaded;
      if (event.questionIndex >= 0 &&
          event.questionIndex < currentState.questions.length) {
        final question = currentState.questions[event.questionIndex];

        // Only allow text answers for fill-in-the-blank questions
        if (!question.isFillBlank) {
          print(
              '>>> QuizBloc: Warning - Text answer provided for non-fill-in-the-blank question');
          return;
        }

        final newTextAnswers = List<String>.from(currentState.textAnswers);
        // Ensure list is long enough
        while (newTextAnswers.length <= event.questionIndex) {
          newTextAnswers.add('');
        }
        newTextAnswers[event.questionIndex] = event.textAnswer;

        print(
            '>>> QuizBloc: Stored text answer "${event.textAnswer}" for question $event.questionIndex');

        final newState = currentState.copyWith(textAnswers: newTextAnswers);
        emit(newState);

        // Save progress after answer is entered
        _saveProgress(newState);
      }
    }
  }

  Future<void> _saveProgress(QuizLoaded state) async {
    if (_currentProgressKey != null) {
      // Convert option mappings to list of order lists for storage
      List<List<int>>? optionOrders;
      if (_optionMappings != null) {
        optionOrders = _optionMappings!
            .map((mapping) => mapping.optionOrderMapping)
            .toList();
      }

      await QuizProgressService.saveQuizProgress(
        courseId:
            _currentProgressKey!, // Use progressKey (assignmentId) for saving
        currentQuestionIndex: state.currentQuestionIndex,
        answers:
            state.answers, // Answers are in shuffled format (matching display)
        textAnswers: state.textAnswers, // Text answers for fill-in-the-blank
        questionOrder:
            _questionOrderMapping, // Save question order for randomized quizzes
        optionOrders: optionOrders, // Save option orders for randomized options
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
        textAnswers: currentState.textAnswers,
      ));

      try {
        // Calculate score
        // Note: Answers are stored in shuffled format (matching display)
        // Questions in state have shuffled options with correctAnswer in shuffled format
        // We need to map both back to original format for accurate grading
        print('>>> Calculating score...');
        if (_questionOrderMapping != null) {
          print(
              '>>> Quiz was randomized. Question order mapping: $_questionOrderMapping');
        }
        if (_optionMappings != null) {
          print('>>> Options were randomized');
        }

        // Get original questions for grading (correctAnswer is in original format)
        final questionsForGrading =
            _originalQuestions ?? currentState.questions;

        int correctAnswers = 0;
        for (int i = 0; i < currentState.questions.length; i++) {
          final displayQuestion = currentState.questions[i];
          bool isCorrect = false;

          // Get the original question index (if questions were shuffled)
          final originalQuestionIndex =
              _questionOrderMapping != null && i < _questionOrderMapping!.length
                  ? _questionOrderMapping![i]
                  : i;

          // Get original question for correct answer
          final originalQuestion = questionsForGrading[originalQuestionIndex];

          if (displayQuestion.isFillBlank) {
            // Handle fill-in-the-blank questions
            final userTextAnswer = i < currentState.textAnswers.length
                ? currentState.textAnswers[i]
                : '';
            isCorrect =
                originalQuestion.isFillBlankAnswerCorrect(userTextAnswer);
            print(
                '>>> Question $i (Fill-in-the-blank): User Answer="$userTextAnswer", Accepted Answers=${originalQuestion.acceptedAnswers}, IsCorrect=$isCorrect');
          } else {
            // Handle multiple choice and True/False questions
            final userAnswerShuffledIndex =
                i < currentState.answers.length ? currentState.answers[i] : -1;

            final correctAnswerOriginalIndex =
                originalQuestion.correctAnswer as int;

            // Map user's answer from shuffled format to original format
            int userAnswerOriginalIndex = userAnswerShuffledIndex;
            if (_optionMappings != null && i < _optionMappings!.length) {
              userAnswerOriginalIndex = _optionMappings![i]
                  .mapToOriginalIndex(userAnswerShuffledIndex);
            }

            // Compare in original format
            isCorrect = userAnswerOriginalIndex == correctAnswerOriginalIndex;

            print(
                '>>> Question $i: User Answer (shuffled=$userAnswerShuffledIndex, original=$userAnswerOriginalIndex), Correct (original)=$correctAnswerOriginalIndex, IsCorrect=$isCorrect');
          }

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
        if (_selectedQuestionIds != null) {
          print('>>>   Selected Question IDs from pool: $_selectedQuestionIds');
        }

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
          textAnswers: currentState.textAnswers,
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
      // Note: For question pool mode, clearing progress will cause new random selection on next load
      if (_currentProgressKey != null) {
        QuizProgressService.clearQuizProgress(_currentProgressKey!);
      }

      // Clear selected question IDs when resetting (new attempt gets new selection)
      _selectedQuestionIds = null;

      emit(QuizLoaded(
        questions: questions,
        answers: List.filled(questions.length, -1),
        textAnswers: List.filled(questions.length, ''),
        currentQuestionIndex: 0,
      ));
    }
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../course/data/models/course_model.dart';
import '../../../learning_path/data/models/learning_path_model.dart';
import '../bloc/quiz_bloc.dart';
import '../../../../core/widgets/app_loader.dart';
import '../../../../core/widgets/celebration_animation.dart';
import '../../../../core/services/activity_logger.dart';

class QuizScreen extends StatefulWidget {
  final Course course;
  final String assignmentId;
  final String source; // 'learning_path', 'course_list', or 'course_details'
  final LearningPath? learningPath; // Required when source is 'learning_path'
  final Function(int score, bool passed) onQuizComplete;
  final VoidCallback onClose;

  const QuizScreen({
    super.key,
    required this.course,
    required this.assignmentId,
    this.source = 'course_list', // Default to course_list
    this.learningPath, // Optional, required when source is 'learning_path'
    required this.onQuizComplete,
    required this.onClose,
  });

  @override
  State<QuizScreen> createState() => _QuizScreenState();
}

class _QuizScreenState extends State<QuizScreen> {
  DateTime? _quizStartTime;
  int? _selectedAnswerIndex;
  bool _showFeedback = false;
  bool _showCelebration = false;

  /// Same side effects as "Review Course": refresh parent data and navigate home/learning path/course details.
  void _finishPassedQuizAndNavigate(BuildContext context, QuizResults state) {
    ActivityLogger.logQuizCompletion(
      courseId: widget.course.id,
      courseTitle: widget.course.title,
      assignmentId: widget.assignmentId,
      score: state.score,
      passed: state.passed,
    );
    ActivityLogger.logCourseCompletion(
      courseId: widget.course.id,
      courseTitle: widget.course.title,
      assignmentId: widget.assignmentId,
      score: state.score,
      passed: true,
    );
    widget.onQuizComplete(state.score, state.passed);

    Future.delayed(const Duration(milliseconds: 300), () {
      if (!context.mounted) return;

      if (widget.source == 'learning_path' && widget.learningPath != null) {
        context.pushReplacement(
          '/learning-path-progress',
          extra: {
            'learningPath': widget.learningPath,
            'returningFromQuiz': true,
          },
        );
      } else if (widget.source == 'course_details') {
        context.pushReplacement(
          '/course-details',
          extra: widget.course,
        );
      } else {
        if (context.canPop()) {
          context.pop();
          Future.delayed(const Duration(milliseconds: 100), () {
            if (context.mounted) {
              context.go('/home?returningFromQuiz=true');
            }
          });
        }
      }
    });
  }

  void _handleClosePressed() {
    final bloc = context.read<QuizBloc>();
    final state = bloc.state;
    if (state is QuizResults && state.passed) {
      _finishPassedQuizAndNavigate(context, state);
      return;
    }
    widget.onClose();
  }

  @override
  void initState() {
    super.initState();
    _quizStartTime = DateTime.now();
    // Load quiz questions when screen is initialized if bloc is in initial state
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        final bloc = context.read<QuizBloc>();
        if (bloc.state is QuizInitial) {
          bloc.add(LoadQuizQuestions(
            widget.course.id,
            progressKey: widget.assignmentId,
            randomizeQuestions: widget.course.randomizeQuestions ?? false,
            randomizeOptions: widget.course.randomizeOptions ?? false,
            useQuestionPool: widget.course.useQuestionPool ?? false,
            questionsToDisplay: widget.course.questionsToDisplay,
          ));
        }
      }
    });
  }

  String _formatDuration(Duration duration) {
    String twoDigits(int n) => n.toString().padLeft(2, '0');
    final minutes = twoDigits(duration.inMinutes.remainder(60));
    final seconds = twoDigits(duration.inSeconds.remainder(60));
    return '$minutes:$seconds';
  }

  /// Build True/False button widget
  Widget _buildTrueFalseButton({
    required BuildContext context,
    required String label,
    required int index,
    required bool isSelected,
    required bool isCorrect,
    required bool hasAnswered,
    required VoidCallback? onTap,
  }) {
    Color borderColor = Colors.grey[300]!;
    Color backgroundColor = Colors.white;
    Color textColor = Colors.black87;
    Widget? icon;

    if (hasAnswered) {
      if (isCorrect) {
        borderColor = Colors.green;
        backgroundColor = Colors.green[50]!;
        textColor = Colors.green[900]!;
        icon = const Icon(Icons.check_circle, color: Colors.green, size: 28);
      } else if (isSelected && !isCorrect) {
        borderColor = Colors.red;
        backgroundColor = Colors.red[50]!;
        textColor = Colors.red[900]!;
        icon = const Icon(Icons.cancel, color: Colors.red, size: 28);
      } else {
        borderColor = Colors.grey[300]!;
        backgroundColor = Colors.grey[50]!;
        textColor = Colors.grey[600]!;
      }
    } else if (isSelected) {
      borderColor = const Color(0xFF2C6EF2);
      backgroundColor = const Color(0xFF2C6EF2).withOpacity(0.1);
      textColor = const Color(0xFF2C6EF2);
    }

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
        decoration: BoxDecoration(
          color: backgroundColor,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: borderColor,
            width: 3,
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              icon,
              const SizedBox(height: 12),
            ],
            Text(
              label,
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: textColor,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Build fill-in-the-blank text input widget
  Widget _buildFillInTheBlankInput({
    required BuildContext context,
    required int questionIndex,
    required String currentAnswer,
    required bool hasAnswered,
    required bool isCorrect,
    required List<String> correctAnswers,
  }) {
    final textController = TextEditingController(text: currentAnswer);
    if (hasAnswered) {
      textController.text = currentAnswer;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: hasAnswered
                ? (isCorrect ? Colors.green[50] : Colors.red[50])
                : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: hasAnswered
                  ? (isCorrect ? Colors.green : Colors.red)
                  : Colors.grey[300]!,
              width: 2,
            ),
          ),
          child: Row(
            children: [
              if (hasAnswered) ...[
                Icon(
                  isCorrect ? Icons.check_circle : Icons.cancel,
                  color: isCorrect ? Colors.green : Colors.red,
                  size: 24,
                ),
                const SizedBox(width: 12),
              ],
              Expanded(
                child: TextField(
                  controller: textController,
                  enabled: !hasAnswered,
                  decoration: InputDecoration(
                    hintText: 'Type your answer here...',
                    border: InputBorder.none,
                    hintStyle: TextStyle(color: Colors.grey[400]),
                  ),
                  style: const TextStyle(
                    fontSize: 16,
                    color: Colors.black87,
                  ),
                  onChanged: (value) {
                    if (!hasAnswered) {
                      context.read<QuizBloc>().add(SelectTextAnswer(
                            questionIndex: questionIndex,
                            textAnswer: value,
                          ));
                    }
                  },
                ),
              ),
            ],
          ),
        ),
        if (hasAnswered) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.grey[100],
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isCorrect ? 'Correct!' : 'Incorrect',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: isCorrect ? Colors.green[700] : Colors.red[700],
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Your answer: "$currentAnswer"',
                  style: const TextStyle(
                    fontSize: 13,
                    color: Colors.black87,
                  ),
                ),
                if (correctAnswers.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    'Correct answer(s): ${correctAnswers.join(", ")}',
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.grey[700],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<QuizBloc, QuizState>(
      builder: (context, state) {
        final blockPopForPassedQuiz =
            state is QuizResults && state.passed;

        Widget child;
        if (state is QuizInitial) {
          // Show loading while quiz questions are being loaded
          child = const Scaffold(
            backgroundColor: Color(0xFFF6F7FB),
            body: LoadingWidget(
              message: 'Loading quiz...',
            ),
          );
        } else if (state is QuizLoading) {
          child = const Scaffold(
            backgroundColor: Color(0xFFF6F7FB),
            body: LoadingWidget(
              message: 'Loading quiz...',
            ),
          );
        } else if (state is QuizError) {
          child = SafeArea(
            child: Scaffold(
              backgroundColor: const Color(0xFFF6F7FB),
              appBar: AppBar(
                leading: IconButton(
                  icon: const Icon(Icons.close, color: Colors.black87),
                  onPressed: _handleClosePressed,
                ),
                backgroundColor: Colors.white,
                elevation: 0,
              ),
              body: Center(
                child: Padding(
                  padding: const EdgeInsets.all(20.0),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        state.message,
                        style: const TextStyle(
                          fontSize: 16,
                          color: Colors.red,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 20),
                      ElevatedButton(
                        onPressed: _handleClosePressed,
                        child: const Text('Close'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        } else if (state is QuizResults) {
          child = _buildResultsView(context, state);
        } else if (state is QuizLoaded) {
          child = _buildQuizView(context, state);
        } else if (state is QuizSubmitting) {
          child = const Scaffold(
            backgroundColor: Color(0xFFF6F7FB),
            body: LoadingWidget(
              message: 'Submitting quiz...',
            ),
          );
        } else {
          child = Scaffold(
            backgroundColor: const Color(0xFFF6F7FB),
            body: Center(
              child: Text(
                'Unknown state: ${state.runtimeType}',
              ),
            ),
          );
        }

        return PopScope(
          canPop: !blockPopForPassedQuiz,
          onPopInvokedWithResult: (didPop, result) {
            if (didPop) return;
            if (state is QuizResults && state.passed) {
              _finishPassedQuizAndNavigate(context, state);
            }
          },
          child: child,
        );
      },
    );
  }

  Widget _buildResultsView(BuildContext context, QuizResults state) {
    if (state.questions.isEmpty || state.answers.isEmpty) {
      return Scaffold(
        backgroundColor: const Color(0xFFF6F7FB),
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.close, color: Colors.black87),
            onPressed: _handleClosePressed,
          ),
          backgroundColor: Colors.white,
          elevation: 0,
        ),
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(20.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text(
                    'No quiz data available.',
                    style: TextStyle(
                      fontSize: 16,
                      color: Colors.red,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    onPressed: _handleClosePressed,
                    child: const Text('Close'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    // Calculate correct count - handle both index-based and text-based answers
    int correctCount = 0;
    for (int i = 0; i < state.questions.length; i++) {
      final question = state.questions[i];
      if (question.isFillBlank) {
        final textAnswer =
            i < state.textAnswers.length ? state.textAnswers[i] : '';
        if (textAnswer.isNotEmpty &&
            question.isFillBlankAnswerCorrect(textAnswer)) {
          correctCount++;
        }
      } else {
        final answer = i < state.answers.length ? state.answers[i] : -1;
        if (answer == question.correctAnswer) {
          correctCount++;
        }
      }
    }
    final incorrectCount = state.questions.length - correctCount;
    final timeTaken = _quizStartTime != null
        ? DateTime.now().difference(_quizStartTime!)
        : const Duration(seconds: 0);

    // Trigger celebration animation when quiz is passed
    if (state.passed && !_showCelebration) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          setState(() {
            _showCelebration = true;
          });
        }
      });
    }

    return CelebrationAnimation(
      isActive: state.passed && _showCelebration,
      child: Scaffold(
        backgroundColor: const Color(0xFFF6F7FB),
        appBar: AppBar(
          leading: const SizedBox(),
          actions: [
            IconButton(
              icon: const Icon(Icons.close, color: Colors.black87, size: 24),
              onPressed: _handleClosePressed,
            ),
          ],
          title: Text(
            'Results: ${widget.course.title}',
            style: const TextStyle(
              color: Colors.black87,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
          backgroundColor: Colors.white,
          elevation: 0,
        ),
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                // Main Result Card
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.05),
                        blurRadius: 20,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      // Circular Progress with Success Icon Animation
                      SizedBox(
                        width: 140,
                        height: 140,
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            SizedBox(
                              width: 150,
                              height: 150,
                              child: CircularProgressIndicator(
                                value: state.score / 100,
                                strokeWidth: 12,
                                backgroundColor: const Color(0xFFE0E0E0),
                                valueColor: AlwaysStoppedAnimation<Color>(
                                  state.passed
                                      ? Colors.green
                                      : const Color(0xFF2C6EF2),
                                ),
                              ),
                            ),
                            Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                if (state.passed)
                                  SuccessIconAnimation(
                                    isActive: _showCelebration,
                                    child: Container(
                                      width: 50,
                                      height: 50,
                                      decoration: BoxDecoration(
                                        color: Colors.green,
                                        shape: BoxShape.circle,
                                        boxShadow: [
                                          BoxShadow(
                                            color:
                                                Colors.green.withOpacity(0.3),
                                            blurRadius: 15,
                                            spreadRadius: 2,
                                          ),
                                        ],
                                      ),
                                      child: const Icon(
                                        Icons.check,
                                        color: Colors.white,
                                        size: 30,
                                      ),
                                    ),
                                  )
                                else
                                  Text(
                                    '${state.score}%',
                                    style: const TextStyle(
                                      fontSize: 25,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.black87,
                                    ),
                                  ),
                                const SizedBox(height: 4),
                                Text(
                                  state.passed ? 'Passed' : 'Failed',
                                  style: TextStyle(
                                    fontSize: 15,
                                    color: state.passed
                                        ? Colors.green
                                        : Colors.grey[600],
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 10),
                      AnimatedDefaultTextStyle(
                        duration: const Duration(milliseconds: 300),
                        style: TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.bold,
                          color:
                              state.passed ? Colors.green[700] : Colors.black87,
                        ),
                        child: Text(
                          state.passed ? 'Congratulations!' : 'Keep Trying!',
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        state.passed
                            ? 'You have successfully passed the quiz and demonstrated a strong understanding of the material.'
                            : 'You did not pass this quiz. Review the material and try again.',
                        style: TextStyle(
                          fontSize: 16,
                          color: Colors.grey[600],
                          height: 1.5,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 15),
                // Stats Cards
                Column(
                  children: [
                    _buildStatCard(
                      'Correct',
                      '$correctCount / ${state.questions.length}',
                      Colors.green,
                    ),
                    const SizedBox(height: 12),
                    _buildStatCard(
                      'Incorrect',
                      '$incorrectCount / ${state.questions.length}',
                      Colors.red,
                    ),
                    const SizedBox(height: 12),
                    _buildStatCard(
                      'Time Taken',
                      _formatDuration(timeTaken),
                      Colors.black87,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        // MOVED BUTTONS TO BOTTOM NAVIGATION BAR
        bottomNavigationBar: SafeArea(
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border(
                top: BorderSide(color: Colors.grey[200]!),
              ),
            ),
            child: state.passed
                ? // If passed: Show only "Review Course" button
                SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () {
                        _finishPassedQuizAndNavigate(context, state);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF2C6EF2),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 15),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        elevation: 0,
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.refresh, size: 20),
                          SizedBox(width: 8),
                          Text(
                            'Review Course',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                : // If failed: Show both "Retake Quiz" and "Continue to Next Module" buttons
                Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Continue Button
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: () {
                            // Log quiz completion
                            ActivityLogger.logQuizCompletion(
                              courseId: widget.course.id,
                              courseTitle: widget.course.title,
                              assignmentId: widget.assignmentId,
                              score: state.score,
                              passed: state.passed,
                            );
                            
                            // Log course completion if quiz passed
                            if (state.passed) {
                              ActivityLogger.logCourseCompletion(
                                courseId: widget.course.id,
                                courseTitle: widget.course.title,
                                assignmentId: widget.assignmentId,
                                score: state.score,
                                passed: true,
                              );
                            }
                            
                            widget.onQuizComplete(state.score, state.passed);
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF2C6EF2),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 15),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            elevation: 0,
                          ),
                          child: const Text(
                            'Continue to Next Module',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      // Retake Button
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton(
                          onPressed: () {
                            context.read<QuizBloc>().add(const ResetQuiz());
                            setState(() {
                              _quizStartTime = DateTime.now();
                              _selectedAnswerIndex = null;
                              _showFeedback = false;
                            });
                          },
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: Color(0xFF2C6EF2)),
                            foregroundColor: const Color(0xFF2C6EF2),
                            padding: const EdgeInsets.symmetric(vertical: 15),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: const Text(
                            'Retake Quiz',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }

  Widget _buildStatCard(String label, String value, Color valueColor) {
    return SizedBox(
      width: double.infinity,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 10,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: const TextStyle(
                fontSize: 14,
                color: Color(0xFF424242),
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              value,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: valueColor,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuizView(BuildContext context, QuizLoaded state) {
    if (state.questions.isEmpty) {
      return Scaffold(
        backgroundColor: const Color(0xFFF6F7FB),
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.close, color: Colors.black87),
            onPressed: _handleClosePressed,
          ),
          title: Text(
            widget.course.title,
            style: const TextStyle(
              color: Colors.black87,
              fontSize: 18,
              fontWeight: FontWeight.w600,
            ),
          ),
          backgroundColor: Colors.white,
          elevation: 0,
        ),
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(20.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text(
                    'No questions available for this quiz.',
                    style: TextStyle(
                      fontSize: 16,
                      color: Colors.red,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    onPressed: _handleClosePressed,
                    child: const Text('Close'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }
    final safeIndex =
        state.currentQuestionIndex.clamp(0, state.questions.length - 1);
    final currentQuestion = state.questions[safeIndex];
    final isLastQuestion = safeIndex == state.questions.length - 1;
    final progress = ((safeIndex + 1) / state.questions.length * 100).round();
    final selectedAnswer =
        safeIndex < state.answers.length ? state.answers[safeIndex] : -1;
    final textAnswer = safeIndex < state.textAnswers.length
        ? state.textAnswers[safeIndex]
        : '';

    bool isCorrect;
    bool hasAnswered;

    if (currentQuestion.isFillBlank) {
      final hasTextAnswer = textAnswer.isNotEmpty;
      if (_selectedAnswerIndex != (hasTextAnswer ? 1 : -1)) {
        _selectedAnswerIndex = hasTextAnswer ? 1 : -1;
        _showFeedback = hasTextAnswer;
      }
      isCorrect =
          hasTextAnswer && currentQuestion.isFillBlankAnswerCorrect(textAnswer);
      hasAnswered = hasTextAnswer;
    } else {
      if (_selectedAnswerIndex != selectedAnswer) {
        _selectedAnswerIndex = selectedAnswer;
        _showFeedback = selectedAnswer != -1;
      }
      isCorrect = selectedAnswer == currentQuestion.correctAnswer;
      hasAnswered = selectedAnswer != -1;
    }
    return Scaffold(
      resizeToAvoidBottomInset: false,
      backgroundColor: const Color(0xFFF6F7FB),
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.close, color: Colors.black87, size: 24),
          onPressed: _handleClosePressed,
        ),
        title: Text(
          widget.course.title,
          style: const TextStyle(
            color: Colors.black87,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Progress Bar
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Question ${safeIndex + 1} of ${state.questions.length}',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    '$progress%',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              margin: const EdgeInsets.all(10),
              height: 10,
              width: double.infinity,
              decoration: BoxDecoration(
                color: Colors.black12,
                borderRadius: BorderRadius.circular(6),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: Stack(
                  children: [
                    FractionallySizedBox(
                      widthFactor: (safeIndex + 1) / state.questions.length,
                      alignment: Alignment.centerLeft,
                      child: Container(
                        height: 10,
                        decoration: BoxDecoration(
                          color: const Color(0xFF2C6EF2),
                          borderRadius: BorderRadius.circular(6),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF2C6EF2).withOpacity(0.3),
                              blurRadius: 4,
                              offset: const Offset(0, 1),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            // Content
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Question
                    Text(
                      currentQuestion.question,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 24),
                    // Answer Options - Show True/False buttons for T/F questions
                    if (currentQuestion.isTrueFalse) ...[
                      // True/False Question - Show two large buttons
                      Row(
                        children: [
                          // True Button
                          Expanded(
                            child: _buildTrueFalseButton(
                              context: context,
                              label: 'True',
                              index: 0,
                              isSelected: selectedAnswer == 0,
                              isCorrect: currentQuestion.correctAnswer == 0,
                              hasAnswered: hasAnswered,
                              onTap: hasAnswered
                                  ? null
                                  : () {
                                      context.read<QuizBloc>().add(SelectAnswer(
                                            questionIndex: safeIndex,
                                            answerIndex: 0,
                                          ));
                                      setState(() {
                                        _showFeedback = true;
                                      });
                                    },
                            ),
                          ),
                          const SizedBox(width: 16),
                          // False Button
                          Expanded(
                            child: _buildTrueFalseButton(
                              context: context,
                              label: 'False',
                              index: 1,
                              isSelected: selectedAnswer == 1,
                              isCorrect: currentQuestion.correctAnswer == 1,
                              hasAnswered: hasAnswered,
                              onTap: hasAnswered
                                  ? null
                                  : () {
                                      context.read<QuizBloc>().add(SelectAnswer(
                                            questionIndex: safeIndex,
                                            answerIndex: 1,
                                          ));
                                      setState(() {
                                        _showFeedback = true;
                                      });
                                    },
                            ),
                          ),
                        ],
                      ),
                    ] else if (currentQuestion.isFillBlank) ...[
                      // Fill-in-the-Blank Question - Show text input
                      _buildFillInTheBlankInput(
                        context: context,
                        questionIndex: safeIndex,
                        currentAnswer: safeIndex < state.textAnswers.length
                            ? state.textAnswers[safeIndex]
                            : '',
                        hasAnswered: hasAnswered,
                        isCorrect: hasAnswered && isCorrect,
                        correctAnswers: currentQuestion.acceptedAnswers,
                      ),
                    ] else ...[
                      // Multiple Choice Question - Show list of options
                      ...currentQuestion.options.asMap().entries.map((entry) {
                        final index = entry.key;
                        final option = entry.value;
                        final isSelected = selectedAnswer == index;
                        final isCorrectAnswer =
                            index == currentQuestion.correctAnswer;
                        Color borderColor = Colors.grey[300]!;
                        Color backgroundColor = Colors.white;
                        Widget? leftIcon;
                        Widget? rightIcon;
                        if (hasAnswered) {
                          if (isCorrectAnswer) {
                            borderColor = Colors.green;
                            backgroundColor = Colors.green[50]!;
                            leftIcon = const Icon(Icons.check_circle,
                                color: Colors.green, size: 24);
                            rightIcon = Container(
                              width: 24,
                              height: 24,
                              decoration: const BoxDecoration(
                                color: Colors.green,
                                shape: BoxShape.circle,
                              ),
                            );
                          } else if (isSelected && !isCorrectAnswer) {
                            borderColor = Colors.red;
                            backgroundColor = Colors.red[50]!;
                            leftIcon = const Icon(Icons.cancel,
                                color: Colors.red, size: 24);
                            rightIcon = Container(
                              width: 24,
                              height: 24,
                              decoration: BoxDecoration(
                                border: Border.all(color: Colors.red, width: 2),
                                shape: BoxShape.circle,
                              ),
                            );
                          } else {
                            rightIcon = Container(
                              width: 24,
                              height: 24,
                              decoration: BoxDecoration(
                                border: Border.all(
                                    color: Colors.grey[400]!, width: 2),
                                shape: BoxShape.circle,
                              ),
                            );
                          }
                        } else {
                          rightIcon = Container(
                            width: 24,
                            height: 24,
                            decoration: BoxDecoration(
                              border: Border.all(
                                  color: Colors.grey[400]!, width: 2),
                              shape: BoxShape.circle,
                            ),
                          );
                        }
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: InkWell(
                            onTap: hasAnswered
                                ? null
                                : () {
                                    context.read<QuizBloc>().add(SelectAnswer(
                                          questionIndex: safeIndex,
                                          answerIndex: index,
                                        ));
                                    setState(() {
                                      _showFeedback = true;
                                    });
                                  },
                            borderRadius: BorderRadius.circular(12),
                            child: Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: backgroundColor,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: borderColor,
                                  width: 2,
                                ),
                              ),
                              child: Row(
                                children: [
                                  if (leftIcon != null) ...[
                                    leftIcon,
                                    const SizedBox(width: 12),
                                  ],
                                  Expanded(
                                    child: Text(
                                      option,
                                      style: TextStyle(
                                        fontSize: 16,
                                        color: Colors.black87,
                                        fontWeight: isSelected
                                            ? FontWeight.w500
                                            : FontWeight.w500,
                                      ),
                                    ),
                                  ),
                                  rightIcon,
                                ],
                              ),
                            ),
                          ),
                        );
                      }),
                    ],
                    // Feedback Section
                    if (_showFeedback && hasAnswered) ...[
                      const SizedBox(height: 20),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: isCorrect
                              ? const Color(0xFFE8F5E9)
                              : const Color(0xFFFFEBEE),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isCorrect
                                ? Colors.green.withOpacity(0.3)
                                : Colors.red.withOpacity(0.3),
                            width: 1,
                          ),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              isCorrect ? Icons.check_circle : Icons.cancel,
                              color: isCorrect
                                  ? const Color(0xFF4CAF50)
                                  : const Color(0xFFF44336),
                              size: 24,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    isCorrect ? 'Correct!' : 'Incorrect',
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                      color: isCorrect
                                          ? const Color(0xFF4CAF50)
                                          : const Color(0xFFF44336),
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    _getExplanation(currentQuestion, isCorrect),
                                    style: const TextStyle(
                                      fontSize: 14,
                                      color: Color(0xFF424242),
                                      height: 1.5,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
      // MOVED CONTINUE BUTTON TO BOTTOM NAVIGATION BAR
      bottomNavigationBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border(
              top: BorderSide(color: Colors.grey[200]!),
            ),
          ),
          child: SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: hasAnswered
                  ? () {
                      if (isLastQuestion) {
                        print('=== QUIZ SUBMISSION STARTED ===');
                        print('Assignment ID: ${widget.assignmentId}');
                        print('Course: ${widget.course.title}');
                        print(
                            'Passing Score: ${widget.course.passingScore ?? 70}');
                        print('Current Question Index: $safeIndex');
                        print('Total Questions: ${state.questions.length}');
                        print('Selected Answers: ${state.answers}');
                        print('================================');
                        context.read<QuizBloc>().add(SubmitQuiz(
                              assignmentId: widget.assignmentId,
                              passingScore: widget.course.passingScore ?? 70,
                            ));
                      } else {
                        context.read<QuizBloc>().add(const NextQuestion());
                        setState(() {
                          _showFeedback = false;
                          _selectedAnswerIndex = null;
                        });
                      }
                    }
                  : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2C6EF2),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                elevation: 0,
              ),
              child: Text(
                isLastQuestion ? 'Finish Quiz' : 'Continue',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  String _getExplanation(dynamic quizQuestion, bool isCorrect) {
    if (isCorrect) {
      // Generate a generic explanation based on the question
      return 'Great job! You selected the correct answer. This demonstrates a good understanding of the concept.';
    } else {
      return 'That\'s not quite right. Review the material and try to understand why the correct answer is the best choice.';
    }
  }
}

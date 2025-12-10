import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../models/course_model.dart';
import '../bloc/quiz/quiz_bloc.dart';
import '../widgets/app_loader.dart';

class QuizScreen extends StatefulWidget {
  final Course course;
  final String assignmentId;
  final Function(int score, bool passed) onQuizComplete;
  final VoidCallback onClose;

  const QuizScreen({
    super.key,
    required this.course,
    required this.assignmentId,
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

  @override
  void initState() {
    super.initState();
    _quizStartTime = DateTime.now();
  }

  String _formatDuration(Duration duration) {
    String twoDigits(int n) => n.toString().padLeft(2, '0');
    final minutes = twoDigits(duration.inMinutes.remainder(60));
    final seconds = twoDigits(duration.inSeconds.remainder(60));
    return '$minutes:$seconds';
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<QuizBloc, QuizState>(
      builder: (context, state) {
        if (state is QuizLoading) {
          return const Scaffold(
            backgroundColor: Color(0xFFF6F7FB),
            body: LoadingWidget(
              message: 'Loading quiz...',
            ),
          );
        }

        if (state is QuizError) {
          return SafeArea(
            child: Scaffold(
              backgroundColor: const Color(0xFFF6F7FB),
              appBar: AppBar(
                leading: IconButton(
                  icon: const Icon(Icons.close, color: Colors.black87),
                  onPressed: widget.onClose,
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
                        onPressed: widget.onClose,
                        child: const Text('Close'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        }

        if (state is QuizResults) {
          return _buildResultsView(context, state);
        }

        if (state is QuizLoaded) {
          return _buildQuizView(context, state);
        }

        if (state is QuizSubmitting) {
          return const Scaffold(
            backgroundColor: Color(0xFFF6F7FB),
            body: LoadingWidget(
              message: 'Submitting quiz...',
            ),
          );
        }

        return Scaffold(
          backgroundColor: const Color(0xFFF6F7FB),
          body: Center(
            child: Text(
              'Unknown state: ${state.runtimeType}',
            ),
          ),
        );
      },
    );
  }

  Widget _buildResultsView1(BuildContext context, QuizResults state) {
    if (state.questions.isEmpty || state.answers.isEmpty) {
      return Scaffold(
        backgroundColor: const Color(0xFFF6F7FB),
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.close, color: Colors.black87),
            onPressed: widget.onClose,
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
                  onPressed: widget.onClose,
                  child: const Text('Close'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final correctCount = state.answers.asMap().entries.where((entry) {
      return entry.key < state.questions.length &&
          entry.value == state.questions[entry.key].correctAnswer;
    }).length;
    final incorrectCount = state.questions.length - correctCount;
    final timeTaken = _quizStartTime != null
        ? DateTime.now().difference(_quizStartTime!)
        : const Duration(seconds: 0);

    return Scaffold(
      backgroundColor: const Color(0xFFF6F7FB),
      appBar: AppBar(
        leading: const SizedBox(),
        actions: [
          IconButton(
            icon: const Icon(Icons.close, color: Colors.black87, size: 24),
            onPressed: widget.onClose,
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
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            // Main Result Card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
              ),
              child: Column(
                children: [
                  // Circular Progress
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
                            valueColor: const AlwaysStoppedAnimation<Color>(
                              Color(0xFF2C6EF2),
                            ),
                          ),
                        ),
                        Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              '${state.score}%',
                              style: const TextStyle(
                                fontSize: 25,
                                fontWeight: FontWeight.bold,
                                color: Colors.black87,
                              ),
                            ),
                            //const SizedBox(height: 4),
                            Text(
                              state.passed ? 'Passed' : 'Failed',
                              style: TextStyle(
                                fontSize: 15,
                                color: Colors.grey[600],
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'Great Job!',
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                    ),
                  ),
                  //  const SizedBox(height: 2),
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
            const SizedBox(height: 22),
            // Continue Button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  // Call onQuizComplete to refresh course list and show result
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
    );
  }
  Widget _buildResultsView(BuildContext context, QuizResults state) {
    if (state.questions.isEmpty || state.answers.isEmpty) {
      return Scaffold(
        backgroundColor: const Color(0xFFF6F7FB),
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.close, color: Colors.black87),
            onPressed: widget.onClose,
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
                    onPressed: widget.onClose,
                    child: const Text('Close'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    final correctCount = state.answers.asMap().entries.where((entry) {
      return entry.key < state.questions.length &&
          entry.value == state.questions[entry.key].correctAnswer;
    }).length;
    final incorrectCount = state.questions.length - correctCount;
    final timeTaken = _quizStartTime != null
        ? DateTime.now().difference(_quizStartTime!)
        : const Duration(seconds: 0);

    return Scaffold(
      backgroundColor: const Color(0xFFF6F7FB),
      appBar: AppBar(
        leading: const SizedBox(),
        actions: [
          IconButton(
            icon: const Icon(Icons.close, color: Colors.black87, size: 24),
            onPressed: widget.onClose,
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
                ),
                child: Column(
                  children: [
                    // Circular Progress
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
                              valueColor: const AlwaysStoppedAnimation<Color>(
                                Color(0xFF2C6EF2),
                              ),
                            ),
                          ),
                          Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                '${state.score}%',
                                style: const TextStyle(
                                  fontSize: 25,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.black87,
                                ),
                              ),
                              Text(
                                state.passed ? 'Passed' : 'Failed',
                                style: TextStyle(
                                  fontSize: 15,
                                  color: Colors.grey[600],
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'Great Job!',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                    ),
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
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Continue Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
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

  Widget _buildQuizView1(BuildContext context, QuizLoaded state) {
    if (state.questions.isEmpty) {
      return Scaffold(
        backgroundColor: const Color(0xFFF6F7FB),
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.close, color: Colors.black87),
            onPressed: widget.onClose,
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
        body: Center(
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
                  onPressed: widget.onClose,
                  child: const Text('Close'),
                ),
              ],
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

    // Reset feedback when question changes
    if (_selectedAnswerIndex != selectedAnswer) {
      _selectedAnswerIndex = selectedAnswer;
      _showFeedback = selectedAnswer != -1;
    }

    final isCorrect = selectedAnswer == currentQuestion.correctAnswer;
    final hasAnswered = selectedAnswer != -1;

    return Scaffold(
      backgroundColor: const Color(0xFFF6F7FB),
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.close, color: Colors.black87, size: 24),
          onPressed: widget.onClose,
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
      body: Column(
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

                    ///color: Colors.grey[600],
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  '$progress%',
                  style: const TextStyle(
                    fontSize: 14,
                    //color: Color(0xFF2C6EF2),
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          Container(
            margin: EdgeInsets.all(10),
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
                  // Answer Options
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
                        // Correct answer - green
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
                        // Wrong selected answer - red
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
                        // Unselected answer
                        rightIcon = Container(
                          width: 24,
                          height: 24,
                          decoration: BoxDecoration(
                            border:
                                Border.all(color: Colors.grey[400]!, width: 2),
                            shape: BoxShape.circle,
                          ),
                        );
                      }
                    } else {
                      // Not answered yet
                      rightIcon = Container(
                        width: 24,
                        height: 24,
                        decoration: BoxDecoration(
                          border:
                              Border.all(color: Colors.grey[400]!, width: 2),
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
                  // Feedback Section
                  if (_showFeedback && hasAnswered) ...[
                    const SizedBox(height: 10),
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
          // Continue Button
          Container(
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
                          print('Passing Score: ${widget.course.passingScore ?? 70}');
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
        ],
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
            onPressed: widget.onClose,
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
                    onPressed: widget.onClose,
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
    if (_selectedAnswerIndex != selectedAnswer) {
      _selectedAnswerIndex = selectedAnswer;
      _showFeedback = selectedAnswer != -1;
    }
    final isCorrect = selectedAnswer == currentQuestion.correctAnswer;
    final hasAnswered = selectedAnswer != -1;

    return Scaffold(
      resizeToAvoidBottomInset: false,
      backgroundColor: const Color(0xFFF6F7FB),
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.close, color: Colors.black87, size: 24),
          onPressed: widget.onClose,
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
                    // Answer Options
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
                              border:
                              Border.all(color: Colors.grey[400]!, width: 2),
                              shape: BoxShape.circle,
                            ),
                          );
                        }
                      } else {
                        rightIcon = Container(
                          width: 24,
                          height: 24,
                          decoration: BoxDecoration(
                            border:
                            Border.all(color: Colors.grey[400]!, width: 2),
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
                  print('Passing Score: ${widget.course.passingScore ?? 70}');
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

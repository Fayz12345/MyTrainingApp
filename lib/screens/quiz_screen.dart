import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../models/course_model.dart';
import '../bloc/quiz/quiz_bloc.dart';

class QuizScreen extends StatelessWidget {
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
  Widget build(BuildContext context) {
    return BlocBuilder<QuizBloc, QuizState>(
      builder: (context, state) {
        if (state is QuizLoading) {
          return Scaffold(
            body: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const CircularProgressIndicator(),
                  const SizedBox(height: 16),
                  Text(
                    'Loading quiz...',
                    style: TextStyle(
                      fontSize: 16,
                      color: Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),
          );
        }

        if (state is QuizError) {
          return Scaffold(
            appBar: AppBar(
              title: const Text('Quiz'),
              backgroundColor: const Color(0xFF007AFF),
              foregroundColor: Colors.white,
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
                      onPressed: onClose,
                      child: const Text('Close'),
                    ),
                  ],
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
          return Scaffold(
            body: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const CircularProgressIndicator(),
                  const SizedBox(height: 16),
                  Text(
                    'Submitting quiz...',
                    style: TextStyle(
                      fontSize: 16,
                      color: Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),
          );
        }

        return Scaffold(
          body: Center(
            child: Text(
              'Unknown state: ${state.runtimeType}',
            ),
          ),
        );
      },
    );
  }

  Widget _buildResultsView(BuildContext context, QuizResults state) {
    final passingScore = course.passingScore ?? 70;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: onClose,
        ),
        title: const Text('Quiz Results'),
        backgroundColor: const Color(0xFF007AFF),
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                color: state.passed ? Colors.green[50] : Colors.red[50],
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: state.passed ? Colors.green : Colors.red,
                  width: 2,
                ),
              ),
              child: Column(
                children: [
                  Text(
                    '${state.score}%',
                    style: const TextStyle(
                      fontSize: 48,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    state.passed ? '🎉 Congratulations!' : '📚 Keep Learning!',
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    state.passed
                        ? 'You passed with ${state.score}%! (Required: $passingScore%)'
                        : 'You scored ${state.score}%. You need $passingScore% to pass.',
                    style: TextStyle(
                      fontSize: 16,
                      color: Colors.grey[600],
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Quiz Summary',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Correct Answers: ${state.answers.asMap().entries.where((entry) => entry.value == state.questions[entry.key].correctAnswer).length} / ${state.questions.length}',
                    style: TextStyle(
                      fontSize: 16,
                      color: Colors.grey[600],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Passing Score: $passingScore%',
                    style: TextStyle(
                      fontSize: 16,
                      color: Colors.grey[600],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Status: ${state.passed ? 'PASSED ✅' : 'FAILED ❌'}',
                    style: TextStyle(
                      fontSize: 16,
                      color: Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            if (!state.passed)
              ElevatedButton(
                onPressed: () {
                  context.read<QuizBloc>().add(const ResetQuiz());
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.orange,
                  minimumSize: const Size(double.infinity, 50),
                ),
                child: const Text(
                  'Retake Quiz',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: () {
                onQuizComplete(state.score, state.passed);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF007AFF),
                minimumSize: const Size(double.infinity, 50),
              ),
              child: Text(
                state.passed ? 'Complete Training' : 'Close',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuizView(BuildContext context, QuizLoaded state) {
    final currentQuestion = state.questions[state.currentQuestionIndex];
    final isLastQuestion =
        state.currentQuestionIndex == state.questions.length - 1;
    final hasAnswered = state.answers[state.currentQuestionIndex] != -1;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: onClose,
        ),
        title: Text('Quiz: ${course.title}'),
        backgroundColor: const Color(0xFF007AFF),
        foregroundColor: Colors.white,
      ),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            color: Colors.white,
            child: Column(
              children: [
                Text(
                  'Question ${state.currentQuestionIndex + 1} of ${state.questions.length}',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey[600],
                  ),
                ),
                const SizedBox(height: 8),
                LinearProgressIndicator(
                  value:
                      (state.currentQuestionIndex + 1) / state.questions.length,
                  backgroundColor: Colors.grey[200],
                  valueColor:
                      const AlwaysStoppedAnimation<Color>(Color(0xFF007AFF)),
                ),
              ],
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    currentQuestion.question,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 24),
                  ...currentQuestion.options.asMap().entries.map((entry) {
                    final index = entry.key;
                    final option = entry.value;
                    final isSelected =
                        state.answers[state.currentQuestionIndex] == index;

                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: InkWell(
                        onTap: () {
                          context.read<QuizBloc>().add(SelectAnswer(
                                questionIndex: state.currentQuestionIndex,
                                answerIndex: index,
                              ));
                        },
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: isSelected ? Colors.blue[50] : Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isSelected
                                  ? const Color(0xFF007AFF)
                                  : Colors.grey[300]!,
                              width: 2,
                            ),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 32,
                                height: 32,
                                decoration: BoxDecoration(
                                  color: isSelected
                                      ? const Color(0xFF007AFF)
                                      : Colors.grey[300],
                                  shape: BoxShape.circle,
                                ),
                                child: Center(
                                  child: Text(
                                    String.fromCharCode(65 + index),
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.bold,
                                      color: isSelected
                                          ? Colors.white
                                          : Colors.grey[700],
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  option,
                                  style: TextStyle(
                                    fontSize: 16,
                                    color: isSelected
                                        ? const Color(0xFF007AFF)
                                        : Colors.black87,
                                    fontWeight: isSelected
                                        ? FontWeight.w500
                                        : FontWeight.normal,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  }),
                ],
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border(
                top: BorderSide(color: Colors.grey[300]!),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                ElevatedButton(
                  onPressed: state.currentQuestionIndex > 0
                      ? () {
                          context
                              .read<QuizBloc>()
                              .add(const PreviousQuestion());
                        }
                      : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.grey[200],
                    foregroundColor: Colors.black87,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 24,
                      vertical: 12,
                    ),
                  ),
                  child: const Text('Previous'),
                ),
                ElevatedButton(
                  onPressed: hasAnswered
                      ? () {
                          if (isLastQuestion) {
                            context.read<QuizBloc>().add(SubmitQuiz(
                                  assignmentId: assignmentId,
                                  passingScore: course.passingScore ?? 70,
                                ));
                          } else {
                            context.read<QuizBloc>().add(const NextQuestion());
                          }
                        }
                      : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF007AFF),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 24,
                      vertical: 12,
                    ),
                  ),
                  child: Text(isLastQuestion ? 'Finish Quiz' : 'Next'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { generateClient } from 'aws-amplify/data';
import { getCurrentUser } from 'aws-amplify/auth';
import type { Schema } from '../amplify/data/resource';

const client = generateClient<Schema>();

type Props = {
  course: Schema['Course']['type'];
  assignmentId: string;
  onQuizComplete: (score: number, passed: boolean) => void;
  onClose: () => void;
};

type QuizQuestion = Schema['QuizQuestion']['type'];

export function QuizScreen({ course, assignmentId, onQuizComplete, onClose }: Props) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const { data: quizQuestions, errors } = await client.models.QuizQuestion.list({
          filter: { courseId: { eq: course.id } }
        });

        if (errors) {
          setError('Failed to load quiz questions');
          return;
        }

        if (!quizQuestions || quizQuestions.length === 0) {
          setError('No quiz questions available for this course');
          return;
        }

        setQuestions(quizQuestions);
        setAnswers(new Array(quizQuestions.length).fill(-1));
        setLoading(false);
      } catch (err) {
        console.error('Error loading quiz:', err);
        setError('Failed to load quiz');
      }
    };

    loadQuestions();
  }, [course.id]);

  const handleAnswerSelect = (answerIndex: number) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = answerIndex;
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      finishQuiz();
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const finishQuiz = async () => {
    // Calculate score
    let correctAnswers = 0;
    questions.forEach((question, index) => {
      if (answers[index] === question.correctAnswer) {
        correctAnswers++;
      }
    });

    const finalScore = Math.round((correctAnswers / questions.length) * 100);
    const passingScore = course.passingScore || 70;
    const passed = finalScore >= passingScore;

    setScore(finalScore);
    setShowResults(true);

    // Save result to database
    try {
      await client.models.Result.create({
        assignmentId: assignmentId,
        score: finalScore,
        passed: passed,
      });

      // Update assignment status if passed
      if (passed) {
        await client.models.Assignment.update({
          id: assignmentId,
          status: 'completed'
        });
      }
    } catch (err) {
      console.error('Error saving quiz result:', err);
    }

    onQuizComplete(finalScore, passed);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading quiz...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={onClose}>
          <Text style={styles.buttonText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (showResults) {
    const passingScore = course.passingScore || 70;
    const passed = score >= passingScore;

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Quiz Results</Text>
        </View>

        <View style={styles.resultsContainer}>
          <View style={[styles.scoreContainer, passed ? styles.passedContainer : styles.failedContainer]}>
            <Text style={styles.scoreText}>{score}%</Text>
            <Text style={styles.resultText}>
              {passed ? '🎉 Congratulations!' : '📚 Keep Learning!'}
            </Text>
            <Text style={styles.resultSubtext}>
              {passed 
                ? `You passed with ${score}%! (Required: ${passingScore}%)`
                : `You scored ${score}%. You need ${passingScore}% to pass.`
              }
            </Text>
          </View>

          <View style={styles.summaryContainer}>
            <Text style={styles.summaryTitle}>Quiz Summary</Text>
            <Text style={styles.summaryText}>
              Correct Answers: {answers.filter((answer, index) => answer === questions[index].correctAnswer).length} / {questions.length}
            </Text>
            <Text style={styles.summaryText}>
              Passing Score: {passingScore}%
            </Text>
            <Text style={styles.summaryText}>
              Status: {passed ? 'PASSED ✅' : 'FAILED ❌'}
            </Text>
          </View>

          <View style={styles.actionContainer}>
            {!passed && (
              <TouchableOpacity 
                style={[styles.button, styles.retryButton]} 
                onPress={() => {
                  setCurrentQuestionIndex(0);
                  setAnswers(new Array(questions.length).fill(-1));
                  setShowResults(false);
                  setScore(0);
                }}
              >
                <Text style={styles.buttonText}>Retake Quiz</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity style={styles.button} onPress={onClose}>
              <Text style={styles.buttonText}>
                {passed ? 'Complete Training' : 'Close'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const hasAnswered = answers[currentQuestionIndex] !== -1;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quiz: {course.title}</Text>
      </View>

      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          Question {currentQuestionIndex + 1} of {questions.length}
        </Text>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }
            ]} 
          />
        </View>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.questionContainer}>
          <Text style={styles.questionText}>{currentQuestion.question}</Text>
          
          <View style={styles.optionsContainer}>
            {currentQuestion.options?.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.optionButton,
                  answers[currentQuestionIndex] === index && styles.selectedOption
                ]}
                onPress={() => handleAnswerSelect(index)}
              >
                <View style={styles.optionContent}>
                  <View style={[
                    styles.optionIndicator,
                    answers[currentQuestionIndex] === index && styles.selectedIndicator
                  ]}>
                    <Text style={styles.optionLetter}>
                      {String.fromCharCode(65 + index)}
                    </Text>
                  </View>
                  <Text style={[
                    styles.optionText,
                    answers[currentQuestionIndex] === index && styles.selectedOptionText
                  ]}>
                    {option}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.navigationContainer}>
        <TouchableOpacity
          style={[styles.navButton, currentQuestionIndex === 0 && styles.disabledButton]}
          onPress={handlePrevious}
          disabled={currentQuestionIndex === 0}
        >
          <Text style={[styles.navButtonText, currentQuestionIndex === 0 && styles.disabledText]}>
            Previous
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, styles.nextButton, !hasAnswered && styles.disabledButton]}
          onPress={handleNext}
          disabled={!hasAnswered}
        >
          <Text style={[styles.nextButtonText, !hasAnswered && styles.disabledText]}>
            {isLastQuestion ? 'Finish Quiz' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginRight: 34, // Compensate for close button
  },
  progressContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  content: {
    flex: 1,
  },
  questionContainer: {
    padding: 20,
  },
  questionText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 24,
    lineHeight: 28,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    padding: 16,
  },
  selectedOption: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  selectedIndicator: {
    backgroundColor: '#007AFF',
  },
  optionLetter: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  selectedOptionText: {
    color: '#007AFF',
    fontWeight: '500',
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  navButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    minWidth: 100,
    alignItems: 'center',
  },
  nextButton: {
    backgroundColor: '#007AFF',
  },
  disabledButton: {
    backgroundColor: '#f0f0f0',
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  nextButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  disabledText: {
    color: '#999',
  },
  resultsContainer: {
    flex: 1,
    padding: 20,
  },
  scoreContainer: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 16,
    marginBottom: 24,
  },
  passedContainer: {
    backgroundColor: '#e8f5e8',
    borderColor: '#28a745',
    borderWidth: 2,
  },
  failedContainer: {
    backgroundColor: '#fff5f5',
    borderColor: '#dc3545',
    borderWidth: 2,
  },
  scoreText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  resultText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  resultSubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  summaryContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  actionContainer: {
    gap: 12,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: '#ffc107',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#dc3545',
    textAlign: 'center',
    marginBottom: 20,
  },
});
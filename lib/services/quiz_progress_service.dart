import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';

class QuizProgressService {
  static const String _progressPrefix = 'quiz_progress_';
  static const String _answersPrefix = 'quiz_answers_';

  /// Save quiz progress (current question index and answers)
  static Future<void> saveQuizProgress({
    required String courseId,
    required int currentQuestionIndex,
    required List<int> answers,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setInt('$_progressPrefix$courseId', currentQuestionIndex);
      await prefs.setString('$_answersPrefix$courseId', jsonEncode(answers));
      print('>>> QuizProgressService: Saved progress for course $courseId: question $currentQuestionIndex, answers: $answers');
    } catch (e) {
      print('>>> QuizProgressService: Error saving progress: $e');
    }
  }

  /// Get saved quiz progress
  static Future<Map<String, dynamic>?> getQuizProgress(String courseId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final questionIndex = prefs.getInt('$_progressPrefix$courseId');
      final answersJson = prefs.getString('$_answersPrefix$courseId');
      
      if (questionIndex != null && answersJson != null) {
        final answers = List<int>.from(jsonDecode(answersJson) as List);
        print('>>> QuizProgressService: Loaded progress for course $courseId: question $questionIndex, answers: $answers');
        return {
          'currentQuestionIndex': questionIndex,
          'answers': answers,
        };
      }
      print('>>> QuizProgressService: No saved progress for course $courseId');
      return null;
    } catch (e) {
      print('>>> QuizProgressService: Error loading progress: $e');
      return null;
    }
  }

  /// Clear quiz progress (when quiz is completed or reset)
  static Future<void> clearQuizProgress(String courseId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('$_progressPrefix$courseId');
      await prefs.remove('$_answersPrefix$courseId');
      print('>>> QuizProgressService: Cleared progress for course $courseId');
    } catch (e) {
      print('>>> QuizProgressService: Error clearing progress: $e');
    }
  }
}




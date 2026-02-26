import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';

class QuizProgressService {
  static const String _progressPrefix = 'quiz_progress_';
  static const String _answersPrefix = 'quiz_answers_';
  static const String _questionOrderPrefix =
      'quiz_question_order_'; // For randomized questions
  static const String _optionOrdersPrefix =
      'quiz_option_orders_'; // For randomized answer options
  static const String _textAnswersPrefix =
      'quiz_text_answers_'; // For fill-in-the-blank questions
  static const String _selectedQuestionIdsPrefix =
      'quiz_selected_question_ids_'; // For question pool mode

  /// Save quiz progress (current question index and answers)
  /// Also saves question order mapping and option orders if randomized
  static Future<void> saveQuizProgress({
    required String courseId,
    required int currentQuestionIndex,
    required List<int> answers,
    List<String>? textAnswers, // Text answers for fill-in-the-blank questions
    List<int>? questionOrder, // Original index -> shuffled index mapping
    List<List<int>>? optionOrders, // Option order mappings for each question
    List<String>? selectedQuestionIds, // Selected question IDs from pool
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setInt('$_progressPrefix$courseId', currentQuestionIndex);
      await prefs.setString('$_answersPrefix$courseId', jsonEncode(answers));

      // Save text answers if provided (for fill-in-the-blank questions)
      if (textAnswers != null) {
        await prefs.setString(
            '$_textAnswersPrefix$courseId', jsonEncode(textAnswers));
        print(
            '>>> QuizProgressService: Saved text answers for course $courseId: ${textAnswers.length} answers');
      }

      // Save question order mapping if provided (for randomized quizzes)
      if (questionOrder != null) {
        await prefs.setString(
            '$_questionOrderPrefix$courseId', jsonEncode(questionOrder));
        print(
            '>>> QuizProgressService: Saved question order mapping for course $courseId: $questionOrder');
      }

      // Save option orders if provided (for randomized options)
      if (optionOrders != null) {
        await prefs.setString(
            '$_optionOrdersPrefix$courseId', jsonEncode(optionOrders));
        print(
            '>>> QuizProgressService: Saved option orders for course $courseId: ${optionOrders.length} questions');
      }

      // Save selected question IDs if provided (for question pool mode)
      if (selectedQuestionIds != null) {
        await prefs.setString('$_selectedQuestionIdsPrefix$courseId',
            jsonEncode(selectedQuestionIds));
        print(
            '>>> QuizProgressService: Saved selected question IDs for course $courseId: ${selectedQuestionIds.length} questions');
      }

      print(
          '>>> QuizProgressService: Saved progress for course $courseId: question $currentQuestionIndex, answers: $answers');
    } catch (e) {
      print('>>> QuizProgressService: Error saving progress: $e');
    }
  }

  /// Get saved quiz progress
  /// Returns progress with question order mapping and option orders if available
  static Future<Map<String, dynamic>?> getQuizProgress(String courseId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final questionIndex = prefs.getInt('$_progressPrefix$courseId');
      final answersJson = prefs.getString('$_answersPrefix$courseId');
      final questionOrderJson =
          prefs.getString('$_questionOrderPrefix$courseId');
      final optionOrdersJson = prefs.getString('$_optionOrdersPrefix$courseId');
      final textAnswersJson = prefs.getString('$_textAnswersPrefix$courseId');
      final selectedQuestionIdsJson =
          prefs.getString('$_selectedQuestionIdsPrefix$courseId');

      if (questionIndex != null && answersJson != null) {
        final answers = List<int>.from(jsonDecode(answersJson) as List);
        List<int>? questionOrder;
        List<List<int>>? optionOrders;
        List<String>? textAnswers;
        List<String>? selectedQuestionIds;

        if (questionOrderJson != null) {
          questionOrder = List<int>.from(jsonDecode(questionOrderJson) as List);
          print(
              '>>> QuizProgressService: Loaded question order mapping for course $courseId: $questionOrder');
        }

        if (optionOrdersJson != null) {
          final decoded = jsonDecode(optionOrdersJson) as List;
          optionOrders = decoded
              .map((orderList) => List<int>.from(orderList as List))
              .toList();
          print(
              '>>> QuizProgressService: Loaded option orders for course $courseId: ${optionOrders.length} questions');
        }

        if (textAnswersJson != null) {
          final decoded = jsonDecode(textAnswersJson) as List;
          textAnswers = decoded.map((a) => a?.toString() ?? '').toList();
          print(
              '>>> QuizProgressService: Loaded text answers for course $courseId: ${textAnswers.length} answers');
        }

        if (selectedQuestionIdsJson != null) {
          final decoded = jsonDecode(selectedQuestionIdsJson) as List;
          selectedQuestionIds = decoded
              .map((id) => id?.toString() ?? '')
              .where((id) => id.isNotEmpty)
              .toList();
          print(
              '>>> QuizProgressService: Loaded selected question IDs for course $courseId: ${selectedQuestionIds.length} questions');
        }

        print(
            '>>> QuizProgressService: Loaded progress for course $courseId: question $questionIndex, answers: $answers');
        return {
          'currentQuestionIndex': questionIndex,
          'answers': answers,
          'textAnswers': textAnswers, // Text answers for fill-in-the-blank
          'questionOrder': questionOrder, // Original -> shuffled mapping
          'optionOrders':
              optionOrders, // Option order mappings for each question
          'selectedQuestionIds':
              selectedQuestionIds, // Selected question IDs from pool
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
      await prefs
          .remove('$_textAnswersPrefix$courseId'); // Also clear text answers
      await prefs.remove(
          '$_questionOrderPrefix$courseId'); // Also clear question order
      await prefs
          .remove('$_optionOrdersPrefix$courseId'); // Also clear option orders
      await prefs.remove(
          '$_selectedQuestionIdsPrefix$courseId'); // Also clear selected question IDs
      print('>>> QuizProgressService: Cleared progress for course $courseId');
    } catch (e) {
      print('>>> QuizProgressService: Error clearing progress: $e');
    }
  }
}

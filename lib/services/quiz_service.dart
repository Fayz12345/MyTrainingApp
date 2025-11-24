import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:amplify_api/amplify_api.dart';
import '../models/quiz_question_model.dart';
import 'dart:convert';

class QuizService {
  static Future<List<QuizQuestion>> getQuizQuestions(String courseId) async {
    try {
      const query = '''
        query GetQuizQuestions(\$courseId: ID!) {
          listQuizQuestions(filter: { courseId: { eq: \$courseId } }) {
            items {
              id
              courseId
              question
              options
              correctAnswer
              createdAt
              updatedAt
            }
          }
        }
      ''';

      final request = GraphQLRequest<String>(
        document: query,
        variables: {'courseId': courseId},
      );

      final response = await Amplify.API.query(request: request).response;
      final data = jsonDecode(response.data ?? '{}') as Map<String, dynamic>;

      final questions = data['listQuizQuestions']?['items'] as List?;
      if (questions == null) {
        return [];
      }

      return questions
          .map((q) => QuizQuestion.fromJson(q as Map<String, dynamic>))
          .toList();
    } catch (e) {
      safePrint('Error fetching quiz questions: $e');
      rethrow;
    }
  }

  static Future<void> saveQuizResult({
    required String assignmentId,
    required int score,
    required bool passed,
  }) async {
    try {
      const mutation = '''
        mutation CreateResult(\$input: CreateResultInput!) {
          createResult(input: \$input) {
            id
            score
            passed
          }
        }
      ''';

      final request = GraphQLRequest<String>(
        document: mutation,
        variables: {
          'input': {
            'assignmentId': assignmentId,
            'score': score,
            'passed': passed,
          },
        },
      );

      await Amplify.API.mutate(request: request).response;

      // Update assignment status if passed
      if (passed) {
        const updateMutation = '''
          mutation UpdateAssignment(\$input: UpdateAssignmentInput!) {
            updateAssignment(input: \$input) {
              id
              status
            }
          }
        ''';

        final updateRequest = GraphQLRequest<String>(
          document: updateMutation,
          variables: {
            'input': {
              'id': assignmentId,
              'status': 'completed',
            },
          },
        );

        await Amplify.API.mutate(request: updateRequest).response;
      }
    } catch (e) {
      safePrint('Error saving quiz result: $e');
      rethrow;
    }
  }
}

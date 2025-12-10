import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:amplify_api/amplify_api.dart';
import '../models/quiz_question_model.dart';
import 'dart:convert';

class QuizService {
  static Future<List<QuizQuestion>> getQuizQuestions(String courseId) async {
    print("Course list $courseId");
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
    print('>>> QuizService: saveQuizResult called');
    print('>>>   Assignment ID: $assignmentId');
    print('>>>   Score: $score');
    print('>>>   Passed: $passed');

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

      final inputData = {
        'assignmentId': assignmentId,
        'score': score,
        'passed': passed,
      };

      print('>>> Creating GraphQL request for CreateResult...');
      print('>>>   Mutation variables: $inputData');

      final request = GraphQLRequest<String>(
        document: mutation,
        variables: {
          'input': inputData,
        },
      );

      print('>>> Executing CreateResult mutation...');
      final response = await Amplify.API.mutate(request: request).response;
      print('>>> CreateResult mutation response: ${response.data}');

      // Check for errors in result creation
      if (response.errors.isNotEmpty) {
        print('>>> ERROR in CreateResult mutation:');
        for (final error in response.errors) {
          print('>>>   - ${error.message}');
        }
        throw Exception(
            'Failed to create result: ${response.errors.first.message}');
      }

      // Parse response to verify result was created
      final responseData =
          jsonDecode(response.data ?? '{}') as Map<String, dynamic>;
      final resultData = responseData['createResult'] as Map<String, dynamic>?;

      if (resultData == null) {
        throw Exception('Failed to create result: Response data is null');
      }

      print('>>> CreateResult mutation completed successfully');
      print('>>> Result ID: ${resultData['id']}');

      // Update assignment if passed (employees have update permission)
      // Only update if result was created successfully (matching React behavior)
      if (passed && resultData.isNotEmpty) {
        print('>>> Quiz passed! Updating assignment status to completed...');
        const updateMutation = '''
          mutation UpdateAssignment(\$input: UpdateAssignmentInput!) {
            updateAssignment(input: \$input) {
              id
              status
              isTrainingComplete
            }
          }
        ''';

        final updateInputData = <String, dynamic>{
          'id': assignmentId,
          'status': 'completed',
          'isTrainingComplete': true,
        };

        // Note: trainingCompletedAt field is not included because it's not in the deployed schema
        // After redeploying the schema with trainingCompletedAt field, you can add it back:
        // 'trainingCompletedAt': DateTime.now().toUtc().toIso8601String(),

        print('>>> Creating GraphQL request for UpdateAssignment...');
        print('>>>   Mutation variables: $updateInputData');

        final updateRequest = GraphQLRequest<String>(
          document: updateMutation,
          variables: {
            'input': updateInputData,
          },
        );

        print('>>> Executing UpdateAssignment mutation...');
        final updateResponse =
            await Amplify.API.mutate(request: updateRequest).response;
        print('>>> UpdateAssignment mutation response: ${updateResponse.data}');

        // Check for errors
        if (updateResponse.errors.isNotEmpty) {
          print('>>> ERROR in UpdateAssignment mutation:');
          for (final error in updateResponse.errors) {
            print('>>>   - ${error.message}');
            print('>>>   - Error type: ${error.errorType}');
            print('>>>   - Path: ${error.path}');
          }
          safePrint(
              'Error updating assignment status: ${updateResponse.errors}');
          // Throw error to surface the issue (matching React behavior)
          throw Exception(
              'Failed to update assignment: ${updateResponse.errors.first.message}');
        } else {
          // Parse response to verify update was successful
          final updateResponseData =
              jsonDecode(updateResponse.data ?? '{}') as Map<String, dynamic>;
          final updatedAssignment =
              updateResponseData['updateAssignment'] as Map<String, dynamic>?;

          if (updatedAssignment != null) {
            print('>>> UpdateAssignment mutation completed successfully');
            print('>>>   - id: ${updatedAssignment['id']}');
            print('>>>   - status: ${updatedAssignment['status']}');
            print(
                '>>>   - isTrainingComplete: ${updatedAssignment['isTrainingComplete']}');
          } else {
            print('>>> WARNING: UpdateAssignment returned null data');
            safePrint(
                'Warning: Assignment update may have failed - response data is null');
          }
        }
      } else {
        print('>>> Quiz not passed, assignment status remains unchanged');
      }

      print('>>> QuizService: saveQuizResult completed successfully');
    } catch (e, stackTrace) {
      print('>>> ERROR in QuizService.saveQuizResult: $e');
      print('>>> Stack trace: $stackTrace');
      safePrint('Error saving quiz result: $e');
      rethrow;
    }
  }

  /// Check if a quiz result exists for an assignment (indicating quiz was submitted)
  static Future<bool> hasQuizResult(String assignmentId) async {
    try {
      const query = '''
        query GetResults(\$assignmentId: ID!) {
          listResults(filter: { assignmentId: { eq: \$assignmentId } }) {
            items {
              id
              passed
              score
            }
          }
        }
      ''';

      final request = GraphQLRequest<String>(
        document: query,
        variables: {'assignmentId': assignmentId},
      );

      final response = await Amplify.API.query(request: request).response;
      final data = jsonDecode(response.data ?? '{}') as Map<String, dynamic>;

      final results = data['listResults']?['items'] as List?;
      if (results == null || results.isEmpty) {
        return false;
      }

      // Check if any result shows the quiz was passed
      for (final result in results) {
        final resultMap = result as Map<String, dynamic>;
        if (resultMap['passed'] == true) {
          return true;
        }
      }

      return false;
    } catch (e) {
      safePrint('Error checking quiz result: $e');
      return false;
    }
  }
}

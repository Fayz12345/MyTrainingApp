import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:amplify_api/amplify_api.dart';
import '../../quiz/data/models/quiz_question_model.dart';
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
              questionType
              caseSensitive
              fuzzyMatching
              isActive
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
        safePrint('[QuizService] No questions found for course: $courseId');
        return [];
      }

      safePrint(
          '[QuizService] Found ${questions.length} questions for course: $courseId');

      // Parse questions with better error handling - skip invalid questions
      final List<QuizQuestion> parsedQuestions = [];
      int skippedCount = 0;

      for (var i = 0; i < questions.length; i++) {
        try {
          final questionData = questions[i] as Map<String, dynamic>;
          final questionId = questionData['id'] as String? ?? 'unknown';
          safePrint('[QuizService] Parsing question ${i + 1}: $questionId');

          // Log correctAnswer value for debugging
          final correctAnswer = questionData['correctAnswer'];
          final options = questionData['options'];
          safePrint(
              '[QuizService] correctAnswer type: ${correctAnswer.runtimeType}, value: $correctAnswer');
          safePrint(
              '[QuizService] options type: ${options.runtimeType}, count: ${options is List ? options.length : 'N/A'}');

          // Check if question is active (skip inactive questions)
          final isActive = questionData['isActive'] as bool? ??
              true; // Default to true if not specified
          if (!isActive) {
            safePrint(
                '[QuizService] ⚠️ Skipping question ${i + 1} ($questionId): isActive is false');
            skippedCount++;
            continue;
          }

          // Skip questions with null correctAnswer or empty options (for non-fill-in-the-blank)
          final questionType = questionData['questionType'] as String?;
          final isFillBlank = questionType?.toLowerCase() == 'fill_blank' ||
              questionType?.toLowerCase() == 'fillblank';

          if (correctAnswer == null && !isFillBlank) {
            safePrint(
                '[QuizService] ⚠️ Skipping question ${i + 1} ($questionId): correctAnswer is null');
            skippedCount++;
            continue;
          }

          if ((options == null || (options is List && options.isEmpty)) &&
              !isFillBlank) {
            safePrint(
                '[QuizService] ⚠️ Skipping question ${i + 1} ($questionId): options is null or empty');
            skippedCount++;
            continue;
          }

          final question = QuizQuestion.fromJson(questionData);
          parsedQuestions.add(question);
          safePrint(
              '[QuizService] ✅ Successfully parsed question ${i + 1}: $questionId');
        } catch (e) {
          final questionId = questions[i] is Map<String, dynamic>
              ? (questions[i] as Map<String, dynamic>)['id'] as String? ??
                  'unknown'
              : 'unknown';
          safePrint(
              '[QuizService] ⚠️ Skipping question ${i + 1} ($questionId): $e');
          safePrint('[QuizService] Question data: ${questions[i]}');
          skippedCount++;
          // Continue with other questions instead of failing completely
        }
      }

      if (skippedCount > 0) {
        safePrint(
            '[QuizService] ⚠️ Skipped $skippedCount invalid question(s) out of ${questions.length} total');
      }

      if (parsedQuestions.isEmpty) {
        safePrint('[QuizService] ❌ No valid questions found after parsing');
        throw Exception(
            'No valid quiz questions available. All questions were invalid or incomplete.');
      }

      safePrint(
          '[QuizService] ✅ Successfully parsed ${parsedQuestions.length} valid question(s)');

      return parsedQuestions;
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

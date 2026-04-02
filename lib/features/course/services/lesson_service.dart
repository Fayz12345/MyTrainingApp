import 'dart:convert';
import 'package:amplify_api/amplify_api.dart';
import 'package:amplify_flutter/amplify_flutter.dart';
import '../data/models/lesson_model.dart';



class LessonService {

  static Future<List<Lesson>> getLessonsForCourse(String courseId) async {
    print("lesson of courseId $courseId");
    try {
      const document = '''
        query ListLessonsByCourse(\$courseId: ID!) {
          listLessons(filter: { courseId: { eq: \$courseId } }) {
            items {
              id
              courseId
              title
              order
              contentBlocks
            }
          }
        }
      ''';

      final request = GraphQLRequest<String>(
        document: document,
        variables: {'courseId': courseId},
      );

      final response = await Amplify.API.query(request: request).response;

      if (response.errors.isNotEmpty) {
        safePrint(
          '[LESSON_SERVICE] GraphQL errors: ${response.errors.map((e) => e.message).join(', ')}',
        );
      }

      final data = jsonDecode(response.data ?? '{}') as Map<String, dynamic>;
      final listLessons = data['listLessons'] as Map<String, dynamic>?;
      final items = listLessons?['items'] as List<dynamic>? ?? const [];

      final lessons = items
          .whereType<Map<String, dynamic>>()
          .map(Lesson.fromJson)
          .toList();

      lessons.sort((a, b) => a.order.compareTo(b.order));
      return lessons;
    } catch (e) {
      safePrint('[LESSON_SERVICE] Error fetching lessons: $e');
      return [];
    }
  }

}


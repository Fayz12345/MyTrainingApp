import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:amplify_api/amplify_api.dart';
import '../models/course_model.dart';
import 'auth_service.dart';
import 'dart:convert';

class CourseService {
  static Future<List<Course>> getAssignedCourses() async {
    safePrint(
        '[REFRESH_COURSES] [COURSE_SERVICE] ========================================');
    safePrint('[REFRESH_COURSES] [COURSE_SERVICE] getAssignedCourses() called');

    try {
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 1] Getting current user ID...');
      final userId = await AuthService.getCurrentUserId();
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 1.1] User ID: $userId');

      if (userId == null) {
        safePrint(
            '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 1.2] ❌ User not authenticated');
        throw Exception('User not authenticated');
      }
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 1.2] ✅ User authenticated');

      // GraphQL query to get employee and assignments
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 2] Building GraphQL query...');
      const query = '''
        query GetAssignedCourses(\$userId: String!) {
          listEmployees(filter: { userId: { eq: \$userId } }) {
            items {
              id
              assignments {
                items {
                  id
                  status
                  course {
                    id
                    title
                    videoKey
                    passingScore
                    createdAt
                    updatedAt
                  }
                }
              }
            }
          }
        }
      ''';
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 2.1] ✅ GraphQL query built');
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 2.2] Query variables: {userId: $userId}');
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 2.3] Variable type: String! (changed from ID! to match schema)');

      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 3] Creating GraphQL request...');
      final request = GraphQLRequest<String>(
        document: query,
        variables: {'userId': userId},
      );
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 3.1] ✅ GraphQL request created');

      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 4] Executing GraphQL query via Amplify.API...');
      final response = await Amplify.API.query(request: request).response;
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 4.1] ✅ GraphQL query executed');
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 4.2] Response data present: ${response.data != null}');
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 4.3] Response errors: ${response.errors}');

      if (response.errors.isNotEmpty) {
        safePrint(
            '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 4.4] ⚠️ GraphQL errors detected:');
        for (final error in response.errors) {
          safePrint(
              '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 4.4]   - ${error.message}');
        }
      }

      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 5] Parsing response data...');
      final data = jsonDecode(response.data ?? '{}') as Map<String, dynamic>;
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 5.1] ✅ Response data parsed');
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 5.2] Data keys: ${data.keys.toList()}');
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 5.3] Full response data: $data');

      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 6] Extracting employees from response...');
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 6.0] listEmployees value: ${data['listEmployees']}');
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 6.0.1] listEmployees type: ${data['listEmployees']?.runtimeType}');

      final listEmployees = data['listEmployees'];
      if (listEmployees != null) {
        safePrint(
            '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 6.0.2] listEmployees is Map: ${listEmployees is Map}');
        if (listEmployees is Map) {
          final listEmployeesMap = listEmployees as Map<String, dynamic>;
          safePrint(
              '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 6.0.3] listEmployees keys: ${listEmployeesMap.keys.toList()}');
          final itemsValue = listEmployeesMap['items'];
          safePrint(
              '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 6.0.4] listEmployees items value: $itemsValue');
          if (itemsValue != null) {
            safePrint(
                '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 6.0.5] items type: ${itemsValue.runtimeType}');
          }
        }
      }

      final employees = data['listEmployees']?['items'] as List?;
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 6.1] Employees found: ${employees != null ? employees.length : 0}');

      if (employees != null && employees.isNotEmpty) {
        safePrint(
            '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 6.1.1] First employee data: ${employees[0]}');
      } else {
        safePrint(
            '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 6.1.2] ⚠️ No employees in response');
        safePrint(
            '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 6.1.3] This could mean:');
        safePrint(
            '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 6.1.3]   1. No Employee record exists for userId: $userId');
        safePrint(
            '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 6.1.3]   2. Employee record exists but userId field doesn\'t match');
        safePrint(
            '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 6.1.3]   3. Check DynamoDB Employee table for this userId');
      }

      if (employees == null || employees.isEmpty) {
        safePrint(
            '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 6.2] ⚠️ No employees found, returning empty list');
        safePrint(
            '[REFRESH_COURSES] [COURSE_SERVICE] ========================================');
        return [];
      }

      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 7] Processing employee data...');
      final employee = employees[0] as Map<String, dynamic>;
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 7.1] Employee ID: ${employee['id']}');

      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 8] Extracting assignments...');
      final assignments = employee['assignments']?['items'] as List?;
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 8.1] Assignments found: ${assignments != null ? assignments.length : 0}');

      if (assignments == null || assignments.isEmpty) {
        safePrint(
            '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 8.2] ⚠️ No assignments found, returning empty list');
        safePrint(
            '[REFRESH_COURSES] [COURSE_SERVICE] ========================================');
        return [];
      }

      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 9] Mapping assignments to Course objects...');
      final courses = <Course>[];
      for (int i = 0; i < assignments.length; i++) {
        final assignment = assignments[i];
        safePrint(
            '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 9.${i + 1}] Processing assignment ${i + 1}/${assignments.length}...');

        final assignmentData = assignment as Map<String, dynamic>;
        safePrint(
            '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 9.${i + 1}.1] Assignment ID: ${assignmentData['id']}');
        safePrint(
            '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 9.${i + 1}.1] Assignment Status: ${assignmentData['status']}');

        final courseData = assignmentData['course'] as Map<String, dynamic>?;
        if (courseData == null) {
          safePrint(
              '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 9.${i + 1}.2] ⚠️ No course data in assignment, skipping');
          continue;
        }

        safePrint(
            '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 9.${i + 1}.2] Course ID: ${courseData['id']}');
        safePrint(
            '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 9.${i + 1}.2] Course Title: ${courseData['title']}');
        safePrint(
            '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 9.${i + 1}.2] Video Key: ${courseData['videoKey']}');
        safePrint(
            '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 9.${i + 1}.2] Passing Score: ${courseData['passingScore']}');

        try {
          final course = Course(
            id: courseData['id'] as String,
            title: courseData['title'] as String,
            videoKey: courseData['videoKey'] as String?,
            passingScore: courseData['passingScore'] as int?,
            createdAt: DateTime.parse(courseData['createdAt'] as String),
            updatedAt: DateTime.parse(courseData['updatedAt'] as String),
            assignmentStatus: assignmentData['status'] as String?,
            assignmentId: assignmentData['id'] as String,
          );
          courses.add(course);
          safePrint(
              '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 9.${i + 1}.3] ✅ Course object created and added');
        } catch (e) {
          safePrint(
              '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 9.${i + 1}.3] ❌ Error creating course object: $e');
          safePrint(
              '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 9.${i + 1}.3] Skipping this assignment');
        }
      }

      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 10] ✅ Course mapping complete');
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 10.1] Total courses created: ${courses.length}');
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] ========================================');
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] ✅ getAssignedCourses() completed successfully');
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] ========================================');

      return courses;
    } catch (e, stackTrace) {
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] ❌ ERROR in getAssignedCourses()');
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] Error type: ${e.runtimeType}');
      safePrint('[REFRESH_COURSES] [COURSE_SERVICE] Error message: $e');
      safePrint('[REFRESH_COURSES] [COURSE_SERVICE] Stack trace: $stackTrace');
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] ========================================');
      rethrow;
    }
  }
}

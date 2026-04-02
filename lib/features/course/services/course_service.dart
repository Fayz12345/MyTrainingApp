import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:amplify_api/amplify_api.dart';
import '../../auth/services/auth_service.dart';
import 'dart:convert';
import '../data/models/course_model.dart';
import '../data/models/lesson_model.dart';

class CourseService {
  static Future<List<Course>> getAssignedCourses() async {
    try {
      final userId = await AuthService.getCurrentUserId();
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 1.1] User ID: $userId');

      if (userId == null) {
        safePrint(
            '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 1.2] ❌ User not authenticated');
        throw Exception('User not authenticated');
      }
      const query = '''
           query GetAssignedCourses(\$userId: String!) {
          listEmployees(filter: { userId: { eq: \$userId } }) {
            items {
              id
              assignments(filter: { assignmentSource: { eq: "individual" } }) {
                items {
                  id
                  status
                  updatedAt
                  course {
                    id
                    title
                    videoKey
                    pdfKey
                    pdfTitle
                    contentType
                    passingScore
                    createdAt
                    updatedAt
                    duration
                    category
                    tag
                    imageKey
                    description
                    randomizeQuestions
                    randomizeOptions
                    useQuestionPool
                    poolSize
                    questionsToDisplay
                    lessons {
                      items {
                        id
                        courseId
                        title
                        order
                        contentBlocks
                      }
                    }
                  }
                }
              }
            }
          }
        }
      ''';

      final request = GraphQLRequest<String>(
        document: query,
        variables: {"userId": "$userId"},
      );

      final startTime = DateTime.now();
      final response = await Amplify.API.query(request: request).response;
      final endTime = DateTime.now();
      final duration = endTime.difference(startTime);

      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 4.1.1] ⏱️ API call duration: ${duration.inMilliseconds}ms');

      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 4.2.1] Response data present: ${response.data != null}');
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 4.2.2] Response data length: ${response.data?.length ?? 0} characters');
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 4.2.3] Response errors count: ${response.errors.length}');
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
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 5.0] Raw response data (first 500 chars): ${response.data?.substring(0, response.data!.length > 500 ? 500 : response.data!.length) ?? 'null'}');
      final data = jsonDecode(response.data ?? '{}') as Map<String, dynamic>;

      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 5.2] Data keys: ${data.keys.toList()}');
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 5.3] Full response data: $data');

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
      } else {}

      if (employees == null || employees.isEmpty) {
        return [];
      }

      final employee = employees[0] as Map<String, dynamic>;
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 7.1] Employee ID: ${employee['id']}');

      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 8] Extracting assignments...');
      final assignments = employee['assignments']?['items'] as List?;
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 8.1] Assignments found: ${assignments != null ? assignments.length : 0}');

      if (assignments == null || assignments.isEmpty) {
        return [];
      }
      final courses = <Course>[];
      // Map to store assignment updatedAt for each course (used for sorting)
      final assignmentUpdatedAtMap = <String, DateTime>{};

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
          // Parse assignment updatedAt if available
          DateTime? assignmentUpdatedAt;
          if (assignmentData['updatedAt'] != null) {
            assignmentUpdatedAt =
                DateTime.parse(assignmentData['updatedAt'] as String);
          }

          final course = Course(
            id: courseData['id'] as String,
            title: courseData['title'] as String,
            videoKey: courseData['videoKey'] as String?,
            imageKey: courseData['imageKey'] as String?,
            description: courseData['description'] as String?,
            passingScore: courseData['passingScore'] as int?,
            createdAt: DateTime.parse(courseData['createdAt'] as String),
            updatedAt: DateTime.parse(courseData['updatedAt'] as String),
            duration: courseData['duration'] as String?,
            category: courseData['category'] as String?,
            tag: courseData['tag'] as String?,
            assignmentStatus: assignmentData['status'] as String?,
            assignmentId: assignmentData['id'] as String, // assignment.id
            assignmentUpdatedAt:
                assignmentData['updatedAt'] as String?, // assignment.updatedAt
            pdfKey: courseData['pdfKey'] as String?,
            pdfTitle: courseData['pdfTitle'] as String?,
            contentType: CourseContentType.fromString(
              courseData['contentType'] as String?,
            ),
            randomizeQuestions:
                courseData['randomizeQuestions'] as bool? ?? false,
            randomizeOptions: courseData['randomizeOptions'] as bool? ?? false,
            useQuestionPool: courseData['useQuestionPool'] as bool? ?? false,
            poolSize: courseData['poolSize'] as int?,
            questionsToDisplay: courseData['questionsToDisplay'] as int?,
            lessons: ((courseData['lessons']?['items'] as List<dynamic>?) ??
                    const [])
                .whereType<Map<String, dynamic>>()
                .map(Lesson.fromJson)
                .toList()
              ..sort((a, b) => a.order.compareTo(b.order)),
          );
          courses.add(course);

          // Store assignment updatedAt for sorting (use course id as key)
          if (assignmentUpdatedAt != null) {
            assignmentUpdatedAtMap[course.id] = assignmentUpdatedAt;
          }
        } catch (e) {
          safePrint(
              '[REFRESH_COURSES] [COURSE_SERVICE] [STEP 9.${i + 1}.3] ❌ Error creating course object: $e');
        }
      }

      safePrint('[REFRESH_COURSES] [COURSE_SERVICE] [STEP 10.1] Total courses created: ${courses.length}');

      courses.sort((a, b) {
        final statusA = a.assignmentStatus ?? '';
        final statusB = b.assignmentStatus ?? '';

        // Get assignment updatedAt for each course
        final assignmentUpdatedAtA = assignmentUpdatedAtMap[a.id];
        final assignmentUpdatedAtB = assignmentUpdatedAtMap[b.id];

        final now = DateTime.now();
        final isInProgressA = statusA == 'assigned' &&
            assignmentUpdatedAtA != null &&
            (now.difference(assignmentUpdatedAtA).inDays < 30 ||
                assignmentUpdatedAtA.difference(a.createdAt).inHours > 24);
        final isInProgressB = statusB == 'assigned' &&
            assignmentUpdatedAtB != null &&
            (now.difference(assignmentUpdatedAtB).inDays < 30 ||
                assignmentUpdatedAtB.difference(b.createdAt).inHours > 24);

        // Priority calculation:
        // In Progress (assigned + updated) = 0
        // Start Course (assigned + not updated) = 1
        // Completed = 2
        // Others = 3
        int priorityA;
        if (isInProgressA) {
          priorityA = 0; // In Progress
        } else if (statusA == 'assigned') {
          priorityA = 1; // Start Course (assigned but not started)
        } else if (statusA == 'completed') {
          priorityA = 2; // Completed
        } else {
          priorityA = 3; // Others
        }

        int priorityB;
        if (isInProgressB) {
          priorityB = 0; // In Progress
        } else if (statusB == 'assigned') {
          priorityB = 1; // Start Course (assigned but not started)
        } else if (statusB == 'completed') {
          priorityB = 2; // Completed
        } else {
          priorityB = 3; // Others
        }

        // Compare by priority first
        if (priorityA != priorityB) {
          return priorityA.compareTo(priorityB);
        }

        // If same priority, sort by assignment updatedAt (newest first), fallback to course updatedAt
        final sortDateA = assignmentUpdatedAtA ?? a.updatedAt;
        final sortDateB = assignmentUpdatedAtB ?? b.updatedAt;
        return sortDateB.compareTo(sortDateA);
      });

      return courses;
    } catch (e, stackTrace) {
      safePrint(
          '[REFRESH_COURSES] [COURSE_SERVICE] Error type: ${e.runtimeType}');
      safePrint('[REFRESH_COURSES] [COURSE_SERVICE] Error message: $e');
      safePrint('[REFRESH_COURSES] [COURSE_SERVICE] Stack trace: $stackTrace');
      rethrow;
    }
  }
}

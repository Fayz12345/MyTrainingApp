import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:amplify_api/amplify_api.dart';
import '../../auth/services/auth_service.dart';
import '../../course/data/models/course_model.dart';
import '../../course/data/models/lesson_model.dart';
import '../../course/services/course_service.dart';
import 'dart:convert';
import '../data/models/learning_path_model.dart';
import '../../../models/learning_path_assignment_model.dart';

class LearningPathService {
  /// Fetch all learning paths for the current employee using GraphQL query
  /// Uses the new GetAssignedLearningPathsByUserId query
  static Future<List<LearningPath>> getLearningPaths() async {
    try {
      safePrint('[LEARNING_PATH] Fetching learning paths via GraphQL...');

      final userId = await AuthService.getCurrentUserId();
      if (userId == null) {
        safePrint('[LEARNING_PATH] ❌ User not authenticated');
        throw Exception('User not authenticated');
      }

      const query = '''
        query GetAssignedLearningPathsByUserId(\$userId: String!) {
          listEmployees(filter: { userId: { eq: \$userId } }) {
            items {
              id
              name
              email
              learningPathAssignments {
                items {
                  id
                  learningPathId
                  employeeId
                  status
                  assignedDate
                  dueDate
                  completedDate
                  expirationDate
                  certificationStatus
                  lastReminderSentAt
                  reminderCount
                  createdAt
                  updatedAt
                  learningPath {
                    id
                    title
                    description
                    isSequential
                    mandatoryForScheduling
                    isCertification
                    certificationExpirationDays
                    isArchived
                    version
                    courses {
                      items {
                        id
                        courseId
                        order
                        isRequired
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
            }
          }
        }
      ''';

      final request = GraphQLRequest<String>(
        document: query,
        variables: {'userId': userId},
      );

      final response = await Amplify.API.query(request: request).response;

      if (response.errors.isNotEmpty) {
        safePrint('[LEARNING_PATH] ⚠️ GraphQL errors:');
        for (final error in response.errors) {
          safePrint('[LEARNING_PATH]   - ${error.message}');
        }
        throw Exception(
            'GraphQL errors: ${response.errors.map((e) => e.message).join(", ")}');
      }

      final data = jsonDecode(response.data ?? '{}') as Map<String, dynamic>;
      final employees = data['listEmployees']?['items'] as List?;

      if (employees == null || employees.isEmpty) {
        safePrint('[LEARNING_PATH] No employees found');
        return [];
      }

      final paths = <LearningPath>[];

      for (final employee in employees) {
        final employeeData = employee as Map<String, dynamic>;
        final assignments =
            employeeData['learningPathAssignments']?['items'] as List?;

        if (assignments == null || assignments.isEmpty) {
          continue;
        }

        for (final assignment in assignments) {
          final assignmentData = assignment as Map<String, dynamic>;
          final learningPathData =
              assignmentData['learningPath'] as Map<String, dynamic>?;

          if (learningPathData == null) {
            continue;
          }

          // Skip archived paths
          if (learningPathData['isArchived'] == true) {
            continue;
          }

          final path = await _mapGraphQLResponseToLearningPath(
            learningPathData,
            assignmentData,
          );

          if (path != null) {
            paths.add(path);
          }
        }
      }

      // Sort paths: active (in progress) first, then by progress, then completed
      paths.sort((a, b) {
        if (a.isCompleted && !b.isCompleted) return 1;
        if (!a.isCompleted && b.isCompleted) return -1;
        if (a.isCompleted && b.isCompleted) {
          // Both completed, sort by completion date (most recent first)
          return b.completedCount.compareTo(a.completedCount);
        }
        // Both active, sort by progress (highest first)
        return b.progressPercentage.compareTo(a.progressPercentage);
      });

      safePrint('[LEARNING_PATH] ✅ Created ${paths.length} learning paths');
      return paths;
    } catch (e, stackTrace) {
      safePrint('[LEARNING_PATH] ❌ Error fetching learning paths: $e');
      safePrint('[LEARNING_PATH] Stack trace: $stackTrace');
      rethrow;
    }
  }

  /// Map GraphQL response to LearningPath model
  static Future<LearningPath?> _mapGraphQLResponseToLearningPath(
    Map<String, dynamic> learningPathData,
    Map<String, dynamic> assignmentData,
  ) async {
    try {
      final pathId = learningPathData['id'] as String;
      final title = learningPathData['title'] as String;
      final description = learningPathData['description'] as String?;
      final isSequential = learningPathData['isSequential'] as bool? ?? false;
      final version = (learningPathData['version'] as num?)?.toInt();
      final mandatoryForScheduling =
          learningPathData['mandatoryForScheduling'] as bool?;
      final isCertification = learningPathData['isCertification'] as bool?;
      final certificationExpirationDays =
          (learningPathData['certificationExpirationDays'] as num?)?.toInt();

      LearningPathAssignmentModel? assignmentModel;
      try {
        assignmentModel =
            LearningPathAssignmentModel.fromJson(assignmentData);
      } catch (e) {
        safePrint('[LEARNING_PATH] ⚠️ Assignment parse skipped: $e');
      }

      // Get due date from assignment
      DateTime? dueDate;
      if (assignmentData['dueDate'] != null) {
        dueDate = DateTime.parse(assignmentData['dueDate'] as String);
      }

      // Get path assignment status
      final pathAssignmentStatus =
          assignmentData['status'] as String? ?? 'assigned';

      // Get courses from learning path
      final coursesData = learningPathData['courses']?['items'] as List?;
      if (coursesData == null || coursesData.isEmpty) {
        safePrint('[LEARNING_PATH] ⚠️ No courses found for path: $title');
        return null;
      }

      // Fetch individual course assignments to get accurate status
      // Filter by this specific learning path to get only relevant assignments
      final userId = await AuthService.getCurrentUserId();
      final courseAssignments = userId != null
          ? await _fetchCourseAssignments(userId, learningPathId: pathId)
          : <String, Map<String, dynamic>>{};

      // Map courses and sort by order
      final pathCourses = <PathCourse>[];
      int completedCount = 0;
      bool foundFirstIncomplete =
          false; // Track if we've found the first incomplete course

      // Sort courses by order
      final sortedCoursesData = List<Map<String, dynamic>>.from(
        coursesData.map((c) => c as Map<String, dynamic>),
      );
      sortedCoursesData.sort((a, b) {
        final orderA = a['order'] as int? ?? 0;
        final orderB = b['order'] as int? ?? 0;
        return orderA.compareTo(orderB);
      });

      for (final courseData in sortedCoursesData) {
        final courseJson = courseData['course'] as Map<String, dynamic>?;
        if (courseJson == null) {
          continue;
        }

        final courseId = courseJson['id'] as String;
        final courseAssignment = courseAssignments[courseId];
        final courseAssignmentStatus = courseAssignment?['status'] as String?;
        final courseAssignmentId = courseAssignment?['id'] as String?;

        // Create Course object with individual assignment status (lessons + fields aligned with [CourseService])
        final course = Course(
          id: courseId,
          title: courseJson['title'] as String,
          videoKey: courseJson['videoKey'] as String?,
          imageKey: courseJson['imageKey'] as String?,
          description: courseJson['description'] as String?,
          passingScore: courseJson['passingScore'] as int?,
          createdAt: DateTime.parse(courseJson['createdAt'] as String),
          updatedAt: DateTime.parse(courseJson['updatedAt'] as String),
          duration: courseJson['duration'] as String?,
          category: courseJson['category'] as String?,
          tag: courseJson['tag'] as String?,
          assignmentStatus: courseAssignmentStatus ?? pathAssignmentStatus,
          assignmentId: courseAssignmentId,
          assignmentUpdatedAt: courseAssignment?['updatedAt'] as String?,
          pdfKey: courseJson['pdfKey'] as String?,
          pdfTitle: courseJson['pdfTitle'] as String?,
          contentType: CourseContentType.fromString(
            courseJson['contentType'] as String?,
          ),
          randomizeQuestions:
              courseJson['randomizeQuestions'] as bool? ?? false,
          randomizeOptions: courseJson['randomizeOptions'] as bool? ?? false,
          useQuestionPool: courseJson['useQuestionPool'] as bool? ?? false,
          poolSize: courseJson['poolSize'] as int?,
          questionsToDisplay: courseJson['questionsToDisplay'] as int?,
          lessons: ((courseJson['lessons']?['items'] as List<dynamic>?) ??
                  const [])
              .whereType<Map<String, dynamic>>()
              .map(Lesson.fromJson)
              .toList()
            ..sort((a, b) => a.order.compareTo(b.order)),
        );

        // Determine course status in the path using individual assignment status
        final isCourseCompleted = courseAssignmentStatus == 'completed';

        CourseStatus status;
        if (isCourseCompleted) {
          // Completed courses always show checkmark
          status = CourseStatus.completed;
          completedCount++;
          // Don't set foundFirstIncomplete - keep it false so future courses aren't locked
        } else {
          // Course is not completed
          if (isSequential && foundFirstIncomplete) {
            // In sequential paths, lock all courses after the first incomplete one
            status = CourseStatus.locked;
          } else {
            // This is the first incomplete course (or path is flexible)
            foundFirstIncomplete =
                true; // Mark that we found the first incomplete course

            // Determine if it's in progress or not started
            if (courseAssignmentStatus == 'assigned' ||
                courseAssignmentStatus == 'in_progress' ||
                (courseAssignmentStatus == null &&
                    pathAssignmentStatus == 'assigned')) {
              status = CourseStatus.inProgress;
            } else {
              status = CourseStatus.notStarted;
            }
          }
        }

        pathCourses.add(PathCourse(
          course: course,
          order: courseData['order'] as int? ?? pathCourses.length + 1,
          status: status,
        ));
      }

      final totalCount = pathCourses.length;
      final progressPercentage =
          totalCount > 0 ? (completedCount / totalCount) * 100 : 0.0;
      final isCompleted = completedCount == totalCount && totalCount > 0;

      return LearningPath(
        id: pathId,
        title: title,
        description: description,
        courses: pathCourses,
        isSequential: isSequential,
        dueDate: dueDate,
        completedCount: completedCount,
        totalCount: totalCount,
        progressPercentage: progressPercentage,
        isCompleted: isCompleted,
        version: version,
        assignment: assignmentModel,
        isCertification: isCertification,
        certificationExpirationDays: certificationExpirationDays,
        mandatoryForScheduling: mandatoryForScheduling,
      );
    } catch (e, stackTrace) {
      safePrint('[LEARNING_PATH] ❌ Error mapping learning path: $e');
      safePrint('[LEARNING_PATH] Stack trace: $stackTrace');
      return null;
    }
  }

  /// Fetch course assignments for the current user
  /// Returns a map of courseId -> assignment data
  /// Optionally filters by a specific learning path ID
  static Future<Map<String, Map<String, dynamic>>> _fetchCourseAssignments(
    String userId, {
    String? learningPathId,
  }) async {
    try {
      // Build query based on whether learningPathId is provided
      String query;
      Map<String, dynamic> variables;

      if (learningPathId != null) {
        // Filter by assignmentSource and specific learning path
        query = '''
          query GetCourseAssignments(\$userId: String!, \$learningPathId: ID!) {
            listEmployees(filter: { userId: { eq: \$userId } }) {
              items {
                id
                assignments(filter: {
                  assignmentSource: { eq: "learning_path" },
                  learningPathId: { eq: \$learningPathId }
                }) {
                  items {
                    id
                    status
                    updatedAt
                    course {
                      id
                    }
                  }
                }
              }
            }
          }
        ''';
        variables = {
          'userId': userId,
          'learningPathId': learningPathId,
        };
      } else {
        // Filter by assignmentSource only
        query = '''
          query GetCourseAssignments(\$userId: String!) {
            listEmployees(filter: { userId: { eq: \$userId } }) {
              items {
                id
                assignments(filter: { assignmentSource: { eq: "learning_path" } }) {
                  items {
                    id
                    status
                    updatedAt
                    course {
                      id
                    }
                  }
                }
              }
            }
          }
        ''';
        variables = {'userId': userId};
      }

      final request = GraphQLRequest<String>(
        document: query,
        variables: variables,
      );

      final response = await Amplify.API.query(request: request).response;

      if (response.errors.isNotEmpty) {
        safePrint(
            '[LEARNING_PATH] ⚠️ Error fetching course assignments: ${response.errors}');
        return {};
      }

      final data = jsonDecode(response.data ?? '{}') as Map<String, dynamic>;
      final employees = data['listEmployees']?['items'] as List?;

      if (employees == null || employees.isEmpty) {
        return {};
      }

      final assignmentsMap = <String, Map<String, dynamic>>{};

      for (final employee in employees) {
        final employeeData = employee as Map<String, dynamic>;
        final assignments = employeeData['assignments']?['items'] as List?;

        if (assignments == null) {
          continue;
        }

        for (final assignment in assignments) {
          final assignmentData = assignment as Map<String, dynamic>;
          final course = assignmentData['course'] as Map<String, dynamic>?;
          final courseId = course?['id'] as String?;

          if (courseId != null) {
            assignmentsMap[courseId] = assignmentData;
          }
        }
      }

      return assignmentsMap;
    } catch (e) {
      safePrint('[LEARNING_PATH] ⚠️ Error fetching course assignments: $e');
      return {};
    }
  }

  /// Legacy method: Fetch all learning paths for the current employee
  /// Groups courses by their tag field (kept for backward compatibility)
  static Future<List<LearningPath>> getLearningPathsByTag() async {
    try {
      safePrint('[LEARNING_PATH] Fetching learning paths...');

      // Get all assigned courses
      final courses = await CourseService.getAssignedCourses();
      safePrint('[LEARNING_PATH] Found ${courses.length} assigned courses');

      if (courses.isEmpty) {
        return [];
      }

      // Group courses by tag
      final coursesByTag = <String, List<Course>>{};
      final coursesWithoutTag = <Course>[];

      for (final course in courses) {
        if (course.tag != null && course.tag!.isNotEmpty) {
          final tag = course.tag!;
          coursesByTag.putIfAbsent(tag, () => []).add(course);
        } else {
          coursesWithoutTag.add(course);
        }
      }

      safePrint('[LEARNING_PATH] Found ${coursesByTag.length} paths with tags');
      safePrint(
          '[LEARNING_PATH] Found ${coursesWithoutTag.length} courses without tags');

      final paths = <LearningPath>[];

      // Create learning paths from tagged courses
      for (final entry in coursesByTag.entries) {
        final tag = entry.key;
        final pathCourses = entry.value;

        // Determine if path is sequential
        // For now, we'll use a convention: if tag contains "sequential" or "path", it's sequential
        // Otherwise, it's flexible
        final isSequential = tag.toLowerCase().contains('sequential') ||
            tag.toLowerCase().contains('path');

        // Get the first course's category as description (or use tag)
        final description = pathCourses.first.category ??
            pathCourses.first.description ??
            'Learning path: $tag';

        // Create learning path
        final path = LearningPath.calculateProgress(
          id: tag,
          title: tag, // Use tag as title, or could be customized
          description: description,
          courses: pathCourses,
          isSequential: isSequential,
          dueDate:
              null, // Could be added later if due dates are assigned to paths
        );
        // Note: Legacy method doesn't have version, so it will be null

        paths.add(path);
      }

      // If there are courses without tags, create a default "Individual Courses" path
      if (coursesWithoutTag.isNotEmpty) {
        final individualPath = LearningPath.calculateProgress(
          id: 'individual',
          title: 'Individual Courses',
          description: 'Courses not part of a learning path',
          courses: coursesWithoutTag,
          isSequential: false, // Individual courses are always flexible
          dueDate: null,
        );
        // Note: Legacy method doesn't have version, so it will be null
        paths.add(individualPath);
      }

      // Sort paths: active (in progress) first, then by progress, then completed
      paths.sort((a, b) {
        if (a.isCompleted && !b.isCompleted) return 1;
        if (!a.isCompleted && b.isCompleted) return -1;
        if (a.isCompleted && b.isCompleted) {
          // Both completed, sort by completion date (most recent first)
          return b.completedCount.compareTo(a.completedCount);
        }
        // Both active, sort by progress (highest first)
        return b.progressPercentage.compareTo(a.progressPercentage);
      });

      safePrint('[LEARNING_PATH] Created ${paths.length} learning paths');
      return paths;
    } catch (e, stackTrace) {
      safePrint('[LEARNING_PATH] Error fetching learning paths: $e');
      safePrint('[LEARNING_PATH] Stack trace: $stackTrace');
      rethrow;
    }
  }

  /// Get active (in-progress) learning paths
  static Future<List<LearningPath>> getActiveLearningPaths() async {
    final allPaths = await getLearningPaths();
    return allPaths.where((path) => !path.isCompleted).toList();
  }

  /// Get completed learning paths
  static Future<List<LearningPath>> getCompletedLearningPaths() async {
    final allPaths = await getLearningPaths();
    return allPaths.where((path) => path.isCompleted).toList();
  }

  /// Check if a course can be accessed (not locked)
  static bool canAccessCourse(PathCourse pathCourse, LearningPath path) {
    if (!path.isSequential) {
      // Flexible paths: all courses accessible
      return true;
    }

    // Sequential paths: check if previous course is completed
    if (pathCourse.status == CourseStatus.locked) {
      return false;
    }

    return true;
  }

  /// Get the current course ID in a sequential path
  /// Returns the ID of the first non-completed accessible course
  /// Returns null if all courses are completed or path is flexible
  static String? getCurrentCourseId(LearningPath path) {
    if (!path.isSequential) {
      // Flexible paths don't have a "current" course concept
      return null;
    }

    for (final pathCourse in path.courses) {
      final canAccess = canAccessCourse(pathCourse, path);
      final isCompleted = pathCourse.status == CourseStatus.completed;
      if (!isCompleted && canAccess) {
        return pathCourse.course.id;
      }
    }

    // All courses are completed
    return null;
  }

  /// Check if a course is the current course in a sequential path
  static bool isCurrentCourse(PathCourse pathCourse, LearningPath path) {
    if (!path.isSequential) {
      return false;
    }

    final currentCourseId = getCurrentCourseId(path);
    return currentCourseId != null && pathCourse.course.id == currentCourseId;
  }

  /// Check if a course is clickable (can be accessed or reviewed)
  static bool isCourseClickable(PathCourse pathCourse, LearningPath path) {
    // Completed courses can be reviewed
    if (pathCourse.status == CourseStatus.completed) {
      return true;
    }

    // Check if course can be accessed
    return canAccessCourse(pathCourse, path);
  }
}

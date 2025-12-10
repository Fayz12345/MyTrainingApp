import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:amplify_flutter/amplify_flutter.dart' hide Emitter;
import '../../models/course_model.dart';
import '../../services/course_service.dart';

part 'course_event.dart';
part 'course_state.dart';

class CourseBloc extends Bloc<CourseEvent, CourseState> {
  CourseBloc() : super(const CourseInitial()) {
    on<LoadCourses>(_onLoadCourses);
    on<RefreshCourses>(_onRefreshCourses);
  }

  Future<void> _onLoadCourses(
    LoadCourses event,
    Emitter<CourseState> emit,
  ) async {
    safePrint('[COURSE_API] ========================================');
    safePrint('[COURSE_API] 🚀 LoadCourses event received');
    safePrint('[COURSE_API] [STEP 1] Emitting CourseLoading state...');
    emit(const CourseLoading());
    safePrint('[COURSE_API] [STEP 1] ✅ CourseLoading state emitted');
    try {
      safePrint(
          '[COURSE_API] [STEP 2] Calling CourseService.getAssignedCourses()...');
      safePrint(
          '[COURSE_API] [STEP 2.1] This will trigger GraphQL API call to fetch courses');
      final courses = await CourseService.getAssignedCourses();
      safePrint('[COURSE_API] [STEP 3] ✅ Courses received from API');
      safePrint('[COURSE_API] [STEP 3.1] Number of courses: ${courses.length}');
      safePrint('[COURSE_API] [STEP 4] Emitting CourseLoaded state...');
      emit(CourseLoaded(courses));
      safePrint('[COURSE_API] [STEP 4] ✅ CourseLoaded state emitted');
      safePrint('[COURSE_API] ========================================');
      safePrint('[COURSE_API] ✅ LoadCourses completed successfully');
      safePrint('[COURSE_API] ========================================');
    } catch (e, stackTrace) {
      safePrint('[COURSE_API] [STEP 2] ❌ ERROR occurred during API call');
      safePrint('[COURSE_API] [STEP 2.1] Error type: ${e.runtimeType}');
      safePrint('[COURSE_API] [STEP 2.1] Error message: $e');
      safePrint('[COURSE_API] [STEP 2.1] Stack trace: $stackTrace');
      safePrint('[COURSE_API] [STEP 2.2] Emitting CourseError state...');
      emit(CourseError(e.toString()));
      safePrint('[COURSE_API] [STEP 2.2] ✅ CourseError state emitted');
      safePrint('[COURSE_API] ========================================');
      safePrint('[COURSE_API] ❌ LoadCourses failed');
      safePrint('[COURSE_API] ========================================');
    }
  }

  Future<void> _onRefreshCourses(
    RefreshCourses event,
    Emitter<CourseState> emit,
  ) async {
    safePrint('[REFRESH_COURSES] ========================================');
    safePrint('[REFRESH_COURSES] 🚀 RefreshCourses event received');
    safePrint('[REFRESH_COURSES] [STEP 1] Starting course refresh...');

    try {
      safePrint(
          '[REFRESH_COURSES] [STEP 2] Calling CourseService.getAssignedCourses()...');
      final courses = await CourseService.getAssignedCourses();

      safePrint('[REFRESH_COURSES] [STEP 3] ✅ Courses fetched successfully');
      safePrint(
          '[REFRESH_COURSES] [STEP 3.1] Number of courses: ${courses.length}');

      if (courses.isNotEmpty) {
        safePrint('[REFRESH_COURSES] [STEP 3.2] Course details:');
        for (int i = 0; i < courses.length; i++) {
          final course = courses[i];
          safePrint('[REFRESH_COURSES] [STEP 3.2] Course ${i + 1}:');
          safePrint('[REFRESH_COURSES] [STEP 3.2]   - ID: ${course.id}');
          safePrint('[REFRESH_COURSES] [STEP 3.2]   - Title: ${course.title}');
          safePrint(
              '[REFRESH_COURSES] [STEP 3.2]   - Video Key: ${course.videoKey ?? 'N/A'}');
          safePrint(
              '[REFRESH_COURSES] [STEP 3.2]   - Passing Score: ${course.passingScore ?? 'N/A'}');
          safePrint(
              '[REFRESH_COURSES] [STEP 3.2]   - Assignment Status: ${course.assignmentStatus ?? 'N/A'}');
          safePrint(
              '[REFRESH_COURSES] [STEP 3.2]   - Assignment ID: ${course.assignmentId ?? 'N/A'}');
          safePrint(
              '[REFRESH_COURSES] [STEP 3.2]   - Created At: ${course.createdAt}');
          safePrint(
              '[REFRESH_COURSES] [STEP 3.2]   - Updated At: ${course.updatedAt}');
        }
      } else {
        safePrint('[REFRESH_COURSES] [STEP 3.2] ⚠️ No courses found');
      }

      safePrint('[REFRESH_COURSES] [STEP 4] Emitting CourseLoaded state...');
      emit(CourseLoaded(courses));
      safePrint('[REFRESH_COURSES] [STEP 4] ✅ CourseLoaded state emitted');
      safePrint('[REFRESH_COURSES] ========================================');
      safePrint(
          '[REFRESH_COURSES] ✅ REFRESH COMPLETE - ${courses.length} courses loaded');
      safePrint('[REFRESH_COURSES] ========================================');
    } catch (e, stackTrace) {
      safePrint('[REFRESH_COURSES] [STEP 2] ❌ ERROR occurred');
      safePrint('[REFRESH_COURSES] [STEP 2.1] Error type: ${e.runtimeType}');
      safePrint('[REFRESH_COURSES] [STEP 2.1] Error message: $e');
      safePrint('[REFRESH_COURSES] [STEP 2.1] Stack trace: $stackTrace');
      safePrint('[REFRESH_COURSES] [STEP 2.2] Emitting CourseError state...');
      emit(CourseError(e.toString()));
      safePrint('[REFRESH_COURSES] [STEP 2.2] ✅ CourseError state emitted');
      safePrint('[REFRESH_COURSES] ========================================');
      safePrint('[REFRESH_COURSES] ❌ REFRESH FAILED');
      safePrint('[REFRESH_COURSES] ========================================');
    }
  }
}

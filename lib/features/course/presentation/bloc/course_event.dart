part of 'course_bloc.dart';

abstract class CourseEvent extends BaseEvent {
  const CourseEvent();
}

class LoadCourses extends CourseEvent {
  const LoadCourses();
}

class RefreshCourses extends CourseEvent {
  const RefreshCourses();
}

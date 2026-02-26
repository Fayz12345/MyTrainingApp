part of 'course_bloc.dart';

abstract class CourseState extends BaseState {
  const CourseState();
}

class CourseInitial extends CourseState {
  const CourseInitial();
}

class CourseLoading extends CourseState {
  const CourseLoading();
}

class CourseLoaded extends CourseState {
  final List<Course> courses;

  const CourseLoaded(this.courses);

  @override
  List<Object?> get props => [courses];
}

class CourseError extends CourseState {
  final String message;

  const CourseError(this.message);

  @override
  List<Object?> get props => [message];
}

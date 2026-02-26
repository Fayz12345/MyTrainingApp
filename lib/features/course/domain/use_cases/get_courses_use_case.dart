import '../../data/models/course_model.dart';
import '../../domain/repositories/course_repository.dart';

class GetCoursesUseCase {
  final CourseRepository _repository;

  GetCoursesUseCase(this._repository);
  Future<List<Course>> execute() async {
    return await _repository.getAssignedCourses();
  }
}

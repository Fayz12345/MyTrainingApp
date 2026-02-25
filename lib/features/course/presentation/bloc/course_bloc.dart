import 'package:flutter_bloc/flutter_bloc.dart';
import '../../data/models/course_model.dart';
import '../../services/course_service.dart';
import '../../../../core/bloc/base_state.dart';
import '../../../../core/bloc/base_event.dart';
import '../../../../core/bloc/bloc_error_handler.dart';
import '../../../../core/bloc/data_bloc_mixin.dart';

part 'course_event.dart';
part 'course_state.dart';

class CourseBloc extends Bloc<CourseEvent, CourseState>
    with BlocErrorHandler<CourseEvent, CourseState>,
        DataBlocMixin<CourseEvent, CourseState, Course> {
  CourseBloc() : super(const CourseInitial()) {
    on<LoadCourses>(_onLoadCourses);
    on<RefreshCourses>(_onRefreshCourses);
  }

  @override
  String get blocName => 'COURSE_BLOC';

  @override
  CourseState get loadingState => const CourseLoading();

  @override
  Future<List<Course>> fetchData() => CourseService.getAssignedCourses();

  @override
  CourseState createLoadedState(List<Course> data) => CourseLoaded(data);

  @override
  CourseState createErrorState(String message) => CourseError(message);

  Future<void> _onLoadCourses(
    LoadCourses event,
    Emitter<CourseState> emit,
  ) async {
    await handleLoad(event, emit);
  }

  Future<void> _onRefreshCourses(
    RefreshCourses event,
    Emitter<CourseState> emit,
  ) async {
    await handleRefresh(event, emit);
  }
}

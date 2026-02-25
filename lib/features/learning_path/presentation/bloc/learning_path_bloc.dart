import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:amplify_flutter/amplify_flutter.dart' hide Emitter;
import '../../data/models/learning_path_model.dart';
import '../../services/learning_path_service.dart';
import '../../../../core/bloc/base_state.dart';
import '../../../../core/bloc/base_event.dart';
import '../../../../core/bloc/bloc_error_handler.dart';
import '../../../../core/bloc/data_bloc_mixin.dart';

part 'learning_path_event.dart';
part 'learning_path_state.dart';

class LearningPathBloc extends Bloc<LearningPathEvent, LearningPathState>
    with BlocErrorHandler<LearningPathEvent, LearningPathState>,
        DataBlocMixin<LearningPathEvent, LearningPathState, LearningPath> {
  LearningPathBloc() : super(const LearningPathInitial()) {
    on<LoadLearningPaths>(_onLoadLearningPaths);
    on<RefreshLearningPaths>(_onRefreshLearningPaths);
    on<LoadActiveLearningPaths>(_onLoadActiveLearningPaths);
    on<LoadCompletedLearningPaths>(_onLoadCompletedLearningPaths);
  }

  @override
  String get blocName => 'LEARNING_PATH_BLOC';

  @override
  LearningPathState get loadingState => const LearningPathLoading();

  @override
  Future<List<LearningPath>> fetchData() => LearningPathService.getLearningPaths();

  @override
  LearningPathState createLoadedState(List<LearningPath> data) => LearningPathLoaded(data);

  @override
  LearningPathState createErrorState(String message) => LearningPathError(message);

  Future<void> _onLoadLearningPaths(
    LoadLearningPaths event,
    Emitter<LearningPathState> emit,
  ) async {
    await handleLoad(event, emit);
  }

  Future<void> _onRefreshLearningPaths(
    RefreshLearningPaths event,
    Emitter<LearningPathState> emit,
  ) async {
    await handleRefresh(event, emit);
  }

  Future<void> _onLoadActiveLearningPaths(
    LoadActiveLearningPaths event,
    Emitter<LearningPathState> emit,
  ) async {
    safePrint('[$blocName] 🚀 Loading active learning paths...');
    emit(loadingState);

    final result = await executeWithErrorHandling(
      () => LearningPathService.getActiveLearningPaths(),
      emit,
      blocName,
    );

    if (result != null) {
      safePrint('[$blocName] ✅ Loaded ${result.length} active paths');
      emit(createLoadedState(result));
    }
  }

  Future<void> _onLoadCompletedLearningPaths(
    LoadCompletedLearningPaths event,
    Emitter<LearningPathState> emit,
  ) async {
    safePrint('[$blocName] 🚀 Loading completed learning paths...');
    emit(loadingState);

    final result = await executeWithErrorHandling(
      () => LearningPathService.getCompletedLearningPaths(),
      emit,
      blocName,
    );

    if (result != null) {
      safePrint('[$blocName] ✅ Loaded ${result.length} completed paths');
      emit(createLoadedState(result));
    }
  }
}

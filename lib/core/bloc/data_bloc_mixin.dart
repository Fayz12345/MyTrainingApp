import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:amplify_flutter/amplify_flutter.dart' hide Emitter;
import 'bloc_error_handler.dart';

/// Mixin for BLoCs that load and refresh data
/// Provides common patterns for Load and Refresh operations
mixin DataBlocMixin<Event, State, T> on Bloc<Event, State>, BlocErrorHandler<Event, State> {
  /// Name of the BLoC for logging (override in implementing class)
  String get blocName;

  /// Service method to fetch data (override in implementing class)
  Future<List<T>> fetchData();

  /// Create loading state (override in implementing class)
  State get loadingState;

  /// Create loaded state with data (override in implementing class)
  State createLoadedState(List<T> data);

  /// Create error state (override in implementing class)
  State createErrorState(String message);

  /// Handle load event
  Future<void> handleLoad(
    Event event,
    Emitter<State> emit,
  ) async {
    safePrint('[$blocName] 🚀 Loading data...');
    emit(loadingState);

    final result = await executeWithErrorHandling(
      () => fetchData(),
      emit,
      blocName,
    );

    if (result != null) {
      safePrint('[$blocName] ✅ Loaded ${result.length} items');
      emit(createLoadedState(result));
    }
  }

  /// Handle refresh event
  Future<void> handleRefresh(
    Event event,
    Emitter<State> emit,
  ) async {
    safePrint('[$blocName] 🔄 Refreshing data...');
    emit(loadingState);

    final result = await executeWithErrorHandling(
      () => fetchData(),
      emit,
      blocName,
    );

    if (result != null) {
      safePrint('[$blocName] ✅ Refreshed ${result.length} items');
      emit(createLoadedState(result));
    }
  }
}

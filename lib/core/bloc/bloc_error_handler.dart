import 'package:amplify_flutter/amplify_flutter.dart' hide Emitter;
import 'package:flutter_bloc/flutter_bloc.dart';


mixin BlocErrorHandler<Event, State> on Bloc<Event, State> {
  /// Create error state (override in implementing class)
  State createErrorState(String message);


  void handleError(
    Object error,
    StackTrace stackTrace,
    Emitter<State> emit,
    String blocName, {
    String? customMessage,
  }) {
    final errorMessage = customMessage ?? error.toString();
    safePrint('[$blocName] ❌ Error: $errorMessage');
    safePrint('[$blocName] Stack trace: $stackTrace');
    emit(createErrorState(errorMessage));
  }

  /// Execute async operation with error handling
  Future<T?> executeWithErrorHandling<T>(
    Future<T> Function() operation,
    Emitter<State> emit,
    String blocName, {
    String? customErrorMessage,
  }) async {
    try {
      return await operation();
    } catch (e, stackTrace) {
      handleError(e, stackTrace, emit, blocName, customMessage: customErrorMessage);
      return null;
    }
  }
}

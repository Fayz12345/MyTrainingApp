import 'package:equatable/equatable.dart';

/// Base state class for all BLoC states
abstract class BaseState extends Equatable {
  const BaseState();

  @override
  List<Object?> get props => [];
}

/// Initial state - BLoC hasn't started any operation yet
class InitialState extends BaseState {
  const InitialState();
}

/// Loading state - BLoC is currently processing a request
class LoadingState extends BaseState {
  const LoadingState();
}

/// Error state - BLoC encountered an error
class ErrorState extends BaseState {
  final String message;
  final Object? error;

  const ErrorState(this.message, {this.error});

  @override
  List<Object?> get props => [message, error];
}

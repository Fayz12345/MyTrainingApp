import 'package:equatable/equatable.dart';

/// Base event class for all BLoC events
abstract class BaseEvent extends Equatable {
  const BaseEvent();

  @override
  List<Object?> get props => [];
}

/// Load event - triggers loading of data
class LoadEvent extends BaseEvent {
  const LoadEvent();
}

/// Refresh event - triggers refresh of data
class RefreshEvent extends BaseEvent {
  const RefreshEvent();
}

part of 'notifications_bloc.dart';

abstract class NotificationsState extends Equatable {
  const NotificationsState();

  @override
  List<Object?> get props => [];
}

class NotificationsInitial extends NotificationsState {
  const NotificationsInitial();
}

class NotificationsLoading extends NotificationsState {
  const NotificationsLoading();
}

class NotificationsLoaded extends NotificationsState {
  final Map<String, bool> notificationSettings;

  const NotificationsLoaded({required this.notificationSettings});

  @override
  List<Object?> get props => [notificationSettings];
}

class NotificationsError extends NotificationsState {
  final String message;

  const NotificationsError(this.message);

  @override
  List<Object?> get props => [message];
}

class NotificationsUpdating extends NotificationsState {
  const NotificationsUpdating();
}

class NotificationsUpdated extends NotificationsState {
  final Map<String, bool> notificationSettings;

  const NotificationsUpdated({required this.notificationSettings});

  @override
  List<Object?> get props => [notificationSettings];
}

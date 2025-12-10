part of 'notifications_bloc.dart';

abstract class NotificationsEvent extends Equatable {
  const NotificationsEvent();

  @override
  List<Object?> get props => [];
}

class LoadNotifications extends NotificationsEvent {
  const LoadNotifications();
}

class UpdateNotificationSettings extends NotificationsEvent {
  final Map<String, bool> notificationSettings;

  const UpdateNotificationSettings({required this.notificationSettings});

  @override
  List<Object?> get props => [notificationSettings];
}

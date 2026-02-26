import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';

part 'notifications_event.dart';
part 'notifications_state.dart';

class NotificationsBloc extends Bloc<NotificationsEvent, NotificationsState> {
  NotificationsBloc() : super(const NotificationsInitial()) {
    on<LoadNotifications>(_onLoadNotifications);
    on<UpdateNotificationSettings>(_onUpdateNotificationSettings);
  }

  Future<void> _onLoadNotifications(
    LoadNotifications event,
    Emitter<NotificationsState> emit,
  ) async {
    emit(const NotificationsLoading());

    try {
      // TODO: Load notification settings from backend/API
      // For now, return default settings
      await Future.delayed(const Duration(milliseconds: 500));

      emit(const NotificationsLoaded(notificationSettings: {}));
    } catch (e) {
      emit(NotificationsError('Failed to load notifications: $e'));
    }
  }

  Future<void> _onUpdateNotificationSettings(
    UpdateNotificationSettings event,
    Emitter<NotificationsState> emit,
  ) async {
    emit(const NotificationsUpdating());

    try {
      // TODO: Save notification settings to backend/API
      await Future.delayed(const Duration(seconds: 1));

      emit(NotificationsUpdated(
        notificationSettings: event.notificationSettings,
      ));
    } catch (e) {
      emit(NotificationsError('Failed to update notifications: $e'));
    }
  }
}

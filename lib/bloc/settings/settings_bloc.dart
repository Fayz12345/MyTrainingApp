import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';

part 'settings_event.dart';
part 'settings_state.dart';

class SettingsBloc extends Bloc<SettingsEvent, SettingsState> {
  SettingsBloc() : super(const SettingsInitial()) {
    on<LoadSettings>(_onLoadSettings);
    on<UpdateSettings>(_onUpdateSettings);
  }

  Future<void> _onLoadSettings(
    LoadSettings event,
    Emitter<SettingsState> emit,
  ) async {
    emit(const SettingsLoading());

    try {
      // TODO: Load settings from backend/API
      // For now, return default settings
      await Future.delayed(const Duration(milliseconds: 500));

      emit(const SettingsLoaded(settings: {}));
    } catch (e) {
      emit(SettingsError('Failed to load settings: $e'));
    }
  }

  Future<void> _onUpdateSettings(
    UpdateSettings event,
    Emitter<SettingsState> emit,
  ) async {
    emit(const SettingsUpdating());

    try {
      // TODO: Save settings to backend/API
      await Future.delayed(const Duration(seconds: 1));

      emit(SettingsUpdated(settings: event.settings));
    } catch (e) {
      emit(SettingsError('Failed to update settings: $e'));
    }
  }
}

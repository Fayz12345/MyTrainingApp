import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../../domain/use_cases/get_bank_info_submitted_use_case.dart';

part 'settings_event.dart';
part 'settings_state.dart';

class SettingsBloc extends Bloc<SettingsEvent, SettingsState> {
  SettingsBloc(this._getBankInfoSubmittedUseCase) : super(const SettingsInitial()) {
    on<LoadSettings>(_onLoadSettings);
    on<UpdateSettings>(_onUpdateSettings);
    on<RefreshBankInfoStatus>(_onRefreshBankInfoStatus);
  }

  final GetBankInfoSubmittedUseCase _getBankInfoSubmittedUseCase;

  Future<void> _onLoadSettings(
    LoadSettings event,
    Emitter<SettingsState> emit,
  ) async {
    emit(const SettingsLoading());

    try {
      // Load settings from backend/API (placeholder)
      await Future.delayed(const Duration(milliseconds: 300));

      // Bank info status from Employee table (API-first, dynamic)
      final bankStatus = await _getBankInfoSubmittedUseCase.execute();

      emit(SettingsLoaded(
        settings: {},
        bankInfoSubmitted: bankStatus.hasSubmitted,
      ));
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
      await Future.delayed(const Duration(seconds: 1));

      final currentSubmitted = state is SettingsLoaded
          ? (state as SettingsLoaded).bankInfoSubmitted
          : false;

      emit(SettingsUpdated(
        settings: event.settings,
        bankInfoSubmitted: currentSubmitted,
      ));
    } catch (e) {
      emit(SettingsError('Failed to update settings: $e'));
    }
  }

  Future<void> _onRefreshBankInfoStatus(
    RefreshBankInfoStatus event,
    Emitter<SettingsState> emit,
  ) async {
    final currentSettings = state is SettingsLoaded
        ? (state as SettingsLoaded).settings
        : <String, dynamic>{};

    try {
      final bankStatus = await _getBankInfoSubmittedUseCase.execute();
      emit(SettingsLoaded(
        settings: currentSettings,
        bankInfoSubmitted: bankStatus.hasSubmitted,
      ));
    } catch (e) {
      if (state is SettingsLoaded) {
        emit(SettingsLoaded(
          settings: currentSettings,
          bankInfoSubmitted: (state as SettingsLoaded).bankInfoSubmitted,
        ));
      }
    }
  }
}

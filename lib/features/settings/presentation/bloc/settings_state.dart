part of 'settings_bloc.dart';

abstract class SettingsState extends Equatable {
  const SettingsState();

  @override
  List<Object?> get props => [];
}

class SettingsInitial extends SettingsState {
  const SettingsInitial();
}

class SettingsLoading extends SettingsState {
  const SettingsLoading();
}

class SettingsLoaded extends SettingsState {
  final Map<String, dynamic> settings;
  /// From Employee table (API): true when banking fields are filled; false → show alert icon.
  final bool bankInfoSubmitted;

  const SettingsLoaded({
    required this.settings,
    required this.bankInfoSubmitted,
  });

  /// Show alert when Employee has no banking info (dynamic from API, not local).
  bool get showBankInfoAlert => !bankInfoSubmitted;

  @override
  List<Object?> get props => [settings, bankInfoSubmitted];
}

class SettingsError extends SettingsState {
  final String message;

  const SettingsError(this.message);

  @override
  List<Object?> get props => [message];
}

class SettingsUpdating extends SettingsState {
  const SettingsUpdating();
}

class SettingsUpdated extends SettingsState {
  final Map<String, dynamic> settings;
  final bool bankInfoSubmitted;

  const SettingsUpdated({
    required this.settings,
    required this.bankInfoSubmitted,
  });

  bool get showBankInfoAlert => !bankInfoSubmitted;

  @override
  List<Object?> get props => [settings, bankInfoSubmitted];
}

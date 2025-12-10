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

  const SettingsLoaded({required this.settings});

  @override
  List<Object?> get props => [settings];
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

  const SettingsUpdated({required this.settings});

  @override
  List<Object?> get props => [settings];
}

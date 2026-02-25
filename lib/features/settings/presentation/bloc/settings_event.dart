part of 'settings_bloc.dart';

abstract class SettingsEvent extends Equatable {
  const SettingsEvent();

  @override
  List<Object?> get props => [];
}

class LoadSettings extends SettingsEvent {
  const LoadSettings();
}

class UpdateSettings extends SettingsEvent {
  final Map<String, dynamic> settings;

  const UpdateSettings({required this.settings});

  @override
  List<Object?> get props => [settings];
}

/// Refresh bank info status from Employee table (e.g. after returning from BankingInformationScreen).
class RefreshBankInfoStatus extends SettingsEvent {
  const RefreshBankInfoStatus();
}

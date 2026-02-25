part of 'help_bloc.dart';

abstract class HelpEvent extends Equatable {
  const HelpEvent();

  @override
  List<Object?> get props => [];
}

class LoadHelpContent extends HelpEvent {
  const LoadHelpContent();
}

class SubmitSupportRequest extends HelpEvent {
  final String subject;
  final String message;

  const SubmitSupportRequest({
    required this.subject,
    required this.message,
  });

  @override
  List<Object?> get props => [subject, message];
}

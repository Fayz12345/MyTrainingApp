part of 'help_bloc.dart';

abstract class HelpState extends Equatable {
  const HelpState();

  @override
  List<Object?> get props => [];
}

class HelpInitial extends HelpState {
  const HelpInitial();
}

class HelpLoading extends HelpState {
  const HelpLoading();
}

class HelpLoaded extends HelpState {
  final Map<String, dynamic> helpContent;

  const HelpLoaded({required this.helpContent});

  @override
  List<Object?> get props => [helpContent];
}

class HelpError extends HelpState {
  final String message;

  const HelpError(this.message);

  @override
  List<Object?> get props => [message];
}

class HelpSubmitting extends HelpState {
  const HelpSubmitting();
}

class HelpSubmitted extends HelpState {
  const HelpSubmitted();
}

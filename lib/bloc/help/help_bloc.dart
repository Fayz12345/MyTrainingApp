import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';

part 'help_event.dart';
part 'help_state.dart';

class HelpBloc extends Bloc<HelpEvent, HelpState> {
  HelpBloc() : super(const HelpInitial()) {
    on<LoadHelpContent>(_onLoadHelpContent);
    on<SubmitSupportRequest>(_onSubmitSupportRequest);
  }

  Future<void> _onLoadHelpContent(
    LoadHelpContent event,
    Emitter<HelpState> emit,
  ) async {
    emit(const HelpLoading());

    try {
      // TODO: Load help content from backend/API
      // For now, return empty content
      await Future.delayed(const Duration(milliseconds: 500));

      emit(const HelpLoaded(helpContent: {}));
    } catch (e) {
      emit(HelpError('Failed to load help content: $e'));
    }
  }

  Future<void> _onSubmitSupportRequest(
    SubmitSupportRequest event,
    Emitter<HelpState> emit,
  ) async {
    emit(const HelpSubmitting());

    try {
      // TODO: Submit support request to backend/API
      await Future.delayed(const Duration(seconds: 1));

      emit(const HelpSubmitted());
    } catch (e) {
      emit(HelpError('Failed to submit support request: $e'));
    }
  }
}

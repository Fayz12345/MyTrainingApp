import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../../services/auth_service.dart';

part 'profile_event.dart';
part 'profile_state.dart';

class ProfileBloc extends Bloc<ProfileEvent, ProfileState> {
  ProfileBloc() : super(const ProfileInitial()) {
    on<LoadProfile>(_onLoadProfile);
    on<UpdateProfile>(_onUpdateProfile);
  }

  Future<void> _onLoadProfile(
    LoadProfile event,
    Emitter<ProfileState> emit,
  ) async {
    emit(const ProfileLoading());

    try {
      final email = await AuthService.getCurrentUserEmail();
      final username = await AuthService.getCurrentUsername();

      // Extract display name from username/email
      String displayName = 'User';
      if (username != null && username.isNotEmpty) {
        if (username.contains('@')) {
          final namePart = username.split('@')[0];
          displayName = namePart
              .split('.')
              .map((word) => word.isEmpty
                  ? ''
                  : word[0].toUpperCase() + word.substring(1).toLowerCase())
              .join(' ');
        } else {
          displayName = username;
        }
      }

      emit(ProfileLoaded(
        email: email,
        username: username,
        name: displayName,
        businessUnit: 'Product Development', // Default value
        store: 'San Francisco, CA', // Default value
      ));
    } catch (e) {
      emit(ProfileError('Failed to load profile: $e'));
    }
  }

  Future<void> _onUpdateProfile(
    UpdateProfile event,
    Emitter<ProfileState> emit,
  ) async {
    emit(const ProfileUpdating());

    try {
      // TODO: Implement actual save to backend/API
      // For now, just simulate a save operation
      await Future.delayed(const Duration(seconds: 1));

      emit(ProfileUpdated(
        name: event.name,
        businessUnit: event.businessUnit,
        store: event.store,
      ));
    } catch (e) {
      emit(ProfileError('Failed to update profile: $e'));
    }
  }
}

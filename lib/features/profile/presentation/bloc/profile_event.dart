part of 'profile_bloc.dart';

abstract class ProfileEvent extends Equatable {
  const ProfileEvent();

  @override
  List<Object?> get props => [];
}

class LoadProfile extends ProfileEvent {
  const LoadProfile();
}

class UpdateProfile extends ProfileEvent {
  final String name;
  final String businessUnit;
  final String store;

  const UpdateProfile({
    required this.name,
    required this.businessUnit,
    required this.store,
  });

  @override
  List<Object?> get props => [name, businessUnit, store];
}

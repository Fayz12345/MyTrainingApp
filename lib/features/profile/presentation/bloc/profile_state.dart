part of 'profile_bloc.dart';

abstract class ProfileState extends Equatable {
  const ProfileState();

  @override
  List<Object?> get props => [];
}

class ProfileInitial extends ProfileState {
  const ProfileInitial();
}

class ProfileLoading extends ProfileState {
  const ProfileLoading();
}

class ProfileLoaded extends ProfileState {
  final String? email;
  final String? username;
  final String name;
  final String businessUnit;
  final String store;

  const ProfileLoaded({
    this.email,
    this.username,
    required this.name,
    required this.businessUnit,
    required this.store,
  });

  @override
  List<Object?> get props => [email, username, name, businessUnit, store];
}

class ProfileError extends ProfileState {
  final String message;

  const ProfileError(this.message);

  @override
  List<Object?> get props => [message];
}

class ProfileUpdating extends ProfileState {
  const ProfileUpdating();
}

class ProfileUpdated extends ProfileState {
  final String name;
  final String businessUnit;
  final String store;

  const ProfileUpdated({
    required this.name,
    required this.businessUnit,
    required this.store,
  });

  @override
  List<Object?> get props => [name, businessUnit, store];
}

part of 'auth_bloc.dart';

abstract class AuthEvent extends Equatable {
  const AuthEvent();

  @override
  List<Object?> get props => [];
}

class CheckUserGroups extends AuthEvent {
  const CheckUserGroups();
}

class SignOut extends AuthEvent {
  const SignOut();
}

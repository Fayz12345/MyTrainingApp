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

class SignIn extends AuthEvent {
  final String email;
  final String password;

  const SignIn({
    required this.email,
    required this.password,
  });

  @override
  List<Object?> get props => [email, password];
}

class SignUp extends AuthEvent {
  final String email;
  final String password;

  const SignUp({
    required this.email,
    required this.password,
  });

  @override
  List<Object?> get props => [email, password];
}

class ResetPassword extends AuthEvent {
  final String email;

  const ResetPassword({required this.email});

  @override
  List<Object?> get props => [email];
}

class ConfirmResetPassword extends AuthEvent {
  final String email;
  final String newPassword;
  final String confirmationCode;

  const ConfirmResetPassword({
    required this.email,
    required this.newPassword,
    required this.confirmationCode,
  });

  @override
  List<Object?> get props => [email, newPassword, confirmationCode];
}

class ConfirmSignUp extends AuthEvent {
  final String email;
  final String password;
  final String confirmationCode;

  const ConfirmSignUp({
    required this.email,
    required this.password,
    required this.confirmationCode,
  });

  @override
  List<Object?> get props => [email, password, confirmationCode];
}

class SignInWithGoogle extends AuthEvent {
  const SignInWithGoogle();
}

class SignInWithApple extends AuthEvent {
  const SignInWithApple();
}

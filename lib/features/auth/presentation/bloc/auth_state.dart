part of 'auth_bloc.dart';

abstract class AuthState extends Equatable {
  const AuthState();

  @override
  List<Object?> get props => [];
}

class AuthInitial extends AuthState {
  const AuthInitial();
}

class AuthLoading extends AuthState {
  const AuthLoading();
}

class AuthAuthenticated extends AuthState {
  final bool isEmployee;
  final String? username;
  final String? userId;

  const AuthAuthenticated({
    required this.isEmployee,
    this.username,
    this.userId,
  });

  @override
  List<Object?> get props => [isEmployee, username, userId];
}

class AuthUnauthenticated extends AuthState {
  final String? message;

  const AuthUnauthenticated({this.message});

  @override
  List<Object?> get props => [message];
}

class AuthError extends AuthState {
  final String message;

  const AuthError(this.message);

  @override
  List<Object?> get props => [message];
}

class PasswordResetCodeSent extends AuthState {
  final String email;

  const PasswordResetCodeSent({required this.email});

  @override
  List<Object?> get props => [email];
}

class PasswordResetSuccess extends AuthState {
  const PasswordResetSuccess();
}

class SignUpConfirmationRequired extends AuthState {
  final String email;
  final String password;

  const SignUpConfirmationRequired({
    required this.email,
    required this.password,
  });

  @override
  List<Object?> get props => [email, password];
}

class AccountCreatedSuccess extends AuthState {
  final String email;

  const AccountCreatedSuccess({required this.email});

  @override
  List<Object?> get props => [email];
}

class VerificationRequired extends AuthState {
  final String email;
  final String password;

  const VerificationRequired({
    required this.email,
    required this.password,
  });

  @override
  List<Object?> get props => [email, password];
}

import 'package:equatable/equatable.dart';

/// Domain entity: whether the current employee has submitted banking info.
/// Source of truth is the Employee table (API); empty banking fields → show alert.
class BankInfoStatus extends Equatable {
  const BankInfoStatus({required this.hasSubmitted});

  /// True when Employee record has transitNumber, institutionNumber, accountNumber filled.
  final bool hasSubmitted;

  /// Show alert icon when banking info is not submitted (from Employee table).
  bool get showAlert => !hasSubmitted;

  @override
  List<Object?> get props => [hasSubmitted];
}

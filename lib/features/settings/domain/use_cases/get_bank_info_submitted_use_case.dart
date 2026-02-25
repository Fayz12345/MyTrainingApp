import '../entities/bank_info_status.dart';
import '../repositories/bank_info_repository.dart';

/// Use case: get whether current employee has submitted banking info (from Employee table).
class GetBankInfoSubmittedUseCase {
  GetBankInfoSubmittedUseCase(this._repository);
  final BankInfoRepository _repository;

  Future<BankInfoStatus> execute() async {
    final submitted = await _repository.hasSubmittedBankInfo();
    return BankInfoStatus(hasSubmitted: submitted);
  }
}

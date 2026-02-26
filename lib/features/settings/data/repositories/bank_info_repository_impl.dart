import '../../domain/repositories/bank_info_repository.dart';
import '../../services/bank_info_service.dart';

/// Data layer: implements BankInfoRepository using BankInfoService.
/// BankInfoService reads from Employee table (API first); empty banking fields → false.
class BankInfoRepositoryImpl implements BankInfoRepository {
  @override
  Future<bool> hasSubmittedBankInfo() =>
      BankInfoService.hasSubmittedBankInfo();
}

/// Repository interface for bank info status (Employee table).
/// Domain depends on abstraction; data layer implements this.
abstract class BankInfoRepository {
  /// Whether the current employee has submitted banking info (from Employee table).
  /// Uses API first; empty banking fields in DB → false (show alert).
  Future<bool> hasSubmittedBankInfo();
}

import 'dart:io';
import 'dart:convert';
import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:amplify_api/amplify_api.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:path_provider/path_provider.dart';
import '../../auth/services/auth_service.dart';

/// Keys for SharedPreferences (local cache / fallback when API unavailable)
const String _keyTransitNumber = 'bank_info_transit_number';
const String _keyInstitutionNumber = 'bank_info_institution_number';
const String _keyAccountNumber = 'bank_info_account_number';
const String _keyAttachmentPath = 'bank_info_attachment_path';
const String _keySubmittedAt = 'bank_info_submitted_at';
const String _keyEmployeeId = 'bank_info_employee_id';

/// S3 path prefix for bank documents (under log/* - Employees have read/write).
String _bankStoragePath(String userId) => 'log/$userId/bank';

/// Service to save/load employee banking information.
/// Uses Employee table fields: transitNumber, institutionNumber, accountNumber, bankingDocumentKey.
/// Persists via Amplify API (assets/amplify_outputs.json). Falls back to local if API unavailable.
class BankInfoService {
  static SharedPreferences? _prefs;

  static Future<SharedPreferences> _getPrefs() async {
    _prefs ??= await SharedPreferences.getInstance();
    return _prefs!;
  }

  /// Whether the user has submitted bank information (all three numbers filled).
  static Future<bool> hasSubmittedBankInfo() async {
    safePrint(
      '[BANK_INFO] hasSubmittedBankInfo() called – checking if alert icon should show',
    );
    try {
      final userId = await AuthService.getCurrentUserId();
      if (userId == null) {
        safePrint('[BANK_INFO] No userId – using local check');
        return _hasSubmittedLocal();
      }

      safePrint(
        '[BANK_INFO] API: listEmployees(filter: userId) – fetching Employee bank fields',
      );
      final employee = await _fetchEmployeeByUserId(userId);
      if (employee != null) {
        final t = (employee['transitNumber'] as String?)?.trim();
        final i = (employee['institutionNumber'] as String?)?.trim();
        final a = (employee['accountNumber'] as String?)?.trim();
        if (t != null &&
            t.isNotEmpty &&
            i != null &&
            i.isNotEmpty &&
            a != null &&
            a.isNotEmpty) {
          safePrint(
            '[BANK_INFO] ✅ Bank info found in database – alert icon will be REMOVED',
          );
          await _syncToLocalFromEmployee(employee);
          return true;
        }
        // Database says bank fields are empty – show alert; do NOT use local (database is source of truth)
        safePrint(
          '[BANK_INFO] Employee found but bank fields empty – alert icon will SHOW (returning false)',
        );
        return false;
      } else {
        safePrint(
          '[BANK_INFO] No employee record for userId – using local result',
        );
      }
    } catch (e) {
      safePrint('[BANK_INFO] hasSubmittedBankInfo API fallback: $e');
    }
    final local = await _hasSubmittedLocal();
    safePrint('[BANK_INFO] Using local result: hasSubmitted=$local');
    return local;
  }

  static Future<bool> _hasSubmittedLocal() async {
    final prefs = await _getPrefs();
    final submittedAt = prefs.getString(_keySubmittedAt);
    return submittedAt != null && submittedAt.isNotEmpty;
  }

  static Future<String?> getTransitNumber() async {
    final prefs = await _getPrefs();
    return prefs.getString(_keyTransitNumber);
  }

  static Future<String?> getInstitutionNumber() async {
    final prefs = await _getPrefs();
    return prefs.getString(_keyInstitutionNumber);
  }

  static Future<String?> getAccountNumber() async {
    final prefs = await _getPrefs();
    return prefs.getString(_keyAccountNumber);
  }

  static Future<String?> getAttachmentPath() async {
    final prefs = await _getPrefs();
    return prefs.getString(_keyAttachmentPath);
  }

  /// Load bank info from Employee (API first), then local.
  static Future<BankInfoModel> load() async {
    safePrint('[BANK_INFO] load() called');
    try {
      final userId = await AuthService.getCurrentUserId();
      if (userId != null) {
        safePrint(
          '[BANK_INFO] API: listEmployees(filter: userId) – loading bank info',
        );
        final employee = await _fetchEmployeeByUserId(userId);
        if (employee != null) {
          safePrint('[BANK_INFO] ✅ Loaded from database (Employee)');
          final model = _employeeToModel(employee);
          await _syncToLocal(model);
          return model;
        }
      }
    } catch (e) {
      safePrint('[BANK_INFO] load API fallback: $e');
    }
    safePrint('[BANK_INFO] Loading from local cache');
    return _loadLocal();
  }

  static Future<BankInfoModel> _loadLocal() async {
    final prefs = await _getPrefs();
    return BankInfoModel(
      transitNumber: prefs.getString(_keyTransitNumber) ?? '',
      institutionNumber: prefs.getString(_keyInstitutionNumber) ?? '',
      accountNumber: prefs.getString(_keyAccountNumber) ?? '',
      attachmentPath: prefs.getString(_keyAttachmentPath),
      submittedAt: prefs.getString(_keySubmittedAt),
      id: prefs.getString(_keyEmployeeId),
    );
  }

  /// Save: upload attachment to S3 (bankingDocumentKey), then update Employee; sync to local.
  static Future<void> save({
    required String transitNumber,
    required String institutionNumber,
    required String accountNumber,
    File? attachmentFile,
  }) async {
    safePrint('[BANK_INFO] ========== SAVE BANK INFO START ==========');
    final userId = await AuthService.getCurrentUserId() ?? 'local';
    final prefs = await _getPrefs();

    String? bankingDocumentKey;
    if (attachmentFile != null && await attachmentFile.exists()) {
      try {
        safePrint(
          '[BANK_INFO] Uploading attachment to S3 (log/$userId/bank/...)',
        );
        bankingDocumentKey = await _uploadAttachment(userId, attachmentFile);
        safePrint('[BANK_INFO] ✅ Attachment uploaded: $bankingDocumentKey');
      } catch (e) {
        safePrint('[BANK_INFO] upload attachment failed: $e');
      }
    }

    try {
      safePrint(
        '[BANK_INFO] API: listEmployees(filter: userId) – get Employee id',
      );
      final employee = await _fetchEmployeeByUserId(userId);
      if (employee != null) {
        final employeeId = employee['id'] as String?;
        if (employeeId != null && employeeId.isNotEmpty) {
          safePrint('[BANK_INFO] API: updateEmployee – submitting to database');
          await _updateEmployeeInApi(
            id: employeeId,
            transitNumber: transitNumber.trim(),
            institutionNumber: institutionNumber.trim(),
            accountNumber: accountNumber.trim(),
            bankingDocumentKey: bankingDocumentKey,
          );
          await prefs.setString(_keyEmployeeId, employeeId);
          safePrint(
            '[BANK_INFO] ✅ Successfully submitted to database (updateEmployee). Alert icon will be REMOVED.',
          );
        } else {
          safePrint(
            '[BANK_INFO] ⚠️ Employee has no id – cannot update, saving locally only',
          );
        }
      } else {
        safePrint(
          '[BANK_INFO] ⚠️ No Employee record for user – saving locally only',
        );
      }
    } catch (e) {
      safePrint('[BANK_INFO] save API failed, saving locally: $e');
    }

    safePrint('[BANK_INFO] Syncing to local cache');
    await _saveLocal(
      prefs: prefs,
      userId: userId,
      transitNumber: transitNumber.trim(),
      institutionNumber: institutionNumber.trim(),
      accountNumber: accountNumber.trim(),
      attachmentFile: attachmentFile,
      bankingDocumentKey: bankingDocumentKey,
    );
    safePrint('[BANK_INFO] ========== SAVE BANK INFO END ==========');
  }

  static Future<String> _uploadAttachment(String userId, File file) async {
    final ext = file.path.split('.').last;
    final key =
        '${_bankStoragePath(userId)}/bank_doc_${DateTime.now().millisecondsSinceEpoch}.$ext';
    await Amplify.Storage.uploadFile(
      path: StoragePath.fromString(key),
      localFile: AWSFile.fromPath(file.path),
    ).result;
    return key;
  }

  /// Query Employee by userId (includes bank fields).
  static const String _listEmployeesQuery = r'''
    query ListEmployeesBankInfo($userId: String!) {
      listEmployees(filter: { userId: { eq: $userId } }) {
        items {
          id
          userId
          transitNumber
          institutionNumber
          accountNumber
          bankingDocumentKey
          updatedAt
        }
      }
    }
  ''';

  static Future<Map<String, dynamic>?> _fetchEmployeeByUserId(
    String userId,
  ) async {
    final request = GraphQLRequest<String>(
      document: _listEmployeesQuery,
      variables: {'userId': userId},
    );
    safePrint(
      '[BANK_INFO] GraphQL query: listEmployees(filter: { userId: { eq: \$userId } })',
    );
    final response = await Amplify.API.query(request: request).response;
    if (response.errors.isNotEmpty) {
      safePrint(
        '[BANK_INFO] listEmployees errors: ${response.errors.map((e) => e.message).toList()}',
      );
      throw Exception(response.errors.first.message);
    }
    final data = jsonDecode(response.data ?? '{}') as Map<String, dynamic>;
    final list = data['listEmployees']?['items'] as List?;
    if (list == null || list.isEmpty) {
      safePrint('[BANK_INFO] listEmployees returned 0 items');
      return null;
    }
    safePrint('[BANK_INFO] listEmployees returned ${list.length} item(s)');
    return list.first as Map<String, dynamic>;
  }

  static BankInfoModel _employeeToModel(Map<String, dynamic> employee) {
    return BankInfoModel(
      id: employee['id'] as String?,
      transitNumber: employee['transitNumber'] as String? ?? '',
      institutionNumber: employee['institutionNumber'] as String? ?? '',
      accountNumber: employee['accountNumber'] as String? ?? '',
      attachmentPath: employee['bankingDocumentKey'] as String?,
      submittedAt: employee['updatedAt'] as String?,
    );
  }

  /// Update Employee with bank fields.
  static const String _updateEmployeeMutation = r'''
    mutation UpdateEmployee($input: UpdateEmployeeInput!) {
      updateEmployee(input: $input) {
        id
        userId
        transitNumber
        institutionNumber
        accountNumber
        bankingDocumentKey
        updatedAt
      }
    }
  ''';

  static Future<void> _updateEmployeeInApi({
    required String id,
    required String transitNumber,
    required String institutionNumber,
    required String accountNumber,
    String? bankingDocumentKey,
  }) async {
    final input = <String, dynamic>{
      'id': id,
      'transitNumber': transitNumber,
      'institutionNumber': institutionNumber,
      'accountNumber': accountNumber,
      if (bankingDocumentKey != null) 'bankingDocumentKey': bankingDocumentKey,
    };
    safePrint(
      '[BANK_INFO] GraphQL mutation: updateEmployee(input: { id, transitNumber, institutionNumber, accountNumber, bankingDocumentKey })',
    );
    safePrint('[BANK_INFO] updateEmployee input: $input');
    final request = GraphQLRequest<String>(
      document: _updateEmployeeMutation,
      variables: {'input': input},
    );
    final response = await Amplify.API.mutate(request: request).response;
    if (response.errors.isNotEmpty) {
      safePrint(
        '[BANK_INFO] updateEmployee errors: ${response.errors.map((e) => e.message).toList()}',
      );
      throw Exception(response.errors.first.message);
    }
    safePrint('[BANK_INFO] updateEmployee response: ${response.data}');
  }

  static Future<void> _syncToLocal(BankInfoModel model) async {
    final prefs = await _getPrefs();
    await prefs.setString(_keyTransitNumber, model.transitNumber);
    await prefs.setString(_keyInstitutionNumber, model.institutionNumber);
    await prefs.setString(_keyAccountNumber, model.accountNumber);
    if (model.attachmentPath != null) {
      await prefs.setString(_keyAttachmentPath, model.attachmentPath!);
    } else {
      await prefs.remove(_keyAttachmentPath);
    }
    if (model.submittedAt != null) {
      await prefs.setString(_keySubmittedAt, model.submittedAt!);
    }
    if (model.id != null) {
      await prefs.setString(_keyEmployeeId, model.id!);
    }
  }

  static Future<void> _syncToLocalFromEmployee(
    Map<String, dynamic> employee,
  ) async {
    final model = _employeeToModel(employee);
    await _syncToLocal(model);
  }

  static Future<void> _saveLocal({
    required SharedPreferences prefs,
    required String userId,
    required String transitNumber,
    required String institutionNumber,
    required String accountNumber,
    File? attachmentFile,
    String? bankingDocumentKey,
  }) async {
    await prefs.setString(_keyTransitNumber, transitNumber);
    await prefs.setString(_keyInstitutionNumber, institutionNumber);
    await prefs.setString(_keyAccountNumber, accountNumber);
    await prefs.setString(_keySubmittedAt, DateTime.now().toIso8601String());

    if (bankingDocumentKey != null) {
      await prefs.setString(_keyAttachmentPath, bankingDocumentKey);
    } else if (attachmentFile != null && await attachmentFile.exists()) {
      final dir = await getApplicationDocumentsDirectory();
      final bankDir = Directory('${dir.path}/bank_documents');
      if (!await bankDir.exists()) await bankDir.create(recursive: true);
      final ext = attachmentFile.path.split('.').last;
      final dest = File(
        '${bankDir.path}/bank_doc_${userId}_${DateTime.now().millisecondsSinceEpoch}.$ext',
      );
      await attachmentFile.copy(dest.path);
      await prefs.setString(_keyAttachmentPath, dest.path);
    } else {
      await prefs.remove(_keyAttachmentPath);
    }
  }

  static Future<void> clear() async {
    final prefs = await _getPrefs();
    await prefs.remove(_keyTransitNumber);
    await prefs.remove(_keyInstitutionNumber);
    await prefs.remove(_keyAccountNumber);
    await prefs.remove(_keyAttachmentPath);
    await prefs.remove(_keySubmittedAt);
    await prefs.remove(_keyEmployeeId);
  }
}

class BankInfoModel {
  final String? id;
  final String transitNumber;
  final String institutionNumber;
  final String accountNumber;
  final String? attachmentPath;
  final String? submittedAt;

  const BankInfoModel({
    this.id,
    required this.transitNumber,
    required this.institutionNumber,
    required this.accountNumber,
    this.attachmentPath,
    this.submittedAt,
  });

  bool get isSubmitted => submittedAt != null && submittedAt!.isNotEmpty;
  bool get hasAttachment =>
      attachmentPath != null && attachmentPath!.isNotEmpty;
}

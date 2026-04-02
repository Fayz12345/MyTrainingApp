/// Employee record aligned with Amplify `Employee` in [assets/amplify_outputs.json].
class Employee {
  const Employee({
    required this.id,
    required this.userId,
    required this.email,
    required this.name,
    this.department,
    this.managerId,
    this.storeId,
    this.createdBy,
    this.isActive,
    this.transitNumber,
    this.institutionNumber,
    this.accountNumber,
    this.bankingDocumentKey,
    this.schedulingEligible,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String userId;
  final String email;
  final String name;
  final String? department;
  final String? managerId;
  final String? storeId;
  final String? createdBy;
  final bool? isActive;
  final String? transitNumber;
  final String? institutionNumber;
  final String? accountNumber;
  final String? bankingDocumentKey;

  /// When `true`, employee meets backend rules for Clearview Connect scheduling.
  final bool? schedulingEligible;

  final String createdAt;
  final String updatedAt;

  /// Treats null as not eligible (matches typical default before evaluation).
  bool get isSchedulingEligible => schedulingEligible == true;

  factory Employee.fromJson(Map<String, dynamic> json) {
    return Employee(
      id: json['id'] as String,
      userId: json['userId'] as String,
      email: json['email'] as String,
      name: json['name'] as String,
      department: json['department'] as String?,
      managerId: json['managerId'] as String?,
      storeId: json['storeId'] as String?,
      createdBy: json['createdBy'] as String?,
      isActive: json['isActive'] as bool?,
      transitNumber: json['transitNumber'] as String?,
      institutionNumber: json['institutionNumber'] as String?,
      accountNumber: json['accountNumber'] as String?,
      bankingDocumentKey: json['bankingDocumentKey'] as String?,
      schedulingEligible: json['schedulingEligible'] as bool?,
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'userId': userId,
        'email': email,
        'name': name,
        'department': department,
        'managerId': managerId,
        'storeId': storeId,
        'createdBy': createdBy,
        'isActive': isActive,
        'transitNumber': transitNumber,
        'institutionNumber': institutionNumber,
        'accountNumber': accountNumber,
        'bankingDocumentKey': bankingDocumentKey,
        'schedulingEligible': schedulingEligible,
        'createdAt': createdAt,
        'updatedAt': updatedAt,
      };
}

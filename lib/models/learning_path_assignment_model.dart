/// Employee's assignment to a learning path — matches Amplify `LearningPathAssignment`
/// in [assets/amplify_outputs.json].
class LearningPathAssignmentModel {
  const LearningPathAssignmentModel({
    required this.id,
    required this.learningPathId,
    required this.employeeId,
    this.status,
    this.assignedDate,
    this.dueDate,
    this.completedDate,
    this.expirationDate,
    this.certificationStatus,
    this.lastReminderSentAt,
    this.reminderCount,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String learningPathId;
  final String employeeId;
  final String? status;
  final DateTime? assignedDate;
  final DateTime? dueDate;
  final DateTime? completedDate;
  final DateTime? expirationDate;
  final String? certificationStatus;
  final DateTime? lastReminderSentAt;
  final int? reminderCount;
  final String createdAt;
  final String updatedAt;

  static DateTime? _parseAwsDateTime(dynamic value) {
    if (value == null) return null;
    if (value is String) return DateTime.tryParse(value);
    return null;
  }

  factory LearningPathAssignmentModel.fromJson(Map<String, dynamic> json) {
    return LearningPathAssignmentModel(
      id: json['id'] as String,
      learningPathId: json['learningPathId'] as String,
      employeeId: json['employeeId'] as String,
      status: json['status'] as String?,
      assignedDate: _parseAwsDateTime(json['assignedDate']),
      dueDate: _parseAwsDateTime(json['dueDate']),
      completedDate: _parseAwsDateTime(json['completedDate']),
      expirationDate: _parseAwsDateTime(json['expirationDate']),
      certificationStatus: json['certificationStatus'] as String?,
      lastReminderSentAt: _parseAwsDateTime(json['lastReminderSentAt']),
      reminderCount: (json['reminderCount'] as num?)?.toInt(),
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String,
    );
  }
}

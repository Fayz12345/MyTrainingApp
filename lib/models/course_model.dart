class Course {
  final String id;
  final String title;
  final String? videoKey;
  final int? passingScore;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String? assignmentStatus;
  final String? assignmentId;

  Course({
    required this.id,
    required this.title,
    this.videoKey,
    this.passingScore,
    required this.createdAt,
    required this.updatedAt,
    this.assignmentStatus,
    this.assignmentId,
  });

  factory Course.fromJson(Map<String, dynamic> json) {
    return Course(
      id: json['id'] as String,
      title: json['title'] as String,
      videoKey: json['videoKey'] as String?,
      passingScore: json['passingScore'] as int?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      assignmentStatus: json['assignmentStatus'] as String?,
      assignmentId: json['assignmentId'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'videoKey': videoKey,
      'passingScore': passingScore,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
      'assignmentStatus': assignmentStatus,
      'assignmentId': assignmentId,
    };
  }
}

/*
class Course {
  final String id;
  final String title;
  final String? videoKey;
  final String? imageKey;
  final String? description;
  final int? passingScore;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String? duration;
  final String? category;
  final String? assignmentStatus;
  final String? assignmentId;

  Course({
    required this.id,
    required this.title,
    this.videoKey,
    this.imageKey,
    this.description,
    this.passingScore,
    required this.createdAt,
    required this.updatedAt,
    this.duration,
    this.category,
    this.assignmentStatus,
    this.assignmentId,
  });

  factory Course.fromJson(Map<String, dynamic> json) {
    return Course(
      id: json['id'] as String,
      title: json['title'] as String,
      videoKey: json['videoKey'] as String?,
      imageKey: json['imageKey'] as String?,
      description: json['description'] as String?,
      passingScore: json['passingScore'] as int?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      duration: json['duration'] as String?,
      category: json['category'] as String?,
      assignmentStatus: json['assignmentStatus'] as String?,
      assignmentId: json['assignmentId'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'videoKey': videoKey,
      'imageKey': imageKey,
      'description': description,
      'passingScore': passingScore,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
      'duration': duration,
      'category': category,
      'assignmentStatus': assignmentStatus,
      'assignmentId': assignmentId,
    };
  }
}
 */



class Course {
  final String id; // course.id
  final String title;
  final String? videoKey;
  final String? imageKey;
  final String? description;
  final int? passingScore;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String? duration;
  final String? category;
  final String? assignmentStatus;
  final String? assignmentId; // assignment.id
  final String? assignmentUpdatedAt; // Optional: assignment.updatedAt

  Course({
    required this.id,
    required this.title,
    this.videoKey,
    this.imageKey,
    this.description,
    this.passingScore,
    required this.createdAt,
    required this.updatedAt,
    this.duration,
    this.category,
    this.assignmentStatus,
    this.assignmentId,
    this.assignmentUpdatedAt,
  });

  factory Course.fromJson(Map<String, dynamic> json) {
    return Course(
      id: json['course']['id'] as String,
      title: json['course']['title'] as String,
      videoKey: json['course']['videoKey'] as String?,
      imageKey: json['course']['imageKey'] as String?,
      description: json['course']['description'] as String?,
      passingScore: json['course']['passingScore'] as int?,
      createdAt: DateTime.parse(json['course']['createdAt'] as String),
      updatedAt: DateTime.parse(json['course']['updatedAt'] as String),
      duration: json['course']['duration'] as String?,
      category: json['course']['category'] as String?,
      assignmentStatus: json['status'] as String?,
      assignmentId: json['id'] as String?, // assignment.id
      assignmentUpdatedAt: json['updatedAt'] as String?, // assignment.updatedAt
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'videoKey': videoKey,
      'imageKey': imageKey,
      'description': description,
      'passingScore': passingScore,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
      'duration': duration,
      'category': category,
      'assignmentStatus': assignmentStatus,
      'assignmentId': assignmentId,
      'assignmentUpdatedAt': assignmentUpdatedAt,
    };
  }
}

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

import 'lesson_model.dart';

enum CourseContentType {
  video,
  pdf,
  both;

  static CourseContentType? fromString(String? value) {
    if (value == null) return null;
    switch (value.toLowerCase()) {
      case 'video':
        return CourseContentType.video;
      case 'pdf':
        return CourseContentType.pdf;
      case 'both':
        return CourseContentType.both;
      default:
        return null;
    }
  }

  String toJson() {
    switch (this) {
      case CourseContentType.video:
        return 'video';
      case CourseContentType.pdf:
        return 'pdf';
      case CourseContentType.both:
        return 'both';
    }
  }
}

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
  final String? tag; // Course tag for grouping into learning paths
  final String? assignmentStatus;
  final String? assignmentId; // assignment.id
  final String? assignmentUpdatedAt; // Optional: assignment.updatedAt
  // PDF fields
  final String? pdfKey; // S3 key for PDF document
  final String? pdfTitle; // Display title for PDF
  final CourseContentType? contentType; // Content type: video, pdf, or both
  // Quiz randomization
  final bool? randomizeQuestions; // Whether to randomize quiz question order
  final bool? randomizeOptions; // Whether to randomize answer options order
  // Question pool
  final bool? useQuestionPool; // Whether to use question pool mode
  final int? poolSize; // Total number of questions in pool
  final int?
      questionsToDisplay; // Number of questions to randomly select from pool
  final List<Lesson> lessons; // Lessons loaded from assigned-courses query

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
    this.tag,
    this.assignmentStatus,
    this.assignmentId,
    this.assignmentUpdatedAt,
    this.pdfKey,
    this.pdfTitle,
    this.contentType,
    this.randomizeQuestions,
    this.randomizeOptions,
    this.useQuestionPool,
    this.poolSize,
    this.questionsToDisplay,
    this.lessons = const [],
  });

  factory Course.fromJson(Map<String, dynamic> json) {
    // Determine content type based on available content
    final videoKey = json['course']['videoKey'] as String?;
    final pdfKey = json['course']['pdfKey'] as String?;
    CourseContentType? contentType;

    if (videoKey != null && pdfKey != null) {
      contentType = CourseContentType.both;
    } else if (videoKey != null) {
      contentType = CourseContentType.video;
    } else if (pdfKey != null) {
      contentType = CourseContentType.pdf;
    }

    // Override with explicit contentType if provided
    if (json['course']['contentType'] != null) {
      contentType = CourseContentType.fromString(
        json['course']['contentType'] as String?,
      );
    }

    return Course(
      id: json['course']['id'] as String,
      title: json['course']['title'] as String,
      videoKey: videoKey,
      imageKey: json['course']['imageKey'] as String?,
      description: json['course']['description'] as String?,
      passingScore: json['course']['passingScore'] as int?,
      createdAt: DateTime.parse(json['course']['createdAt'] as String),
      updatedAt: DateTime.parse(json['course']['updatedAt'] as String),
      duration: json['course']['duration'] as String?,
      category: json['course']['category'] as String?,
      tag: json['course']['tag'] as String?,
      assignmentStatus: json['status'] as String?,
      assignmentId: json['id'] as String?, // assignment.id
      assignmentUpdatedAt: json['updatedAt'] as String?, // assignment.updatedAt
      pdfKey: pdfKey,
      pdfTitle: json['course']['pdfTitle'] as String?,
      contentType: contentType,
      randomizeQuestions:
          json['course']['randomizeQuestions'] as bool? ?? false,
      randomizeOptions: json['course']['randomizeOptions'] as bool? ?? false,
      useQuestionPool: json['course']['useQuestionPool'] as bool? ?? false,
      poolSize: json['course']['poolSize'] as int?,
      questionsToDisplay: json['course']['questionsToDisplay'] as int?,
      lessons: ((json['course']['lessons']?['items'] as List<dynamic>?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(Lesson.fromJson)
          .toList()
        ..sort((a, b) => a.order.compareTo(b.order)),
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
      'tag': tag,
      'assignmentStatus': assignmentStatus,
      'assignmentId': assignmentId,
      'assignmentUpdatedAt': assignmentUpdatedAt,
      'pdfKey': pdfKey,
      'pdfTitle': pdfTitle,
      'contentType': contentType?.toJson(),
      'randomizeQuestions': randomizeQuestions ?? false,
      'randomizeOptions': randomizeOptions ?? false,
      'useQuestionPool': useQuestionPool ?? false,
      'poolSize': poolSize,
      'questionsToDisplay': questionsToDisplay,
      'lessons': lessons
          .map(
            (l) => {
              'id': l.id,
              'courseId': l.courseId,
              'title': l.title,
              'order': l.order,
              'contentBlocks': l.contentBlocks,
            },
          )
          .toList(),
    };
  }

  /// Helper method to check if course has video content
  bool get hasVideo => videoKey != null && videoKey!.isNotEmpty;

  /// Helper method to check if course has PDF content
  bool get hasPdf => pdfKey != null && pdfKey!.isNotEmpty;

  /// Helper method to check if course has both video and PDF
  bool get hasBothContent => hasVideo && hasPdf;
}

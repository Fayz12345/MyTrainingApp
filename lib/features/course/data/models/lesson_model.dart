class Lesson {
  final String id;
  final String courseId;
  final String title;
  final int order;
  final String? contentBlocks; // JSON string from backend

  Lesson({
    required this.id,
    required this.courseId,
    required this.title,
    required this.order,
    this.contentBlocks,
  });

  factory Lesson.fromJson(Map<String, dynamic> json) {
    return Lesson(
      id: json['id'] as String,
      courseId: json['courseId'] as String,
      title: json['title'] as String,
      order: json['order'] as int,
      contentBlocks: json['contentBlocks'] as String?,
    );
  }
}


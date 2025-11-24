class QuizQuestion {
  final String id;
  final String courseId;
  final String question;
  final List<String> options;
  final int correctAnswer;
  final DateTime createdAt;
  final DateTime updatedAt;

  QuizQuestion({
    required this.id,
    required this.courseId,
    required this.question,
    required this.options,
    required this.correctAnswer,
    required this.createdAt,
    required this.updatedAt,
  });

  factory QuizQuestion.fromJson(Map<String, dynamic> json) {
    return QuizQuestion(
      id: json['id'] as String,
      courseId: json['courseId'] as String,
      question: json['question'] as String,
      options: List<String>.from(json['options'] as List),
      correctAnswer: json['correctAnswer'] as int,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'courseId': courseId,
      'question': question,
      'options': options,
      'correctAnswer': correctAnswer,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }
}

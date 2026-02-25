import 'dart:convert';
import 'dart:math';

/// Question type enum
enum QuestionType {
  multipleChoice,
  trueFalse,
  fillBlank;

  static QuestionType? fromString(String? value) {
    if (value == null) return null;
    switch (value.toLowerCase()) {
      case 'multiple_choice':
      case 'multiplechoice':
        return QuestionType.multipleChoice;
      case 'true_false':
      case 'truefalse':
      case 'true/false':
        return QuestionType.trueFalse;
      case 'fill_blank':
      case 'fillblank':
        return QuestionType.fillBlank;
      default:
        return QuestionType.multipleChoice; // Default to multiple choice
    }
  }

  String toJson() {
    switch (this) {
      case QuestionType.multipleChoice:
        return 'multiple_choice';
      case QuestionType.trueFalse:
        return 'true_false';
      case QuestionType.fillBlank:
        return 'fill_blank';
    }
  }
}

/// Helper class to store shuffled options and mapping
class ShuffledQuestionOptions {
  final List<String> shuffledOptions;
  final List<int>
      optionOrderMapping; // Original index -> shuffled index mapping
  final int shuffledCorrectAnswer; // Correct answer index in shuffled options

  ShuffledQuestionOptions({
    required this.shuffledOptions,
    required this.optionOrderMapping,
    required this.shuffledCorrectAnswer,
  });

  /// Map user's selected answer (shuffled index) back to original index
  /// This is used for grading - we need to compare with original correctAnswer
  int mapToOriginalIndex(int shuffledIndex) {
    if (shuffledIndex < 0 || shuffledIndex >= optionOrderMapping.length) {
      return -1;
    }
    // optionOrderMapping[shuffledIndex] gives the original index
    return optionOrderMapping[shuffledIndex];
  }

  /// Map original index to shuffled index
  int mapToShuffledIndex(int originalIndex) {
    return optionOrderMapping.indexOf(originalIndex);
  }
}

/// Display model for quiz question with shuffled options
class DisplayQuizQuestion {
  final QuizQuestion originalQuestion;
  final ShuffledQuestionOptions? shuffledOptions;

  DisplayQuizQuestion({
    required this.originalQuestion,
    this.shuffledOptions,
  });

  /// Get options to display (shuffled if available, otherwise original)
  List<String> get displayOptions {
    return shuffledOptions?.shuffledOptions ?? originalQuestion.options;
  }

  /// Get correct answer index for display (shuffled if available, otherwise original)
  int get displayCorrectAnswer {
    return shuffledOptions?.shuffledCorrectAnswer ??
        originalQuestion.correctAnswer;
  }

  /// Map user's selected answer (display index) back to original index for grading
  int mapAnswerToOriginal(int displayIndex) {
    if (shuffledOptions != null) {
      return shuffledOptions!.mapToOriginalIndex(displayIndex);
    }
    return displayIndex; // No shuffling, return as-is
  }
}

class QuizQuestion {
  final String id;
  final String courseId;
  final String question;
  final List<String> options;
  final dynamic
      correctAnswer; // int for multiple choice/TF, String for fill-in-the-blank
  final QuestionType questionType;
  final bool?
      caseSensitive; // For fill-in-the-blank: whether answer is case-sensitive
  final bool?
      fuzzyMatching; // For fill-in-the-blank: whether to use fuzzy matching (Levenshtein ≤ 2)
  final DateTime createdAt;
  final DateTime updatedAt;

  QuizQuestion({
    required this.id,
    required this.courseId,
    required this.question,
    required this.options,
    required this.correctAnswer,
    this.questionType = QuestionType.multipleChoice,
    this.caseSensitive,
    this.fuzzyMatching,
    required this.createdAt,
    required this.updatedAt,
  });

  /// Check if this is a True/False question
  bool get isTrueFalse => questionType == QuestionType.trueFalse;

  /// Check if this is a multiple choice question
  bool get isMultipleChoice => questionType == QuestionType.multipleChoice;

  /// Check if this is a fill-in-the-blank question
  bool get isFillBlank => questionType == QuestionType.fillBlank;

  /// Get accepted answers for fill-in-the-blank questions
  /// Returns list of accepted answers (comma-separated from correctAnswer string)
  List<String> get acceptedAnswers {
    if (!isFillBlank || correctAnswer is! String) {
      return [];
    }
    return (correctAnswer as String)
        .split(',')
        .map((a) => a.trim())
        .where((a) => a.isNotEmpty)
        .toList();
  }

  factory QuizQuestion.fromJson(Map<String, dynamic> json) {
    // Parse question type
    final questionTypeValue = json['questionType'] as String?;
    final questionType = QuestionType.fromString(questionTypeValue) ??
        QuestionType.multipleChoice;

    // Handle correctAnswer - can be int (for MC/TF) or String (for fill-in-the-blank)
    dynamic correctAnswer;
    final correctAnswerValue = json['correctAnswer'];

    if (questionType == QuestionType.fillBlank) {
      // For fill-in-the-blank, correctAnswer is a string with comma-separated accepted answers
      if (correctAnswerValue is String) {
        correctAnswer = correctAnswerValue;
      } else if (correctAnswerValue != null) {
        correctAnswer = correctAnswerValue.toString();
      } else {
        correctAnswer = null;
      }
    } else {
      // For multiple choice and True/False, correctAnswer is an int
      if (correctAnswerValue == null) {
        correctAnswer = null;
      } else if (correctAnswerValue is int) {
        correctAnswer = correctAnswerValue;
      } else if (correctAnswerValue is String) {
        correctAnswer = int.tryParse(correctAnswerValue);
      } else {
        correctAnswer = null;
      }
    }

    // Handle options - can be List or JSON string
    List<String> optionsList;
    final optionsValue = json['options'];
    if (optionsValue is List) {
      optionsList = List<String>.from(optionsValue.map((e) => e.toString()));
    } else if (optionsValue is String) {
      // Try to parse as JSON string
      try {
        final decoded = jsonDecode(optionsValue) as List;
        optionsList = List<String>.from(decoded.map((e) => e.toString()));
      } catch (e) {
        optionsList = []; // Invalid format, set to empty
      }
    } else {
      optionsList = []; // Invalid type, set to empty
    }

    // For True/False questions, ensure options are ["True", "False"]
    if (questionType == QuestionType.trueFalse) {
      if (optionsList.isEmpty ||
          (optionsList.length == 2 &&
              optionsList[0].toLowerCase() != 'true' &&
              optionsList[1].toLowerCase() != 'false')) {
        // Set default True/False options
        optionsList = ['True', 'False'];
      }
      // Ensure correctAnswer is 0 (True) or 1 (False)
      if (correctAnswer != null &&
          correctAnswer is int &&
          correctAnswer != 0 &&
          correctAnswer != 1) {
        // If invalid, default to 0 (True)
        correctAnswer = 0;
      }
    }

    // For fill-in-the-blank questions, options can be empty
    if (questionType == QuestionType.fillBlank) {
      // Fill-in-the-blank doesn't need options, but we can keep an empty list
      if (optionsList.isEmpty) {
        optionsList = []; // Empty list is fine for fill-in-the-blank
      }
    }

    // Validate question has required data
    if (correctAnswer == null) {
      throw Exception('Quiz question missing correctAnswer: ${json['id']}');
    }

    // For multiple choice and True/False, validate options and correctAnswer range
    if (questionType != QuestionType.fillBlank) {
      if (optionsList.isEmpty) {
        throw Exception('Quiz question has no options: ${json['id']}');
      }

      // Validate correctAnswer is within options range (only for MC/TF)
      if (correctAnswer is int &&
          (correctAnswer < 0 || correctAnswer >= optionsList.length)) {
        throw Exception(
            'Quiz question correctAnswer ($correctAnswer) is out of range for ${optionsList.length} options: ${json['id']}');
      }
    }

    // Parse caseSensitive and fuzzyMatching flags (for fill-in-the-blank)
    final caseSensitive = json['caseSensitive'] as bool? ?? false;
    final fuzzyMatching = json['fuzzyMatching'] as bool? ?? false;

    return QuizQuestion(
      id: json['id'] as String? ?? '',
      courseId: json['courseId'] as String? ?? '',
      question: json['question'] as String? ?? '',
      options: optionsList,
      correctAnswer: correctAnswer,
      questionType: questionType,
      caseSensitive: caseSensitive,
      fuzzyMatching: fuzzyMatching,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : DateTime.now(),
      updatedAt: json['updatedAt'] != null
          ? DateTime.parse(json['updatedAt'] as String)
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'courseId': courseId,
      'question': question,
      'options': options,
      'correctAnswer': correctAnswer,
      'questionType': questionType.toJson(),
      'caseSensitive': caseSensitive ?? false,
      'fuzzyMatching': fuzzyMatching ?? false,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }

  /// Check if a fill-in-the-blank answer is correct
  /// Returns true if answer matches any accepted answer
  bool isFillBlankAnswerCorrect(String userAnswer) {
    if (!isFillBlank) return false;

    final accepted = acceptedAnswers;
    if (accepted.isEmpty) return false;

    // Normalize user answer
    String normalizedUserAnswer = userAnswer.trim();
    if (!(caseSensitive ?? false)) {
      normalizedUserAnswer = normalizedUserAnswer.toLowerCase();
    }

    // Check exact match first
    for (final acceptedAnswer in accepted) {
      String normalizedAccepted = acceptedAnswer.trim();
      if (!(caseSensitive ?? false)) {
        normalizedAccepted = normalizedAccepted.toLowerCase();
      }

      if (normalizedUserAnswer == normalizedAccepted) {
        return true;
      }

      // Check fuzzy matching if enabled
      if (fuzzyMatching ?? false) {
        final distance =
            _levenshteinDistance(normalizedUserAnswer, normalizedAccepted);
        if (distance <= 2) {
          return true;
        }
      }
    }

    return false;
  }

  /// Calculate Levenshtein distance between two strings
  static int _levenshteinDistance(String s1, String s2) {
    if (s1.isEmpty) return s2.length;
    if (s2.isEmpty) return s1.length;

    final matrix = List.generate(
      s1.length + 1,
      (i) => List.generate(s2.length + 1, (j) => 0),
    );

    for (int i = 0; i <= s1.length; i++) {
      matrix[i][0] = i;
    }
    for (int j = 0; j <= s2.length; j++) {
      matrix[0][j] = j;
    }

    for (int i = 1; i <= s1.length; i++) {
      for (int j = 1; j <= s2.length; j++) {
        final cost = s1[i - 1] == s2[j - 1] ? 0 : 1;
        matrix[i][j] = [
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + cost, // substitution
        ].reduce((a, b) => a < b ? a : b);
      }
    }

    return matrix[s1.length][s2.length];
  }

  /// Create shuffled options with secure random algorithm
  /// Returns shuffled options and mapping for grading
  ShuffledQuestionOptions createShuffledOptions() {
    // Create mapping: original index -> shuffled index
    final optionOrder = List.generate(options.length, (i) => i);
    optionOrder.shuffle(Random.secure()); // Use secure random

    // Create shuffled options list
    final shuffledOptions =
        optionOrder.map((originalIndex) => options[originalIndex]).toList();

    // Map correct answer to shuffled position
    final shuffledCorrectAnswer = optionOrder.indexOf(correctAnswer);

    return ShuffledQuestionOptions(
      shuffledOptions: shuffledOptions,
      optionOrderMapping: optionOrder, // Original index -> shuffled index
      shuffledCorrectAnswer: shuffledCorrectAnswer,
    );
  }
}

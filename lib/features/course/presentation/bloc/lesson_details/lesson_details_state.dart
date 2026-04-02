part of 'lesson_details_bloc.dart';

abstract class LessonDetailsState extends Equatable {
  const LessonDetailsState();

  @override
  List<Object?> get props => [];
}

class LessonDetailsLoading extends LessonDetailsState {
  const LessonDetailsLoading();
}

class LessonDetailsLoadError extends LessonDetailsState {
  const LessonDetailsLoadError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}

/// Main UI state for lesson content + progress.
class LessonDetailsReady extends LessonDetailsState {
  const LessonDetailsReady({
    required this.lesson,
    required this.course,
    required this.blocks,
    required this.videoViewed,
    required this.pdfViewed,
    required this.contentProgressLoaded,
    required this.lessonPersistedComplete,
    this.autoMarkingInProgress = false,
    this.pathProgressChangedThisSession = false,
  });

  final Lesson lesson;
  final Course course;
  final List<Map<String, dynamic>> blocks;
  final bool videoViewed;
  final bool pdfViewed;
  final bool contentProgressLoaded;
  final bool lessonPersistedComplete;
  final bool autoMarkingInProgress;

  /// True after video/PDF progress or lesson completion was written this session.
  /// Used to refresh learning path APIs only when needed.
  final bool pathProgressChangedThisSession;

  static bool _hasValidKey(dynamic key) =>
      key != null &&
      key.toString().trim().isNotEmpty &&
      key.toString() != 'null';

  bool get hasVideoBlock =>
      blocks.any((b) => b['type'] == 'video' && _hasValidKey(b['key']));
  bool get hasPdfBlock =>
      blocks.any((b) => b['type'] == 'pdf' && _hasValidKey(b['key']));
  bool get hasImageBlock =>
      blocks.any((b) => b['type'] == 'image' && _hasValidKey(b['key']));
  bool get hasTrackableLessonContent =>
      hasVideoBlock || hasPdfBlock || hasImageBlock;

  int get requiredItemCount =>
      (hasImageBlock ? 1 : 0) + (hasPdfBlock ? 1 : 0) + (hasVideoBlock ? 1 : 0);

  int get completedItemCount =>
      (hasImageBlock ? 1 : 0) +
      ((hasPdfBlock && pdfViewed) ? 1 : 0) +
      ((hasVideoBlock && videoViewed) ? 1 : 0);

  bool get meetsAutoCompletionRequirements {
    final videoOk = !hasVideoBlock || videoViewed;
    final pdfOk = !hasPdfBlock || pdfViewed;
    return videoOk && pdfOk;
  }

  LessonDetailsReady copyWith({
    List<Map<String, dynamic>>? blocks,
    bool? videoViewed,
    bool? pdfViewed,
    bool? contentProgressLoaded,
    bool? lessonPersistedComplete,
    bool? autoMarkingInProgress,
    bool? pathProgressChangedThisSession,
  }) {
    return LessonDetailsReady(
      lesson: lesson,
      course: course,
      blocks: blocks ?? this.blocks,
      videoViewed: videoViewed ?? this.videoViewed,
      pdfViewed: pdfViewed ?? this.pdfViewed,
      contentProgressLoaded:
          contentProgressLoaded ?? this.contentProgressLoaded,
      lessonPersistedComplete:
          lessonPersistedComplete ?? this.lessonPersistedComplete,
      autoMarkingInProgress:
          autoMarkingInProgress ?? this.autoMarkingInProgress,
      pathProgressChangedThisSession: pathProgressChangedThisSession ??
          this.pathProgressChangedThisSession,
    );
  }

  @override
  List<Object?> get props => [
        lesson,
        course,
        blocks,
        videoViewed,
        pdfViewed,
        contentProgressLoaded,
        lessonPersistedComplete,
        autoMarkingInProgress,
        pathProgressChangedThisSession,
      ];
}

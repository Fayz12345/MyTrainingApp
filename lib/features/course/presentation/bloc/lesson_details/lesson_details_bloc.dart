import 'dart:convert';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../../core/services/storage_service.dart';
import '../../../data/models/course_model.dart';
import '../../../data/models/lesson_model.dart';
import '../../../services/lesson_completion_service.dart';
import '../../../services/lesson_content_progress_service.dart';

part 'lesson_details_event.dart';
part 'lesson_details_state.dart';


class LessonDetailsBloc extends Bloc<LessonDetailsEvent, LessonDetailsState> {
  LessonDetailsBloc() : super(const LessonDetailsLoading()) {
    on<LessonDetailsStarted>(_onStarted);
    on<LessonVideoMarkedWatched>(_onVideoMarked);
    on<LessonPdfMarkedViewed>(_onPdfMarked);
    on<LessonPdfSyncFromStorage>(_onPdfSync);
    on<LessonDetailsRefreshCompletion>(_onRefreshCompletion);
  }

  final Map<String, Future<String>> _imageUrlFutureCache = {};

  /// Stable future per image key so ListView rebuilds do not re-fetch URLs.
  Future<String> getCachedImageUrl(String key) {
    return _imageUrlFutureCache.putIfAbsent(
      key,
      () => StorageService.getImageUrl(key),
    );
  }

  Future<void> _onStarted(
    LessonDetailsStarted event,
    Emitter<LessonDetailsState> emit,
  ) async {
    List<Map<String, dynamic>> blocks = [];
    try {
      if (event.lesson.contentBlocks != null &&
          event.lesson.contentBlocks!.isNotEmpty) {
        final parsed = json.decode(event.lesson.contentBlocks!);
        if (parsed is List) {
          blocks = parsed.map((e) => e as Map<String, dynamic>).toList();
        }
      }
    } catch (e) {
      emit(LessonDetailsLoadError('Could not load lesson content: $e'));
      return;
    }

    final scope = event.course.assignmentId ?? event.course.id;
    final lessonId = event.lesson.id;

    final videoDone = await LessonContentProgressService.isLessonVideoViewed(
      scope,
      lessonId,
    );
    final pdfDone = await LessonContentProgressService.isLessonPdfViewed(
      scope,
      lessonId,
    );
    final doneIds = await LessonCompletionService.getCompletedLessonIds(scope);
    final persisted = doneIds.contains(lessonId);

    final ready = LessonDetailsReady(
      lesson: event.lesson,
      course: event.course,
      blocks: blocks,
      videoViewed: videoDone,
      pdfViewed: pdfDone,
      contentProgressLoaded: true,
      lessonPersistedComplete: persisted,
      pathProgressChangedThisSession: false,
    );

    emit(ready);
    await _tryAutoComplete(emit);
  }

  Future<void> _onVideoMarked(
    LessonVideoMarkedWatched event,
    Emitter<LessonDetailsState> emit,
  ) async {
    final s = state;
    if (s is! LessonDetailsReady) return;
    final scope = s.course.assignmentId ?? s.course.id;
    await LessonContentProgressService.markLessonVideoViewed(
      scope,
      s.lesson.id,
    );
    emit(s.copyWith(
      videoViewed: true,
      pathProgressChangedThisSession: true,
    ));
    await _tryAutoComplete(emit);
  }

  Future<void> _onPdfMarked(
    LessonPdfMarkedViewed event,
    Emitter<LessonDetailsState> emit,
  ) async {
    final s = state;
    if (s is! LessonDetailsReady) return;
    final scope = s.course.assignmentId ?? s.course.id;
    await LessonContentProgressService.markLessonPdfViewed(
      scope,
      s.lesson.id,
    );
    emit(s.copyWith(
      pdfViewed: true,
      pathProgressChangedThisSession: true,
    ));
    await _tryAutoComplete(emit);
  }

  Future<void> _onPdfSync(
    LessonPdfSyncFromStorage event,
    Emitter<LessonDetailsState> emit,
  ) async {
    final s = state;
    if (s is! LessonDetailsReady) return;
    final scope = s.course.assignmentId ?? s.course.id;
    final pdfDone = await LessonContentProgressService.isLessonPdfViewed(
      scope,
      s.lesson.id,
    );
    emit(s.copyWith(
      pdfViewed: pdfDone,
      pathProgressChangedThisSession: s.pathProgressChangedThisSession ||
          (pdfDone && !s.pdfViewed),
    ));
    await _tryAutoComplete(emit);
  }

  Future<void> _onRefreshCompletion(
    LessonDetailsRefreshCompletion event,
    Emitter<LessonDetailsState> emit,
  ) async {
    final s = state;
    if (s is! LessonDetailsReady) return;
    final scope = s.course.assignmentId ?? s.course.id;
    final doneIds = await LessonCompletionService.getCompletedLessonIds(scope);
    final persisted = doneIds.contains(s.lesson.id);
    emit(s.copyWith(lessonPersistedComplete: persisted));
  }

  Future<void> _tryAutoComplete(Emitter<LessonDetailsState> emit) async {
    final current = state;
    if (current is! LessonDetailsReady) return;
    if (!current.hasTrackableLessonContent) return;
    if (!current.meetsAutoCompletionRequirements) return;
    if (current.lessonPersistedComplete) return;
    if (current.autoMarkingInProgress) return;

    emit(current.copyWith(autoMarkingInProgress: true));
    try {
      final scope = current.course.assignmentId ?? current.course.id;
      await LessonCompletionService.markLessonCompleted(
        scope,
        current.lesson.id,
      );
      final doneIds =
          await LessonCompletionService.getCompletedLessonIds(scope);
      final persisted = doneIds.contains(current.lesson.id);
      final after = state;
      if (after is LessonDetailsReady) {
        emit(
          after.copyWith(
            lessonPersistedComplete: persisted,
            autoMarkingInProgress: false,
            pathProgressChangedThisSession:
                (persisted && !after.lessonPersistedComplete) ||
                    after.pathProgressChangedThisSession,
          ),
        );
      }
    } catch (_) {
      final after = state;
      if (after is LessonDetailsReady) {
        emit(after.copyWith(autoMarkingInProgress: false));
      }
    }
  }
}

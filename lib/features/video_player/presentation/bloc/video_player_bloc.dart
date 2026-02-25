import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:video_player/video_player.dart';
import '../../../../core/services/storage_service.dart';
import '../../../course/services/video_progress_service.dart';

part 'video_player_event.dart';
part 'video_player_state.dart';

class VideoPlayerBloc extends Bloc<VideoPlayerEvent, VideoPlayerState> {
  VideoPlayerController? _videoPlayerController;
  Timer? _progressTimer;
  String? _progressKey;
  bool _hasInitialized = false;

  VideoPlayerBloc() : super(const VideoPlayerInitial()) {
    on<InitializeVideoPlayer>(_onInitializeVideoPlayer);
    on<LoadVideoProgress>(_onLoadVideoProgress);
    on<VideoInitialized>(_onVideoInitialized);
    on<VideoLoadError>(_onVideoLoadError);
    on<TogglePlayPause>(_onTogglePlayPause);
    on<PlayVideo>(_onPlayVideo);
    on<PauseVideo>(_onPauseVideo);
    on<SeekToPosition>(_onSeekToPosition);
    on<Rewind10Seconds>(_onRewind10Seconds);
    on<Forward10Seconds>(_onForward10Seconds);
    on<UpdateVideoPosition>(_onUpdateVideoPosition);
    on<VideoCompleted>(_onVideoCompleted);
    on<TogglePlaybackSpeed>(_onTogglePlaybackSpeed);
    on<SetPlaybackSpeed>(_onSetPlaybackSpeed);
    on<ToggleControls>(_onToggleControls);
    on<ShowControls>(_onShowControls);
    on<HideControls>(_onHideControls);
    on<SaveVideoProgress>(_onSaveVideoProgress);
    on<ToggleFullscreen>(_onToggleFullscreen);
    on<DisposeVideoPlayer>(_onDisposeVideoPlayer);
  }

  VideoPlayerController? get videoPlayerController => _videoPlayerController;

  Future<void> _onInitializeVideoPlayer(
    InitializeVideoPlayer event,
    Emitter<VideoPlayerState> emit,
  ) async {
    if (_hasInitialized) return;

    emit(const VideoPlayerLoading());
    _progressKey = event.assignmentId ?? event.courseId;

    try {
      // Load saved progress first
      add(const LoadVideoProgress());

      // Get video URL
      final videoUrl = await StorageService.getVideoUrl(event.videoKey);

      // Create and initialize video controller
      _videoPlayerController =
          VideoPlayerController.networkUrl(Uri.parse(videoUrl));
      await _videoPlayerController!.initialize();

      // Get saved progress
      final savedPosition =
          await VideoProgressService.getVideoProgress(_progressKey!);
      final isCompleted =
          await VideoProgressService.isVideoCompleted(_progressKey!);

      final duration = _videoPlayerController!.value.duration;

      // Resume from saved position if available
      if (savedPosition != null && !isCompleted) {
        if (duration.inMilliseconds > 0) {
          final resumePosition =
              savedPosition.inMilliseconds < (duration.inMilliseconds * 0.95)
                  ? savedPosition
                  : Duration.zero;
          await _videoPlayerController!.seekTo(resumePosition);
        }
      }

      // Set playback speed
      await _videoPlayerController!.setPlaybackSpeed(1.0);

      // Add listener for video updates
      _videoPlayerController!.addListener(_videoListener);

      // Start progress saving
      _startProgressSaving();

      _hasInitialized = true;

      emit(VideoPlayerLoaded(
        position: savedPosition ?? Duration.zero,
        duration: duration,
        isPlaying: _videoPlayerController!.value.isPlaying,
        isCompleted: isCompleted,
        playbackSpeed: 1.0,
        showControls: true,
        isFullScreen: false,
      ));

      // Auto-hide controls after 3 seconds
      Future.delayed(const Duration(seconds: 3), () {
        if (state is VideoPlayerLoaded &&
            (state as VideoPlayerLoaded).isPlaying) {
          add(const HideControls());
        }
      });
    } catch (e) {
      emit(VideoPlayerError('Failed to load video: $e'));
    }
  }

  Future<void> _onLoadVideoProgress(
    LoadVideoProgress event,
    Emitter<VideoPlayerState> emit,
  ) async {
    if (_progressKey == null) return;

    final savedPosition =
        await VideoProgressService.getVideoProgress(_progressKey!);
    final isCompleted =
        await VideoProgressService.isVideoCompleted(_progressKey!);

    if (state is VideoPlayerLoaded) {
      final currentState = state as VideoPlayerLoaded;
      emit(currentState.copyWith(
        position: savedPosition ?? currentState.position,
        isCompleted: isCompleted,
      ));
    }
  }

  void _onVideoInitialized(
    VideoInitialized event,
    Emitter<VideoPlayerState> emit,
  ) {
    emit(VideoPlayerLoaded(
      position: event.savedPosition ?? Duration.zero,
      duration: event.duration,
      isPlaying: false,
      isCompleted: event.isCompleted,
      playbackSpeed: 1.0,
      showControls: true,
      isFullScreen: false,
    ));
  }

  void _onVideoLoadError(
    VideoLoadError event,
    Emitter<VideoPlayerState> emit,
  ) {
    emit(VideoPlayerError(event.error));
  }

  Future<void> _onTogglePlayPause(
    TogglePlayPause event,
    Emitter<VideoPlayerState> emit,
  ) async {
    if (_videoPlayerController == null || state is! VideoPlayerLoaded) return;

    final currentState = state as VideoPlayerLoaded;
    if (currentState.isPlaying) {
      await _videoPlayerController!.pause();
    } else {
      await _videoPlayerController!.play();
    }

    emit(currentState.copyWith(
      isPlaying: !currentState.isPlaying,
      showControls: true,
    ));

    // Auto-hide controls after delay
    if (!currentState.isPlaying) {
      Future.delayed(const Duration(seconds: 3), () {
        if (state is VideoPlayerLoaded &&
            (state as VideoPlayerLoaded).isPlaying) {
          add(const HideControls());
        }
      });
    }
  }

  Future<void> _onPlayVideo(
    PlayVideo event,
    Emitter<VideoPlayerState> emit,
  ) async {
    if (_videoPlayerController == null || state is! VideoPlayerLoaded) return;

    await _videoPlayerController!.play();
    final currentState = state as VideoPlayerLoaded;
    emit(currentState.copyWith(isPlaying: true));
  }

  Future<void> _onPauseVideo(
    PauseVideo event,
    Emitter<VideoPlayerState> emit,
  ) async {
    if (_videoPlayerController == null || state is! VideoPlayerLoaded) return;

    await _videoPlayerController!.pause();
    final currentState = state as VideoPlayerLoaded;
    emit(currentState.copyWith(isPlaying: false));
  }

  Future<void> _onSeekToPosition(
    SeekToPosition event,
    Emitter<VideoPlayerState> emit,
  ) async {
    if (_videoPlayerController == null || state is! VideoPlayerLoaded) return;

    final duration = _videoPlayerController!.value.duration;
    final validPosition =
        event.position.inMilliseconds > duration.inMilliseconds
            ? duration
            : event.position;

    await _videoPlayerController!.seekTo(validPosition);

    final currentState = state as VideoPlayerLoaded;
    emit(currentState.copyWith(
      position: validPosition,
      showControls: true,
    ));
  }

  Future<void> _onRewind10Seconds(
    Rewind10Seconds event,
    Emitter<VideoPlayerState> emit,
  ) async {
    if (_videoPlayerController == null || state is! VideoPlayerLoaded) return;

    final currentPosition = _videoPlayerController!.value.position;
    final newPosition = currentPosition - const Duration(seconds: 10);
    await _videoPlayerController!.seekTo(
      newPosition < Duration.zero ? Duration.zero : newPosition,
    );

    final currentState = state as VideoPlayerLoaded;
    emit(currentState.copyWith(
      position: newPosition < Duration.zero ? Duration.zero : newPosition,
      showControls: true,
    ));
  }

  Future<void> _onForward10Seconds(
    Forward10Seconds event,
    Emitter<VideoPlayerState> emit,
  ) async {
    if (_videoPlayerController == null || state is! VideoPlayerLoaded) return;

    final currentPosition = _videoPlayerController!.value.position;
    final duration = _videoPlayerController!.value.duration;
    final newPosition = currentPosition + const Duration(seconds: 10);
    await _videoPlayerController!.seekTo(
      newPosition > duration ? duration : newPosition,
    );

    final currentState = state as VideoPlayerLoaded;
    emit(currentState.copyWith(
      position: newPosition > duration ? duration : newPosition,
      showControls: true,
    ));
  }

  void _onUpdateVideoPosition(
    UpdateVideoPosition event,
    Emitter<VideoPlayerState> emit,
  ) {
    if (state is! VideoPlayerLoaded) return;

    final currentState = state as VideoPlayerLoaded;
    emit(currentState.copyWith(
      position: event.position,
      duration: event.duration,
      isPlaying: event.isPlaying,
    ));
  }

  void _onVideoCompleted(
    VideoCompleted event,
    Emitter<VideoPlayerState> emit,
  ) {
    if (state is! VideoPlayerLoaded || _progressKey == null) return;

    final currentState = state as VideoPlayerLoaded;

    // Mark as completed
    VideoProgressService.markVideoCompleted(_progressKey!);
    VideoProgressService.saveVideoProgress(
      _progressKey!,
      currentState.duration,
      duration: currentState.duration,
    );

    emit(currentState.copyWith(
      isCompleted: true,
      isPlaying: false,
    ));
  }

  Future<void> _onTogglePlaybackSpeed(
    TogglePlaybackSpeed event,
    Emitter<VideoPlayerState> emit,
  ) async {
    if (state is! VideoPlayerLoaded) return;

    final currentState = state as VideoPlayerLoaded;
    double newSpeed;

    if (currentState.playbackSpeed == 1.0) {
      newSpeed = 1.25;
    } else if (currentState.playbackSpeed == 1.25) {
      newSpeed = 1.5;
    } else if (currentState.playbackSpeed == 1.5) {
      newSpeed = 2.0;
    } else {
      newSpeed = 1.0;
    }

    await _videoPlayerController?.setPlaybackSpeed(newSpeed);
    emit(currentState.copyWith(playbackSpeed: newSpeed));
  }

  Future<void> _onSetPlaybackSpeed(
    SetPlaybackSpeed event,
    Emitter<VideoPlayerState> emit,
  ) async {
    if (state is! VideoPlayerLoaded) return;

    await _videoPlayerController?.setPlaybackSpeed(event.speed);
    final currentState = state as VideoPlayerLoaded;
    emit(currentState.copyWith(playbackSpeed: event.speed));
  }

  void _onToggleControls(
    ToggleControls event,
    Emitter<VideoPlayerState> emit,
  ) {
    if (state is! VideoPlayerLoaded) return;

    final currentState = state as VideoPlayerLoaded;
    emit(currentState.copyWith(showControls: !currentState.showControls));

    if (!currentState.showControls) {
      // Auto-hide after delay
      Future.delayed(const Duration(seconds: 3), () {
        if (state is VideoPlayerLoaded &&
            (state as VideoPlayerLoaded).isPlaying) {
          add(const HideControls());
        }
      });
    }
  }

  void _onShowControls(
    ShowControls event,
    Emitter<VideoPlayerState> emit,
  ) {
    if (state is! VideoPlayerLoaded) return;

    final currentState = state as VideoPlayerLoaded;
    emit(currentState.copyWith(showControls: true));
  }

  void _onHideControls(
    HideControls event,
    Emitter<VideoPlayerState> emit,
  ) {
    if (state is! VideoPlayerLoaded) return;

    final currentState = state as VideoPlayerLoaded;
    emit(currentState.copyWith(showControls: false));
  }

  Future<void> _onSaveVideoProgress(
    SaveVideoProgress event,
    Emitter<VideoPlayerState> emit,
  ) async {
    if (_progressKey == null) return;

    await VideoProgressService.saveVideoProgress(
      _progressKey!,
      event.position,
      duration: event.duration,
    );
  }

  void _onToggleFullscreen(
    ToggleFullscreen event,
    Emitter<VideoPlayerState> emit,
  ) {
    if (state is! VideoPlayerLoaded) return;

    final currentState = state as VideoPlayerLoaded;
    emit(currentState.copyWith(isFullScreen: !currentState.isFullScreen));
  }

  void _onDisposeVideoPlayer(
    DisposeVideoPlayer event,
    Emitter<VideoPlayerState> emit,
  ) {
    _progressTimer?.cancel();
    _videoPlayerController?.removeListener(_videoListener);
    _videoPlayerController?.dispose();
    _videoPlayerController = null;
    _hasInitialized = false;
  }

  void _videoListener() {
    if (_videoPlayerController == null) return;

    final position = _videoPlayerController!.value.position;
    final duration = _videoPlayerController!.value.duration;
    final isPlaying = _videoPlayerController!.value.isPlaying;

    // Update position
    add(UpdateVideoPosition(
      position: position,
      duration: duration,
      isPlaying: isPlaying,
    ));

    // Check if video is completed
    if (duration.inMilliseconds > 0 &&
        position.inMilliseconds >= (duration.inMilliseconds - 1000)) {
      if (state is VideoPlayerLoaded &&
          !(state as VideoPlayerLoaded).isCompleted) {
        add(const VideoCompleted());
      }
    }
  }

  void _startProgressSaving() {
    _progressTimer?.cancel();

    _progressTimer = Timer.periodic(const Duration(seconds: 5), (timer) {
      if (_videoPlayerController == null || _progressKey == null) {
        timer.cancel();
        return;
      }

      final position = _videoPlayerController!.value.position;
      final duration = _videoPlayerController!.value.duration;

      if (duration.inMilliseconds > 0) {
        add(SaveVideoProgress(
          position: position,
          duration: duration,
        ));
      }
    });
  }

  @override
  Future<void> close() {
    _progressTimer?.cancel();
    _videoPlayerController?.removeListener(_videoListener);
    _videoPlayerController?.dispose();
    return super.close();
  }
}

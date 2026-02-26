part of 'video_player_bloc.dart';

abstract class VideoPlayerEvent extends Equatable {
  const VideoPlayerEvent();

  @override
  List<Object?> get props => [];
}

/// Initialize video player with course data
class InitializeVideoPlayer extends VideoPlayerEvent {
  final String videoKey;
  final String? assignmentId;
  final String courseId;
  final String courseTitle;

  const InitializeVideoPlayer({
    required this.videoKey,
    this.assignmentId,
    required this.courseId,
    required this.courseTitle,
  });

  @override
  List<Object?> get props => [videoKey, assignmentId, courseId, courseTitle];
}

/// Load saved video progress
class LoadVideoProgress extends VideoPlayerEvent {
  const LoadVideoProgress();
}

/// Video loaded and initialized
class VideoInitialized extends VideoPlayerEvent {
  final Duration duration;
  final Duration? savedPosition;
  final bool isCompleted;

  const VideoInitialized({
    required this.duration,
    this.savedPosition,
    required this.isCompleted,
  });

  @override
  List<Object?> get props => [duration, savedPosition, isCompleted];
}

/// Video loading error
class VideoLoadError extends VideoPlayerEvent {
  final String error;

  const VideoLoadError(this.error);

  @override
  List<Object?> get props => [error];
}

/// Toggle play/pause
class TogglePlayPause extends VideoPlayerEvent {
  const TogglePlayPause();
}

/// Play video
class PlayVideo extends VideoPlayerEvent {
  const PlayVideo();
}

/// Pause video
class PauseVideo extends VideoPlayerEvent {
  const PauseVideo();
}

/// Seek to position
class SeekToPosition extends VideoPlayerEvent {
  final Duration position;

  const SeekToPosition(this.position);

  @override
  List<Object?> get props => [position];
}

/// Rewind 10 seconds
class Rewind10Seconds extends VideoPlayerEvent {
  const Rewind10Seconds();
}

/// Forward 10 seconds
class Forward10Seconds extends VideoPlayerEvent {
  const Forward10Seconds();
}

/// Update video position (from video controller listener)
class UpdateVideoPosition extends VideoPlayerEvent {
  final Duration position;
  final Duration duration;
  final bool isPlaying;

  const UpdateVideoPosition({
    required this.position,
    required this.duration,
    required this.isPlaying,
  });

  @override
  List<Object?> get props => [position, duration, isPlaying];
}

/// Video completed
class VideoCompleted extends VideoPlayerEvent {
  const VideoCompleted();
}

/// Toggle playback speed
class TogglePlaybackSpeed extends VideoPlayerEvent {
  const TogglePlaybackSpeed();
}

/// Set playback speed
class SetPlaybackSpeed extends VideoPlayerEvent {
  final double speed;

  const SetPlaybackSpeed(this.speed);

  @override
  List<Object?> get props => [speed];
}

/// Toggle controls visibility
class ToggleControls extends VideoPlayerEvent {
  const ToggleControls();
}

/// Show controls
class ShowControls extends VideoPlayerEvent {
  const ShowControls();
}

/// Hide controls
class HideControls extends VideoPlayerEvent {
  const HideControls();
}

/// Save video progress
class SaveVideoProgress extends VideoPlayerEvent {
  final Duration position;
  final Duration duration;

  const SaveVideoProgress({
    required this.position,
    required this.duration,
  });

  @override
  List<Object?> get props => [position, duration];
}

/// Toggle fullscreen
class ToggleFullscreen extends VideoPlayerEvent {
  const ToggleFullscreen();
}

/// Dispose video player
class DisposeVideoPlayer extends VideoPlayerEvent {
  const DisposeVideoPlayer();
}

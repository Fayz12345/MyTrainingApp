part of 'video_player_bloc.dart';

abstract class VideoPlayerState extends Equatable {
  const VideoPlayerState();

  @override
  List<Object?> get props => [];
}

/// Initial state
class VideoPlayerInitial extends VideoPlayerState {
  const VideoPlayerInitial();
}

/// Loading video
class VideoPlayerLoading extends VideoPlayerState {
  const VideoPlayerLoading();
}

/// Video loaded and ready
class VideoPlayerLoaded extends VideoPlayerState {
  final Duration position;
  final Duration duration;
  final bool isPlaying;
  final bool isCompleted;
  final double playbackSpeed;
  final bool showControls;
  final bool isFullScreen;

  const VideoPlayerLoaded({
    required this.position,
    required this.duration,
    required this.isPlaying,
    required this.isCompleted,
    required this.playbackSpeed,
    required this.showControls,
    required this.isFullScreen,
  });

  VideoPlayerLoaded copyWith({
    Duration? position,
    Duration? duration,
    bool? isPlaying,
    bool? isCompleted,
    double? playbackSpeed,
    bool? showControls,
    bool? isFullScreen,
  }) {
    return VideoPlayerLoaded(
      position: position ?? this.position,
      duration: duration ?? this.duration,
      isPlaying: isPlaying ?? this.isPlaying,
      isCompleted: isCompleted ?? this.isCompleted,
      playbackSpeed: playbackSpeed ?? this.playbackSpeed,
      showControls: showControls ?? this.showControls,
      isFullScreen: isFullScreen ?? this.isFullScreen,
    );
  }

  @override
  List<Object?> get props => [
        position,
        duration,
        isPlaying,
        isCompleted,
        playbackSpeed,
        showControls,
        isFullScreen,
      ];
}

/// Video load error
class VideoPlayerError extends VideoPlayerState {
  final String error;

  const VideoPlayerError(this.error);

  @override
  List<Object?> get props => [error];
}

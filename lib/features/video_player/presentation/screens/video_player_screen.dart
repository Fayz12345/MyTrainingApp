import 'dart:async';
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import 'package:amplify_flutter/amplify_flutter.dart';
import '../../../course/data/models/course_model.dart';
import '../../../../core/services/storage_service.dart';
import '../../../course/services/video_progress_service.dart';
import '../../../../core/services/activity_logger.dart';

class VideoPlayerScreen extends StatefulWidget {
  final Course course;
  final VoidCallback onVideoComplete;
  final VoidCallback onClose;
  const VideoPlayerScreen({
    super.key,
    required this.course,
    required this.onVideoComplete,
    required this.onClose,
  });
  @override
  State<VideoPlayerScreen> createState() => _VideoPlayerScreenState();
}

class _VideoPlayerScreenState extends State<VideoPlayerScreen> {
  VideoPlayerController? _videoPlayerController;
  bool _isLoading = true;
  String? _error;
  bool _completed = false;
  bool _showControls = true;
  bool _isPlaying = false;
  double _playbackSpeed = 1.0;
  bool _isFullScreen = false;
  Duration? _savedPosition;
  Timer? _progressTimer; // Track the timer to cancel it on dispose

  @override
  void initState() {
    super.initState();
    _loadSavedProgress();
    _loadVideo();
    _hideControlsAfterDelay();
  }

  Future<void> _loadSavedProgress() async {
    // Use assignmentId for progress tracking (each assignment has its own progress)
    final progressKey = widget.course.assignmentId ?? widget.course.id;
    safePrint(
        '[VIDEO_PROGRESS] Loading progress: Course="${widget.course.title}", AssignmentId=${widget.course.assignmentId ?? "N/A"}, ProgressKey=$progressKey');
    final savedPosition =
        await VideoProgressService.getVideoProgress(progressKey);
    final isCompleted =
        await VideoProgressService.isVideoCompleted(progressKey);
    setState(() {
      _savedPosition = savedPosition;
      _completed = isCompleted;
    });
    safePrint(
        '[VIDEO_PROGRESS] Loaded progress: Course="${widget.course.title}", SavedPosition=${savedPosition?.inSeconds ?? 0}s (${savedPosition?.inMinutes ?? 0}m ${(savedPosition?.inSeconds ?? 0) % 60}s), Completed=$isCompleted');
  }

  Future<void> _loadVideo() async {
    if (widget.course.videoKey == null) {
      setState(() {
        _error = 'No video available for this course';
        _isLoading = false;
      });
      return;
    }

    try {
      final videoUrl =
          await StorageService.getVideoUrl(widget.course.videoKey!);

      _videoPlayerController =
          VideoPlayerController.networkUrl(Uri.parse(videoUrl));
      await _videoPlayerController!.initialize();
      _videoPlayerController!.setPlaybackSpeed(_playbackSpeed);

      // Resume from saved position if available
      if (_savedPosition != null && !_completed) {
        final duration = _videoPlayerController!.value.duration;
        if (duration.inMilliseconds > 0) {
          // Only resume if saved position is less than 95% of video (to avoid completion loop)
          final resumePosition =
              _savedPosition!.inMilliseconds < (duration.inMilliseconds * 0.95)
                  ? _savedPosition!
                  : Duration.zero;
          await _videoPlayerController!.seekTo(resumePosition);
          print(
              '>>> VideoPlayerScreen: Resumed from position: ${resumePosition.inSeconds}s');
        }
      }

      // Listen for video updates
      _videoPlayerController!.addListener(_videoListener);

      // Start saving progress periodically
      _startProgressSaving();

      setState(() {
        _isLoading = false;
        _isPlaying = _videoPlayerController!.value.isPlaying;
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to load video: $e';
        _isLoading = false;
      });
    }
  }

  void _saveFinalProgress() {
    if (_videoPlayerController != null &&
        _videoPlayerController!.value.isInitialized) {
      final position = _videoPlayerController!.value.position;
      final duration = _videoPlayerController!.value.duration;
      if (duration.inMilliseconds > 0 && position.inMilliseconds > 0) {
        final progressKey = widget.course.assignmentId ?? widget.course.id;
        final validPosition = position.inMilliseconds > duration.inMilliseconds
            ? duration
            : position;
        VideoProgressService.saveVideoProgress(progressKey, validPosition,
            duration: duration);
        safePrint(
            '[VIDEO_PROGRESS] Final save: Course="${widget.course.title}", Position=${validPosition.inSeconds}s (${validPosition.inMinutes}m ${validPosition.inSeconds % 60}s) / Duration=${duration.inSeconds}s');
      }
    }
  }

  void _videoListener() {
    if (_videoPlayerController == null) return;

    final position = _videoPlayerController!.value.position;
    final duration = _videoPlayerController!.value.duration;

    // Check if video is completed (within 1 second of end)
    if (duration.inMilliseconds > 0 &&
        position.inMilliseconds >= (duration.inMilliseconds - 1000) &&
        !_completed) {
      setState(() {
        _completed = true;
        _isPlaying = false;
      });
      // Mark video as completed
      // Use assignmentId for progress tracking (each assignment has its own progress)
      final progressKey = widget.course.assignmentId ?? widget.course.id;
      VideoProgressService.markVideoCompleted(progressKey);
      // Save final position with duration
      VideoProgressService.saveVideoProgress(progressKey, duration,
          duration: duration);
      safePrint(
          '[VIDEO_PROGRESS] Video completed: Course="${widget.course.title}", AssignmentId=${widget.course.assignmentId ?? "N/A"}, ProgressKey=$progressKey, Duration=${duration.inSeconds}s (${duration.inMinutes}m ${duration.inSeconds % 60}s)');
      print('>>> VideoPlayerScreen: Video completed!');
      
      // Log video completion
      if (widget.course.videoKey != null) {
        ActivityLogger.logVideoCompletion(
          courseId: widget.course.id,
          courseTitle: widget.course.title,
          videoKey: widget.course.videoKey!,
          assignmentId: widget.course.assignmentId,
          durationSeconds: duration.inSeconds,
        );
      }
      
      _showCompletionDialog();
    } else {
      setState(() {
        _isPlaying = _videoPlayerController!.value.isPlaying;
      });
    }
  }

  void _startProgressSaving() {
    // Save progress every 5 seconds
    Future.delayed(const Duration(seconds: 5), () {
      if (mounted &&
          _videoPlayerController != null &&
          _videoPlayerController!.value.isInitialized) {
        final position = _videoPlayerController!.value.position;
        final duration = _videoPlayerController!.value.duration;

        // Only save if video is initialized and has valid duration and position
        if (duration.inMilliseconds > 0 && position.inMilliseconds > 0) {
          // Ensure position doesn't exceed duration
          final validPosition =
              position.inMilliseconds > duration.inMilliseconds
                  ? duration
                  : position;

          // Use assignmentId for progress tracking (each assignment has its own progress)
          final progressKey = widget.course.assignmentId ?? widget.course.id;
          VideoProgressService.saveVideoProgress(progressKey, validPosition,
              duration: duration);
          safePrint(
              '[VIDEO_PROGRESS] Saving progress: Course="${widget.course.title}", AssignmentId=${widget.course.assignmentId ?? "N/A"}, ProgressKey=$progressKey, Position=${validPosition.inSeconds}s (${validPosition.inMinutes}m ${validPosition.inSeconds % 60}s) / Duration=${duration.inSeconds}s (${duration.inMinutes}m ${duration.inSeconds % 60}s)');
        }

        // Continue saving periodically
        _startProgressSaving();
      }
    });
  }

  void _hideControlsAfterDelay() {
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted && _isPlaying) {
        setState(() {
          _showControls = false;
        });
      }
    });
  }

  void _toggleControls() {
    setState(() {
      _showControls = !_showControls;
    });
    if (_showControls) {
      _hideControlsAfterDelay();
    }
  }

  void _togglePlayPause() {
    if (_videoPlayerController == null) return;
    setState(() {
      if (_isPlaying) {
        _videoPlayerController!.pause();
      } else {
        _videoPlayerController!.play();
      }
      _isPlaying = !_isPlaying;
    });
    _hideControlsAfterDelay();
  }

  void _rewind10Seconds() {
    if (_videoPlayerController == null) return;
    final currentPosition = _videoPlayerController!.value.position;
    final newPosition = currentPosition - const Duration(seconds: 10);
    _videoPlayerController!
        .seekTo(newPosition < Duration.zero ? Duration.zero : newPosition);
  }

  void _forward10Seconds() {
    if (_videoPlayerController == null) return;
    final currentPosition = _videoPlayerController!.value.position;
    final duration = _videoPlayerController!.value.duration;
    final newPosition = currentPosition + const Duration(seconds: 10);
    _videoPlayerController!
        .seekTo(newPosition > duration ? duration : newPosition);
  }

  void _togglePlaybackSpeed() {
    setState(() {
      if (_playbackSpeed == 1.0) {
        _playbackSpeed = 1.25;
      } else if (_playbackSpeed == 1.25) {
        _playbackSpeed = 1.5;
      } else if (_playbackSpeed == 1.5) {
        _playbackSpeed = 2.0;
      } else {
        _playbackSpeed = 1.0;
      }
      _videoPlayerController?.setPlaybackSpeed(_playbackSpeed);
    });
  }

  String _formatDuration(Duration duration) {
    String twoDigits(int n) => n.toString().padLeft(2, '0');
    final minutes = twoDigits(duration.inMinutes.remainder(60));
    final seconds = twoDigits(duration.inSeconds.remainder(60));
    return '$minutes:$seconds';
  }

  void _showCompletionDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return Dialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          child: Container(
            padding: const EdgeInsets.all(15),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              color: Colors.white,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Top Icon
                const Icon(
                  Icons.check_circle,
                  color: Colors.green,
                  size: 70,
                ),
                const SizedBox(height: 15),

                // Title
                const Text(
                  "Video Completed!",
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 10),

                // Content
                const Text(
                  "Great job! You’ve finished watching the training video.\nReady to take the quiz?",
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.grey,
                  ),
                ),
                const SizedBox(height: 25),

                // Buttons Row
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    // Watch Again Button
                    TextButton(
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 12,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: const BorderSide(color: Colors.blue, width: 2),
                        ),
                      ),
                      onPressed: () async {
                        _saveFinalProgress();
                        Navigator.pop(context);
                        // Use assignmentId for progress tracking (each assignment has its own progress)
                        final progressKey =
                            widget.course.assignmentId ?? widget.course.id;
                        await VideoProgressService.clearVideoProgress(
                            progressKey);
                        _videoPlayerController?.seekTo(Duration.zero);
                        setState(() {
                          _completed = false;
                          _isPlaying = false;
                          _savedPosition = null;
                        });
                      },
                      child: const Text(
                        "Watch Again",
                        style: TextStyle(
                          fontSize: 15,
                          color: Colors.blue,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),

                    // Take Quiz Button
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 12,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        backgroundColor: Colors.blue,
                        elevation: 3,
                      ),
                      onPressed: () {
                        Navigator.pop(context);
                        widget.onVideoComplete();
                      },
                      child: const Text(
                        "Take Quiz",
                        style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: Colors.white),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  void dispose() {
    // Save final progress before disposing
    _saveFinalProgress();
    // Cancel progress timer
    _progressTimer?.cancel();
    // Remove listener and dispose controller
    _videoPlayerController?.removeListener(_videoListener);
    _videoPlayerController?.dispose();
    _videoPlayerController = null;
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        backgroundColor: Colors.black,
        body: const Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(color: Colors.white),
              SizedBox(height: 16),
              Text(
                'Loading video...',
                style: TextStyle(color: Colors.white),
              ),
            ],
          ),
        ),
      );
    }
    if (_error != null) {
      return Scaffold(
        backgroundColor: Colors.black,
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(20.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  _error!,
                  style: const TextStyle(
                    color: Colors.red,
                    fontSize: 16,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: widget.onClose,
                  child: const Text('Close'),
                ),
              ],
            ),
          ),
        ),
      );
    }
    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        onTap: _toggleControls,
        child: Stack(
          children: [
            // Video Player
            Center(
              child: _videoPlayerController != null &&
                      _videoPlayerController!.value.isInitialized
                  ? AspectRatio(
                      aspectRatio: _videoPlayerController!.value.aspectRatio,
                      child: VideoPlayer(_videoPlayerController!),
                    )
                  : const CircularProgressIndicator(color: Colors.white),
            ),
            // Top Bar
            if (_showControls)
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: Container(
                  padding: EdgeInsets.only(
                    top: MediaQuery.of(context).padding.top,
                    left: 16,
                    right: 16,
                    bottom: 16,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.7),
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.black.withOpacity(0.8),
                        Colors.transparent,
                      ],
                    ),
                  ),
                  child: Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.arrow_back, color: Colors.white),
                        onPressed: () {
                          _saveFinalProgress();
                          widget.onClose();
                        },
                      ),
                      Expanded(
                        child: Text(
                          'Chapter 1: ${widget.course.title}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w500,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.playlist_play,
                            color: Colors.white),
                        onPressed: () {
                          // TODO: Show playlist
                        },
                      ),
                      IconButton(
                        icon: const Icon(Icons.more_vert, color: Colors.white),
                        onPressed: () {
                          // TODO: Show menu
                        },
                      ),
                    ],
                  ),
                ),
              ),
            // Center Controls
            if (_showControls)
              Center(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Rewind 10s
                    GestureDetector(
                      onTap: _rewind10Seconds,
                      child: Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.6),
                          shape: BoxShape.circle,
                        ),
                        child: const Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.replay_10,
                                color: Colors.white, size: 24),
                            Text(
                              '10',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 24),
                    // Play/Pause
                    GestureDetector(
                      onTap: _togglePlayPause,
                      child: Container(
                        width: 72,
                        height: 72,
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.9),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          _isPlaying ? Icons.pause : Icons.play_arrow,
                          color: Colors.black,
                          size: 40,
                        ),
                      ),
                    ),
                    const SizedBox(width: 24),
                    // Forward 10s
                    GestureDetector(
                      onTap: _forward10Seconds,
                      child: Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.6),
                          shape: BoxShape.circle,
                        ),
                        child: const Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.forward_10,
                                color: Colors.white, size: 24),
                            Text(
                              '10',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            // Bottom Controls
            if (_showControls && _videoPlayerController != null)
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: SafeArea(
                  // <-- Added SafeArea here
                  child: Container(
                    padding: EdgeInsets.only(
                      bottom: MediaQuery.of(context).padding.bottom + 16,
                      left: 16,
                      right: 16,
                      top: 16,
                    ),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.bottomCenter,
                        end: Alignment.topCenter,
                        colors: [
                          Colors.black.withOpacity(0.8),
                          Colors.transparent,
                        ],
                      ),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Progress Bar
                        Row(
                          children: [
                            Text(
                              _formatDuration(
                                  _videoPlayerController!.value.position),
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            Expanded(
                              child: SliderTheme(
                                data: SliderTheme.of(context).copyWith(
                                  activeTrackColor: const Color(0xFF2C6EF2),
                                  inactiveTrackColor:
                                      Colors.white.withOpacity(0.3),
                                  thumbColor: const Color(0xFF2C6EF2),
                                  thumbShape: const RoundSliderThumbShape(
                                    enabledThumbRadius: 6,
                                  ),
                                  trackHeight: 4,
                                ),
                                child: Slider(
                                  value: _videoPlayerController!
                                      .value.position.inMilliseconds
                                      .toDouble(),
                                  min: 0,
                                  max: _videoPlayerController!
                                      .value.duration.inMilliseconds
                                      .toDouble(),
                                  onChanged: (value) {
                                    _videoPlayerController!.seekTo(
                                      Duration(milliseconds: value.toInt()),
                                    );
                                  },
                                ),
                              ),
                            ),
                            Text(
                              _formatDuration(
                                  _videoPlayerController!.value.duration),
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        // Bottom Row Controls
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            // Playback Speed
                            GestureDetector(
                              onTap: _togglePlaybackSpeed,
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 8,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.white.withOpacity(0.2),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  '${_playbackSpeed}x',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ),
                            // Spacer to push fullscreen button to the right
                            const Spacer(),
                            // Fullscreen
                            IconButton(
                              icon: const Icon(
                                Icons.fullscreen,
                                color: Colors.white,
                                size: 24,
                              ),
                              onPressed: () {
                                setState(() {
                                  _isFullScreen = !_isFullScreen;
                                });
                                // TODO: Implement fullscreen mode
                              },
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}


/*
class VideoPlayerScreen extends StatefulWidget {
  final Course course;
  final VoidCallback onVideoComplete;
  final VoidCallback onClose;

  const VideoPlayerScreen({
    super.key,
    required this.course,
    required this.onVideoComplete,
    required this.onClose,
  });

  @override
  State<VideoPlayerScreen> createState() => _VideoPlayerScreenState();
}

class _VideoPlayerScreenState extends State<VideoPlayerScreen> {
  VideoPlayerController? _videoPlayerController;
  bool _isLoading = true;
  String? _error;
  bool _completed = false;
  bool _showControls = true;
  bool _isPlaying = false;
  double _playbackSpeed = 1.0;
  bool _isFullScreen = false;
  Duration? _savedPosition;
  Timer? _progressTimer; // Track the timer to cancel it on dispose

  @override
  void initState() {
    super.initState();
    _loadSavedProgress();
    _loadVideo();
    _hideControlsAfterDelay();
  }

  Future<void> _loadSavedProgress() async {
    // Use assignmentId for progress tracking (each assignment has its own progress)
    final progressKey = widget.course.assignmentId ?? widget.course.id;
    final savedPosition = await VideoProgressService.getVideoProgress(progressKey);
    final isCompleted = await VideoProgressService.isVideoCompleted(progressKey);
    setState(() {
      _savedPosition = savedPosition;
      _completed = isCompleted;
    });
    print('>>> VideoPlayerScreen: Loaded saved position: ${savedPosition?.inSeconds}s, completed: $isCompleted');
  }

  Future<void> _loadVideo() async {
    if (widget.course.videoKey == null) {
      setState(() {
        _error = 'No video available for this course';
        _isLoading = false;
      });
      return;
    }

    try {
      final videoUrl =
          await StorageService.getVideoUrl(widget.course.videoKey!);

      _videoPlayerController =
          VideoPlayerController.networkUrl(Uri.parse(videoUrl));
      await _videoPlayerController!.initialize();
      _videoPlayerController!.setPlaybackSpeed(_playbackSpeed);

      // Resume from saved position if available
      if (_savedPosition != null && !_completed) {
        final duration = _videoPlayerController!.value.duration;
        if (duration.inMilliseconds > 0) {
          // Only resume if saved position is less than 95% of video (to avoid completion loop)
          final resumePosition = _savedPosition!.inMilliseconds < (duration.inMilliseconds * 0.95)
              ? _savedPosition!
              : Duration.zero;
          await _videoPlayerController!.seekTo(resumePosition);
          print('>>> VideoPlayerScreen: Resumed from position: ${resumePosition.inSeconds}s');
        }
      }

      // Listen for video updates
      _videoPlayerController!.addListener(_videoListener);

      // Start saving progress periodically
      _startProgressSaving();

      setState(() {
        _isLoading = false;
        _isPlaying = _videoPlayerController!.value.isPlaying;
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to load video: $e';
        _isLoading = false;
      });
    }
  }

  void _startProgressSaving() {
    // Cancel existing timer if any (prevents multiple timers on hot reload)
    _progressTimer?.cancel();
    
    // Save progress every 5 seconds using Timer.periodic
    _progressTimer = Timer.periodic(const Duration(seconds: 5), (timer) {
      if (!mounted || _videoPlayerController == null) {
        timer.cancel();
        return;
      }
      
      final position = _videoPlayerController!.value.position;
      final duration = _videoPlayerController!.value.duration;

      // Only save if video is initialized and has valid duration
      if (duration.inMilliseconds > 0) {
        // Use assignmentId for progress tracking (each assignment has its own progress)
        final progressKey = widget.course.assignmentId ?? widget.course.id;
        VideoProgressService.saveVideoProgress(progressKey, position, duration: duration);
        safePrint('[VIDEO_PROGRESS] Saving progress: Course="${widget.course.title}", AssignmentId=${widget.course.assignmentId ?? "N/A"}, ProgressKey=$progressKey, Position=${position.inSeconds}s (${position.inMinutes}m ${position.inSeconds % 60}s) / Duration=${duration.inSeconds}s');
      }
    });
  }

  void _videoListener() {
    if (_videoPlayerController == null) return;

    final position = _videoPlayerController!.value.position;
    final duration = _videoPlayerController!.value.duration;

    // Check if video is completed (within 1 second of end)
    if (duration.inMilliseconds > 0 &&
        position.inMilliseconds >= (duration.inMilliseconds - 1000) &&
        !_completed) {
      setState(() {
        _completed = true;
        _isPlaying = false;
      });
      // Mark video as completed
      // Use assignmentId for progress tracking (each assignment has its own progress)
      final progressKey = widget.course.assignmentId ?? widget.course.id;
      VideoProgressService.markVideoCompleted(progressKey);
      // Save final position
      VideoProgressService.saveVideoProgress(progressKey, duration);
      safePrint('[VIDEO_PROGRESS] Video completed: Course="${widget.course.title}", AssignmentId=${widget.course.assignmentId ?? "N/A"}, ProgressKey=$progressKey, Duration=${duration.inSeconds}s (${duration.inMinutes}m ${duration.inSeconds % 60}s)');
      print('>>> VideoPlayerScreen: Video completed!');
      _showCompletionDialog();
    } else {
      setState(() {
        _isPlaying = _videoPlayerController!.value.isPlaying;
      });
    }
  }

  void _hideControlsAfterDelay() {
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted && _isPlaying) {
        setState(() {
          _showControls = false;
        });
      }
    });
  }

  void _toggleControls() {
    setState(() {
      _showControls = !_showControls;
    });
    if (_showControls) {
      _hideControlsAfterDelay();
    }
  }

  void _togglePlayPause() {
    if (_videoPlayerController == null) return;
    setState(() {
      if (_isPlaying) {
        _videoPlayerController!.pause();
      } else {
        _videoPlayerController!.play();
      }
      _isPlaying = !_isPlaying;
    });
    _hideControlsAfterDelay();
  }

  void _rewind10Seconds() {
    if (_videoPlayerController == null) return;
    final currentPosition = _videoPlayerController!.value.position;
    final newPosition = currentPosition - const Duration(seconds: 10);
    _videoPlayerController!
        .seekTo(newPosition < Duration.zero ? Duration.zero : newPosition);
  }

  void _forward10Seconds() {
    if (_videoPlayerController == null) return;
    final currentPosition = _videoPlayerController!.value.position;
    final duration = _videoPlayerController!.value.duration;
    final newPosition = currentPosition + const Duration(seconds: 10);
    _videoPlayerController!
        .seekTo(newPosition > duration ? duration : newPosition);
  }

  void _togglePlaybackSpeed() {
    setState(() {
      if (_playbackSpeed == 1.0) {
        _playbackSpeed = 1.25;
      } else if (_playbackSpeed == 1.25) {
        _playbackSpeed = 1.5;
      } else if (_playbackSpeed == 1.5) {
        _playbackSpeed = 2.0;
      } else {
        _playbackSpeed = 1.0;
      }
      _videoPlayerController?.setPlaybackSpeed(_playbackSpeed);
    });
  }

  String _formatDuration(Duration duration) {
    String twoDigits(int n) => n.toString().padLeft(2, '0');
    final minutes = twoDigits(duration.inMinutes.remainder(60));
    final seconds = twoDigits(duration.inSeconds.remainder(60));
    return '$minutes:$seconds';
  }

  void _showCompletionDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return Dialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              color: Colors.white,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Top Icon
                const Icon(
                  Icons.check_circle,
                  color: Colors.green,
                  size: 70,
                ),
                const SizedBox(height: 15),

                // Title
                const Text(
                  "Video Completed!",
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 10),

                // Content
                const Text(
                  "Great job! You’ve finished watching the training video.\nReady to take the quiz?",
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.grey,
                  ),
                ),
                const SizedBox(height: 25),

                // Buttons Row
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    // Watch Again Button
                    TextButton(
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 20,
                          vertical: 12,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: const BorderSide(color: Colors.blue,width: 2),
                        ),
                      ),
                      onPressed: () async {
                        _saveFinalProgress();
                        Navigator.pop(context);
                        // Use assignmentId for progress tracking (each assignment has its own progress)
                        final progressKey = widget.course.assignmentId ?? widget.course.id;
                        await VideoProgressService.clearVideoProgress(progressKey);
                        _videoPlayerController?.seekTo(Duration.zero);
                        setState(() {
                          _completed = false;
                          _isPlaying = false;
                          _savedPosition = null;
                        });
                      },
                      child: const Text(
                        "Watch Again",
                        style: TextStyle(
                          fontSize: 15,
                          color: Colors.blue,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),

                    // Take Quiz Button
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 20,
                          vertical: 12,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        backgroundColor: Colors.blue,
                        elevation: 3,
                      ),
                      onPressed: () {
                        Navigator.pop(context);
                        widget.onVideoComplete();
                      },
                      child: const Text(
                        "Take Quiz",
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: Colors.white
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }


  @override
  void dispose() {
    // Save final progress before disposing
    _saveFinalProgress();
    _videoPlayerController?.removeListener(_videoListener);
    _videoPlayerController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        backgroundColor: Colors.black,
        body: const Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(color: Colors.white),
              SizedBox(height: 16),
              Text(
                'Loading video...',
                style: TextStyle(color: Colors.white),
              ),
            ],
          ),
        ),
      );
    }

    if (_error != null) {
      return Scaffold(
        backgroundColor: Colors.black,
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(20.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  _error!,
                  style: const TextStyle(
                    color: Colors.red,
                    fontSize: 16,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: widget.onClose,
                  child: const Text('Close'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        onTap: _toggleControls,
        child: Stack(
          children: [
            // Video Player
            Center(
              child: _videoPlayerController != null &&
                      _videoPlayerController!.value.isInitialized
                  ? AspectRatio(
                      aspectRatio: _videoPlayerController!.value.aspectRatio,
                      child: VideoPlayer(_videoPlayerController!),
                    )
                  : const CircularProgressIndicator(color: Colors.white),
            ),

            // Top Bar
            if (_showControls)
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: Container(
                  padding: EdgeInsets.only(
                    top: MediaQuery.of(context).padding.top,
                    left: 16,
                    right: 16,
                    bottom: 16,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.7),
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.black.withOpacity(0.8),
                        Colors.transparent,
                      ],
                    ),
                  ),
                  child: Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.arrow_back, color: Colors.white),
                        onPressed: () {
                        _saveFinalProgress();
                        widget.onClose();
                      },
                      ),
                      Expanded(
                        child: Text(
                          'Chapter 1: ${widget.course.title}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w500,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.playlist_play,
                            color: Colors.white),
                        onPressed: () {
                          // TODO: Show playlist
                        },
                      ),
                      IconButton(
                        icon: const Icon(Icons.more_vert, color: Colors.white),
                        onPressed: () {
                          // TODO: Show menu
                        },
                      ),
                    ],
                  ),
                ),
              ),

            // Center Controls
            if (_showControls)
              Center(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Rewind 10s
                    GestureDetector(
                      onTap: _rewind10Seconds,
                      child: Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.6),
                          shape: BoxShape.circle,
                        ),
                        child: const Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.replay_10,
                                color: Colors.white, size: 24),
                            Text(
                              '10',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 24),
                    // Play/Pause
                    GestureDetector(
                      onTap: _togglePlayPause,
                      child: Container(
                        width: 72,
                        height: 72,
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.9),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          _isPlaying ? Icons.pause : Icons.play_arrow,
                          color: Colors.black,
                          size: 40,
                        ),
                      ),
                    ),
                    const SizedBox(width: 24),
                    // Forward 10s
                    GestureDetector(
                      onTap: _forward10Seconds,
                      child: Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.6),
                          shape: BoxShape.circle,
                        ),
                        child: const Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.forward_10,
                                color: Colors.white, size: 24),
                            Text(
                              '10',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),

            // Bottom Controls
            if (_showControls && _videoPlayerController != null)
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.bottomCenter,
                      end: Alignment.topCenter,
                      colors: [
                        Colors.black.withOpacity(0.8),
                        Colors.transparent,
                      ],
                    ),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Progress Bar
                      Row(
                        children: [
                          Text(
                            _formatDuration(
                                _videoPlayerController!.value.position),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          Expanded(
                            child: SliderTheme(
                              data: SliderTheme.of(context).copyWith(
                                activeTrackColor: const Color(0xFF2C6EF2),
                                inactiveTrackColor:
                                    Colors.white.withOpacity(0.3),
                                thumbColor: const Color(0xFF2C6EF2),
                                thumbShape: const RoundSliderThumbShape(
                                  enabledThumbRadius: 6,
                                ),
                                trackHeight: 4,
                              ),
                              child: Slider(
                                value: _videoPlayerController!
                                    .value.position.inMilliseconds
                                    .toDouble(),
                                min: 0,
                                max: _videoPlayerController!
                                    .value.duration.inMilliseconds
                                    .toDouble(),
                                onChanged: (value) {
                                  _videoPlayerController!.seekTo(
                                    Duration(milliseconds: value.toInt()),
                                  );
                                },
                              ),
                            ),
                          ),
                          Text(
                            _formatDuration(
                                _videoPlayerController!.value.duration),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      // Bottom Row Controls
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          // Playback Speed
                          GestureDetector(
                            onTap: _togglePlaybackSpeed,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 8,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.2),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                '${_playbackSpeed}x',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ),
                          // Fullscreen
                          IconButton(
                            icon: const Icon(
                              Icons.fullscreen,
                              color: Colors.white,
                              size: 24,
                            ),
                            onPressed: () {
                              setState(() {
                                _isFullScreen = !_isFullScreen;
                              });
                              // TODO: Implement fullscreen mode
                            },
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
 */


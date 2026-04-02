import 'dart:async';
import 'dart:ui' show FontFeature;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:video_player/video_player.dart';

import '../../../../core/theme/app_colors.dart';
import 'package:amplify_flutter/amplify_flutter.dart';
import '../../../course/data/models/course_model.dart';
import '../../../course/data/models/lesson_model.dart';
import '../../../course/services/lesson_service.dart';
import '../../../../core/services/storage_service.dart';
import '../../../course/services/video_progress_service.dart';
import '../../../../core/services/activity_logger.dart';

class VideoPlayerScreen extends StatefulWidget {
  final Course course;
  final VoidCallback onVideoComplete;
  final VoidCallback onClose;
  final String? lesson; // 👈 optional

  const VideoPlayerScreen({
    super.key,
    required this.course,
    required this.onVideoComplete,
    required this.onClose,
    this.lesson,
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
  bool _muted = false;
  double _volumeBeforeMute = 1.0;
  Duration? _savedPosition;
  Timer? _progressTimer; // Track the timer to cancel it on dispose
  List<Lesson> _lessons = [];
  int _currentLessonIndex = 0;
  bool _isLoadingLessons = false;

  @override
  void initState() {
    super.initState();
    _loadSavedProgress();
    _loadLessons();
    _loadVideo();
    _hideControlsAfterDelay();
  }

  Future<void> _loadLessons() async {
    setState(() {
      _isLoadingLessons = true;
    });
    try {
      final lessons = await LessonService.getLessonsForCourse(widget.course.id);
      if (!mounted) return;
      setState(() {
        _lessons = lessons;
        _currentLessonIndex = 0;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        // Swallow the error for now; video playback still works without lessons.
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoadingLessons = false;
        });
      }
    }
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

  void _showLessonsPlaylist() {
    if (_isLoadingLessons) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Loading lessons...'),
          duration: Duration(seconds: 1),
        ),
      );
      return;
    }
    if (_lessons.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No lessons available for this course'),
          duration: Duration(seconds: 2),
        ),
      );
      return;
    }

    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) {
        return SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                margin: const EdgeInsets.symmetric(vertical: 12),
                height: 4,
                width: 40,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Lessons',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1),
              Flexible(
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: _lessons.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final lesson = _lessons[index];
                    final isCurrent = index == _currentLessonIndex;
                    return ListTile(
                      title: Text(
                        lesson.title,
                        style: TextStyle(
                          fontWeight:
                              isCurrent ? FontWeight.w600 : FontWeight.w400,
                        ),
                      ),
                      leading: CircleAvatar(
                        radius: 14,
                        backgroundColor: isCurrent
                            ? Colors.blue
                            : Colors.grey.withOpacity(0.2),
                        child: Text(
                          '${index + 1}',
                          style: TextStyle(
                            fontSize: 12,
                            color: isCurrent ? Colors.white : Colors.black87,
                          ),
                        ),
                      ),
                      trailing: isCurrent
                          ? const Icon(Icons.play_arrow, color: Colors.blue)
                          : null,
                      onTap: () {
                        setState(() {
                          _currentLessonIndex = index;
                        });
                        Navigator.of(context).pop();
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
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

  String _formatVideoTimestamp(Duration d) {
    final h = d.inHours;
    final m = d.inMinutes.remainder(60);
    final s = d.inSeconds.remainder(60);
    final mm = m.toString().padLeft(2, '0');
    final ss = s.toString().padLeft(2, '0');
    if (h > 0) {
      return '${h.toString().padLeft(2, '0')}:$mm:$ss';
    }
    return '$mm:$ss';
  }

  TextStyle get _timestampStyle => TextStyle(
        color: Colors.white,
        fontSize: 12,
        fontWeight: FontWeight.w600,
        fontFeatures: const [FontFeature.tabularFigures()],
      );

  Future<void> _toggleFullscreen() async {
    setState(() => _isFullScreen = !_isFullScreen);
    if (_isFullScreen) {
      await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    } else {
      await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    }
  }

  void _toggleMute() {
    if (_videoPlayerController == null) return;
    setState(() {
      _muted = !_muted;
      if (_muted) {
        _volumeBeforeMute = _videoPlayerController!.value.volume;
        _videoPlayerController!.setVolume(0);
      } else {
        _videoPlayerController!.setVolume(_volumeBeforeMute.clamp(0.0, 1.0));
      }
    });
  }

  void _restartFromBeginning() {
    if (_videoPlayerController == null) return;
    _videoPlayerController!.seekTo(Duration.zero);
    _videoPlayerController!.play();
    setState(() {
      _isPlaying = true;
      _completed = false;
    });
    _hideControlsAfterDelay();
  }

  void _showPlayerToolsSheet() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: const Color(0xFF1E1E1E),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: Icon(
                  _muted ? Icons.volume_up : Icons.volume_off,
                  color: Colors.white70,
                ),
                title: Text(
                  _muted ? 'Unmute' : 'Mute',
                  style: const TextStyle(color: Colors.white),
                ),
                onTap: () {
                  Navigator.pop(ctx);
                  _toggleMute();
                },
              ),
              ListTile(
                leading: const Icon(Icons.replay, color: Colors.white70),
                title: const Text(
                  'Start from beginning',
                  style: TextStyle(color: Colors.white),
                ),
                onTap: () {
                  Navigator.pop(ctx);
                  _restartFromBeginning();
                },
              ),
              ListTile(
                leading: const Icon(Icons.speed, color: Colors.white70),
                title: const Text(
                  'Playback speed',
                  style: TextStyle(color: Colors.white),
                ),
                subtitle: Text(
                  '${_playbackSpeed}x',
                  style: TextStyle(color: Colors.white.withOpacity(0.6)),
                ),
                onTap: () {
                  Navigator.pop(ctx);
                  _togglePlaybackSpeed();
                },
              ),
              ListTile(
                leading: const Icon(Icons.playlist_play, color: Colors.white70),
                title: const Text(
                  'Lessons',
                  style: TextStyle(color: Colors.white),
                ),
                onTap: () {
                  Navigator.pop(ctx);
                  _showLessonsPlaylist();
                },
              ),
            ],
          ),
        );
      },
    );
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
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
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
                          _lessons.isNotEmpty
                              ? 'Lesson ${_currentLessonIndex + 1}: ${_lessons[_currentLessonIndex].title}'
                              : widget.course.title,
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
                        onPressed: _showLessonsPlaylist,
                      ),
                      IconButton(
                        icon: const Icon(Icons.more_vert, color: Colors.white),
                        onPressed: _showPlayerToolsSheet,
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
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            SizedBox(
                              width: 68,
                              child: Text(
                                _formatVideoTimestamp(
                                  _videoPlayerController!.value.position,
                                ),
                                style: _timestampStyle,
                                maxLines: 1,
                                overflow: TextOverflow.fade,
                                softWrap: false,
                              ),
                            ),
                            Expanded(
                              child: SliderTheme(
                                data: SliderTheme.of(context).copyWith(
                                  activeTrackColor: AppColors.primaryBlue,
                                  inactiveTrackColor:
                                      Colors.white.withOpacity(0.3),
                                  thumbColor: AppColors.primaryBlue,
                                  thumbShape: const RoundSliderThumbShape(
                                    enabledThumbRadius: 6,
                                  ),
                                  trackHeight: 4,
                                  overlayShape: SliderComponentShape.noOverlay,
                                ),
                                child: Builder(
                                  builder: (context) {
                                    final durationMs = _videoPlayerController!
                                        .value.duration.inMilliseconds;
                                    final positionMs = _videoPlayerController!
                                        .value.position.inMilliseconds;
                                    final maxMs =
                                        durationMs > 0 ? durationMs : 1;
                                    final clampedPosition = durationMs > 0
                                        ? positionMs.clamp(0, durationMs)
                                        : 0;
                                    return Slider(
                                      value: clampedPosition.toDouble(),
                                      min: 0,
                                      max: maxMs.toDouble(),
                                      onChanged: durationMs > 0
                                          ? (value) {
                                              _videoPlayerController!.seekTo(
                                                Duration(
                                                  milliseconds: value.toInt(),
                                                ),
                                              );
                                            }
                                          : null,
                                    );
                                  },
                                ),
                              ),
                            ),
                            SizedBox(
                              width: 68,
                              child: Text(
                                _formatVideoTimestamp(
                                  _videoPlayerController!.value.duration,
                                ),
                                style: _timestampStyle,
                                textAlign: TextAlign.right,
                                maxLines: 1,
                                overflow: TextOverflow.fade,
                                softWrap: false,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            IconButton(
                              tooltip: _muted ? 'Unmute' : 'Mute',
                              icon: Icon(
                                _muted ? Icons.volume_off : Icons.volume_up,
                                color: Colors.white,
                                size: 22,
                              ),
                              onPressed: _toggleMute,
                            ),
                            IconButton(
                              tooltip: 'Start from beginning',
                              icon: const Icon(
                                Icons.replay,
                                color: Colors.white,
                                size: 22,
                              ),
                              onPressed: _restartFromBeginning,
                            ),
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
                            const Spacer(),
                            IconButton(
                              tooltip: _isFullScreen
                                  ? 'Exit fullscreen'
                                  : 'Fullscreen',
                              icon: Icon(
                                _isFullScreen
                                    ? Icons.fullscreen_exit
                                    : Icons.fullscreen,
                                color: Colors.white,
                                size: 24,
                              ),
                              onPressed: _toggleFullscreen,
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

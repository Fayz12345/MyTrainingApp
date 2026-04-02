import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:video_player/video_player.dart';

import '../../../../core/services/storage_service.dart';
import '../../../../core/theme/app_colors.dart';
import '../../data/models/course_model.dart';
import '../../data/models/lesson_model.dart';

class LessonVideoPlayerScreen extends StatefulWidget {
  final Course course;
  final Lesson lesson;
  final String videoKey;

  const LessonVideoPlayerScreen({
    super.key,
    required this.course,
    required this.lesson,
    required this.videoKey,
  });

  @override
  State<LessonVideoPlayerScreen> createState() =>
      _LessonVideoPlayerScreenState();
}

class _LessonVideoPlayerScreenState extends State<LessonVideoPlayerScreen> {
  VideoPlayerController? _controller;
  bool _loading = true;
  String? _error;
  bool _completed = false;
  bool _disposed = false;
  bool _showControls = true;
  bool _isPlaying = false;
  double _playbackSpeed = 1.0;
  bool _muted = false;
  double _volumeBeforeMute = 1.0;
  bool _isFullScreen = false;
  bool _buffering = false;

  /// True only after [Duration.zero] + threshold so mid-play stalls show a spinner.
  bool _decodeStarted = false;

  /// Spinner on black only if startup is still loading after [_initStallThreshold].
  bool _stallingInit = false;
  Timer? _initStallTimer;

  /// Beyond this, first frame is slow → treat as weak/slow link and show spinner (no text).
  static const Duration _initStallThreshold = Duration(milliseconds: 550);

  @override
  void initState() {
    super.initState();
    _initStallTimer = Timer(_initStallThreshold, () {
      if (mounted && _loading) {
        setState(() => _stallingInit = true);
      }
    });
    _loadVideo();
    _hideControlsAfterDelay();
  }

  Future<void> _loadVideo() async {
    try {
      final url = await StorageService.getVideoUrl(widget.videoKey);
      // Progressive buffering is handled by the platform player (HTTP range / internal buffer).
      final controller = VideoPlayerController.networkUrl(Uri.parse(url));
      await controller.initialize();

      if (!mounted || _disposed) {
        await controller.dispose();
        return;
      }

      await controller.setPlaybackSpeed(_playbackSpeed);
      controller.addListener(_onVideoUpdate);
      await controller.play();
      if (!mounted || _disposed) {
        controller.removeListener(_onVideoUpdate);
        await controller.dispose();
        return;
      }
      final c = controller;
      _initStallTimer?.cancel();
      _initStallTimer = null;
      setState(() {
        _controller = c;
        _loading = false;
        _stallingInit = false;
        _isPlaying = c.value.isPlaying;
        _buffering = c.value.isBuffering;
      });
    } catch (e) {
      _initStallTimer?.cancel();
      _initStallTimer = null;
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load video: $e';
        _loading = false;
        _stallingInit = false;
      });
    }
  }

  void _onVideoUpdate() {
    if (_disposed || !mounted) return;
    final c = _controller;
    if (c == null || !c.value.isInitialized) return;

    if (c.value.isPlaying ||
        c.value.position.inMilliseconds > 400 ||
        c.value.buffered.isNotEmpty) {
      _decodeStarted = true;
    }

    if (!_completed) {
      final duration = c.value.duration;
      final position = c.value.position;
      if (duration.inMilliseconds > 0 &&
          position.inMilliseconds >= (duration.inMilliseconds - 1000)) {
        _completed = true;
        c.removeListener(_onVideoUpdate);
        c.pause();
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted && !_disposed) {
            _showCompletionDialog();
          }
        });
        setState(() {
          _isPlaying = false;
          _buffering = false;
        });
        return;
      }
    }
    setState(() {
      _isPlaying = c.value.isPlaying;
      _buffering = c.value.isBuffering;
    });
  }

  void _hideControlsAfterDelay() {
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted && !_disposed && _isPlaying) {
        setState(() => _showControls = false);
      }
    });
  }

  void _toggleControls() {
    setState(() => _showControls = !_showControls);
    if (_showControls) {
      _hideControlsAfterDelay();
    }
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
    final c = _controller;
    if (c == null) return;
    setState(() {
      _muted = !_muted;
      if (_muted) {
        _volumeBeforeMute = c.value.volume;
        c.setVolume(0);
      } else {
        c.setVolume(_volumeBeforeMute.clamp(0.0, 1.0));
      }
    });
  }

  void _togglePlayPause() {
    final c = _controller;
    if (c == null) return;
    if (c.value.isPlaying) {
      c.pause();
    } else {
      c.play();
    }
    setState(() {
      _isPlaying = c.value.isPlaying;
    });
    _hideControlsAfterDelay();
  }

  void _rewind10Seconds() {
    final c = _controller;
    if (c == null) return;
    final p = c.value.position - const Duration(seconds: 10);
    c.seekTo(p < Duration.zero ? Duration.zero : p);
  }

  void _forward10Seconds() {
    final c = _controller;
    if (c == null) return;
    final duration = c.value.duration;
    final p = c.value.position + const Duration(seconds: 10);
    c.seekTo(p > duration ? duration : p);
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
      _controller?.setPlaybackSpeed(_playbackSpeed);
    });
    _hideControlsAfterDelay();
  }

  void _restartFromBeginning() {
    final c = _controller;
    if (c == null) return;
    if (_completed) {
      c.addListener(_onVideoUpdate);
    }
    c.seekTo(Duration.zero);
    c.play();
    setState(() {
      _completed = false;
      _isPlaying = true;
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
            ],
          ),
        );
      },
    );
  }

  void _showCompletionDialog() {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Video completed'),
        content:
            const Text('Would you like to watch again or go back to lesson?'),
        actions: [
          TextButton(
            onPressed: () async {
              Navigator.of(context).pop();
              if (!mounted || _disposed) return;
              final c = _controller;
              if (c == null || !c.value.isInitialized) return;
              c.removeListener(_onVideoUpdate);
              try {
                await c.seekTo(Duration.zero);
                if (!mounted || _disposed) return;
                await c.play();
                c.addListener(_onVideoUpdate);
                if (mounted) {
                  setState(() {
                    _completed = false;
                    _isPlaying = true;
                  });
                }
              } catch (_) {
                // Controller may be disposing if user navigated away.
              }
            },
            child: const Text('Watch again'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              if (mounted) {
                Navigator.of(context).pop(true);
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primaryBlue,
              foregroundColor: Colors.white,
            ),
            child: const Text('Back'),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _initStallTimer?.cancel();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    _disposed = true;
    final c = _controller;
    _controller = null;
    if (c != null) {
      c.removeListener(_onVideoUpdate);
      c.dispose();
    }
    super.dispose();
  }

  /// Mid-playback stall only (initial slow open uses full-screen scaffold above).
  bool get _showBlockingSpinner =>
      !_loading &&
      _decodeStarted &&
      _buffering &&
      _controller != null &&
      _controller!.value.isInitialized;

  @override
  Widget build(BuildContext context) {
    if (_loading && !_stallingInit) {
      return const Scaffold(
        backgroundColor: Colors.black,
        body: SizedBox.expand(),
      );
    }

    if (_loading && _stallingInit) {
      return const Scaffold(
        backgroundColor: Colors.black,
        body: Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    if (_error != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Lesson Video')),
        body: Center(child: Text(_error!)),
      );
    }

    final controller = _controller!;
    final topPad = MediaQuery.paddingOf(context).top;

    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _toggleControls,
        child: Stack(
          fit: StackFit.expand,
          children: [
            Center(
              child: AspectRatio(
                aspectRatio: controller.value.aspectRatio,
                child: VideoPlayer(controller),
              ),
            ),
            if (_showBlockingSpinner)
              Positioned.fill(
                child: IgnorePointer(
                  child: ColoredBox(
                    color: Colors.black.withValues(alpha: 0.35),
                    child: const Center(
                      child: CircularProgressIndicator(
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ),
            if (_showControls)
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: Container(
                  padding: EdgeInsets.only(
                    top: topPad,
                    left: 8,
                    right: 8,
                    bottom: 16,
                  ),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.black.withOpacity(0.75),
                        Colors.transparent,
                      ],
                    ),
                  ),
                  child: Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.arrow_back, color: Colors.white),
                        onPressed: () => Navigator.of(context).pop(),
                      ),
                      Expanded(
                        child: Text(
                          widget.lesson.title,
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
                        icon: const Icon(Icons.more_vert, color: Colors.white),
                        onPressed: _showPlayerToolsSheet,
                      ),
                    ],
                  ),
                ),
              ),
            if (_showControls)
              Center(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
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
            if (_showControls)
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: SafeArea(
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.bottomCenter,
                        end: Alignment.topCenter,
                        colors: [
                          Colors.black.withOpacity(0.85),
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
                                    controller.value.position),
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
                                    final durationMs = controller
                                        .value.duration.inMilliseconds;
                                    final positionMs = controller
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
                                              controller.seekTo(
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
                                    controller.value.duration),
                                style: _timestampStyle,
                                textAlign: TextAlign.right,
                                maxLines: 1,
                                overflow: TextOverflow.fade,
                                softWrap: false,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
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

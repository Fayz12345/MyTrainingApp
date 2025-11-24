import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import 'package:chewie/chewie.dart';
import '../models/course_model.dart';
import '../services/storage_service.dart';

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
  ChewieController? _chewieController;
  bool _isLoading = true;
  String? _error;
  bool _completed = false;

  @override
  void initState() {
    super.initState();
    _loadVideo();
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

      _chewieController = ChewieController(
        videoPlayerController: _videoPlayerController!,
        autoPlay: true,
        looping: false,
        allowFullScreen: true,
        allowMuting: false,
        showControls: true,
        aspectRatio: _videoPlayerController!.value.aspectRatio,
      );

      // Listen for video end
      _videoPlayerController!.addListener(() {
        if (_videoPlayerController!.value.position >=
                _videoPlayerController!.value.duration &&
            _videoPlayerController!.value.duration.inMilliseconds > 0 &&
            !_completed) {
          setState(() {
            _completed = true;
          });
          _showCompletionDialog();
        }
      });

      // Progress checking is handled in the listener added above

      setState(() {
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to load video: $e';
        _isLoading = false;
      });
    }
  }

  void _checkProgress() {
    if (_videoPlayerController != null &&
        _videoPlayerController!.value.isInitialized) {
      final duration = _videoPlayerController!.value.duration;
      final position = _videoPlayerController!.value.position;

      if (duration.inMilliseconds > 0) {
        final progress = position.inMilliseconds / duration.inMilliseconds;
        if (progress > 0.9 && !_completed) {
          setState(() {
            _completed = true;
          });
        }
      }
    }
  }

  void _showCompletionDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Video Complete!'),
        content: const Text(
          'You have finished watching the training video. Ready to take the quiz?',
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              _videoPlayerController?.seekTo(Duration.zero);
              setState(() {
                _completed = false;
              });
            },
            child: const Text('Watch Again'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              widget.onVideoComplete();
            },
            child: const Text('Take Quiz'),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _videoPlayerController?.removeListener(_checkProgress);
    _chewieController?.dispose();
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
      appBar: AppBar(
        backgroundColor: Colors.black87,
        leading: IconButton(
          icon: const Icon(Icons.close, color: Colors.white),
          onPressed: widget.onClose,
        ),
        title: Text(
          widget.course.title,
          style: const TextStyle(color: Colors.white),
        ),
        centerTitle: true,
      ),
      body: Column(
        children: [
          Expanded(
            child: Center(
              child: _chewieController != null
                  ? Chewie(controller: _chewieController!)
                  : const CircularProgressIndicator(),
            ),
          ),
          if (_completed)
            Container(
              padding: const EdgeInsets.all(16),
              color: Colors.black87,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.green,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Text(
                      '✓ Completed',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  ElevatedButton(
                    onPressed: widget.onVideoComplete,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF007AFF),
                    ),
                    child: const Text('Take Quiz'),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

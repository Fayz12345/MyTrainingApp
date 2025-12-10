import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// Circular Dots Loader - Modern and attractive animated loader
class DotsLoader extends StatefulWidget {
  final Color color;
  final double size;

  const DotsLoader({
    super.key,
    this.color = AppTheme.primaryColor,
    this.size = 5.0,
  });

  @override
  State<DotsLoader> createState() => _DotsLoaderState();
}

class _DotsLoaderState extends State<DotsLoader>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    )..repeat();
  }

  @override
  Widget build(BuildContext context) {
    // Use smaller, fixed padding to prevent overflow on small screens
    // Calculate padding as a percentage of size, but cap it to prevent overflow
    final padding = (widget.size * 0.4).clamp(1.5, 3.0);

    return Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(3, (index) {
        return AnimatedBuilder(
          animation: _controller,
          builder: (_, __) {
            // Calculate opacity with wave effect, ensuring it stays between 0.0 and 1.0
            final phase = (_controller.value + index * 0.3) % 1.0;
            final opacity = (0.3 + phase * 0.7).clamp(0.0, 1.0);
            return Opacity(
              opacity: opacity,
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: padding),
                child: CircleAvatar(
                  radius: widget.size,
                  backgroundColor: widget.color,
                ),
              ),
            );
          },
        );
      }),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }
}

/// Pulse Loader - Clean and modern single dot pulse animation
class PulseLoader extends StatefulWidget {
  final Color color;
  final double size;

  const PulseLoader({
    super.key,
    this.color = AppTheme.primaryColor,
    this.size = 25.0,
  });

  @override
  State<PulseLoader> createState() => _PulseLoaderState();
}

class _PulseLoaderState extends State<PulseLoader>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 1),
      lowerBound: 0.5,
      upperBound: 1,
    )..repeat(reverse: true);
  }

  @override
  Widget build(BuildContext context) {
    return ScaleTransition(
      scale: _controller,
      child: Container(
        height: widget.size,
        width: widget.size,
        decoration: BoxDecoration(
          color: widget.color,
          shape: BoxShape.circle,
        ),
      ),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }
}

/// Wave Loader - Elastic wave animation
class WaveLoader extends StatefulWidget {
  final Color color;

  const WaveLoader({
    super.key,
    this.color = AppTheme.primaryColor,
  });

  @override
  State<WaveLoader> createState() => _WaveLoaderState();
}

class _WaveLoaderState extends State<WaveLoader>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (index) {
        return AnimatedBuilder(
          animation: _controller,
          builder: (_, __) {
            return Container(
              margin: const EdgeInsets.symmetric(horizontal: 3),
              height:
                  20 + 20 * math.sin((_controller.value * 2 * math.pi) + index),
              width: 6,
              decoration: BoxDecoration(
                color: widget.color,
                borderRadius: BorderRadius.circular(10),
              ),
            );
          },
        );
      }),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }
}

/// Full-screen overlay loader with modern design
class AppLoader extends StatelessWidget {
  final String? message;
  final Color? backgroundColor;
  final Color? loaderColor;

  const AppLoader({
    super.key,
    this.message,
    this.backgroundColor,
    this.loaderColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: backgroundColor ?? Colors.black54,
      child: Center(
        child: Container(
          padding: const EdgeInsets.all(30),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.1),
                blurRadius: 20,
                spreadRadius: 5,
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DotsLoader(
                color: loaderColor ?? AppTheme.primaryColor,
                size: 6.0,
              ),
              if (message != null) ...[
                const SizedBox(height: 20),
                Text(
                  message!,
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.grey[700],
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Utility function to show full-screen loader
void showAppLoader(BuildContext context, {String? message}) {
  showDialog(
    context: context,
    barrierDismissible: false,
    barrierColor: Colors.black54,
    builder: (_) => AppLoader(message: message),
  );
}

/// Utility function to hide loader
void hideAppLoader(BuildContext context) {
  Navigator.of(context, rootNavigator: true).pop();
}

/// Loading widget with message - for inline use
class LoadingWidget extends StatelessWidget {
  final String? message;
  final Color? loaderColor;
  final bool useDotsLoader;

  const LoadingWidget({
    super.key,
    this.message,
    this.loaderColor,
    this.useDotsLoader = true,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          useDotsLoader
              ? DotsLoader(
                  color: loaderColor ?? AppTheme.primaryColor,
                  size: 6.0,
                )
              : PulseLoader(
                  color: loaderColor ?? AppTheme.primaryColor,
                  size: 30.0,
                ),
          if (message != null) ...[
            const SizedBox(height: 16),
            Text(
              message!,
              style: TextStyle(
                fontSize: 16,
                color: Colors.grey[600],
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Compact loader for buttons - uses CircularProgressIndicator to avoid overflow
class ButtonLoader extends StatelessWidget {
  final Color color;
  final double size;

  const ButtonLoader({
    super.key,
    this.color = Colors.white,
    this.size = 20.0,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: size,
      width: size,
      child: CircularProgressIndicator(
        strokeWidth: 2.5,
        valueColor: AlwaysStoppedAnimation<Color>(color),
      ),
    );
  }
}

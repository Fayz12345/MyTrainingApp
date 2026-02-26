import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

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

void showAppLoader(BuildContext context, {String? message}) {
  showDialog(
    context: context,
    barrierDismissible: false,
    barrierColor: Colors.black54,
    builder: (_) => AppLoader(message: message),
  );
}

void hideAppLoader(BuildContext context) {
  Navigator.of(context, rootNavigator: true).pop();
}

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

/// Skeleton loader widget with shimmer effect for learning path cards
class SkeletonLoader extends StatefulWidget {
  final double width;
  final double height;
  final BorderRadius? borderRadius;

  const SkeletonLoader({
    super.key,
    this.width = double.infinity,
    this.height = 20.0,
    this.borderRadius,
  });

  @override
  State<SkeletonLoader> createState() => _SkeletonLoaderState();
}

class _SkeletonLoaderState extends State<SkeletonLoader>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();

    _animation = Tween<double>(begin: -1.0, end: 2.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: widget.borderRadius ?? BorderRadius.circular(8),
            gradient: LinearGradient(
              begin: Alignment(_animation.value - 1, 0),
              end: Alignment(_animation.value, 0),
              colors: [
                Colors.grey[300]!,
                Colors.grey[100]!,
                Colors.grey[300]!,
              ],
              stops: const [0.0, 0.5, 1.0],
            ),
          ),
        );
      },
    );
  }
}

/// Skeleton loader for learning path card
class LearningPathSkeletonLoader extends StatelessWidget {
  const LearningPathSkeletonLoader({super.key});

  @override
  Widget build(BuildContext context) {
    final dims = AppTheme.getDimensions(context);
    final isTablet = dims.isTablet;
    final isSmallScreen = dims.isSmallScreen;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Padding(
        padding: EdgeInsets.all(isTablet ? 20.0 : (isSmallScreen ? 12.0 : 16.0)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SkeletonLoader(
                        height: isTablet ? 20 : (isSmallScreen ? 16 : 18),
                        width: double.infinity,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      SizedBox(height: isSmallScreen ? 3 : 4),
                      SkeletonLoader(
                        height: isTablet ? 14 : (isSmallScreen ? 11 : 12),
                        width: MediaQuery.of(context).size.width * 0.6,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ],
                  ),
                ),
                SizedBox(width: isTablet ? 28 : (isSmallScreen ? 20 : 24)),
              ],
            ),
            SizedBox(height: isSmallScreen ? 10 : 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                SkeletonLoader(
                  height: isTablet ? 16 : (isSmallScreen ? 12 : 14),
                  width: MediaQuery.of(context).size.width * 0.4,
                  borderRadius: BorderRadius.circular(4),
                ),
                SkeletonLoader(
                  height: isTablet ? 16 : (isSmallScreen ? 12 : 14),
                  width: 60,
                  borderRadius: BorderRadius.circular(12),
                ),
              ],
            ),
            SizedBox(height: isSmallScreen ? 8 : 10),
            SkeletonLoader(
              height: isTablet ? 12 : (isSmallScreen ? 8 : 10),
              width: double.infinity,
              borderRadius: BorderRadius.circular(8),
            ),
          ],
        ),
      ),
    );
  }
}

/// Skeleton loader for profile card
class ProfileCardSkeletonLoader extends StatelessWidget {
  const ProfileCardSkeletonLoader({super.key});

  @override
  Widget build(BuildContext context) {
    final dims = AppTheme.getDimensions(context);
    final isTablet = dims.isTablet;

    return Container(
      padding: EdgeInsets.all(isTablet ? 24 : 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Avatar skeleton
          SkeletonLoader(
            width: 80,
            height: 80,
            borderRadius: BorderRadius.circular(40),
          ),
          const SizedBox(height: 16),
          // Name skeleton
          SkeletonLoader(
            height: isTablet ? 24 : 20,
            width: 150,
            borderRadius: BorderRadius.circular(4),
          ),
          const SizedBox(height: 8),
          // Department skeleton
          SkeletonLoader(
            height: isTablet ? 16 : 14,
            width: 100,
            borderRadius: BorderRadius.circular(4),
          ),
        ],
      ),
    );
  }
}

/// Skeleton loader for achievements card (statistics)
class AchievementsCardSkeletonLoader extends StatelessWidget {
  const AchievementsCardSkeletonLoader({super.key});

  @override
  Widget build(BuildContext context) {
    final dims = AppTheme.getDimensions(context);
    final isTablet = dims.isTablet;

    return Container(
      padding: EdgeInsets.all(isTablet ? 24 : 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          // Top stat card skeleton
          Card(
            color: Colors.white,
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: Colors.grey[300]!, width: 1),
            ),
            child: Padding(
              padding: EdgeInsets.symmetric(
                vertical: isTablet ? 15 : 10,
                horizontal: isTablet ? 8 : 5,
              ),
              child: Column(
                children: [
                  SkeletonLoader(
                    height: isTablet ? 36 : 30,
                    width: 40,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  SizedBox(height: isTablet ? 12 : 8),
                  SkeletonLoader(
                    height: isTablet ? 16 : 14,
                    width: 120,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ],
              ),
            ),
          ),
          SizedBox(height: isTablet ? 16 : 8),
          // Bottom stat card skeleton
          Card(
            color: Colors.white,
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: Colors.grey[300]!, width: 1),
            ),
            child: Padding(
              padding: EdgeInsets.symmetric(
                vertical: isTablet ? 15 : 10,
                horizontal: isTablet ? 8 : 5,
              ),
              child: Column(
                children: [
                  SkeletonLoader(
                    height: isTablet ? 36 : 30,
                    width: 40,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  SizedBox(height: isTablet ? 12 : 8),
                  SkeletonLoader(
                    height: isTablet ? 16 : 14,
                    width: 140,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Skeleton loader for current progress card
class ProgressCardSkeletonLoader extends StatelessWidget {
  const ProgressCardSkeletonLoader({super.key});

  @override
  Widget build(BuildContext context) {
    final dims = AppTheme.getDimensions(context);
    final isTablet = dims.isTablet;

    return Container(
      padding: EdgeInsets.all(isTablet ? 24 : 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Title skeleton
          SkeletonLoader(
            height: isTablet ? 20 : 16,
            width: 150,
            borderRadius: BorderRadius.circular(4),
          ),
          const SizedBox(height: 20),
          // Course progress items (2 items)
          ...List.generate(2, (index) => Padding(
                padding: EdgeInsets.only(bottom: index == 1 ? 0 : 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: SkeletonLoader(
                            height: isTablet ? 16 : 14,
                            width: double.infinity,
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                        const SizedBox(width: 12),
                        SkeletonLoader(
                          height: isTablet ? 16 : 14,
                          width: 40,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    // Progress bar skeleton
                    SkeletonLoader(
                      height: 8,
                      width: double.infinity,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ],
                ),
              )),
        ],
      ),
    );
  }
}

/// Skeleton loader for course card
class CourseCardSkeletonLoader extends StatelessWidget {
  const CourseCardSkeletonLoader({super.key});

  @override
  Widget build(BuildContext context) {
    final dims = AppTheme.getDimensions(context);
    final isTablet = dims.isTablet;
    final isSmallScreen = dims.isSmallScreen;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      padding: EdgeInsets.all(isTablet ? 20.0 : (isSmallScreen ? 16.0 : 20.0)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header with title, description, and thumbnail
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Title
                    SkeletonLoader(
                      height: isTablet ? 22 : (isSmallScreen ? 18 : 20),
                      width: double.infinity,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    SizedBox(height: isSmallScreen ? 8 : 10),
                    // Description line 1
                    SkeletonLoader(
                      height: isTablet ? 14 : (isSmallScreen ? 12 : 14),
                      width: double.infinity,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    SizedBox(height: isSmallScreen ? 4 : 6),
                    // Description line 2
                    SkeletonLoader(
                      height: isTablet ? 14 : (isSmallScreen ? 12 : 14),
                      width: MediaQuery.of(context).size.width * 0.5,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ],
                ),
              ),
              SizedBox(width: isSmallScreen ? 12 : 16),
              // Thumbnail
              SkeletonLoader(
                width: isTablet ? 90 : (isSmallScreen ? 70 : 80),
                height: isTablet ? 90 : (isSmallScreen ? 70 : 80),
                borderRadius: BorderRadius.circular(20),
              ),
            ],
          ),
          SizedBox(height: isSmallScreen ? 12 : 16),
          // Tags
          Row(
            children: [
              SkeletonLoader(
                height: isTablet ? 24 : (isSmallScreen ? 20 : 22),
                width: 80,
                borderRadius: BorderRadius.circular(12),
              ),
              SizedBox(width: isSmallScreen ? 8 : 10),
              SkeletonLoader(
                height: isTablet ? 24 : (isSmallScreen ? 20 : 22),
                width: 100,
                borderRadius: BorderRadius.circular(12),
              ),
            ],
          ),
          SizedBox(height: isSmallScreen ? 12 : 16),
          // Progress bar and button section
          SkeletonLoader(
            height: isTablet ? 8 : (isSmallScreen ? 6 : 8),
            width: double.infinity,
            borderRadius: BorderRadius.circular(4),
          ),
          SizedBox(height: isSmallScreen ? 12 : 16),
          // Button
          SkeletonLoader(
            height: isTablet ? 48 : (isSmallScreen ? 42 : 46),
            width: double.infinity,
            borderRadius: BorderRadius.circular(12),
          ),
        ],
      ),
    );
  }
}

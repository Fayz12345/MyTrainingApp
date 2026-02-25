import 'package:flutter/material.dart';
import 'dart:math' as math;

/// Celebration animation widget that shows confetti-like particles
/// when quiz is passed
class CelebrationAnimation extends StatefulWidget {
  final Widget child;
  final bool isActive;
  final Duration duration;

  const CelebrationAnimation({
    super.key,
    required this.child,
    this.isActive = false,
    this.duration = const Duration(seconds: 2),
  });

  @override
  State<CelebrationAnimation> createState() => _CelebrationAnimationState();
}

class _CelebrationAnimationState extends State<CelebrationAnimation>
    with TickerProviderStateMixin {
  late List<AnimationController> _controllers;
  late List<Animation<double>> _animations;
  final List<Particle> _particles = [];
  final int _particleCount = 50;

  @override
  void initState() {
    super.initState();
    _initializeParticles();
  }

  void _initializeParticles() {
    final random = math.Random();
    _particles.clear();

    for (int i = 0; i < _particleCount; i++) {
      _particles.add(Particle(
        x: random.nextDouble(),
        y: random.nextDouble(),
        color: _getRandomColor(random),
        size: 4 + random.nextDouble() * 6,
        velocityX: (random.nextDouble() - 0.5) * 0.02,
        velocityY: (random.nextDouble() - 0.5) * 0.02,
        rotation: random.nextDouble() * 2 * math.pi,
        rotationSpeed: (random.nextDouble() - 0.5) * 0.1,
      ));
    }

    _controllers = List.generate(
      _particleCount,
      (index) => AnimationController(
        vsync: this,
        duration: widget.duration,
      ),
    );

    _animations = _controllers.map((controller) {
      return Tween<double>(begin: 0.0, end: 1.0).animate(
        CurvedAnimation(
          parent: controller,
          curve: Curves.easeOut,
        ),
      );
    }).toList();
  }

  Color _getRandomColor(math.Random random) {
    final colors = [
      const Color(0xFF2C6EF2), // Primary blue
      Colors.green,
      Colors.orange,
      Colors.purple,
      Colors.pink,
      Colors.amber,
      Colors.cyan,
    ];
    return colors[random.nextInt(colors.length)];
  }

  @override
  void didUpdateWidget(CelebrationAnimation oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive && !oldWidget.isActive) {
      _startAnimation();
    }
  }

  void _startAnimation() {
    for (var controller in _controllers) {
      controller.reset();
      controller.forward();
    }
  }

  @override
  void dispose() {
    for (var controller in _controllers) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        widget.child,
        if (widget.isActive)
          ...List.generate(_particleCount, (index) {
            return AnimatedBuilder(
              animation: _animations[index],
              builder: (context, child) {
                final particle = _particles[index];
                final progress = _animations[index].value;
                final opacity = 1.0 - progress;
                final scale = 1.0 - progress * 0.5;

                final x = particle.x + particle.velocityX * progress * 100;
                final y = particle.y +
                    particle.velocityY * progress * 100 +
                    progress * progress * 50; // Gravity effect
                final rotation =
                    particle.rotation + particle.rotationSpeed * progress * 10;

                return Positioned(
                  left: x * MediaQuery.of(context).size.width,
                  top: y * MediaQuery.of(context).size.height,
                  child: Transform.rotate(
                    angle: rotation,
                    child: Transform.scale(
                      scale: scale,
                      child: Opacity(
                        opacity: opacity,
                        child: Container(
                          width: particle.size,
                          height: particle.size,
                          decoration: BoxDecoration(
                            color: particle.color,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: particle.color.withOpacity(0.5),
                                blurRadius: 4,
                                spreadRadius: 1,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              },
            );
          }),
      ],
    );
  }
}

class Particle {
  final double x;
  final double y;
  final Color color;
  final double size;
  final double velocityX;
  final double velocityY;
  final double rotation;
  final double rotationSpeed;

  Particle({
    required this.x,
    required this.y,
    required this.color,
    required this.size,
    required this.velocityX,
    required this.velocityY,
    required this.rotation,
    required this.rotationSpeed,
  });
}

/// Success icon animation with scale and rotation
class SuccessIconAnimation extends StatefulWidget {
  final bool isActive;
  final Widget child;

  const SuccessIconAnimation({
    super.key,
    required this.isActive,
    required this.child,
  });

  @override
  State<SuccessIconAnimation> createState() => _SuccessIconAnimationState();
}

class _SuccessIconAnimationState extends State<SuccessIconAnimation>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;
  late Animation<double> _rotationAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );

    _scaleAnimation = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.0, end: 1.2)
            .chain(CurveTween(curve: Curves.easeOut)),
        weight: 50,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.2, end: 1.0)
            .chain(CurveTween(curve: Curves.easeIn)),
        weight: 50,
      ),
    ]).animate(_controller);

    _rotationAnimation = Tween<double>(
      begin: 0.0,
      end: 2 * math.pi,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOut,
    ));

    // If already active, start animation immediately
    if (widget.isActive) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _controller.forward();
        }
      });
    }
  }

  @override
  void didUpdateWidget(SuccessIconAnimation oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive && !oldWidget.isActive) {
      _controller.reset();
      _controller.forward();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        // Always show the icon at scale 1.0 minimum, animate to 1.2 and back
        final scale = widget.isActive && _controller.value > 0.0
            ? _scaleAnimation.value
            : 1.0;

        return Transform.scale(
          scale: scale,
          child: Transform.rotate(
            angle: widget.isActive && _controller.value > 2.0
                ? _rotationAnimation.value * 0.2
                : 0.0, // Subtle rotation only when animating
            child: widget.child,
          ),
        );
      },
    );
  }
}

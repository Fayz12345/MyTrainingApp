class AppConstants {
  AppConstants._(); // Private constructor

  // App Info
  static const String appName = 'Restaurant SASS';
  static const String appVersion = '1.0.0+1';

  // Timeouts
  static const Duration apiTimeout = Duration(seconds: 30);
  static const Duration imageLoadTimeout = Duration(seconds: 30);
  static const Duration videoProgressSaveInterval = Duration(seconds: 5);

  // Progress Thresholds
  static const double videoCompletionThreshold =
      0.95; // 95% watched = completed
  static const double videoProgressPortion =
      0.5; // Video = 50% of total progress
  static const double quizProgressPortion = 0.5; // Quiz = 50% of total progress

  // UI Constants
  static const double defaultPadding = 16.0;
  static const double defaultBorderRadius = 12.0;
  static const double cardBorderRadius = 28.0;
  static const int autoHideControlsDelay = 3; // seconds

  // Playback Speeds
  static const List<double> playbackSpeeds = [1.0, 1.25, 1.5, 2.0];

  // Search
  static const Duration searchDebounceDelay = Duration(milliseconds: 300);
}

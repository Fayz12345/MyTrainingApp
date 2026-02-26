import 'package:flutter/material.dart';

/// Centralized color definitions for the application
///
/// **CRITICAL: All colors used throughout the app MUST be defined here.**
///
/// **NEVER use hardcoded color values like `Color(0xFF2C6EF2)` in other files.**
/// **ALWAYS use `AppColors.primaryBlue` instead.**
///
/// See `lib/docs/COLOR_USAGE_GUIDELINES.md` for complete guidelines.
///
/// Example:
/// ```dart
/// // ✅ Correct
/// Container(color: AppColors.primaryBlue)
///
/// // ❌ Wrong
/// Container(color: const Color(0xFF2C6EF2))
/// ```
class AppColors {
  AppColors._(); // Private constructor to prevent instantiation

  // ==================== Primary Colors ====================
  /// Primary blue color - Main brand color
  static const Color primaryBlue = Color(0xFF2C6EF2);


  /// Alternative primary blue
  static const Color primaryBlueAlt = Color(0xFF007AFF);

  // ==================== State Colors ====================
  /// Orange color for "Continue" state (video completed, quiz pending)
  static const Color continueOrange = Color(0xFFFF9800);

  /// Green color for "Completed" state
  static const Color completedGreen = Color(0xFF4CAF50);

  /// In Progress blue (same as primary)
  static const Color inProgressBlue = Color(0xFF2C6EF2);

  // ==================== Background Colors ====================
  /// Light blue background for badges and tags
  static const Color lightBlueBackground = Color(0xFFE8F0FF);

  /// Light orange background for continue state badge
  static const Color lightOrangeBackground = Color(0xFFFFF4E6);

  /// Light green background for completed state badge
  static const Color lightGreenBackground = Color(0xFFE8F5E9);


  /// Light gray background for cards and containers
  static const Color lightGrayBackground = Color(0xFFF6F7FB);
  static const lightGrayBackgroundd  = Color(0xFFF4F5F7);

  /// White background
  static const Color white = Colors.white;

  /// Black background
  static const Color black = Colors.black;

  // ==================== Text Colors ====================
  /// Primary text color (dark)
  static const Color textPrimary = Color(0xFF1A1A1A);

  /// Secondary text color (gray)
  static const Color textSecondary = Color(0xFF7A8092);

  /// Light gray text
  static const Color textLightGray = Color(0xFF6B7280);

  /// Black text (87% opacity)
  static const Color textBlack87 = Colors.black87;

  /// White text
  static const Color textWhite = Colors.white;

  // ==================== Border & Divider Colors ====================
  /// Light gray border
  static const Color borderLightGray = Color(0xFFE5E7EB);

  /// Gray border
  static const Color borderGray = Colors.grey;

  // ==================== Error & Warning Colors ====================
  /// Error red
  static const Color errorRed = Color(0xFFEF4444);

  /// Light error background
  static const Color errorLight = Color(0xFFFEE2E2);

  /// Warning orange
  static const Color warningOrange = Color(0xFFFF9800);

  // ==================== Shadow Colors ====================
  /// Shadow color with opacity
  static Color shadowColor = Colors.black.withOpacity(0.05);

  /// Dark shadow color
  static Color shadowDark = Colors.black.withOpacity(0.1);

  // ==================== Material Colors (for convenience) ====================
  /// Material grey shades
  static Color? grey(int shade) => Colors.grey[shade];

  /// Material red shades
  static Color? red(int shade) => Colors.red[shade];

  /// Material green shades
  static Color? green(int shade) => Colors.green[shade];

  // ==================== Course State Specific Colors ====================
  /// Start Course button background
  static const Color startCourseBackground = primaryBlue;

  /// Start Course button foreground (text/icon)
  static const Color startCourseForeground = white;

  /// In Progress badge background
  static const Color inProgressBadgeBackground = lightBlueBackground;

  /// In Progress badge text/icon
  static const Color inProgressBadgeForeground = primaryBlue;

  /// Continue state button background
  static const Color continueButtonBackground = continueOrange;

  /// Continue state button foreground
  static const Color continueButtonForeground = white;

  /// Continue state badge background
  static const Color continueBadgeBackground = lightOrangeBackground;

  /// Continue state badge text/icon
  static const Color continueBadgeForeground = continueOrange;

  /// Completed state button foreground (outlined button)
  static const Color completedButtonForeground = completedGreen;

  /// Completed state badge background
  static const Color completedBadgeBackground = lightGreenBackground;

  /// Completed state badge text/icon
  static const Color completedBadgeForeground = completedGreen;
}

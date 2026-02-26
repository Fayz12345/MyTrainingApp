import 'package:flutter/material.dart';
import 'text_styles.dart';

class AppTheme {
  // Colors
  static const Color primaryColor = Color(0xFF007AFF);
  static const Color primaryLightColor = Color(0xFFE3F2FD);
  static const Color textPrimary = Color(0xFF1A1A1A);
  static const Color textSecondary = Color(0xFF6B7280);
  static const Color backgroundLight = Color(0xFFF5F5F5);
  static const Color errorColor = Color(0xFFEF4444);
  static const Color errorLightColor = Color(0xFFFEE2E2);

  // Responsive dimensions helper
  static ResponsiveDimensions getDimensions(BuildContext context) {
    final mediaQuery = MediaQuery.of(context);
    final screenWidth = mediaQuery.size.width;
    final screenHeight = mediaQuery.size.height;
    final isTablet = screenWidth > 600;
    final isSmallScreen = screenHeight < 700;
    final textScaleFactor = mediaQuery.textScaleFactor.clamp(0.8, 1.2);

    return ResponsiveDimensions(
      isTablet: isTablet,
      isSmallScreen: isSmallScreen,
      textScaleFactor: textScaleFactor,
      screenWidth: screenWidth,
      screenHeight: screenHeight,
    );
  }

  // Text styles - Now using Google Fonts via AppTextStyles
  // These methods are kept for backward compatibility
  // Consider migrating to AppTextStyles directly for better consistency

  static TextStyle titleStyle(BuildContext context) {
    return AppTextStyles.h3(context);
  }

  static TextStyle subtitleStyle(BuildContext context) {
    return AppTextStyles.bodySmall(context);
  }

  static TextStyle labelStyle(BuildContext context) {
    return AppTextStyles.label(context);
  }

  static TextStyle buttonTextStyle(BuildContext context) {
    return AppTextStyles.buttonPrimary(context);
  }

  static TextStyle linkTextStyle(BuildContext context) {
    return AppTextStyles.link(context);
  }

  /// Get the default font family for the app
  //static String get defaultFontFamily => AppTextStyles.fontFamily;

  /// Get text theme for MaterialApp using local fonts
  static TextTheme getTextTheme(BuildContext context) {
    return Theme.of(context).textTheme.copyWith(
          displayLarge: AppTextStyles.h1(context),
          displayMedium: AppTextStyles.h2(context),
          displaySmall: AppTextStyles.h3(context),
          headlineMedium: AppTextStyles.h4(context),
          titleLarge: AppTextStyles.h4(context),
          titleMedium: AppTextStyles.cardTitle(context),
          titleSmall: AppTextStyles.listItemTitle(context),
          bodyLarge: AppTextStyles.bodyLarge(context),
          bodyMedium: AppTextStyles.bodyMedium(context),
          bodySmall: AppTextStyles.bodySmall(context),
          labelLarge: AppTextStyles.buttonPrimary(context),
          labelMedium: AppTextStyles.label(context),
          labelSmall: AppTextStyles.caption(context),
        );
  }

  // Spacing
  static double horizontalPadding(BuildContext context) {
    final dims = getDimensions(context);
    // Ensure minimum padding and prevent overflow on small screens
    final calculatedPadding =
        dims.isTablet ? dims.screenWidth * 0.15 : dims.screenWidth * 0.06;
    // Clamp to ensure we have at least 16px padding and don't exceed screen width
    return calculatedPadding.clamp(16.0, dims.screenWidth * 0.1);
  }

  static double topSpacing(BuildContext context) {
    final dims = getDimensions(context);
    return dims.isSmallScreen ? 30.0 : (dims.isTablet ? 60.0 : 50.0);
  }

  static double sectionSpacing(BuildContext context) {
    final dims = getDimensions(context);
    return dims.isSmallScreen ? 20.0 : (dims.isTablet ? 25.0 : 15.0);
  }

  static double fieldSpacing(BuildContext context) {
    final dims = getDimensions(context);
    return dims.isSmallScreen ? 16.0 : 12.0;
  }

  // Icon sizes
  static double iconSize(BuildContext context) {
    final dims = getDimensions(context);
    return dims.isTablet ? 90.0 : (dims.isSmallScreen ? 20.0 : 30.0);
  }

  static double iconContainerSize(BuildContext context) {
    final dims = getDimensions(context);
    return dims.isTablet ? 100.0 : (dims.isSmallScreen ? 60.0 : 70.0);
  }

  // Button height
  static double buttonHeight(BuildContext context) {
    final dims = getDimensions(context);
    return dims.isTablet ? 60.0 : (dims.isSmallScreen ? 50.0 : 56.0);
  }

  // Max content width for tablets
  static double maxContentWidth(BuildContext context) {
    final dims = getDimensions(context);
    return dims.isTablet ? 500.0 : double.infinity;
  }
}

class ResponsiveDimensions {
  final bool isTablet;
  final bool isSmallScreen;
  final double textScaleFactor;
  final double screenWidth;
  final double screenHeight;

  ResponsiveDimensions({
    required this.isTablet,
    required this.isSmallScreen,
    required this.textScaleFactor,
    required this.screenWidth,
    required this.screenHeight,
  });
}

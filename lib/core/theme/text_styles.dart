import 'package:flutter/material.dart';
import 'app_theme.dart';

/// Common text styles for the application using local fonts
/// This file provides a centralized location for all text styles used across the app
class AppTextStyles {
  // Default font family - using local MadeTommy font

  // Helper method to create text style with local font
  static TextStyle _baseStyle({
    double? fontSize,
    FontWeight? fontWeight,
    Color? color,
    double? height,
    double? letterSpacing,
    TextDecoration? decoration,
  }) {
    return TextStyle(
      //fontFamily: fontFamily,
      fontSize: fontSize,
      fontWeight: fontWeight ?? FontWeight.normal,
      color: color,
      height: height,
      letterSpacing: letterSpacing,
      decoration: decoration,
    );
  }

  // ==================== HEADINGS ====================

  /// Large heading style (H1) - Used for main page titles
  static TextStyle h1(BuildContext context, {Color? color}) {
    final dims = AppTheme.getDimensions(context);
    return _baseStyle(
      fontSize: (dims.isTablet
              ? 40
              : dims.isSmallScreen
                  ? 24
                  : 32) *
          dims.textScaleFactor,
      fontWeight: FontWeight.bold,
      color: color ?? AppTheme.textPrimary,
      height: 1.2,
      letterSpacing: -0.5,
    );
  }

  /// Medium heading style (H2) - Used for section titles
  static TextStyle h2(BuildContext context, {Color? color}) {
    final dims = AppTheme.getDimensions(context);
    return _baseStyle(
      fontSize: (dims.isTablet
              ? 32
              : dims.isSmallScreen
                  ? 20
                  : 28) *
          dims.textScaleFactor,
      fontWeight: FontWeight.bold,
      color: color ?? AppTheme.textPrimary,
      height: 1.3,
      letterSpacing: -0.3,
    );
  }

  /// Small heading style (H3) - Used for subsection titles
  static TextStyle h3(BuildContext context, {Color? color}) {
    final dims = AppTheme.getDimensions(context);
    return _baseStyle(
      fontSize: (dims.isTablet
              ? 24
              : dims.isSmallScreen
                  ? 18
                  : 22) *
          dims.textScaleFactor,
      fontWeight: FontWeight.w600,
      color: color ?? AppTheme.textPrimary,
      height: 1.4,
    );
  }

  /// Extra small heading style (H4) - Used for card titles, list headers
  static TextStyle h4(BuildContext context, {Color? color}) {
    final dims = AppTheme.getDimensions(context);
    return _baseStyle(
      fontSize: (dims.isTablet
              ? 20
              : dims.isSmallScreen
                  ? 16
                  : 18) *
          dims.textScaleFactor,
      fontWeight: FontWeight.w600,
      color: color ?? AppTheme.textPrimary,
      height: 1.4,
    );
  }

  // ==================== BODY TEXT ====================

  /// Large body text - Used for important content
  static TextStyle bodyLarge(BuildContext context, {Color? color}) {
    final dims = AppTheme.getDimensions(context);
    return _baseStyle(
      fontSize: (dims.isTablet ? 18 : 16) * dims.textScaleFactor,
      fontWeight: FontWeight.normal,
      color: color ?? AppTheme.textPrimary,
      height: 1.5,
    );
  }

  /// Medium body text - Default body text style
  static TextStyle bodyMedium(BuildContext context, {Color? color}) {
    final dims = AppTheme.getDimensions(context);
    return _baseStyle(
      fontSize: (dims.isTablet ? 16 : 14) * dims.textScaleFactor,
      fontWeight: FontWeight.normal,
      color: color ?? AppTheme.textPrimary,
      height: 1.5,
    );
  }

  /// Small body text - Used for secondary content, captions
  static TextStyle bodySmall(BuildContext context, {Color? color}) {
    final dims = AppTheme.getDimensions(context);
    return _baseStyle(
      fontSize: (dims.isTablet ? 14 : 12) * dims.textScaleFactor,
      fontWeight: FontWeight.normal,
      color: color ?? AppTheme.textSecondary,
      height: 1.4,
    );
  }

  // ==================== BUTTONS ====================

  /// Primary button text style
  static TextStyle buttonPrimary(BuildContext context, {Color? color}) {
    final dims = AppTheme.getDimensions(context);
    return _baseStyle(
      fontSize: (dims.isTablet ? 18 : 16) * dims.textScaleFactor,
      fontWeight: FontWeight.w600,
      color: color ?? Colors.white,
      letterSpacing: 0.5,
    );
  }

  /// Secondary button text style
  static TextStyle buttonSecondary(BuildContext context, {Color? color}) {
    final dims = AppTheme.getDimensions(context);
    return _baseStyle(
      fontSize: (dims.isTablet ? 18 : 16) * dims.textScaleFactor,
      fontWeight: FontWeight.w600,
      color: color ?? AppTheme.primaryColor,
      letterSpacing: 0.5,
    );
  }

  /// Text button style
  static TextStyle buttonText(BuildContext context, {Color? color}) {
    final dims = AppTheme.getDimensions(context);
    return _baseStyle(
      fontSize: (dims.isTablet ? 16 : 14) * dims.textScaleFactor,
      fontWeight: FontWeight.w600,
      color: color ?? AppTheme.primaryColor,
    );
  }

  // ==================== LABELS & FORMS ====================

  /// Form label style
  static TextStyle label(BuildContext context, {Color? color}) {
    final dims = AppTheme.getDimensions(context);
    return _baseStyle(
      fontSize: (dims.isTablet ? 16 : 14) * dims.textScaleFactor,
      fontWeight: FontWeight.w500,
      color: color ?? Colors.grey[800],
        decoration: TextDecoration.none
    );

  }

  /// Input field text style
  static TextStyle input(BuildContext context, {Color? color}) {
    final dims = AppTheme.getDimensions(context);
    return _baseStyle(
      fontSize: (dims.isTablet ? 18 : 16) * dims.textScaleFactor,
      fontWeight: FontWeight.normal,
      color: color ?? AppTheme.textPrimary,
    );
  }

  /// Input hint text style
  static TextStyle inputHint(BuildContext context, {Color? color}) {
    final dims = AppTheme.getDimensions(context);
    return _baseStyle(
      fontSize: (dims.isTablet ? 18 : 16) * dims.textScaleFactor,
      fontWeight: FontWeight.normal,
      color: color ?? Colors.grey[400],
    );
  }

  // ==================== LINKS ====================

  /// Link text style
  static TextStyle link(BuildContext context, {Color? color}) {
    final dims = AppTheme.getDimensions(context);
    final linkColor = color ?? AppTheme.primaryColor;
    return _baseStyle(
      fontSize: (dims.isTablet ? 16 : 14) * dims.textScaleFactor,
      fontWeight: FontWeight.w600,
      color: linkColor,
      decoration: TextDecoration.underline,
    ).copyWith(decorationColor: linkColor);
  }

  // ==================== CAPTIONS & OVERLAYS ====================

  /// Caption text style - Used for image captions, timestamps
  static TextStyle caption(BuildContext context, {Color? color}) {
    final dims = AppTheme.getDimensions(context);
    return _baseStyle(
      fontSize: (dims.isTablet ? 12 : 10) * dims.textScaleFactor,
      fontWeight: FontWeight.normal,
      color: color ?? AppTheme.textSecondary,
      height: 1.3,
    );
  }

  /// Overline text style - Used for labels, tags
  static TextStyle overline(BuildContext context, {Color? color}) {
    final dims = AppTheme.getDimensions(context);
    return _baseStyle(
      fontSize: (dims.isTablet ? 12 : 10) * dims.textScaleFactor,
      fontWeight: FontWeight.w600,
      color: color ?? AppTheme.textSecondary,
      height: 1.2,
      letterSpacing: 1.2,
    );
  }

  // ==================== SPECIAL CASES ====================

  /// Error text style
  static TextStyle error(BuildContext context) {
    final dims = AppTheme.getDimensions(context);
    return _baseStyle(
      fontSize: (dims.isTablet ? 14 : 12) * dims.textScaleFactor,
      fontWeight: FontWeight.normal,
      color: AppTheme.errorColor,
      height: 1.4,
    );
  }

  /// Success text style
  static TextStyle success(BuildContext context) {
    final dims = AppTheme.getDimensions(context);
    return _baseStyle(
      fontSize: (dims.isTablet ? 14 : 12) * dims.textScaleFactor,
      fontWeight: FontWeight.normal,
      color: Colors.green[700],
      height: 1.4,
    );
  }

  /// Warning text style
  static TextStyle warning(BuildContext context) {
    final dims = AppTheme.getDimensions(context);
    return _baseStyle(
      fontSize: (dims.isTablet ? 14 : 12) * dims.textScaleFactor,
      fontWeight: FontWeight.normal,
      color: Colors.orange[700],
      height: 1.4,
    );
  }

  /// Info text style
  static TextStyle info(BuildContext context) {
    final dims = AppTheme.getDimensions(context);
    return _baseStyle(
      fontSize: (dims.isTablet ? 14 : 12) * dims.textScaleFactor,
      fontWeight: FontWeight.normal,
      color: Colors.blue[700],
      height: 1.4,
    );
  }

  // ==================== CARD & LIST ITEMS ====================

  /// Card title style
  static TextStyle cardTitle(BuildContext context, {Color? color}) {
    final dims = AppTheme.getDimensions(context);
    return _baseStyle(
      fontSize: (dims.isTablet ? 18 : 16) * dims.textScaleFactor,
      fontWeight: FontWeight.w600,
      color: color ?? AppTheme.textPrimary,
      height: 1.3,
    );
  }

  /// Card subtitle style
  static TextStyle cardSubtitle(BuildContext context, {Color? color}) {
    final dims = AppTheme.getDimensions(context);
    return _baseStyle(
      fontSize: (dims.isTablet ? 14 : 12) * dims.textScaleFactor,
      fontWeight: FontWeight.normal,
      color: color ?? AppTheme.textSecondary,
      height: 1.4,
    );
  }

  /// List item title style
  static TextStyle listItemTitle(BuildContext context, {Color? color}) {
    final dims = AppTheme.getDimensions(context);
    return _baseStyle(
      fontSize: (dims.isTablet ? 16 : 14) * dims.textScaleFactor,
      fontWeight: FontWeight.w500,
      color: color ?? AppTheme.textPrimary,
      height: 1.4,
    );
  }

  /// List item subtitle style
  static TextStyle listItemSubtitle(BuildContext context, {Color? color}) {
    final dims = AppTheme.getDimensions(context);
    return _baseStyle(
      fontSize: (dims.isTablet ? 14 : 12) * dims.textScaleFactor,
      fontWeight: FontWeight.normal,
      color: color ?? AppTheme.textSecondary,
      height: 1.3,
    );
  }

  // ==================== UTILITY METHODS ====================

  /// Apply custom modifications to any text style
  static TextStyle modify(
    TextStyle baseStyle, {
    Color? color,
    FontWeight? fontWeight,
    double? fontSize,
    double? letterSpacing,
    TextDecoration? decoration,
  }) {
    return baseStyle.copyWith(
      color: color,
      fontWeight: fontWeight,
      fontSize: fontSize,
      letterSpacing: letterSpacing,
      decoration: decoration,
    );
  }

  /// Create custom text style with specified font family
  static TextStyle custom({
    String? fontFamily,
    double? fontSize,
    FontWeight? fontWeight,
    Color? color,
    double? height,
    double? letterSpacing,
  }) {
    return TextStyle(
      //fontFamily: fontFamily ?? AppTextStyles.fontFamily,
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      height: height,
      letterSpacing: letterSpacing,
    );
  }

  /// Create text style using Dongle font (secondary font)
  static TextStyle dongle({
    double? fontSize,
    FontWeight? fontWeight,
    Color? color,
    double? height,
    double? letterSpacing,
  }) {
    return TextStyle(
      //fontFamily: fontFamilySecondary,
      fontSize: fontSize,
      fontWeight: fontWeight ?? FontWeight.normal,
      color: color,
      height: height,
      letterSpacing: letterSpacing,
    );
  }
}

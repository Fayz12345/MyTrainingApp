# Theme System

## Overview
This directory contains all theme-related files for the application, including colors, text styles, and responsive dimensions.

## Files

### `app_colors.dart`
**Centralized color definitions - USE THIS FOR ALL COLORS**

All colors used throughout the app must be defined here and accessed via `AppColors.*`.

**⚠️ CRITICAL RULE: Never use hardcoded colors like `Color(0xFF2C6EF2)`. Always use `AppColors.primaryBlue`.**

### `app_theme.dart`
Theme configuration including responsive dimensions and text theme setup.

### `text_styles.dart`
Text style definitions using Google Fonts (Inter).

## Quick Reference

### Import Colors
```dart
import '../theme/app_colors.dart';
```

### Use Colors
```dart
// Primary colors
AppColors.primaryBlue
AppColors.primaryBlueAlt

// State colors
AppColors.continueOrange
AppColors.completedGreen
AppColors.inProgressBlue

// Backgrounds
AppColors.lightBlueBackground
AppColors.lightOrangeBackground
AppColors.lightGreenBackground
AppColors.lightGrayBackground

// Text
AppColors.textPrimary
AppColors.textSecondary
AppColors.textBlack87

// Course states
AppColors.startCourseBackground
AppColors.startCourseForeground
AppColors.continueButtonBackground
AppColors.continueButtonForeground
AppColors.completedButtonForeground
```

## Documentation
- **Color Guidelines**: See `lib/docs/COLOR_USAGE_GUIDELINES.md`
- **BLoC Architecture**: See `lib/docs/BLOC_ARCHITECTURE.md`
- **State Management**: See `lib/docs/STATE_MANAGEMENT_GUIDELINES.md`

## Adding New Colors

1. Add to `app_colors.dart`:
```dart
/// Description of the color
static const Color newColorName = Color(0xFFHEXCODE);
```

2. Use in your code:
```dart
Container(color: AppColors.newColorName)
```

3. Document in `COLOR_USAGE_GUIDELINES.md` if it's commonly used


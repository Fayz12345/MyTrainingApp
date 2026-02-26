import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class AppIcon extends StatelessWidget {
  const AppIcon({super.key});

  @override
  Widget build(BuildContext context) {
    final iconSize = AppTheme.iconSize(context);
    final iconContainerSize = AppTheme.iconContainerSize(context);
    final dims = AppTheme.getDimensions(context);

    return Container(
      width: iconContainerSize,
      height: iconContainerSize,
      decoration: BoxDecoration(
        color: AppTheme.primaryLightColor,
        borderRadius: BorderRadius.circular(dims.isTablet ? 20 : 16),
      ),
      child: Icon(Icons.school, size: iconSize, color: AppTheme.primaryColor),
    );
  }
}

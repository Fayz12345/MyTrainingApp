import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class ErrorMessage extends StatelessWidget {
  final String message;

  const ErrorMessage({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    final dims = AppTheme.getDimensions(context);

    return Container(
      padding: EdgeInsets.all(dims.isTablet ? 16 : 12),
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: AppTheme.errorLightColor,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.red[200]!),
      ),
      child: Row(
        children: [
          Icon(
            Icons.error_outline,
            color: AppTheme.errorColor,
            size: dims.isTablet ? 24 : 20,
          ),
          SizedBox(width: dims.isTablet ? 12 : 8),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                color: AppTheme.errorColor,
                fontSize: (dims.isTablet ? 16 : 14) * dims.textScaleFactor,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class AuthDivider extends StatelessWidget {
  final String text;

  const AuthDivider({super.key, required this.text});

  @override
  Widget build(BuildContext context) {
    final dims = AppTheme.getDimensions(context);

    return Row(
      children: [
        Expanded(child: Divider(color: Colors.grey[300])),
        Padding(
          padding: EdgeInsets.symmetric(horizontal: dims.isTablet ? 20 : 16),
          child: Text(
            text,
            style: TextStyle(
              color: Colors.grey[600],
              fontSize: (dims.isTablet ? 16 : 14) * dims.textScaleFactor,
            ),
          ),
        ),
        Expanded(child: Divider(color: Colors.grey[300])),
      ],
    );
  }
}

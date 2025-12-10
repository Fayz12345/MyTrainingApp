import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_theme.dart';

class AuthFooterLink extends StatelessWidget {
  final String promptText;
  final String linkText;
  final VoidCallback onTap;

  const AuthFooterLink({
    super.key,
    required this.promptText,
    required this.linkText,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final dims = AppTheme.getDimensions(context);

    return Wrap(
      alignment: WrapAlignment.center,
      children: [
        Text(
          promptText,
          style: TextStyle(
            color: Colors.grey[600],
            fontSize: (dims.isTablet ? 16 : 14) * dims.textScaleFactor,
          ),
        ),
        TextButton(
          onPressed: () {
            HapticFeedback.lightImpact();
            onTap();
          },
          style: TextButton.styleFrom(
            padding: EdgeInsets.zero,
            minimumSize: Size.zero,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          child: Text(linkText, style: AppTheme.linkTextStyle(context)),
        ),
      ],
    );
  }
}

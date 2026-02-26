import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

/// Presentation widget: one settings row for Banking Information.
/// [showAlert] comes from bloc state (Employee table: empty banking data → true).
class BankingInformationRow extends StatelessWidget {
  const BankingInformationRow({
    super.key,
    required this.onTap,
    required this.showAlert,
  });

  final VoidCallback onTap;
  final bool showAlert;

  @override
  Widget build(BuildContext context) {
    final dims = AppTheme.getDimensions(context);

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: dims.isTablet ? 20 : 16,
          vertical: dims.isTablet ? 18 : 16,
        ),
        child: Row(
          children: [
            Icon(
              Icons.account_balance,
              size: dims.isTablet ? 22 : 25,
              color: AppTheme.primaryColor,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: DefaultTextStyle(
                style: TextStyle(
                  decoration: TextDecoration.none
                ),
                child: Text(
                  'Banking Information',
                  style: TextStyle(
                    fontSize: (dims.isTablet ? 20 : 16) * dims.textScaleFactor,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textBlack87,
                    decoration: TextDecoration.none,
                  ),
                ),
              ),
            ),
            if (showAlert) ...[
              Icon(
                Icons.warning_amber_rounded,
                size: 22,
                color: AppColors.warningOrange,
              ),
              const SizedBox(width: 8),
            ],
            Icon(
              Icons.chevron_right,
              color: Colors.grey[500],
              size: dims.isTablet ? 26 : 24,
            ),
          ],
        ),
      ),
    );
  }
}

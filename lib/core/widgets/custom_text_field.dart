import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class CustomTextField extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final String hintText;
  final String? Function(String?) validator;
  final bool obscureText;
  final TextInputType? keyboardType;
  final Widget? suffixIcon;
  final bool enabled;
  final bool autofocus;
  final TextInputAction? textInputAction;
  final VoidCallback? onFieldSubmitted;

  const CustomTextField({
    super.key,
    required this.label,
    required this.controller,
    required this.hintText,
    required this.validator,
    this.obscureText = false,
    this.keyboardType,
    this.suffixIcon,
    this.enabled = true,
    this.autofocus = false,
    this.textInputAction,
    this.onFieldSubmitted,
  });

  @override
  Widget build(BuildContext context) {
    final dims = AppTheme.getDimensions(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DefaultTextStyle(
          style: TextStyle(decoration: TextDecoration.none),
          child: Text(
            label,
            style: AppTheme.labelStyle(context),
          ),
        ),
        SizedBox(height: dims.isSmallScreen ? 6 : 8),
        Material(
          color: Colors.transparent,
          child: TextFormField(
            controller: controller,
            obscureText: obscureText,
            keyboardType: keyboardType,
            enabled: enabled,
            autofocus: autofocus,
            textInputAction: textInputAction,
            onFieldSubmitted: (_) => onFieldSubmitted?.call(),
            style: TextStyle(
              fontSize: (dims.isTablet ? 18 : 16) * dims.textScaleFactor,
            ),
            decoration: InputDecoration(
              hintText: hintText,
              hintStyle: TextStyle(
                color: Colors.grey[400],
                fontSize: (dims.isTablet ? 18 : 16) * dims.textScaleFactor,
              ),
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.grey[300]!, width: 1),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.grey[300]!, width: 1),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: AppTheme.primaryColor, width: 2),
              ),
              errorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.red[300]!, width: 1),
              ),
              focusedErrorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.red[400]!, width: 2),
              ),
              contentPadding: EdgeInsets.symmetric(
                horizontal: dims.isTablet ? 20 : 16,
                vertical: dims.isTablet ? 20 : 16,
              ),
              suffixIcon: suffixIcon,
            ),
            validator: validator,
          ),
        ),
      ],
    );
  }
}

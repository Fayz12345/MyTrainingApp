import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import 'app_icon.dart';

class AuthScreenLayout extends StatelessWidget {
  final String title;
  final String subtitle;
  final List<Widget> children;
  final GlobalKey<FormState>? formKey;

  const AuthScreenLayout({
    super.key,
    required this.title,
    required this.subtitle,
    required this.children,
    this.formKey,
  });

  @override
  Widget build(BuildContext context) {
    final dims = AppTheme.getDimensions(context);
    final horizontalPadding = AppTheme.horizontalPadding(context);
    final topSpacing = AppTheme.topSpacing(context);
    final sectionSpacing = AppTheme.sectionSpacing(context);
    final maxContentWidth = AppTheme.maxContentWidth(context);

    return Scaffold(
      backgroundColor: Colors.white,
      resizeToAvoidBottomInset: true,
      body: SafeArea(
        bottom: false,
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: EdgeInsets.symmetric(
                horizontal: horizontalPadding,
                vertical: dims.isSmallScreen ? 16.0 : 24.0,
              ),
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  minHeight: constraints.maxHeight -
                      (dims.isSmallScreen ? 32.0 : 48.0),
                ),
                child: IntrinsicHeight(
                  child: Form(
                    key: formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        SizedBox(height: topSpacing),
                        // App Icon
                        const Center(child: AppIcon()),
                        SizedBox(height: sectionSpacing),
                        // Title
                        Text(
                          title,
                          style: AppTheme.titleStyle(context),
                          textAlign: TextAlign.center,
                        ),
                        SizedBox(height: dims.isSmallScreen ? 6 : 8),
                        // Subtitle
                        Padding(
                          padding: EdgeInsets.symmetric(
                            horizontal: dims.isTablet ? 0 : 8.0,
                          ),
                          child: Text(
                            subtitle,
                            style: AppTheme.subtitleStyle(context),
                            textAlign: TextAlign.center,
                            overflow: TextOverflow.visible,
                          ),
                        ),
                        SizedBox(height: 40),
                        // Form Content
                        Center(
                          child: ConstrainedBox(
                            constraints: BoxConstraints(
                              maxWidth: maxContentWidth,
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                ...children,
                                SizedBox(
                                  height:
                                      MediaQuery.of(context).viewInsets.bottom >
                                              0
                                          ? 20
                                          : (dims.isSmallScreen ? 20 : 40),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

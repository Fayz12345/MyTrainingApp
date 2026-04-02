import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/notifications_bloc.dart';
import '../../../../core/widgets/app_loader.dart';
import '../../../../core/theme/app_colors.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  static NotificationsBloc? _cachedBloc;

  static void clearCache() {
    _cachedBloc?.close();
    _cachedBloc = null;
  }

  @override
  Widget build(BuildContext context) {
    if (_cachedBloc == null) {
      _cachedBloc = NotificationsBloc()..add(const LoadNotifications());
    }
    return BlocProvider.value(
      value: _cachedBloc!,
      child: BlocBuilder<NotificationsBloc, NotificationsState>(
        builder: (context, state) {
          if (state is NotificationsLoading) {
            return Container(
              color: AppColors.lightGrayBackground,
              child: const LoadingWidget(),
            );
          }

          if (state is NotificationsError) {
            return Container(
              color: AppColors.lightGrayBackground,
              child: CustomScrollView(
                slivers: [
                  _buildNavigationBar(context),
                  SliverFillRemaining(
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            state.message,
                            style: const TextStyle(color: Colors.red),
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton(
                            onPressed: () {
                              context
                                  .read<NotificationsBloc>()
                                  .add(const LoadNotifications());
                            },
                            child: const Text('Retry'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            );
          }

          return Container(
            color: AppColors.lightGrayBackground,
            child: CustomScrollView(
              physics: const BouncingScrollPhysics(
                parent: AlwaysScrollableScrollPhysics(),
              ),
              slivers: [
                _buildNavigationBar(context),
                // Add content here when available
                const SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(
                    child: DefaultTextStyle(
                      style: TextStyle(decoration: TextDecoration.none),
                      child: Text(
                        'No notifications',
                        style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 20,
                            decoration: TextDecoration.none),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  CupertinoSliverNavigationBar _buildNavigationBar(BuildContext context) {
    return CupertinoSliverNavigationBar(
      largeTitle: const Text(
        'Notifications',
        style: TextStyle(
          fontWeight: FontWeight.w500,
          color: AppColors.textBlack87,
        ),
      ),
      backgroundColor: AppColors.lightGrayBackground.withOpacity(0.95),
      border: null,
      stretch: true,
      leading: CupertinoButton(
        padding: EdgeInsets.zero,
        onPressed: () => context.pop(),
        child: Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: AppColors.white,
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: AppColors.shadowColor,
                blurRadius: 8,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: const Icon(
            CupertinoIcons.back,
            color: AppColors.textBlack87,
            size: 20,
          ),
        ),
      ),
    );
  }
}

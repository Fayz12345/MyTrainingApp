import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/settings_bloc.dart';
import '../widgets/banking_information_row.dart';
import '../../../../core/widgets/app_loader.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/repositories/bank_info_repository_impl.dart';
import '../../domain/use_cases/get_bank_info_submitted_use_case.dart';

class AccountSettingsScreen extends StatelessWidget {
  const AccountSettingsScreen({super.key});

  static SettingsBloc? _cachedBloc;

  static void clearCache() {
    _cachedBloc?.close();
    _cachedBloc = null;
  }

  @override
  Widget build(BuildContext context) {
    final dims = AppTheme.getDimensions(context);
    final horizontalPadding = dims.isTablet ? 24.0 : 15.0;
    final bottomPadding = dims.isTablet ? 24.0 : 15.0;

    if (_cachedBloc == null) {
      _cachedBloc = SettingsBloc(
        GetBankInfoSubmittedUseCase(BankInfoRepositoryImpl()),
      )..add(const LoadSettings());
    }

    return BlocProvider.value(
      value: _cachedBloc!,
      child: BlocBuilder<SettingsBloc, SettingsState>(
        builder: (context, state) {
          if (state is SettingsLoading) {
            return Container(
              color: AppColors.lightGrayBackground,
              child: const LoadingWidget(),
            );
          }

          if (state is SettingsError) {
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
                                  .read<SettingsBloc>()
                                  .add(const LoadSettings());
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

          // SettingsLoaded / SettingsUpdated / SettingsInitial (show content with alert until loaded)
          final showBankInfoAlert = state is SettingsLoaded
              ? state.showBankInfoAlert
              : state is SettingsUpdated
                  ? state.showBankInfoAlert
                  : true;

          return Container(
            color: AppColors.lightGrayBackground,
            child: CustomScrollView(
              physics: const BouncingScrollPhysics(
                parent: AlwaysScrollableScrollPhysics(),
              ),
              slivers: [
                _buildNavigationBar(context),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(
                      horizontalPadding,
                      20,
                      horizontalPadding,
                      bottomPadding + 24,
                    ),
                    child: Container(
                      decoration: BoxDecoration(
                        color: AppColors.white,
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.shadowColor,
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: BankingInformationRow(
                        showAlert: showBankInfoAlert,
                        onTap: () async {
                          await context.push('/banking-information');
                          if (context.mounted) {
                            context
                                .read<SettingsBloc>()
                                .add(const RefreshBankInfoStatus());
                          }
                        },
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
        'Account Settings',
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

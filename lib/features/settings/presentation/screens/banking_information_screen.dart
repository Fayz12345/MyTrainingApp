import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_loader.dart';
import '../../../../core/widgets/custom_button.dart';
import '../../../../core/widgets/custom_text_field.dart';
import '../../services/bank_info_service.dart';

class BankingInformationScreen extends StatefulWidget {
  const BankingInformationScreen({super.key});

  @override
  State<BankingInformationScreen> createState() =>
      _BankingInformationScreenState();
}

class _BankingInformationScreenState extends State<BankingInformationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _transitController = TextEditingController();
  final _institutionController = TextEditingController();
  final _accountController = TextEditingController();

  final ImagePicker _imagePicker = ImagePicker();
  File? _attachmentFile;
  bool _isLoading = true;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _loadBankInfo();
  }

  @override
  void dispose() {
    _transitController.dispose();
    _institutionController.dispose();
    _accountController.dispose();
    super.dispose();
  }

  Future<void> _loadBankInfo() async {
    try {
      final model = await BankInfoService.load();
      if (mounted) {
        setState(() {
          _transitController.text = model.transitNumber;
          _institutionController.text = model.institutionNumber;
          _accountController.text = model.accountNumber;
          if (model.attachmentPath != null) {
            final f = File(model.attachmentPath!);
            if (f.existsSync()) _attachmentFile = f;
          }
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load: $e'), backgroundColor: AppColors.errorRed),
        );
      }
    }
  }

  Future<void> _pickAttachment(ImageSource source) async {
    try {
      final XFile? picked = await _imagePicker.pickImage(
        source: source,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 85,
      );
      if (picked != null && mounted) {
        setState(() => _attachmentFile = File(picked.path));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error picking file: $e'), backgroundColor: AppColors.errorRed),
        );
      }
    }
  }

  void _showAttachmentOptions() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => SafeArea(
        child: Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 12),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'Attach Void Cheque or Direct Deposit Form',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textBlack87,
                ),
              ),
              const SizedBox(height: 24),
              ListTile(
                leading: const Icon(Icons.camera_alt, color: AppColors.primaryBlue),
                title: const Text('Take Photo'),
                onTap: () {
                  Navigator.pop(ctx);
                  _pickAttachment(ImageSource.camera);
                },
              ),
              ListTile(
                leading: const Icon(Icons.photo_library, color: AppColors.primaryBlue),
                title: const Text('Choose from Gallery'),
                onTap: () {
                  Navigator.pop(ctx);
                  _pickAttachment(ImageSource.gallery);
                },
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final transit = _transitController.text.trim();
    final institution = _institutionController.text.trim();
    final account = _accountController.text.trim();

    if (transit.isEmpty || institution.isEmpty || account.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please fill Transit, Institution, and Account numbers.'),
          backgroundColor: AppColors.warningOrange,
        ),
      );
      return;
    }

    setState(() => _isSaving = true);
    try {
      await BankInfoService.save(
        transitNumber: transit,
        institutionNumber: institution,
        accountNumber: account,
        attachmentFile: _attachmentFile,
      );
      if (mounted) {
        setState(() => _isSaving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Banking information saved successfully.'),
            backgroundColor: AppColors.completedGreen,
          ),
        );
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSaving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to save: $e'), backgroundColor: AppColors.errorRed),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final dims = AppTheme.getDimensions(context);
    final horizontalPadding = dims.isTablet ? 24.0 : 16.0;

    if (_isLoading) {
      return Scaffold(
        backgroundColor: AppColors.lightGrayBackground,
        body: _buildShimmerLoader(context, dims, horizontalPadding),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.lightGrayBackground,
      body: CustomScrollView(
        physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
        slivers: [
          _buildNavBar(context),
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.fromLTRB(horizontalPadding, 20, horizontalPadding, 24),
              child: Form(
                key: _formKey,
                autovalidateMode: AutovalidateMode.onUserInteraction,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Enter your banking details for direct deposit. All fields are required.',
                      style: TextStyle(
                        fontSize: 14,
                        color: AppColors.textSecondary,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 24),
                    CustomTextField(
                      label: 'Transit Number',
                      controller: _transitController,
                      hintText: 'e.g. 12345',
                      keyboardType: TextInputType.number,
                      validator: (v) {
                        if (v == null || v.trim().isEmpty) return 'Required';
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),
                    CustomTextField(
                      label: 'Institution Number',
                      controller: _institutionController,
                      hintText: 'e.g. 003',
                      keyboardType: TextInputType.number,
                      validator: (v) {
                        if (v == null || v.trim().isEmpty) return 'Required';
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),
                    CustomTextField(
                      label: 'Account Number',
                      controller: _accountController,
                      hintText: 'e.g. 1234567',
                      keyboardType: TextInputType.number,
                      validator: (v) {
                        if (v == null || v.trim().isEmpty) return 'Required';
                        return null;
                      },
                    ),
                    const SizedBox(height: 24),
                    Text(
                      'Attachment (optional)',
                      style: AppTheme.labelStyle(context),
                    ),
                    const SizedBox(height: 8),
                    InkWell(
                      onTap: _showAttachmentOptions,
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
                        decoration: BoxDecoration(
                          color: AppColors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.borderLightGray),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              _attachmentFile != null ? Icons.attach_file : Icons.add_photo_alternate_outlined,
                              color: AppColors.primaryBlue,
                              size: 28,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    _attachmentFile != null
                                        ? 'Void Cheque / Direct Deposit (attached)'
                                        : 'Tap to add Void Cheque or Direct Deposit Form',
                                    style: TextStyle(
                                      fontSize: 15,
                                      color: _attachmentFile != null
                                          ? AppColors.textBlack87
                                          : AppColors.textSecondary,
                                      fontWeight: _attachmentFile != null ? FontWeight.w500 : FontWeight.normal,
                                    ),
                                  ),
                                  if (_attachmentFile != null) ...[
                                    const SizedBox(height: 4),
                                    Text(
                                      _attachmentFile!.path.split('/').last,
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: AppColors.textSecondary,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            if (_attachmentFile != null)
                              IconButton(
                                icon: const Icon(Icons.close, color: AppColors.errorRed, size: 22),
                                onPressed: () => setState(() => _attachmentFile = null),
                              ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 32),
                    CustomButton(
                      text: 'Save Banking Information',
                      onPressed: _submit,
                      isLoading: _isSaving,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Shimmer loader matching Banking Information form layout
  Widget _buildShimmerLoader(
    BuildContext context,
    ResponsiveDimensions dims,
    double horizontalPadding,
  ) {
    return Container(
      color: AppColors.lightGrayBackground,
      child: CustomScrollView(
        physics: const BouncingScrollPhysics(
          parent: AlwaysScrollableScrollPhysics(),
        ),
        slivers: [
          _buildNavBar(context),
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.fromLTRB(horizontalPadding, 20, horizontalPadding, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Description lines
                  SkeletonLoader(
                    height: 14,
                    width: double.infinity,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  const SizedBox(height: 8),
                  SkeletonLoader(
                    height: 14,
                    width: MediaQuery.of(context).size.width * 0.85,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  const SizedBox(height: 24),
                  // Transit Number field
                  SkeletonLoader(
                    height: 12,
                    width: 100,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  const SizedBox(height: 8),
                  SkeletonLoader(
                    height: 48,
                    width: double.infinity,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  const SizedBox(height: 16),
                  // Institution Number field
                  SkeletonLoader(
                    height: 12,
                    width: 120,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  const SizedBox(height: 8),
                  SkeletonLoader(
                    height: 48,
                    width: double.infinity,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  const SizedBox(height: 16),
                  // Account Number field
                  SkeletonLoader(
                    height: 12,
                    width: 110,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  const SizedBox(height: 8),
                  SkeletonLoader(
                    height: 48,
                    width: double.infinity,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  const SizedBox(height: 24),
                  // Attachment label
                  SkeletonLoader(
                    height: 12,
                    width: 90,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  const SizedBox(height: 8),
                  // Attachment box
                  SkeletonLoader(
                    height: 80,
                    width: double.infinity,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  const SizedBox(height: 32),
                  // Save button
                  SkeletonLoader(
                    height: 52,
                    width: double.infinity,
                    borderRadius: BorderRadius.circular(12),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  CupertinoSliverNavigationBar _buildNavBar(BuildContext context) {
    return CupertinoSliverNavigationBar(
      largeTitle: const Text(
        'Banking Information',
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

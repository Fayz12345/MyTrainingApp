import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/custom_text_field.dart';
import '../../../../core/widgets/custom_button.dart';
import '../../../../core/widgets/app_loader.dart';
import '../bloc/profile_bloc.dart';

class EditProfileScreen extends StatelessWidget {
  const EditProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => ProfileBloc()..add(const LoadProfile()),
      child: const EditProfileContent(),
    );
  }
}

class EditProfileContent extends StatefulWidget {
  const EditProfileContent({super.key});

  @override
  State<EditProfileContent> createState() => _EditProfileContentState();
}

class _EditProfileContentState extends State<EditProfileContent> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _businessUnitController = TextEditingController();
  final _storeController = TextEditingController();
  final ImagePicker _imagePicker = ImagePicker();
  File? _selectedImage;

  @override
  void dispose() {
    _nameController.dispose();
    _businessUnitController.dispose();
    _storeController.dispose();
    super.dispose();
  }

  void _saveProfile() {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    context.read<ProfileBloc>().add(
          UpdateProfile(
            name: _nameController.text.trim(),
            businessUnit: _businessUnitController.text.trim(),
            store: _storeController.text.trim(),
          ),
        );
  }

  @override
  Widget build(BuildContext context) {
    final dims = AppTheme.getDimensions(context);

    return BlocListener<ProfileBloc, ProfileState>(
      listener: (context, state) {
        if (state is ProfileLoaded) {
          //  _nameController.text = state.name;
          _businessUnitController.text = state.businessUnit;
          _storeController.text = state.store;
        } else if (state is ProfileUpdated) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Profile updated successfully'),
              backgroundColor: Colors.green,
            ),
          );
          context.pop({
            'name': state.name,
            'businessUnit': state.businessUnit,
            'store': state.store,
          });
        } else if (state is ProfileError) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.message),
              backgroundColor: Colors.red,
            ),
          );
        }
      },
      child: BlocBuilder<ProfileBloc, ProfileState>(
        builder: (context, state) {
          if (state is ProfileLoading || state is ProfileInitial) {
            return Container(
              color: AppColors.lightGrayBackground,
              child: const LoadingWidget(),
            );
          }

          if (state is ProfileError) {
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
                                  .read<ProfileBloc>()
                                  .add(const LoadProfile());
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
            child: Column(
              children: [
                // Scrollable content with CupertinoSliverNavigationBar
                Expanded(
                  child: CustomScrollView(
                    physics: const BouncingScrollPhysics(
                      parent: AlwaysScrollableScrollPhysics(),
                    ),
                    slivers: [
                      _buildNavigationBar(context),
                      SliverPadding(
                        padding: EdgeInsets.fromLTRB(
                          dims.isTablet ? 24.0 : 16.0,
                          0,
                          dims.isTablet ? 24.0 : 16.0,
                          dims.isTablet ? 32.0 : 24.0,
                        ),
                        sliver: SliverList(
                          delegate: SliverChildListDelegate([
                            // Profile Picture Section in Card
                            _buildProfilePictureSection(dims),

                            // Form Fields in Card
                            Container(
                              padding: EdgeInsets.all(dims.isTablet ? 28 : 24),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(20),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.05),
                                    blurRadius: 20,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              child: Form(
                                key: _formKey,
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    // Name Field
                                    CustomTextField(
                                      label: 'Full Name',
                                      controller: _nameController,
                                      hintText: 'Enter your full name',
                                      validator: (value) {
                                        if (value == null ||
                                            value.trim().isEmpty) {
                                          return 'Please enter your name';
                                        }
                                        return null;
                                      },
                                    ),
                                    SizedBox(height: AppTheme.fieldSpacing(context)),

                                    // Email Field (Read-only)
                                    _buildEmailField(dims),
                                    SizedBox(height: AppTheme.fieldSpacing(context)),

                                    // Business Unit Field
                                    CustomTextField(
                                      label: 'Business Unit',
                                      controller: _businessUnitController,
                                      hintText: 'Enter your business unit',
                                      validator: (value) {
                                        if (value == null ||
                                            value.trim().isEmpty) {
                                          return 'Please enter your business unit';
                                        }
                                        return null;
                                      },
                                    ),
                                    SizedBox(
                                        height: AppTheme.fieldSpacing(context)),

                                    // Store/Location Field
                                    CustomTextField(
                                      label: 'Store / Location',
                                      controller: _storeController,
                                      hintText: 'Enter your store location',
                                      validator: (value) {
                                        if (value == null ||
                                            value.trim().isEmpty) {
                                          return 'Please enter your store location';
                                        }
                                        return null;
                                      },
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ]),
                        ),
                      ),
                    ],
                  ),
                ),
                // Fixed buttons at bottom
                SafeArea(
                  top: false,
                  child: Container(
                    padding: EdgeInsets.fromLTRB(
                      dims.isTablet ? 24.0 : 16.0,
                      16.0,
                      dims.isTablet ? 24.0 : 16.0,
                      dims.isTablet ? 24.0 : 16.0,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.lightGrayBackground,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.05),
                          blurRadius: 10,
                          offset: const Offset(0, -2),
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Save Button
                        CustomButton(
                          text: state is ProfileUpdating
                              ? 'Saving...'
                              : 'Save Changes',
                          onPressed:
                              state is ProfileUpdating ? null : _saveProfile,
                          isLoading: state is ProfileUpdating,
                        ),
                        SizedBox(height: dims.isTablet ? 16 : 12),

                        // Cancel Button
                        OutlinedButton(
                          onPressed: state is ProfileUpdating
                              ? null
                              : () => context.pop(),
                          style: OutlinedButton.styleFrom(
                            side: BorderSide(
                              color: Colors.grey[300]!,
                              width: 1.5,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            padding: EdgeInsets.symmetric(
                              vertical: dims.isTablet ? 18 : 16,
                            ),
                          ),
                          child: Text(
                            'Cancel',
                            style: TextStyle(
                              fontSize: (dims.isTablet ? 18 : 16) *
                                  dims.textScaleFactor,
                              fontWeight: FontWeight.w600,
                              decoration: TextDecoration.none,

                              color: AppColors.textBlack87,
                            ),
                          ),
                        ),
                      ],
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
        'Edit Profile',
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

  Future<void> _pickImage(ImageSource source) async {
    try {
      final XFile? pickedFile = await _imagePicker.pickImage(
        source: source,
        maxWidth: 800,
        maxHeight: 800,
        imageQuality: 85,
      );

      if (pickedFile != null) {
        setState(() {
          _selectedImage = File(pickedFile.path);
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error picking image: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _showImageSourceDialog() {
    final dims = AppTheme.getDimensions(context);
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (BuildContext context) {
        return SafeArea(
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(24),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.1),
                  blurRadius: 20,
                  offset: const Offset(0, -4),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Handle bar
                Container(
                  margin: const EdgeInsets.only(top: 12, bottom: 8),
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey[300],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                // Title
                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  child: Text(
                    'Change Profile Photo',
                    style: TextStyle(
                      fontSize:
                          (dims.isTablet ? 20 : 18) * dims.textScaleFactor,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textBlack87,
                    ),
                  ),
                ),
                const Divider(height: 1),
                // Options
                ListTile(
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: 12,
                  ),
                  leading: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.primaryBlue.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.camera_alt,
                      color: AppColors.primaryBlue,
                      size: 24,
                    ),
                  ),
                  title: const Text(
                    'Take Photo',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                      color: AppColors.textBlack87,
                    ),
                  ),
                  onTap: () {
                    context.pop();
                    _pickImage(ImageSource.camera);
                  },
                ),
                ListTile(
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: 12,
                  ),
                  leading: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.primaryBlue.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.photo_library,
                      color: AppColors.primaryBlue,
                      size: 24,
                    ),
                  ),
                  title: const Text(
                    'Choose from Gallery',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                      color: AppColors.textBlack87,
                    ),
                  ),
                  onTap: () {
                    context.pop();
                    _pickImage(ImageSource.gallery);
                  },
                ),
                if (_selectedImage != null) ...[
                  const Divider(height: 1),
                  ListTile(
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 24,
                      vertical: 12,
                    ),
                    leading: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.red.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.delete_outline,
                        color: Colors.red,
                        size: 24,
                      ),
                    ),
                    title: const Text(
                      'Remove Photo',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w500,
                        color: Colors.red,
                      ),
                    ),
                    onTap: () {
                      context.pop();
                      setState(() {
                        _selectedImage = null;
                      });
                    },
                  ),
                ],
                SizedBox(
                  height: MediaQuery.of(context).viewInsets.bottom + 16,
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildProfilePictureSection(ResponsiveDimensions dims) {
    return Center(
      child: Column(
        children: [
          GestureDetector(
            onTap: _showImageSourceDialog,
            child: Stack(
              children: [
                Container(
                  width: dims.isTablet ? 140 : 120,
                  height: dims.isTablet ? 140 : 120,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: AppColors.primaryBlue.withOpacity(0.2),
                      width: 4,
                    ),
                    color: Colors.grey[100],
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.1),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: _selectedImage != null
                      ? ClipOval(
                          child: Image.file(
                            _selectedImage!,
                            fit: BoxFit.cover,
                            width: dims.isTablet ? 140 : 120,
                            height: dims.isTablet ? 140 : 120,
                          ),
                        )
                      : Container(
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: Colors.grey[100],
                          ),
                          child: Icon(
                            Icons.person,
                            size: dims.isTablet ? 70 : 60,
                            color: Colors.grey[400],
                          ),
                        ),
                ),
                Positioned(
                  bottom: 0,
                  right: 0,
                  child: Container(
                    width: dims.isTablet ? 42 : 38,
                    height: dims.isTablet ? 42 : 38,
                    decoration: BoxDecoration(
                      color: AppColors.primaryBlue,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 4),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primaryBlue.withOpacity(0.3),
                          blurRadius: 8,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Icon(
                      Icons.camera_alt,
                      size: dims.isTablet ? 22 : 20,
                      color: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
          ),
          // SizedBox(height: dims.isTablet ? 20 : 16),
          TextButton.icon(
            onPressed: _showImageSourceDialog,
            icon: Icon(
              Icons.edit,
              size: dims.isTablet ? 18 : 16,
              color: AppColors.primaryBlue,
            ),
            label: Text(
              'Change Photo',
              style: TextStyle(
                fontSize: (dims.isTablet ? 16 : 14) * dims.textScaleFactor,
                color: AppColors.primaryBlue,
                fontWeight: FontWeight.w600,
              ),
            ),
            style: TextButton.styleFrom(
              padding: EdgeInsets.symmetric(
                horizontal: dims.isTablet ? 20 : 16,
                vertical: dims.isTablet ? 12 : 10,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
          SizedBox(height: dims.isTablet ? 20 : 16),
        ],
      ),
    );
  }

  Widget _buildEmailField(ResponsiveDimensions dims) {
    return BlocBuilder<ProfileBloc, ProfileState>(
      builder: (context, state) {
        final email = state is ProfileLoaded ? state.email : null;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            DefaultTextStyle(
              style: TextStyle(decoration: TextDecoration.none),
              child: Text(
                'Email',
                style: AppTheme.labelStyle(context),
              ),
            ),
            SizedBox(height: dims.isSmallScreen ? 6 : 8),
            Material(
              color: Colors.transparent,
              child: TextFormField(
                initialValue: email ?? 'Not available',
                enabled: false,
                style: TextStyle(
                  fontSize: (dims.isTablet ? 18 : 16) * dims.textScaleFactor,
                  color: Colors.grey[600],
                ),
                decoration: InputDecoration(
                  hintText: 'Email address',
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
                  disabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: Colors.grey[300]!, width: 1),
                  ),
                  contentPadding: EdgeInsets.symmetric(
                    horizontal: dims.isTablet ? 20 : 16,
                    vertical: dims.isTablet ? 20 : 16,
                  ),
                  suffixIcon: Icon(
                    Icons.lock_outline,
                    color: Colors.grey[500],
                    size: 20,
                  ),
                ),
              ),
            ),
            SizedBox(height: dims.isSmallScreen ? 4 : 6),
            DefaultTextStyle(
              style: TextStyle(
                  decoration: TextDecoration.none
              ),
              child: Padding(
                padding: const EdgeInsets.only(left: 4),
                child: Text(
                  'Email cannot be changed',
                  style: TextStyle(
                      fontSize: (dims.isTablet ? 14 : 12) * dims.textScaleFactor,
                      color: Colors.grey[600],
                      decoration: TextDecoration.none),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

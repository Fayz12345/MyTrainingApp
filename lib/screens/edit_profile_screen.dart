import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import '../theme/app_theme.dart';
import '../widgets/custom_text_field.dart';
import '../widgets/custom_button.dart';
import '../widgets/app_loader.dart';
import '../bloc/profile/profile_bloc.dart';

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
          _nameController.text = state.name;
          _businessUnitController.text = state.businessUnit;
          _storeController.text = state.store;
        } else if (state is ProfileUpdated) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Profile updated successfully'),
              backgroundColor: Colors.green,
            ),
          );
          Navigator.pop(context, {
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
          return Scaffold(
            backgroundColor: const Color(0xFFF6F7FB),
            appBar: AppBar(
              title: const Text(
                'Edit Profile',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
              backgroundColor: Colors.white,
              elevation: 0,
              leading: IconButton(
                icon: const Icon(Icons.arrow_back, color: Colors.black87),
                onPressed: () => Navigator.pop(context),
              ),
            ),
            body: state is ProfileLoading || state is ProfileInitial
                ? const LoadingWidget()
                : state is ProfileError
                    ? Center(
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
                      )
                    : Column(
                        children: [
                          // Scrollable content
                          Expanded(
                            child: SingleChildScrollView(
                              child: Padding(
                                padding:
                                    EdgeInsets.all(dims.isTablet ? 24.0 : 16.0),
                                child: Form(
                                  key: _formKey,
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.stretch,
                                    children: [
                                      // Profile Picture Section
                                      _buildProfilePictureSection(dims),
                                      SizedBox(height: dims.isTablet ? 32 : 24),

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
                                      SizedBox(
                                          height:
                                              AppTheme.fieldSpacing(context)),

                                      // Email Field (Read-only)
                                      _buildEmailField(dims),
                                      SizedBox(
                                          height:
                                              AppTheme.fieldSpacing(context)),

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
                                          height:
                                              AppTheme.fieldSpacing(context)),

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
                                      SizedBox(height: dims.isTablet ? 32 : 24),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                          // Fixed buttons at bottom
                          Container(
                            padding:
                                EdgeInsets.all(dims.isTablet ? 24.0 : 16.0),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF6F7FB),
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
                                  onPressed: state is ProfileUpdating
                                      ? null
                                      : _saveProfile,
                                  isLoading: state is ProfileUpdating,
                                ),
                                SizedBox(height: dims.isTablet ? 16 : 12),

                                // Cancel Button
                                OutlinedButton(
                                  onPressed: state is ProfileUpdating
                                      ? null
                                      : () => Navigator.pop(context),
                                  style: OutlinedButton.styleFrom(
                                    side: BorderSide(color: Colors.grey[300]!),
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
                                      color: Colors.black87,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
          );
        },
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
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (BuildContext context) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading:
                    const Icon(Icons.camera_alt, color: AppTheme.primaryColor),
                title: const Text('Take Photo'),
                onTap: () {
                  Navigator.pop(context);
                  _pickImage(ImageSource.camera);
                },
              ),
              ListTile(
                leading: const Icon(Icons.photo_library,
                    color: AppTheme.primaryColor),
                title: const Text('Choose from Gallery'),
                onTap: () {
                  Navigator.pop(context);
                  _pickImage(ImageSource.gallery);
                },
              ),
              if (_selectedImage != null)
                ListTile(
                  leading: const Icon(Icons.delete, color: Colors.red),
                  title: const Text('Remove Photo'),
                  onTap: () {
                    Navigator.pop(context);
                    setState(() {
                      _selectedImage = null;
                    });
                  },
                ),
              const SizedBox(height: 8),
            ],
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
                  width: dims.isTablet ? 120 : 100,
                  height: dims.isTablet ? 120 : 100,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: Colors.grey.withOpacity(0.2),
                      width: 3,
                    ),
                    color: Colors.grey[200],
                  ),
                  child: _selectedImage != null
                      ? ClipOval(
                          child: Image.file(
                            _selectedImage!,
                            fit: BoxFit.cover,
                            width: dims.isTablet ? 120 : 100,
                            height: dims.isTablet ? 120 : 100,
                          ),
                        )
                      : Container(
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: Colors.grey[200],
                          ),
                          child: Icon(
                            Icons.person,
                            size: dims.isTablet ? 60 : 50,
                            color: Colors.grey[400],
                          ),
                        ),
                ),
                Positioned(
                  bottom: 0,
                  right: 0,
                  child: Container(
                    width: dims.isTablet ? 36 : 32,
                    height: dims.isTablet ? 36 : 32,
                    decoration: BoxDecoration(
                      color: AppTheme.primaryColor,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 3),
                    ),
                    child: Icon(
                      Icons.camera_alt,
                      size: dims.isTablet ? 20 : 18,
                      color: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
          ),
          SizedBox(height: dims.isTablet ? 16 : 12),
          TextButton(
            onPressed: _showImageSourceDialog,
            child: Text(
              'Change Photo',
              style: TextStyle(
                fontSize: (dims.isTablet ? 16 : 14) * dims.textScaleFactor,
                color: AppTheme.primaryColor,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
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
            Text(
              'Email',
              style: AppTheme.labelStyle(context),
            ),
            SizedBox(height: dims.isSmallScreen ? 6 : 8),
            TextFormField(
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
            SizedBox(height: dims.isSmallScreen ? 4 : 6),
            Padding(
              padding: const EdgeInsets.only(left: 4),
              child: Text(
                'Email cannot be changed',
                style: TextStyle(
                  fontSize: (dims.isTablet ? 14 : 12) * dims.textScaleFactor,
                  color: Colors.grey[600],
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

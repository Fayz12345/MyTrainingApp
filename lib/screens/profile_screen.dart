import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:amplify_flutter/amplify_flutter.dart';
import '../bloc/auth/auth_bloc.dart';
import '../bloc/course/course_bloc.dart';
import '../models/course_model.dart';
import '../services/auth_service.dart';
import '../services/video_progress_service.dart';
import '../services/quiz_progress_service.dart';
import '../services/quiz_service.dart';
import '../theme/app_theme.dart';
import '../widgets/app_loader.dart';
import 'account_settings_screen.dart';
import 'notifications_screen.dart';
import 'help_support_screen.dart';
import 'edit_profile_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => CourseBloc()..add(const LoadCourses()),
      child: const ProfileScreenContent(),
    );
  }
}

class ProfileScreenContent extends StatefulWidget {
  const ProfileScreenContent({super.key});

  @override
  State<ProfileScreenContent> createState() => _ProfileScreenContentState();
}

class _ProfileScreenContentState extends State<ProfileScreenContent> {
  String? _userEmail;
  String? _userName;
  String? _employeeFullName;
  String? _employeeDepartment;
  bool _isLoadingUserData = true;

  @override
  void initState() {
    super.initState();
    _loadUserData();
  }

  Future<void> _loadUserData() async {
    try {
      final email = await AuthService.getCurrentUserEmail();
      final username = await AuthService.getCurrentUsername();
      final employeeInfo = await AuthService.getEmployeeInfo();
      setState(() {
        _userEmail = email;
        _userName = username;
        _employeeFullName = employeeInfo['name'];
        _employeeDepartment = employeeInfo['department'];
        _isLoadingUserData = false;
      });
    } catch (e) {
      setState(() {
        _isLoadingUserData = false;
      });
    }
  }

  String _getDisplayName(String? username) {
    if (username == null || username.isEmpty) return 'User';
    // Extract name from email or username
    if (username.contains('@')) {
      final namePart = username.split('@')[0];
      // Capitalize first letter of each word
      return namePart
          .split('.')
          .map((word) => word.isEmpty
              ? ''
              : word[0].toUpperCase() + word.substring(1).toLowerCase())
          .join(' ');
    }
    return username;
  }

  int _getCompletedCoursesCount(List<Course> courses) {
    return courses
        .where((course) => course.assignmentStatus == 'completed')
        .length;
  }

  int _getCertificatesCount(List<Course> courses) {
    // Certificates = completed courses that passed (assuming passing means certificate)
    return courses
        .where((course) => course.assignmentStatus == 'completed')
        .length; // For now, all completed courses count as certificates
  }

  List<Course> _getInProgressCourses1(List<Course> courses) {
    return courses
        .where((course) =>
            course.assignmentStatus != 'completed' &&
            course.assignmentStatus != null)
        .toList();
  }

  List<Course> _getInProgressCourses(List<Course> courses) {
    return courses
        .where((course) =>
            course.assignmentStatus != 'completed' &&
            course.assignmentStatus != null)
        .toList();
  }

  /// Calculate combined progress: Video (0-50%) + Quiz (51-100%)
  Future<double> _calculateCourseProgress(Course course) async {
    // Check if assignment is fully completed
    final bool isAssignmentCompleted = course.assignmentStatus == 'completed';
    if (isAssignmentCompleted) {
      return 100.0;
    }

    // Also check if quiz result exists (quiz was passed) - this handles cases
    // where assignment status hasn't been refreshed yet but quiz was completed
    if (course.assignmentId != null) {
      final hasPassedQuiz =
          await QuizService.hasQuizResult(course.assignmentId!);
      if (hasPassedQuiz) {
        // Quiz was passed, so course should be 100% complete
        return 100.0;
      }
    }

    double videoProgress = 0.0; // 0-50%
    double quizProgress = 0.0; // 51-100%

    // Use assignmentId for progress tracking (each assignment has its own progress)
    // Fall back to course.id if assignmentId is not available
    final progressKey = course.assignmentId ?? course.id;

    // Calculate video progress (0-50%)
    final isVideoCompleted =
        await VideoProgressService.isVideoCompleted(progressKey);
    if (isVideoCompleted) {
      videoProgress = 50.0; // Video fully watched = 50%
    } else {
      final savedPosition =
          await VideoProgressService.getVideoProgress(progressKey);
      if (savedPosition != null) {
        // First try to get the actual saved video duration
        Duration? videoDuration =
            await VideoProgressService.getVideoDuration(progressKey);

        // If no saved duration, fall back to parsing course.duration string
        if (videoDuration == null || videoDuration.inMilliseconds == 0) {
          // Parse duration string like "1hr 30 Mins" or "45 Min" into total minutes
          int estimatedDurationMinutes = 30; // Default fallback
          if (course.duration != null) {
            final durationStr = course.duration!.toLowerCase();
            int hours = 0;
            int minutes = 0;

            // Extract hours (look for "hr" or "hour")
            final hourMatch =
                RegExp(r'(\d+)\s*(?:hr|hour|h)').firstMatch(durationStr);
            if (hourMatch != null) {
              hours = int.tryParse(hourMatch.group(1) ?? '0') ?? 0;
            }

            // Extract minutes (look for "min" or "mins" or just numbers after hours)
            final minMatch = RegExp(
                    r'(\d+)\s*(?:min|mins|minute|minutes|m)(?!\s*(?:hr|hour|h))')
                .firstMatch(durationStr);
            if (minMatch != null) {
              minutes = int.tryParse(minMatch.group(1) ?? '0') ?? 0;
            } else if (hours == 0) {
              // If no hours found and no explicit "min", try to parse as just minutes
              final allNumbers = RegExp(r'\d+').allMatches(durationStr);
              if (allNumbers.isNotEmpty) {
                minutes = int.tryParse(allNumbers.first.group(0) ?? '0') ?? 0;
              }
            }

            estimatedDurationMinutes = (hours * 60) + minutes;
            if (estimatedDurationMinutes == 0) {
              estimatedDurationMinutes = 30; // Fallback if parsing fails
            }
          }
          videoDuration = Duration(minutes: estimatedDurationMinutes);
        }

        if (videoDuration.inMilliseconds > 0) {
          // Calculate video progress as percentage of 50%
          final videoProgressPercent =
              (savedPosition.inMilliseconds / videoDuration.inMilliseconds)
                  .clamp(0.0, 1.0);
          videoProgress = videoProgressPercent * 50.0; // Scale to 0-50%

          // Debug logging
          safePrint(
              '[PROGRESS] [Profile] Video progress calculation for ${course.title}:');
          safePrint('  - Assignment ID: ${course.assignmentId ?? "N/A"}');
          safePrint('  - Progress Key: $progressKey');
          safePrint(
              '  - Using saved duration: ${videoDuration.inSeconds}s (${videoDuration.inMinutes}m ${videoDuration.inSeconds % 60}s)');
          safePrint('  - Course duration string: "${course.duration}"');
          safePrint(
              '  - Saved position: ${savedPosition.inSeconds}s (${savedPosition.inMinutes}m ${savedPosition.inSeconds % 60}s)');
          safePrint(
              '  - Video progress: ${(videoProgressPercent * 100).toStringAsFixed(2)}% of video');
          safePrint(
              '  - Course progress (video portion): ${videoProgress.toStringAsFixed(2)}%');
        }
      }
    }

    // Calculate quiz progress (51-100%)
    // Only calculate quiz progress if video is completed
    if (isVideoCompleted) {
      try {
        final quizQuestions = await QuizService.getQuizQuestions(course.id);
        final totalQuestions = quizQuestions.length;

        if (totalQuestions > 0) {
          final quizProgressData =
              await QuizProgressService.getQuizProgress(progressKey);
          if (quizProgressData != null) {
            final answers = quizProgressData['answers'] as List<int>;
            // Count answered questions (answers that are not -1)
            final answeredQuestions =
                answers.where((answer) => answer != -1).length;
            // Calculate quiz progress: 50% base + (answered/total) * 50%
            // This gives range: 50% (no answers) to 100% (all answered)
            final quizProgressPercent = answeredQuestions / totalQuestions;
            quizProgress =
                50.0 + (quizProgressPercent * 50.0); // Range: 50-100%
          } else {
            // Video complete but quiz not started yet
            quizProgress = 50.0; // Stay at 50% (video completion point)
          }
        } else {
          // No quiz questions, so if video is done, course is 100% complete
          quizProgress = 100.0;
        }
      } catch (e) {
        // If quiz fetch fails and video is complete, stay at 50%
        quizProgress = 50.0;
      }
    }

    // Combined progress: video (0-50%) + quiz (51-100%)
    // If video is complete, use quiz progress (50-100%); otherwise use video progress (0-50%)
    final combinedProgress = isVideoCompleted ? quizProgress : videoProgress;

    final finalProgress = combinedProgress.clamp(0.0, 100.0);
    safePrint(
        '[PROGRESS] [Profile] Final combined progress for ${course.title}: ${finalProgress.toStringAsFixed(2)}% (Video: ${videoProgress.toStringAsFixed(2)}%, Quiz: ${quizProgress.toStringAsFixed(2)}%, IsCompleted: $isVideoCompleted)');
    safePrint('  - Assignment ID: ${course.assignmentId ?? "N/A"}');
    return finalProgress;
  }

  double _calculateCourseProgress1(Course course) {
    // Calculate progress based on assignment status
    if (course.assignmentStatus == 'completed') {
      return 100.0;
    }

    if (course.assignmentStatus == 'in_progress') {
      // For in_progress courses, calculate progress based on:
      // 1. Time since assignment (how long they've been working on it)
      // 2. Course ID hash (to give unique progress per course)
      // 3. This provides different progress values for different courses

      // Generate a consistent progress value based on course ID
      // This ensures each course has a unique progress between 20-80%
      final courseIdHash = course.id.hashCode;
      final baseProgress =
          ((courseIdHash.abs() % 60) + 20).toDouble(); // Range: 20-80%

      // Adjust based on how long the course has been in progress
      final daysSinceUpdate =
          DateTime.now().difference(course.updatedAt).inDays;
      final timeBonus =
          (daysSinceUpdate > 0 ? (daysSinceUpdate * 2).clamp(0, 20) : 0)
              .toDouble();

      // Final progress: base + time bonus, capped at 90% (not completed yet)
      final calculatedProgress = (baseProgress + timeBonus).clamp(20.0, 90.0);

      return calculatedProgress;
    }
    return 0.0;
  }

  @override
  Widget build(BuildContext context) {
    final dims = AppTheme.getDimensions(context);
    final isTablet = dims.isTablet;

    return BlocBuilder<AuthBloc, AuthState>(
      builder: (context, authState) {
        String? username;
        if (authState is AuthAuthenticated) {
          username = authState.username;
        }

        return BlocBuilder<CourseBloc, CourseState>(
          builder: (context, courseState) {
            List<Course> courses = [];
            if (courseState is CourseLoaded) {
              courses = courseState.courses;
            }

            final completedCount = _getCompletedCoursesCount(courses);
            final certificatesCount = _getCertificatesCount(courses);
            final inProgressCourses = _getInProgressCourses(courses);
            // Use employee full name if available, otherwise fall back to display name
            final displayName = _employeeFullName ?? '';

            return Scaffold(
              backgroundColor: Colors.grey[100],
              appBar: AppBar(
                title: const Text(
                  'Profile',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
                backgroundColor: Colors.white,
                elevation: 0,
                actions: [
                  /*
                  IconButton(
                    icon: const Icon(
                      Icons.edit,
                      color: AppTheme.primaryColor,
                    ),
                    onPressed: () {
                      // TODO: Implement edit profile
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Edit profile coming soon'),
                        ),
                      );
                    },
                  ),
                   */
                  IconButton(
                    icon: const Icon(
                      Icons.edit,
                      color: AppTheme.primaryColor,
                    ),
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => const EditProfileScreen(),
                        ),
                      );
                    },
                  ),
                ],
              ),
              body: _isLoadingUserData
                  ? const LoadingWidget()
                  : SingleChildScrollView(
                      child: Padding(
                        padding: EdgeInsets.all(isTablet ? 24.0 : 16.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            // User Profile Card
                            _buildProfileCard(context, displayName,
                                _employeeDepartment, dims),
                            const SizedBox(height: 16),
                            // Learning Achievements Card
                            _buildAchievementsCard(context, completedCount,
                                certificatesCount, dims),
                            const SizedBox(height: 16),
                            // Current Progress Card
                            if (inProgressCourses.isNotEmpty)
                              _buildProgressCard(
                                  context, inProgressCourses, dims),
                            if (inProgressCourses.isNotEmpty)
                              const SizedBox(height: 16),
                            // Contact Information Card
                            _buildContactCard(context, dims),
                            const SizedBox(height: 16),
                            // Settings Cardmport 'package:flutter/material.dart';
                            // import 'package:flutter_bloc/flutter_bloc.dart';
                            // import '../bloc/auth/auth_bloc.dart';
                            // import '../bloc/course/course_bloc.dart';
                            // import '../models/course_model.dart';
                            // import '../services/auth_service.dart';
                            // import '../theme/app_theme.dart';
                            // import '../widgets/app_loader.dart';
                            // import 'account_settings_screen.dart';
                            // import 'notifications_screen.dart';
                            // import 'help_support_screen.dart';
                            //
                            // class ProfileScreen extends StatelessWidget {
                            //   const ProfileScreen({super.key});
                            //
                            //   @override
                            //   Widget build(BuildContext context) {
                            //     return BlocProvider(
                            //       create: (context) => CourseBloc()..add(const LoadCourses()),
                            //       child: const ProfileScreenContent(),
                            //     );
                            //   }
                            // }
                            //
                            // class ProfileScreenContent extends StatefulWidget {
                            //   const ProfileScreenContent({super.key});
                            //
                            //   @override
                            //   State<ProfileScreenContent> createState() => _ProfileScreenContentState();
                            // }
                            //
                            // class _ProfileScreenContentState extends State<ProfileScreenContent> {
                            //   String? _userEmail;
                            //   String? _userName;
                            //   String? _employeeFullName;
                            //   String? _employeeDepartment;
                            //   bool _isLoadingUserData = true;
                            //
                            //   @override
                            //   void initState() {
                            //     super.initState();
                            //     _loadUserData();
                            //   }
                            //
                            //   Future<void> _loadUserData() async {
                            //     try {
                            //       final email = await AuthService.getCurrentUserEmail();
                            //       final username = await AuthService.getCurrentUsername();
                            //       final employeeInfo = await AuthService.getEmployeeInfo();
                            //       setState(() {
                            //         _userEmail = email;
                            //         _userName = username;
                            //         _employeeFullName = employeeInfo['name'];
                            //         _employeeDepartment = employeeInfo['department'];
                            //         _isLoadingUserData = false;
                            //       });
                            //     } catch (e) {
                            //       setState(() {
                            //         _isLoadingUserData = false;
                            //       });
                            //     }
                            //   }
                            //
                            //   String _getDisplayName(String? username) {
                            //     if (username == null || username.isEmpty) return 'User';
                            //     // Extract name from email or username
                            //     if (username.contains('@')) {
                            //       final namePart = username.split('@')[0];
                            //       // Capitalize first letter of each word
                            //       return namePart
                            //           .split('.')
                            //           .map((word) => word.isEmpty
                            //               ? ''
                            //               : word[0].toUpperCase() + word.substring(1).toLowerCase())
                            //           .join(' ');
                            //     }
                            //     return username;
                            //   }
                            //
                            //   int _getCompletedCoursesCount(List<Course> courses) {
                            //     return courses
                            //         .where((course) => course.assignmentStatus == 'completed')
                            //         .length;
                            //   }
                            //
                            //   int _getCertificatesCount(List<Course> courses) {
                            //     // Certificates = completed courses that passed (assuming passing means certificate)
                            //     return courses
                            //         .where((course) => course.assignmentStatus == 'completed')
                            //         .length; // For now, all completed courses count as certificates
                            //   }
                            //
                            //   List<Course> _getInProgressCourses(List<Course> courses) {
                            //     return courses
                            //         .where((course) =>
                            //             course.assignmentStatus != 'completed' &&
                            //             course.assignmentStatus != null)
                            //         .toList();
                            //   }
                            //
                            //   double _calculateCourseProgress(Course course) {
                            //     // Calculate progress based on assignment status
                            //     if (course.assignmentStatus == 'completed') {
                            //       return 100.0;
                            //     }
                            //
                            //     if (course.assignmentStatus == 'in_progress') {
                            //       // For in_progress courses, calculate progress based on:
                            //       // 1. Time since assignment (how long they've been working on it)
                            //       // 2. Course ID hash (to give unique progress per course)
                            //       // 3. This provides different progress values for different courses
                            //
                            //       // Generate a consistent progress value based on course ID
                            //       // This ensures each course has a unique progress between 20-80%
                            //       final courseIdHash = course.id.hashCode;
                            //       final baseProgress =
                            //           ((courseIdHash.abs() % 60) + 20).toDouble(); // Range: 20-80%
                            //
                            //       // Adjust based on how long the course has been in progress
                            //       final daysSinceUpdate =
                            //           DateTime.now().difference(course.updatedAt).inDays;
                            //       final timeBonus =
                            //           (daysSinceUpdate > 0 ? (daysSinceUpdate * 2).clamp(0, 20) : 0)
                            //               .toDouble();
                            //
                            //       // Final progress: base + time bonus, capped at 90% (not completed yet)
                            //       final calculatedProgress = (baseProgress + timeBonus).clamp(20.0, 90.0);
                            //
                            //       return calculatedProgress;
                            //     }
                            //
                            //     // For assigned courses (status is null or 'assigned'), return 0%
                            //     // This means the course hasn't been started yet
                            //     return 0.0;
                            //   }
                            //
                            //   @override
                            //   Widget build(BuildContext context) {
                            //     final dims = AppTheme.getDimensions(context);
                            //     final isTablet = dims.isTablet;
                            //
                            //     return BlocBuilder<AuthBloc, AuthState>(
                            //       builder: (context, authState) {
                            //         String? username;
                            //         if (authState is AuthAuthenticated) {
                            //           username = authState.username;
                            //         }
                            //
                            //         return BlocBuilder<CourseBloc, CourseState>(
                            //           builder: (context, courseState) {
                            //             List<Course> courses = [];
                            //             if (courseState is CourseLoaded) {
                            //               courses = courseState.courses;
                            //             }
                            //
                            //             final completedCount = _getCompletedCoursesCount(courses);
                            //             final certificatesCount = _getCertificatesCount(courses);
                            //             final inProgressCourses = _getInProgressCourses(courses);
                            //             // Use employee full name if available, otherwise fall back to display name
                            //             final displayName =
                            //                 _employeeFullName ?? _getDisplayName(_userName ?? username);
                            //
                            //             return Scaffold(
                            //               backgroundColor: Colors.grey[100],
                            //               appBar: AppBar(
                            //                 title: const Text(
                            //                   'Profile',
                            //                   style: TextStyle(
                            //                     fontSize: 20,
                            //                     fontWeight: FontWeight.bold,
                            //                     color: Colors.black87,
                            //                   ),
                            //                 ),
                            //                 backgroundColor: Colors.white,
                            //                 elevation: 0,
                            //                 actions: [
                            //                   IconButton(
                            //                     icon: const Icon(
                            //                       Icons.edit,
                            //                       color: AppTheme.primaryColor,
                            //                     ),
                            //                     onPressed: () {
                            //                       // TODO: Implement edit profile
                            //                       ScaffoldMessenger.of(context).showSnackBar(
                            //                         const SnackBar(
                            //                           content: Text('Edit profile coming soon'),
                            //                         ),
                            //                       );
                            //                     },
                            //                   ),
                            //                 ],
                            //               ),
                            //               body: _isLoadingUserData
                            //                   ? const LoadingWidget()
                            //                   : SingleChildScrollView(
                            //                       child: Padding(
                            //                         padding: EdgeInsets.all(isTablet ? 24.0 : 16.0),
                            //                         child: Column(
                            //                           crossAxisAlignment: CrossAxisAlignment.stretch,
                            //                           children: [
                            //                             // User Profile Card
                            //                             _buildProfileCard(context, displayName,
                            //                                 _employeeDepartment, dims),
                            //                             const SizedBox(height: 16),
                            //                             // Learning Achievements Card
                            //                             _buildAchievementsCard(context, completedCount,
                            //                                 certificatesCount, dims),
                            //                             const SizedBox(height: 16),
                            //                             // Current Progress Card
                            //                             if (inProgressCourses.isNotEmpty)
                            //                               _buildProgressCard(
                            //                                   context, inProgressCourses, dims),
                            //                             if (inProgressCourses.isNotEmpty)
                            //                               const SizedBox(height: 16),
                            //                             // Contact Information Card
                            //                             _buildContactCard(context, dims),
                            //                             const SizedBox(height: 16),
                            //                             // Settings Card
                            //                             _buildSettingsCard(context, dims),
                            //                             SizedBox(height: isTablet ? 40 : 20),
                            //                           ],
                            //                         ),
                            //                       ),
                            //                     ),
                            //             );
                            //           },
                            //         );
                            //       },
                            //     );
                            //   }
                            //
                            //   Widget _buildProfileCard(BuildContext context, String displayName,
                            //       String? department, ResponsiveDimensions dims) {
                            //     return Container(
                            //       padding: EdgeInsets.all(dims.isTablet ? 24 : 20),
                            _buildSettingsCard(context, dims),
                            SizedBox(height: isTablet ? 40 : 20),
                          ],
                        ),
                      ),
                    ),
            );
          },
        );
      },
    );
  }

  Widget _buildProfileCard(BuildContext context, String displayName,
      String? department, ResponsiveDimensions dims) {
    return Container(
      padding: EdgeInsets.all(dims.isTablet ? 24 : 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Profile Picture
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: Colors.grey.withOpacity(0.2), width: 2),
              image: DecorationImage(
                image: NetworkImage(
                  'https://lh3.googleusercontent.com/aida-public/AB6AXuAgPa8XsbiVMPZyJTfQCpIzli4Aqr_5MAZQ-3Je5I5xo2vTCvo3w8_CwFa7kc4PMlz6ljUdK7Kd1TVuryPNpIQKF-owDH5PKkLRY5Gmyup8Uc6o1XUUklHnN5EEmu0uIIaQIBd58iHxlmsynorKDWrp7YddXJn2WW6vPql2RXVHGNGeDG7CXoMrTtH76Kz3rA3iApF3Z_J3zyDzLDDsyNyOMKCPud00RAwCdcKukV_9I2tjoGlnKacFGpx04BpJb0uC7hiX47cuky8l',
                ),
                fit: BoxFit.cover,
              ),
            ),
          ),

          const SizedBox(height: 16),
          // Name
          Text(
            displayName,
            //"Gyan Mishra",
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: (dims.isTablet ? 24 : 20) * dims.textScaleFactor,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 4),
          // Department
          Text(
            department ?? 'Employee',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: (dims.isTablet ? 16 : 14) * dims.textScaleFactor,
              color: Colors.grey[600],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAchievementsCard(BuildContext context, int completedCount,
      int certificatesCount, ResponsiveDimensions dims) {
    return Container(
      padding: EdgeInsets.all(dims.isTablet ? 24 : 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Top Section - Courses Completed
          Card(
            color: Colors.white,
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: Colors.grey[300]!, width: 1),
            ),
            child: Padding(
              padding: EdgeInsets.symmetric(
                vertical: dims.isTablet ? 15 : 10,
                horizontal: dims.isTablet ? 8 : 5,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '$completedCount',
                    style: TextStyle(
                      fontSize:
                          (dims.isTablet ? 36 : 30) * dims.textScaleFactor,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.primaryColor,
                      height: 1.1,
                      letterSpacing: -1,
                    ),
                  ),
                  SizedBox(height: dims.isTablet ? 12 : 8),
                  Text(
                    'Courses Completed',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize:
                          (dims.isTablet ? 16 : 14) * dims.textScaleFactor,
                      color: Colors.grey[700],
                      height: 1.3,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ),
          SizedBox(height: dims.isTablet ? 16 : 8),
          // Bottom Section - Certificates Earned
          Card(
            color: Colors.white,
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: Colors.grey[300]!, width: 1),
            ),
            child: Padding(
              padding: EdgeInsets.symmetric(
                vertical: dims.isTablet ? 15 : 10,
                horizontal: dims.isTablet ? 8 : 5,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '$certificatesCount',
                    style: TextStyle(
                      fontSize:
                          (dims.isTablet ? 36 : 30) * dims.textScaleFactor,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.primaryColor,
                      height: 1.1,
                      letterSpacing: -1,
                    ),
                  ),
                  SizedBox(height: dims.isTablet ? 12 : 8),
                  Text(
                    'Certificates Earned',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize:
                          (dims.isTablet ? 16 : 14) * dims.textScaleFactor,
                      color: Colors.grey[700],
                      height: 1.3,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProgressCard(
    BuildContext context,
    List<Course> inProgressCourses,
    ResponsiveDimensions dims,
  ) {
    // Limit to 2 courses for display
    final coursesToShow = inProgressCourses.take(2).toList();

    return Container(
      padding: EdgeInsets.all(dims.isTablet ? 24 : 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Current Progress',
            style: TextStyle(
              fontSize: (dims.isTablet ? 20 : 16) * dims.textScaleFactor,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 20),
          ...coursesToShow.asMap().entries.map((entry) {
            final index = entry.key;
            final course = entry.value;
            return FutureBuilder<double>(
              key: ValueKey(
                  'progress_${course.id}_${course.assignmentId}_$index'),
              future: _calculateCourseProgress(course),
              builder: (context, snapshot) {
                final progress = snapshot.data ?? 0.0;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              course.title,
                              style: TextStyle(
                                fontSize: (dims.isTablet ? 16 : 14) *
                                    dims.textScaleFactor,
                                fontWeight: FontWeight.w500,
                                color: Colors.black87,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          Text(
                            '${progress.round()}%',
                            style: TextStyle(
                              fontSize: (dims.isTablet ? 16 : 14) *
                                  dims.textScaleFactor,
                              color: Colors.grey[600],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: progress / 100,
                          backgroundColor: Colors.grey[200],
                          valueColor: const AlwaysStoppedAnimation<Color>(
                              AppTheme.primaryColor),
                          minHeight: 8,
                        ),
                      ),
                    ],
                  ),
                );
              },
            );
          }),
        ],
      ),
    );
  }

/*
  Widget _buildProgressCard1(BuildContext context,
      List<Course> inProgressCourses, ResponsiveDimensions dims) {
    // Limit to 2 courses for display
    final coursesToShow = inProgressCourses.take(2).toList();

    return Container(
      padding: EdgeInsets.all(dims.isTablet ? 24 : 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Current Progress',
            style: TextStyle(
              fontSize: (dims.isTablet ? 20 : 16) * dims.textScaleFactor,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 20),
          ...coursesToShow.map((course) {
            final progress = _calculateCourseProgress(course);
            return Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          course.title,
                          style: TextStyle(
                            fontSize: (dims.isTablet ? 16 : 14) *
                                dims.textScaleFactor,
                            fontWeight: FontWeight.w500,
                            color: Colors.black87,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Text(
                        '${progress.toInt()}%',
                        style: TextStyle(
                          fontSize:
                              (dims.isTablet ? 16 : 14) * dims.textScaleFactor,
                          color: Colors.grey[600],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: progress / 100,
                      backgroundColor: Colors.grey[200],
                      valueColor: const AlwaysStoppedAnimation<Color>(
                          AppTheme.primaryColor),
                      minHeight: 8,
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
 */

  Widget _buildContactCard(BuildContext context, ResponsiveDimensions dims) {
    final horizontalPadding = dims.isTablet ? 24.0 : 20.0;
    final verticalPadding = dims.isTablet ? 18.0 : 14.0;
    final bottomPadding = dims.isTablet ? 24.0 : 20.0;

    return Container(
      padding: EdgeInsets.zero,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          /*
          Padding(
            padding: EdgeInsets.fromLTRB(
              horizontalPadding,
              horizontalPadding,
              horizontalPadding,
              verticalPadding,
            ),
            child: Text(
              'Contact Information',
              style: TextStyle(
                fontSize: (dims.isTablet ? 20 : 18) * dims.textScaleFactor,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
          ),
          */
          Padding(
            padding: EdgeInsets.fromLTRB(
              horizontalPadding,
              horizontalPadding,
              horizontalPadding,
              verticalPadding,
            ),
            child: _buildContactRow(
              context,
              Icons.email,
              'Email',
              _userEmail ?? 'Not available',
              dims,
              Colors.blue,
            ),
          ),
          Container(
            height: 1,
            color: Colors.grey[200],
          ),
          Padding(
            padding: EdgeInsets.symmetric(
              horizontal: horizontalPadding,
              vertical: verticalPadding,
            ),
            child: _buildContactRow(
              context,
              Icons.group,
              'Business Unit',
              'Product Development',
              dims,
              Colors.orange,
            ),
          ),
          Container(
            height: 1,
            color: Colors.grey[200],
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              horizontalPadding,
              verticalPadding,
              horizontalPadding,
              bottomPadding,
            ),
            child: _buildContactRow(
              context,
              Icons.store_outlined,
              'Store',
              'San Francisco, CA',
              dims,
              Colors.green,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContactRow(BuildContext context, IconData icon, String label,
      String value, ResponsiveDimensions dims, Color iconColor) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Icon(icon,
            size: dims.isTablet ? 22 : 22,
            //color: iconColor,
            color: Colors.grey[600]),
        SizedBox(width: dims.isTablet ? 16 : 12),
        Text(
          label,
          style: TextStyle(
            fontSize: (dims.isTablet ? 16 : 14) * dims.textScaleFactor,
            color: Colors.grey[600],
            fontWeight: FontWeight.w500,
          ),
        ),
        const Spacer(),
        Expanded(
          flex: 2,
          child: Text(
            value,
            textAlign: TextAlign.right,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: (dims.isTablet ? 16 : 14) * dims.textScaleFactor,
              color: Colors.black87,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSettingsCard(BuildContext context, ResponsiveDimensions dims) {
    final horizontalPadding = dims.isTablet ? 24.0 : 15.0;
    final verticalPadding = dims.isTablet ? 18.0 : 18.0;
    final bottomPadding = dims.isTablet ? 24.0 : 15.0;

    return Container(
      padding: EdgeInsets.zero,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Padding(
            padding: EdgeInsets.symmetric(
              horizontal: horizontalPadding,
              vertical: verticalPadding,
            ),
            child: _buildSettingsRow(
              context,
              Icons.settings,
              'Account Settings',
              AppTheme.primaryColor,
              () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => const AccountSettingsScreen(),
                  ),
                );
              },
              dims,
            ),
          ),
          Container(
            height: 1,
            color: Colors.grey[300],
          ),
          Padding(
            padding: EdgeInsets.symmetric(
              horizontal: horizontalPadding,
              vertical: verticalPadding,
            ),
            child: _buildSettingsRow(
              context,
              Icons.notifications,
              'Notifications',
              AppTheme.primaryColor,
              () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => const NotificationsScreen(),
                  ),
                );
              },
              dims,
            ),
          ),
          Container(
            height: 1,
            color: Colors.grey[300],
          ),
          Padding(
            padding: EdgeInsets.symmetric(
              horizontal: horizontalPadding,
              vertical: verticalPadding,
            ),
            child: _buildSettingsRow(
              context,
              Icons.help,
              'Help & Support',
              AppTheme.primaryColor,
              () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => const HelpSupportScreen(),
                  ),
                );
              },
              dims,
            ),
          ),
          Container(
            height: 1,
            color: Colors.grey[300],
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              horizontalPadding,
              verticalPadding,
              horizontalPadding,
              bottomPadding,
            ),
            child: _buildSettingsRow(
              context,
              Icons.logout,
              'Log Out',
              Colors.red,
              () {
                _showLogoutDialog(context);
              },
              dims,
              isLogout: true,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSettingsRow(
    BuildContext context,
    IconData icon,
    String label,
    Color iconColor,
    VoidCallback onTap,
    ResponsiveDimensions dims, {
    bool isLogout = false,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Row(
        children: [
          Icon(
            icon,
            size: dims.isTablet ? 22 : 25,
            color: iconColor,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: (dims.isTablet ? 20 : 16) * dims.textScaleFactor,
                fontWeight: FontWeight.bold,
                color: isLogout ? Colors.red : Colors.black87,
              ),
            ),
          ),
          Icon(
            Icons.chevron_right,
            color: Colors.grey[500],
            size: dims.isTablet ? 29 : 25,
          ),
        ],
      ),
    );
  }

  void _showLogoutDialog(BuildContext context) {
    final dims = AppTheme.getDimensions(context);

    showDialog(
      context: context,
      barrierColor: Colors.black54,
      builder: (context) => Dialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        child: Container(
          padding: EdgeInsets.all(dims.isTablet ? 28 : 24),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Icon
              Container(
                width: dims.isTablet ? 80 : 64,
                height: dims.isTablet ? 80 : 64,
                decoration: BoxDecoration(
                  color: Colors.red[50],
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.logout_rounded,
                  size: dims.isTablet ? 40 : 32,
                  color: Colors.red[600],
                ),
              ),
              SizedBox(height: dims.isTablet ? 24 : 20),
              // Title
              Text(
                'Log Out',
                style: TextStyle(
                  fontSize: (dims.isTablet ? 24 : 20) * dims.textScaleFactor,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
              SizedBox(height: dims.isTablet ? 12 : 8),
              // Message
              Text(
                'Are you sure you want to log out?\nYou\'ll need to sign in again to access your account.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: (dims.isTablet ? 16 : 14) * dims.textScaleFactor,
                  color: Colors.grey[600],
                  height: 1.5,
                ),
              ),
              SizedBox(height: dims.isTablet ? 28 : 24),
              // Buttons
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context),
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: Colors.grey[300]!),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        padding: EdgeInsets.symmetric(
                          vertical: dims.isTablet ? 16 : 14,
                        ),
                      ),
                      child: Text(
                        'Cancel',
                        style: TextStyle(
                          fontSize:
                              (dims.isTablet ? 16 : 14) * dims.textScaleFactor,
                          fontWeight: FontWeight.w600,
                          color: Colors.black87,
                        ),
                      ),
                    ),
                  ),
                  SizedBox(width: dims.isTablet ? 16 : 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () async {
                        Navigator.pop(context);
                        // Trigger logout
                        context.read<AuthBloc>().add(const SignOut());
                        // Wait a moment for state to update, then clear navigation
                        await Future.delayed(const Duration(milliseconds: 100));
                        // Clear navigation stack to ensure we go back to login
                        if (context.mounted) {
                          Navigator.of(context, rootNavigator: true)
                              .popUntil((route) => route.isFirst);
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.red[600],
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        padding: EdgeInsets.symmetric(
                          vertical: dims.isTablet ? 16 : 14,
                        ),
                        elevation: 0,
                      ),
                      child: Text(
                        'Log Out',
                        style: TextStyle(
                          fontSize:
                              (dims.isTablet ? 16 : 14) * dims.textScaleFactor,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class RouteConstants {
  RouteConstants._(); // Private constructor

  // Auth Routes
  static const String login = '/login';
  static const String signup = '/signup';
  static const String verification = '/verification';
  static const String forgotPassword = '/forgot-password';
  static const String resetPassword = '/reset-password';
  static const String accountCreatedSuccess = '/account-created-success';

  // Main Routes
  static const String home = '/home';
  static const String root = '/';

  // Course Routes
  static const String courseList = '/courses';
  static const String videoPlayer = '/video-player';
  static const String quiz = '/quiz';

  // Profile Routes
  static const String profile = '/profile';
  static const String editProfile = '/edit-profile';
  static const String accountSettings = '/account-settings';
  static const String bankingInformation = '/banking-information';
  static const String notifications = '/notifications';
  static const String helpSupport = '/help-support';

  // Learning Path Routes
  static const String learningPathProgress = '/learning-path-progress';

  // Other Routes
  static const String googleSignInTest = '/google-signin-test';
}

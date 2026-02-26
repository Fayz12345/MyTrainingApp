import 'package:amplify_flutter/amplify_flutter.dart';
import '../../features/auth/services/file_logger.dart' as file_logger;

/// Centralized logging utility
class AppLogger {
  AppLogger._(); // Private constructor

  /// Log info message
  static void info(String message, {Map<String, dynamic>? variables}) {
    safePrint('[INFO] $message');
    file_logger.FileLogger.log(message, variables: variables);
  }

  /// Log error message
  static void error(String message, {Object? error, StackTrace? stackTrace}) {
    safePrint('[ERROR] $message');
    if (error != null) {
      safePrint('[ERROR] Exception: $error');
    }
    if (stackTrace != null) {
      safePrint('[ERROR] StackTrace: $stackTrace');
    }
    file_logger.FileLogger.log(
      message,
      variables: {
        'error': error?.toString(),
        'stackTrace': stackTrace?.toString(),
      },
    );
  }

  /// Log warning message
  static void warning(String message, {Map<String, dynamic>? variables}) {
    safePrint('[WARNING] $message');
    file_logger.FileLogger.log(message, variables: variables);
  }

  /// Log debug message
  static void debug(String message, {Map<String, dynamic>? variables}) {
    safePrint('[DEBUG] $message');
    // Only log to file in debug mode
    // file_logger.FileLogger.log(message, variables: variables);
  }
}

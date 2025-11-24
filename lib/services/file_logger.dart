import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:intl/intl.dart';
import 'package:amplify_flutter/amplify_flutter.dart';

/// Service to log authentication flow to a file
class FileLogger {
  static File? _logFile;
  static final DateFormat _dateFormat = DateFormat('yyyy-MM-dd HH:mm:ss.SSS');

  /// Initialize log file
  static Future<void> initialize() async {
    try {
      final directory = await getApplicationDocumentsDirectory();
      final logDirectory = Directory('${directory.path}/logs');
      if (!await logDirectory.exists()) {
        await logDirectory.create(recursive: true);
      }
      _logFile = File(
          '${logDirectory.path}/login_flow_${DateTime.now().millisecondsSinceEpoch}.log');
      await _logFile!.writeAsString('');
      safePrint(
          '[LOGIN_FLOW] [FILE_LOGGER] Log file created: ${_logFile!.path}');
    } catch (e) {
      safePrint('[LOGIN_FLOW] [FILE_LOGGER] ❌ Error initializing log file: $e');
    }
  }

  /// Write log entry to file
  static Future<void> log(String message,
      {Map<String, dynamic>? variables}) async {
    try {
      if (_logFile == null) {
        await initialize();
      }

      final timestamp = _dateFormat.format(DateTime.now());
      final logEntry = StringBuffer();

      logEntry.writeln('[$timestamp] $message');

      if (variables != null && variables.isNotEmpty) {
        logEntry.writeln('Variables:');
        variables.forEach((key, value) {
          // Mask sensitive data
          String displayValue = _maskSensitiveData(key, value);
          logEntry.writeln('  $key: $displayValue');
        });
      }

      logEntry.writeln('---');

      await _logFile!.writeAsString(
        '${await _logFile!.readAsString()}$logEntry',
        mode: FileMode.append,
      );
    } catch (e) {
      safePrint('[LOGIN_FLOW] [FILE_LOGGER] ❌ Error writing to log file: $e');
    }
  }

  /// Mask sensitive data (passwords, tokens)
  static String _maskSensitiveData(String key, dynamic value) {
    final sensitiveKeys = ['password', 'token', 'secret', 'key', 'credential'];
    final lowerKey = key.toLowerCase();

    if (sensitiveKeys.any((sensitive) => lowerKey.contains(sensitive))) {
      if (value is String && value.isNotEmpty) {
        return '***MASKED*** (length: ${value.length})';
      }
      return '***MASKED***';
    }

    return value.toString();
  }

  /// Log login attempt with all variables
  static Future<void> logLoginAttempt({
    String? email,
    String? password,
    Map<String, dynamic>? additionalData,
  }) async {
    final variables = <String, dynamic>{
      'email': email ?? 'N/A',
      'password': password ?? 'N/A', // Will be masked
      'timestamp': DateTime.now().toIso8601String(),
      'attempt_type': 'login',
    };

    if (additionalData != null) {
      variables.addAll(additionalData);
    }

    await log('LOGIN ATTEMPT', variables: variables);
  }

  /// Log authentication error with full details
  static Future<void> logAuthenticationError({
    required String errorMessage,
    String? errorCode,
    String? errorType,
    Map<String, dynamic>? errorDetails,
    String? username,
    StackTrace? stackTrace,
  }) async {
    final variables = <String, dynamic>{
      'error_message': errorMessage,
      'timestamp': DateTime.now().toIso8601String(),
      'error_type': 'authentication_error',
    };

    if (errorCode != null) variables['error_code'] = errorCode;
    if (errorType != null) variables['error_type_name'] = errorType;
    if (username != null) variables['username_attempted'] = username;
    if (errorDetails != null) {
      final maskedDetails = <String, dynamic>{};
      errorDetails.forEach((key, value) {
        maskedDetails[key] = _maskSensitiveData(key, value);
      });
      variables['error_details'] = maskedDetails;
    }
    if (stackTrace != null) variables['stack_trace'] = stackTrace.toString();

    await log('AUTHENTICATION ERROR', variables: variables);
  }

  /// Log authentication result
  static Future<void> logAuthResult({
    required bool success,
    String? userId,
    String? username,
    String? error,
    Map<String, dynamic>? sessionData,
    Map<String, dynamic>? tokenData,
    List<String>? groups,
  }) async {
    final variables = <String, dynamic>{
      'success': success,
      'timestamp': DateTime.now().toIso8601String(),
      'result_type': 'authentication',
    };

    if (userId != null) variables['user_id'] = userId;
    if (username != null) variables['username'] = username;
    if (error != null) variables['error'] = error;
    if (groups != null) variables['groups'] = groups;
    if (sessionData != null) variables['session_data'] = sessionData;
    if (tokenData != null) {
      // Mask tokens but keep structure
      final maskedTokenData = <String, dynamic>{};
      tokenData.forEach((key, value) {
        maskedTokenData[key] = _maskSensitiveData(key, value);
      });
      variables['token_data'] = maskedTokenData;
    }

    await log(
      success ? 'AUTHENTICATION SUCCESS' : 'AUTHENTICATION FAILED',
      variables: variables,
    );
  }

  /// Log complete authentication response with all details
  static Future<void> logCompleteAuthResponse({
    required String eventType,
    Map<String, dynamic>? hubEventPayload,
    Map<String, dynamic>? userData,
    Map<String, dynamic>? sessionResponse,
    Map<String, dynamic>? tokenResponse,
    Map<String, dynamic>? cognitoResponse,
    String? errorMessage,
    String? errorCode,
    StackTrace? stackTrace,
  }) async {
    final variables = <String, dynamic>{
      'event_type': eventType,
      'timestamp': DateTime.now().toIso8601String(),
      'response_type': 'complete_authentication_response',
    };

    if (hubEventPayload != null) {
      final maskedPayload = <String, dynamic>{};
      hubEventPayload.forEach((key, value) {
        maskedPayload[key] = _maskSensitiveData(key, value);
      });
      variables['hub_event_payload'] = maskedPayload;
    }

    if (userData != null) {
      variables['user_data'] = userData;
    }

    if (sessionResponse != null) {
      final maskedSession = <String, dynamic>{};
      sessionResponse.forEach((key, value) {
        maskedSession[key] = _maskSensitiveData(key, value);
      });
      variables['session_response'] = maskedSession;
    }

    if (tokenResponse != null) {
      final maskedTokens = <String, dynamic>{};
      tokenResponse.forEach((key, value) {
        maskedTokens[key] = _maskSensitiveData(key, value);
      });
      variables['token_response'] = maskedTokens;
    }

    if (cognitoResponse != null) {
      final maskedCognito = <String, dynamic>{};
      cognitoResponse.forEach((key, value) {
        maskedCognito[key] = _maskSensitiveData(key, value);
      });
      variables['cognito_response'] = maskedCognito;
    }

    if (errorMessage != null) {
      variables['error_message'] = errorMessage;
    }

    if (errorCode != null) {
      variables['error_code'] = errorCode;
    }

    if (stackTrace != null) {
      variables['stack_trace'] = stackTrace.toString();
    }

    await log('COMPLETE AUTHENTICATION RESPONSE', variables: variables);
  }

  /// Log user group check
  static Future<void> logGroupCheck({
    required bool isEmployee,
    List<String>? groups,
    Map<String, dynamic>? claims,
  }) async {
    final variables = <String, dynamic>{
      'is_employee': isEmployee,
      'timestamp': DateTime.now().toIso8601String(),
      'check_type': 'group_verification',
    };

    if (groups != null) variables['groups'] = groups;
    if (claims != null) {
      final maskedClaims = <String, dynamic>{};
      claims.forEach((key, value) {
        maskedClaims[key] = _maskSensitiveData(key, value);
      });
      variables['token_claims'] = maskedClaims;
    }

    await log('GROUP CHECK', variables: variables);
  }

  /// Get log file path
  static String? getLogFilePath() {
    return _logFile?.path;
  }

  /// Read all logs
  static Future<String> readLogs() async {
    try {
      if (_logFile == null || !await _logFile!.exists()) {
        return 'No log file found';
      }
      return await _logFile!.readAsString();
    } catch (e) {
      return 'Error reading log file: $e';
    }
  }

  /// Clear log file
  static Future<void> clearLogs() async {
    try {
      if (_logFile != null && await _logFile!.exists()) {
        await _logFile!.writeAsString('');
      }
    } catch (e) {
      safePrint('[LOGIN_FLOW] [FILE_LOGGER] ❌ Error clearing log file: $e');
    }
  }
}

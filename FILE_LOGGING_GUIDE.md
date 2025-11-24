# File Logging Guide

## 📝 Overview

The app now automatically logs all authentication-related variables to a file when you submit the login form. This helps debug authentication issues by capturing all relevant data.

---

## 📍 Log File Location

**Android:**
```
/data/data/com.mytrainingapp/files/logs/login_flow_[timestamp].log
```

**iOS:**
```
/var/mobile/Containers/Data/Application/[APP_ID]/Documents/logs/login_flow_[timestamp].log
```

**Note:** Each login session creates a new log file with a unique timestamp.

---

## 📊 What Gets Logged

### **1. Login Attempt**
When you submit the login form, the following is logged:
- Email/Username (masked for security)
- Password (masked - only length shown)
- Timestamp
- Attempt type

### **2. Authentication Result**
After login attempt:
- Success/Failure status
- User ID
- Username
- Error message (if failed)
- Session data
- Token data (masked for security)
- User groups

### **3. Group Verification**
When checking if user is an employee:
- Is Employee status (true/false)
- User groups list
- Token claims (masked)

### **4. App Events**
- App startup
- Amplify configuration
- Authentication state changes

---

## 🔒 Security Features

**Sensitive data is automatically masked:**
- Passwords: `***MASKED*** (length: X)`
- Tokens: `***MASKED***`
- Secrets: `***MASKED***`

**What's visible:**
- User IDs
- Usernames
- Groups
- Timestamps
- Error messages
- Token metadata (issuer, expiration, etc.)

---

## 📋 Log File Format

```
[2025-01-21 14:30:15.123] LOGIN ATTEMPT
Variables:
  email: user@example.com
  password: ***MASKED*** (length: 12)
  timestamp: 2025-01-21T14:30:15.123Z
  attempt_type: login
---
[2025-01-21 14:30:16.456] AUTHENTICATION SUCCESS
Variables:
  success: true
  timestamp: 2025-01-21T14:30:16.456Z
  result_type: authentication
  user_id: abc123-def456-ghi789
  username: user@example.com
  groups: [Employees]
  session_data: {is_signed_in: true}
  token_data: {token_type: ID Token, issuer: https://cognito-idp..., expiration: 1234567890}
---
[2025-01-21 14:30:17.789] GROUP CHECK
Variables:
  is_employee: true
  timestamp: 2025-01-21T14:30:17.789Z
  check_type: group_verification
  groups: [Employees]
  token_claims: {sub: abc123, cognito:groups: [Employees], ...}
---
```

---

## 🔍 How to Access Log Files

### **Method 1: Using Flutter DevTools**
1. Open Flutter DevTools
2. Go to "Logging" tab
3. Look for `[FILE_LOGGER]` entries showing log file path

### **Method 2: Using ADB (Android)**
```bash
# List log files
adb shell run-as com.mytrainingapp ls -la files/logs/

# Read log file
adb shell run-as com.mytrainingapp cat files/logs/login_flow_*.log
```

### **Method 3: Using Profile Screen**
The Profile Screen can display log file path (if you add a button to show it).

### **Method 4: Programmatically**
```dart
// Get log file path
String? logPath = FileLogger.getLogFilePath();
print('Log file: $logPath');

// Read all logs
String logs = await FileLogger.readLogs();
print(logs);
```

---

## 📱 Viewing Logs in App

You can add a button in the Profile Screen to view logs:

```dart
ElevatedButton(
  onPressed: () async {
    final logs = await FileLogger.readLogs();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Login Logs'),
        content: SingleChildScrollView(
          child: Text(logs),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Close'),
          ),
        ],
      ),
    );
  },
  child: Text('View Login Logs'),
)
```

---

## 🗑️ Clearing Logs

To clear the log file:

```dart
await FileLogger.clearLogs();
```

---

## 📊 Logged Variables Reference

### **Login Attempt Variables:**
- `email`: User's email/username
- `password`: Password (masked)
- `timestamp`: ISO 8601 timestamp
- `attempt_type`: Always "login"

### **Authentication Result Variables:**
- `success`: Boolean (true/false)
- `user_id`: Cognito user ID
- `username`: User's username
- `error`: Error message (if failed)
- `groups`: List of user groups
- `session_data`: Session information
- `token_data`: Token metadata (masked)

### **Group Check Variables:**
- `is_employee`: Boolean
- `groups`: List of user groups
- `token_claims`: Token claims (masked)

---

## 🐛 Troubleshooting

### **Log file not created:**
- Check app permissions (storage access)
- Check console for `[FILE_LOGGER]` errors
- Verify `path_provider` package is installed

### **Logs are empty:**
- Make sure you've attempted to log in
- Check if file permissions are correct
- Verify app has write access to documents directory

### **Can't find log file:**
- Check log file path in console: `[FILE_LOGGER] Log file created: ...`
- Use ADB/device file explorer to navigate to path
- Check if app has proper permissions

---

## 📝 Example Log Output

```
[2025-01-21 14:30:15.123] APP STARTED
Variables:
  timestamp: 2025-01-21T14:30:15.123Z
  app_version: 1.0.0+1
---
[2025-01-21 14:30:15.456] AMPLIFY CONFIGURED
Variables:
  status: success
  timestamp: 2025-01-21T14:30:15.456Z
---
[2025-01-21 14:30:20.789] LOGIN ATTEMPT
Variables:
  email: employee@example.com
  password: ***MASKED*** (length: 10)
  timestamp: 2025-01-21T14:30:20.789Z
  attempt_type: login
---
[2025-01-21 14:30:21.012] AUTHENTICATION SUCCESS
Variables:
  success: true
  timestamp: 2025-01-21T14:30:21.012Z
  result_type: authentication
  user_id: us-east-1:abc123-def456
  username: employee@example.com
  groups: [Employees]
  session_data: {is_signed_in: true}
  token_data: {token_type: ID Token, issuer: https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABC123, expiration: 1737472221}
---
[2025-01-21 14:30:21.345] GROUP CHECK
Variables:
  is_employee: true
  timestamp: 2025-01-21T14:30:21.345Z
  check_type: group_verification
  groups: [Employees]
  token_claims: {sub: us-east-1:abc123-def456, cognito:groups: [Employees], email: employee@example.com, ...}
---
```

---

## ✅ Features

- ✅ Automatic logging on login form submission
- ✅ All variables captured
- ✅ Sensitive data masked
- ✅ Timestamped entries
- ✅ Easy to read format
- ✅ Multiple log files (one per session)
- ✅ Programmatic access

---

**Last Updated**: File logging system implemented


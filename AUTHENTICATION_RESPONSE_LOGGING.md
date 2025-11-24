# Authentication Response Logging Guide

## 📋 Overview

After submitting the login form, **ALL authentication-related responses** are automatically logged to a file. This includes:

- ✅ Cognito authentication responses
- ✅ Token responses (ID, Access, Refresh tokens)
- ✅ Session responses
- ✅ User data responses
- ✅ Group verification responses
- ✅ Error responses
- ✅ Hub event payloads

---

## 📊 What Gets Logged After Login Form Submission

### **1. Hub Event Response**
When login form is submitted, Amplify Hub fires events:
```
- Event Type: signedIn / signedOut / error
- Event Payload: Complete event data
```

### **2. User Data Response**
```
- User ID: Cognito user ID
- Username: User's username/email
```

### **3. Session Response**
```
- Is Signed In: true/false
- Session Type: CognitoAuthSession
- Tokens Available: true/false
```

### **4. Token Response (Complete)**
```
ID Token:
  - Token Type: ID Token
  - Issuer: Cognito issuer URL
  - Subject: User ID
  - Audience: App client ID
  - Expiration: Token expiration timestamp
  - Issued At: Token issued timestamp
  - Auth Time: Authentication time
  - Email: User email
  - Email Verified: true/false
  - Cognito Username: Username
  - Cognito Groups: [Employees, ...]
  - Token Use: id

Access Token:
  - Token Type: Access Token
  - Expiration: Token expiration
  - Issued At: Token issued timestamp
  - Scope: Token scopes

Refresh Token:
  - Token Type: Refresh Token
  - Present: true/false
```

### **5. Cognito Response**
```
- Identity ID: Cognito identity ID
- Has Tokens: true/false
- Tokens Available: true/false
```

### **6. Group Verification Response**
```
- Is Employee: true/false
- Groups: [Employees, ...]
- Token Claims: All claims from ID token (masked)
```

### **7. Error Response (if login fails)**
```
- Error Message: Complete error message
- Error Code: Error type/class
- Stack Trace: Full stack trace
```

---

## 📝 Log File Format

### **Success Response Example:**
```
[2025-01-21 14:30:21.123] COMPLETE AUTHENTICATION RESPONSE
Variables:
  event_type: signedIn
  timestamp: 2025-01-21T14:30:21.123Z
  response_type: complete_authentication_response
  hub_event_payload: {event: signedIn, ...}
  user_data: {user_id: us-east-1:abc123, username: user@example.com}
  session_response: {is_signed_in: true, session_type: CognitoAuthSession, tokens_available: true}
  token_response: {
    id_token: {
      token_type: ID Token,
      issuer: https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABC123,
      subject: us-east-1:abc123-def456,
      audience: abc123def456ghi789,
      expiration: 1737472221,
      issued_at: 1737468621,
      auth_time: 1737468621,
      email: user@example.com,
      email_verified: true,
      cognito_username: user@example.com,
      cognito_groups: [Employees],
      token_use: id
    },
    access_token: {
      token_type: Access Token,
      expiration: 1737472221,
      issued_at: 1737468621,
      scope: aws.cognito.signin.user.admin
    },
    refresh_token: {
      token_type: Refresh Token,
      present: true
    }
  }
  cognito_response: {identity_id: us-east-1:abc123, has_tokens: true, tokens_available: true}
---
```

### **Error Response Example:**
```
[2025-01-21 14:30:20.456] COMPLETE AUTHENTICATION RESPONSE
Variables:
  event_type: CheckUserGroups_Error
  timestamp: 2025-01-21T14:30:20.456Z
  response_type: complete_authentication_response
  error_message: NotAuthorizedServiceException: Incorrect username or password.
  error_code: NotAuthorizedServiceException
  stack_trace: #0      AuthBloc._onCheckUserGroups ...
---
```

---

## 🔍 Response Data Structure

### **Complete Response Object:**
```json
{
  "event_type": "signedIn",
  "timestamp": "2025-01-21T14:30:21.123Z",
  "response_type": "complete_authentication_response",
  "hub_event_payload": {
    "event": "signedIn",
    "data": {...}
  },
  "user_data": {
    "user_id": "us-east-1:abc123-def456",
    "username": "user@example.com"
  },
  "session_response": {
    "is_signed_in": true,
    "session_type": "CognitoAuthSession",
    "tokens_available": true
  },
  "token_response": {
    "id_token": {...},
    "access_token": {...},
    "refresh_token": {...}
  },
  "cognito_response": {
    "identity_id": "us-east-1:abc123",
    "has_tokens": true,
    "tokens_available": true
  }
}
```

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

---

## 🔒 Security

**Sensitive data is automatically masked:**
- Passwords: `***MASKED*** (length: X)`
- Tokens: `***MASKED***`
- Secrets: `***MASKED***`

**What's visible:**
- Token metadata (issuer, expiration, etc.)
- User IDs and usernames
- Groups
- Error messages
- Response structure

---

## 📊 All Responses Logged

### **After Login Form Submission:**

1. **Hub Event Response** ✅
   - Event type
   - Event payload
   - Timestamp

2. **User Response** ✅
   - User ID
   - Username
   - User attributes

3. **Session Response** ✅
   - Session type
   - Sign-in status
   - Token availability

4. **Token Response** ✅
   - ID Token (all claims)
   - Access Token (metadata)
   - Refresh Token (presence)

5. **Cognito Response** ✅
   - Identity ID
   - Token status
   - User pool info

6. **Group Check Response** ✅
   - Employee status
   - User groups
   - Token claims

7. **Error Response** ✅ (if any)
   - Error message
   - Error code
   - Stack trace

---

## 🎯 Response Flow

```
Login Form Submitted
  ↓
Hub Event Fired (signedIn)
  ↓
[LOG] Hub Event Response
  ↓
Get Current User
  ↓
[LOG] User Data Response
  ↓
Fetch Auth Session
  ↓
[LOG] Session Response
  ↓
Extract Tokens
  ↓
[LOG] Token Response (Complete)
  ↓
Extract Cognito Data
  ↓
[LOG] Cognito Response
  ↓
Check User Groups
  ↓
[LOG] Group Check Response
  ↓
[LOG] Complete Authentication Response
```

---

## 🔍 Viewing Responses

### **Method 1: Console**
Check console for log file path:
```
[FILE_LOGGER] Log file created: /path/to/log/file.log
```

### **Method 2: Programmatically**
```dart
// Read all logs
String logs = await FileLogger.readLogs();
print(logs);

// Get log file path
String? path = FileLogger.getLogFilePath();
print('Log file: $path');
```

### **Method 3: ADB (Android)**
```bash
adb shell run-as com.mytrainingapp cat files/logs/login_flow_*.log
```

---

## ✅ Features

- ✅ **Complete Response Logging** - All authentication responses logged
- ✅ **Token Details** - ID, Access, Refresh token metadata
- ✅ **Session Data** - Complete session information
- ✅ **Cognito Data** - Identity and user pool data
- ✅ **Error Tracking** - Full error details with stack traces
- ✅ **Hub Events** - All authentication events captured
- ✅ **Security** - Sensitive data automatically masked
- ✅ **Timestamped** - All entries have precise timestamps

---

## 📋 Response Checklist

After submitting login form, verify these are logged:

- [ ] Hub event response
- [ ] User data response
- [ ] Session response
- [ ] ID Token response (all claims)
- [ ] Access Token response
- [ ] Refresh Token response
- [ ] Cognito response
- [ ] Group check response
- [ ] Complete authentication response summary

---

**Last Updated**: Complete authentication response logging implemented


# Error Debug Guide - "Incorrect username or password"

## 🔍 Where the Error Comes From

The error `NotAuthorizedServiceException: Incorrect username or password` comes from:

**Location:** Amplify Authenticator Widget (internal)
**When:** User submits login form with wrong credentials
**What happens:**
1. User enters email/password in Authenticator UI
2. Authenticator calls `Amplify.Auth.signIn(username, password)`
3. AWS Cognito validates credentials
4. If wrong → Cognito returns `NotAuthorizedServiceException`
5. Authenticator catches and logs: `ERROR | Authenticator | Error in AuthBloc`

---

## 📍 Error Flow

```
Login Form Submitted
  ↓
Authenticator.signIn() called internally
  ↓
Amplify.Auth.signIn(username, password)
  ↓
AWS Cognito validates
  ↓
❌ Wrong credentials
  ↓
Cognito returns: NotAuthorizedServiceException
  ↓
Authenticator catches error
  ↓
ERROR | Authenticator | Error in AuthBloc: NotAuthorizedServiceException
```

---

## 🐛 Debug Logging Added

### **1. Hub Event Error Detection**
The Hub listener now detects authentication errors:
```
[LOGIN_FLOW] [HUB] ❌❌❌ AUTHENTICATION ERROR DETECTED! ❌❌❌
[LOGIN_FLOW] [HUB] Error Event Type: [event type]
[LOGIN_FLOW] [HUB] Error Details: [error details]
```

### **2. Error Logging to File**
All errors are logged to file with:
- Error message
- Error code
- Error type
- Username attempted (masked)
- Error details
- Stack trace

### **3. Complete Error Response**
Logged to file:
```
[timestamp] AUTHENTICATION ERROR
Variables:
  error_message: Incorrect username or password.
  error_code: NotAuthorizedServiceException
  error_type: authentication_error
  username_attempted: user@example.com
  error_details: {...}
  timestamp: 2025-01-21T14:30:20.456Z
---
```

---

## 🔍 How to Debug

### **Step 1: Check Console Logs**
Look for:
```
[LOGIN_FLOW] [HUB] ❌❌❌ AUTHENTICATION ERROR DETECTED! ❌❌❌
[LOGIN_FLOW] [HUB] Error Event Type: ...
[LOGIN_FLOW] [HUB] Error Details: ...
```

### **Step 2: Check Log File**
The error is automatically logged to:
```
/data/user/0/com.mytrainingapp/app_flutter/logs/login_flow_[timestamp].log
```

Look for entries:
```
[timestamp] AUTHENTICATION ERROR
Variables:
  error_message: Incorrect username or password.
  error_code: NotAuthorizedServiceException
  username_attempted: [username used]
```

### **Step 3: Verify Credentials**
Check:
- ✅ Username/email is correct
- ✅ Password is correct
- ✅ User exists in Cognito
- ✅ User account is confirmed
- ✅ User is in "Employees" group

---

## 📊 Debug Checklist

When you see the error, check:

### **1. Hub Events**
- [ ] `[HUB] 🔔 Auth Hub Event Received` - Event fired?
- [ ] `[HUB] ❌❌❌ AUTHENTICATION ERROR DETECTED!` - Error detected?
- [ ] Error details logged?

### **2. Log File**
- [ ] Error logged to file?
- [ ] Username attempted captured?
- [ ] Error code captured?
- [ ] Error message captured?

### **3. Credentials**
- [ ] Username format correct? (email format)
- [ ] Password correct?
- [ ] No extra spaces?
- [ ] Case sensitive?

### **4. Cognito User**
- [ ] User exists in Cognito?
- [ ] User account confirmed?
- [ ] User in "Employees" group?
- [ ] User account active?

---

## 🔧 Common Issues

### **Issue 1: Wrong Username Format**
**Problem:** Using username instead of email
**Solution:** Use email address as username

### **Issue 2: User Not Confirmed**
**Problem:** User exists but not confirmed
**Solution:** Confirm user in Cognito console

### **Issue 3: User Not in Employees Group**
**Problem:** User exists but not in group
**Solution:** Add user to "Employees" group in Cognito

### **Issue 4: Password Changed**
**Problem:** Password changed but using old password
**Solution:** Reset password or use new password

---

## 📝 Debug Output Example

### **Console Output:**
```
[LOGIN_FLOW] [HUB] 🔔 Auth Hub Event Received
[LOGIN_FLOW] [HUB] Event Type: [error event]
[LOGIN_FLOW] [HUB] Event Payload: {message: Incorrect username or password.}
[LOGIN_FLOW] [HUB] ❌❌❌ AUTHENTICATION ERROR DETECTED! ❌❌❌
[LOGIN_FLOW] [HUB] Error Event Type: [type]
[LOGIN_FLOW] [HUB] Error Details: {message: Incorrect username or password.}
ERROR | Authenticator | Error in AuthBloc: NotAuthorizedServiceException {
  "message": "Incorrect username or password.",
}
```

### **Log File Output:**
```
[2025-01-21 14:30:20.456] AUTHENTICATION ERROR
Variables:
  error_message: Incorrect username or password.
  error_code: NotAuthorizedServiceException
  error_type: authentication_error
  error_type_name: NotAuthorizedServiceException
  username_attempted: user@example.com
  timestamp: 2025-01-21T14:30:20.456Z
---
[2025-01-21 14:30:20.789] COMPLETE AUTHENTICATION RESPONSE
Variables:
  event_type: Authentication_Error
  timestamp: 2025-01-21T14:30:20.789Z
  response_type: complete_authentication_response
  hub_event_payload: {message: Incorrect username or password.}
  error_message: Incorrect username or password.
  error_code: NotAuthorizedServiceException
---
```

---

## ✅ What to Check

1. **Check Log File Path:**
   ```
   [FILE_LOGGER] Log file created: /data/user/0/com.mytrainingapp/app_flutter/logs/login_flow_[timestamp].log
   ```

2. **Read Log File:**
   ```bash
   adb shell run-as com.mytrainingapp cat app_flutter/logs/login_flow_*.log
   ```

3. **Look for:**
   - `AUTHENTICATION ERROR` entries
   - `username_attempted` value
   - `error_message` details
   - `error_code` type

---

## 🎯 Next Steps

1. **Run the app again**
2. **Try to log in** (with correct or incorrect credentials)
3. **Check console** for `[HUB] ❌❌❌ AUTHENTICATION ERROR DETECTED!`
4. **Check log file** for complete error details
5. **Verify credentials** match what's in Cognito

---

**Last Updated**: Error debugging and logging enhanced


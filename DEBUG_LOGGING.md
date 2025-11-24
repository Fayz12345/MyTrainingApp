# Debug Logging Guide - Login Flow

## 🔍 Overview

Comprehensive debug logging has been added throughout the login flow to help track authentication issues. All debug logs are prefixed with `[LOGIN_FLOW]` for easy filtering.

---

## 📋 Debug Log Format

All logs follow this format:
```
[LOGIN_FLOW] [STEP X] [COMPONENT] Message
```

**Examples:**
- `[LOGIN_FLOW] [STEP 1] Starting Amplify configuration...`
- `[LOGIN_FLOW] [AUTH_SERVICE] checkIsEmployee() called`
- `[LOGIN_FLOW] [AppContent] Current state: AuthLoading`

---

## 🔢 Step-by-Step Debug Logs

### **STEP 1: App Initialization**
```
[LOGIN_FLOW] ========================================
[LOGIN_FLOW] 🚀 APP STARTING
[LOGIN_FLOW] ========================================
[LOGIN_FLOW] Initializing Flutter binding...
[LOGIN_FLOW] ✅ Flutter binding initialized
[LOGIN_FLOW] [STEP 1] Starting Amplify configuration...
[LOGIN_FLOW] [STEP 1.1] Reading amplify_outputs.json from assets...
[LOGIN_FLOW] [STEP 1.1] ✅ Config file read from assets
[LOGIN_FLOW] [STEP 1.2] Adding Amplify plugins...
[LOGIN_FLOW] [STEP 1.2] ✅ Plugins added: AuthCognito, API, StorageS3
[LOGIN_FLOW] [STEP 1.3] Configuring Amplify with config string...
[LOGIN_FLOW] [STEP 1.3] ✅ Amplify configured successfully
[LOGIN_FLOW] [STEP 1] ✅ Amplify initialization complete
[LOGIN_FLOW] ✅ Amplify configured successfully
[LOGIN_FLOW] Running MyApp...
```

### **STEP 2: Authentication Check**
```
[LOGIN_FLOW] [MyApp] Building app widget...
[LOGIN_FLOW] [MyApp] Creating AuthBloc and triggering CheckUserGroups...
[LOGIN_FLOW] [MyApp] Creating AuthBloc instance...
[LOGIN_FLOW] [MyApp] Triggering CheckUserGroups event...
[LOGIN_FLOW] [STEP 2] AuthBloc: CheckUserGroups event received
[LOGIN_FLOW] [STEP 2.1] Emitting AuthLoading state...
[LOGIN_FLOW] [AppContent] Current state: AuthLoading
[LOGIN_FLOW] [AppContent] Showing loading screen...
[LOGIN_FLOW] [STEP 2.2] Checking if user is authenticated...
```

**If user is NOT authenticated:**
```
[LOGIN_FLOW] [STEP 2.2] ❌ User is NOT authenticated: [error details]
[LOGIN_FLOW] [STEP 2.2] Emitting AuthUnauthenticated state (no user)
[LOGIN_FLOW] [AppContent] Current state: AuthUnauthenticated
[LOGIN_FLOW] [AppContent] Showing unauthenticated screen
[LOGIN_FLOW] [AppContent] Message: [message]
```

**If user IS authenticated:**
```
[LOGIN_FLOW] [STEP 2.2] ✅ User is authenticated
[LOGIN_FLOW] [STEP 2.2] User ID: [user-id]
[LOGIN_FLOW] [STEP 2.2] Username: [username]
[LOGIN_FLOW] [STEP 2.3] User authenticated, checking employee group membership...
[LOGIN_FLOW] [AUTH_SERVICE] checkIsEmployee() called
[LOGIN_FLOW] [AUTH_SERVICE] Getting current user...
[LOGIN_FLOW] [AUTH_SERVICE] ✅ Current user: [user-id]
[LOGIN_FLOW] [AUTH_SERVICE] Fetching auth session...
[LOGIN_FLOW] [AUTH_SERVICE] ✅ Session fetched
[LOGIN_FLOW] [AUTH_SERVICE] Session is CognitoAuthSession
[LOGIN_FLOW] [AUTH_SERVICE] Extracting ID token...
[LOGIN_FLOW] [AUTH_SERVICE] Parsing token claims...
[LOGIN_FLOW] [AUTH_SERVICE] Claims keys: [list of keys]
[LOGIN_FLOW] [AUTH_SERVICE] Groups value: [groups] (type: [type])
[LOGIN_FLOW] [AUTH_SERVICE] Groups is List: [groups]
[LOGIN_FLOW] [AUTH_SERVICE] Is Employee: [true/false]
[LOGIN_FLOW] [STEP 2.3] Employee check result: [true/false]
```

**If user is in Employees group:**
```
[LOGIN_FLOW] [STEP 2.4] ✅ User is in Employees group, getting user details...
[LOGIN_FLOW] [AUTH_SERVICE] getCurrentUsername() called
[LOGIN_FLOW] [AUTH_SERVICE] ✅ Username: [username]
[LOGIN_FLOW] [AUTH_SERVICE] getCurrentUserId() called
[LOGIN_FLOW] [AUTH_SERVICE] ✅ User ID: [user-id]
[LOGIN_FLOW] [STEP 2.4] Username: [username]
[LOGIN_FLOW] [STEP 2.4] User ID: [user-id]
[LOGIN_FLOW] [STEP 2.5] Emitting AuthAuthenticated state
[LOGIN_FLOW] [STEP 2.5] ✅ Authentication successful! User can access app
[LOGIN_FLOW] [AppContent] Current state: AuthAuthenticated
[LOGIN_FLOW] [AppContent] ✅ User authenticated!
[LOGIN_FLOW] [AppContent] Username: [username]
[LOGIN_FLOW] [AppContent] User ID: [user-id]
[LOGIN_FLOW] [AppContent] Is Employee: true
[LOGIN_FLOW] [AppContent] Showing MainTabNavigator...
[LOGIN_FLOW] ========================================
[LOGIN_FLOW] ✅ LOGIN FLOW COMPLETE - USER LOGGED IN
[LOGIN_FLOW] ========================================
```

**If user is NOT in Employees group:**
```
[LOGIN_FLOW] [STEP 2.3] ❌ User is NOT in Employees group
[LOGIN_FLOW] [STEP 2.3] Emitting AuthUnauthenticated state (not employee)
[LOGIN_FLOW] [AppContent] Current state: AuthUnauthenticated
[LOGIN_FLOW] [AppContent] Showing unauthenticated screen
[LOGIN_FLOW] [AppContent] Message: Access denied. Employees only.
```

---

## 🛠️ How to Use Debug Logs

### **1. Filter Logs in IDE**

**VS Code / Android Studio:**
- Use filter: `[LOGIN_FLOW]`
- This shows only login-related logs

**Terminal:**
```bash
flutter run | grep "\[LOGIN_FLOW\]"
```

### **2. Common Debug Scenarios**

#### **Scenario 1: User Can't Login**
Look for:
```
[LOGIN_FLOW] [STEP 2.2] ❌ User is NOT authenticated: [error]
```
This shows why authentication failed.

#### **Scenario 2: Login Works But Access Denied**
Look for:
```
[LOGIN_FLOW] [AUTH_SERVICE] Groups value: [groups]
[LOGIN_FLOW] [STEP 2.3] ❌ User is NOT in Employees group
```
This shows user groups and why access was denied.

#### **Scenario 3: Configuration Issues**
Look for:
```
[LOGIN_FLOW] [STEP 1] ❌ ERROR configuring Amplify: [error]
```
This shows Amplify configuration problems.

### **3. Log Symbols**

- ✅ = Success
- ❌ = Error/Failure
- ⚠️ = Warning
- 🚀 = App Start
- 🔍 = Checking/Verifying

---

## 📊 Debug Log Locations

### **Files with Debug Logging:**

1. **`lib/main.dart`**
   - App initialization
   - State transitions
   - Widget building

2. **`lib/services/amplify_service.dart`**
   - Amplify configuration
   - Plugin initialization
   - Config file reading

3. **`lib/bloc/auth/auth_bloc.dart`**
   - Authentication state changes
   - User group checks
   - Sign out process

4. **`lib/services/auth_service.dart`**
   - User authentication checks
   - Group membership verification
   - User info retrieval

---

## 🔍 Troubleshooting with Logs

### **Issue: "User is NOT authenticated"**

**Check logs:**
```
[LOGIN_FLOW] [STEP 2.2] ❌ User is NOT authenticated: [error]
```

**Possible causes:**
- User hasn't logged in yet
- Session expired
- Token invalid

**Solution:**
- User needs to log in through Authenticator UI
- Check if login credentials are correct

---

### **Issue: "User is NOT in Employees group"**

**Check logs:**
```
[LOGIN_FLOW] [AUTH_SERVICE] Groups value: [actual groups]
[LOGIN_FLOW] [STEP 2.3] ❌ User is NOT in Employees group
```

**Possible causes:**
- User not added to "Employees" group in Cognito
- Groups not included in token

**Solution:**
- Add user to "Employees" group in AWS Cognito Console
- User needs to re-login to refresh token

---

### **Issue: "ERROR configuring Amplify"**

**Check logs:**
```
[LOGIN_FLOW] [STEP 1] ❌ ERROR configuring Amplify: [error]
[LOGIN_FLOW] [STEP 1] ❌ Stack trace: [stack trace]
```

**Possible causes:**
- `amplify_outputs.json` missing or invalid
- Network connection issues
- AWS credentials problems

**Solution:**
- Verify `amplify_outputs.json` exists
- Check file format is valid JSON
- Verify network connection

---

## 📝 Example Complete Login Flow Logs

### **Successful Login:**
```
[LOGIN_FLOW] ========================================
[LOGIN_FLOW] 🚀 APP STARTING
[LOGIN_FLOW] ========================================
[LOGIN_FLOW] Initializing Flutter binding...
[LOGIN_FLOW] ✅ Flutter binding initialized
[LOGIN_FLOW] [STEP 1] Starting Amplify configuration...
[LOGIN_FLOW] [STEP 1.1] Reading amplify_outputs.json from assets...
[LOGIN_FLOW] [STEP 1.1] ✅ Config file read from assets
[LOGIN_FLOW] [STEP 1.2] Adding Amplify plugins...
[LOGIN_FLOW] [STEP 1.2] ✅ Plugins added: AuthCognito, API, StorageS3
[LOGIN_FLOW] [STEP 1.3] Configuring Amplify with config string...
[LOGIN_FLOW] [STEP 1.3] ✅ Amplify configured successfully
[LOGIN_FLOW] [STEP 1] ✅ Amplify initialization complete
[LOGIN_FLOW] ✅ Amplify configured successfully
[LOGIN_FLOW] Running MyApp...
[LOGIN_FLOW] [MyApp] Building app widget...
[LOGIN_FLOW] [MyApp] Creating AuthBloc and triggering CheckUserGroups...
[LOGIN_FLOW] [MyApp] Creating AuthBloc instance...
[LOGIN_FLOW] [MyApp] Triggering CheckUserGroups event...
[LOGIN_FLOW] [STEP 2] AuthBloc: CheckUserGroups event received
[LOGIN_FLOW] [STEP 2.1] Emitting AuthLoading state...
[LOGIN_FLOW] [AppContent] Current state: AuthLoading
[LOGIN_FLOW] [AppContent] Showing loading screen...
[LOGIN_FLOW] [STEP 2.2] Checking if user is authenticated...
[LOGIN_FLOW] [STEP 2.2] ❌ User is NOT authenticated: [error]
[LOGIN_FLOW] [STEP 2.2] Emitting AuthUnauthenticated state (no user)
[LOGIN_FLOW] [AppContent] Current state: AuthUnauthenticated
[LOGIN_FLOW] [AppContent] Showing unauthenticated screen
[LOGIN_FLOW] [AppContent] Message: null

... [User logs in through Authenticator UI] ...

[LOGIN_FLOW] [STEP 2] AuthBloc: CheckUserGroups event received
[LOGIN_FLOW] [STEP 2.1] Emitting AuthLoading state...
[LOGIN_FLOW] [STEP 2.2] Checking if user is authenticated...
[LOGIN_FLOW] [STEP 2.2] ✅ User is authenticated
[LOGIN_FLOW] [STEP 2.2] User ID: abc123
[LOGIN_FLOW] [STEP 2.2] Username: user@example.com
[LOGIN_FLOW] [STEP 2.3] User authenticated, checking employee group membership...
[LOGIN_FLOW] [AUTH_SERVICE] checkIsEmployee() called
[LOGIN_FLOW] [AUTH_SERVICE] Getting current user...
[LOGIN_FLOW] [AUTH_SERVICE] ✅ Current user: abc123
[LOGIN_FLOW] [AUTH_SERVICE] Fetching auth session...
[LOGIN_FLOW] [AUTH_SERVICE] ✅ Session fetched
[LOGIN_FLOW] [AUTH_SERVICE] Session is CognitoAuthSession
[LOGIN_FLOW] [AUTH_SERVICE] Extracting ID token...
[LOGIN_FLOW] [AUTH_SERVICE] Parsing token claims...
[LOGIN_FLOW] [AUTH_SERVICE] Claims keys: [sub, email, cognito:groups, ...]
[LOGIN_FLOW] [AUTH_SERVICE] Groups value: [Employees] (type: List)
[LOGIN_FLOW] [AUTH_SERVICE] Groups is List: [Employees]
[LOGIN_FLOW] [AUTH_SERVICE] Is Employee: true
[LOGIN_FLOW] [STEP 2.3] Employee check result: true
[LOGIN_FLOW] [STEP 2.4] ✅ User is in Employees group, getting user details...
[LOGIN_FLOW] [AUTH_SERVICE] getCurrentUsername() called
[LOGIN_FLOW] [AUTH_SERVICE] ✅ Username: user@example.com
[LOGIN_FLOW] [AUTH_SERVICE] getCurrentUserId() called
[LOGIN_FLOW] [AUTH_SERVICE] ✅ User ID: abc123
[LOGIN_FLOW] [STEP 2.4] Username: user@example.com
[LOGIN_FLOW] [STEP 2.4] User ID: abc123
[LOGIN_FLOW] [STEP 2.5] Emitting AuthAuthenticated state
[LOGIN_FLOW] [STEP 2.5] ✅ Authentication successful! User can access app
[LOGIN_FLOW] [AppContent] Current state: AuthAuthenticated
[LOGIN_FLOW] [AppContent] ✅ User authenticated!
[LOGIN_FLOW] [AppContent] Username: user@example.com
[LOGIN_FLOW] [AppContent] User ID: abc123
[LOGIN_FLOW] [AppContent] Is Employee: true
[LOGIN_FLOW] [AppContent] Showing MainTabNavigator...
[LOGIN_FLOW] ========================================
[LOGIN_FLOW] ✅ LOGIN FLOW COMPLETE - USER LOGGED IN
[LOGIN_FLOW] ========================================
```

---

## 🎯 Quick Reference

**Filter logs:** `[LOGIN_FLOW]`

**Key log patterns:**
- `✅` = Success
- `❌` = Error
- `⚠️` = Warning
- `[STEP X]` = Step number
- `[COMPONENT]` = Component name

**Important logs to watch:**
1. `[STEP 1]` - App initialization
2. `[STEP 2.2]` - Authentication check
3. `[STEP 2.3]` - Group membership check
4. `[AUTH_SERVICE]` - Service-level operations

---

**Last Updated**: Debug logging added to all authentication components


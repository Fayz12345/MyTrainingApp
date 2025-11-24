# Login Flow - Step by Step Guide

## 🔐 Complete Login Flow in MyTrainingApp

This document explains the complete login flow from app startup to successful authentication.

---

## 📱 **Phase 1: App Initialization**

### Step 1: App Starts
**File**: `lib/main.dart` - `main()` function

```
1. WidgetsFlutterBinding.ensureInitialized()
   → Initializes Flutter framework

2. AmplifyService.configure()
   → Reads amplify_outputs.json
   → Configures AWS Amplify plugins:
     - AmplifyAuthCognito (Authentication)
     - AmplifyAPI (GraphQL API)
     - AmplifyStorageS3 (File Storage)
   → Connects to AWS services

3. runApp(MyApp())
   → Starts the Flutter app
```

**What happens:**
- App reads configuration from `amplify_outputs.json`
- Establishes connection to AWS Cognito User Pool
- Sets up GraphQL API connection to DynamoDB
- Configures S3 storage access

---

## 🎯 **Phase 2: Authentication Check**

### Step 2: AuthBloc Initialization
**File**: `lib/main.dart` - `MyApp` widget

```
AuthBloc()..add(const CheckUserGroups())
```

**What happens:**
- Creates AuthBloc instance
- Immediately triggers `CheckUserGroups` event
- Starts checking if user is authenticated

### Step 3: Check User Groups
**File**: `lib/bloc/auth/auth_bloc.dart` - `_onCheckUserGroups()`

```
1. Emit AuthLoading state
   → Shows "Checking permissions..." screen

2. Try to get current user:
   await Amplify.Auth.getCurrentUser()
   
   IF user exists:
     → Continue to Step 4
   IF no user:
     → Emit AuthUnauthenticated state
     → Show login screen (Step 5)
```

**What happens:**
- Checks if user is already logged in
- If logged in → Continue authentication check
- If not logged in → Show login screen

---

## 🔑 **Phase 3: User Login (If Not Authenticated)**

### Step 4: Login Screen Display
**File**: `lib/main.dart` - `Authenticator` widget

```
Authenticator.builder()
→ Shows Amplify Authenticator UI
→ Displays login form with:
   - Email field
   - Password field
   - "Sign In" button
   - "Sign Up" link (for registration)
```

**What happens:**
- Amplify Authenticator widget handles the UI
- User sees login form
- User can enter credentials

### Step 5: User Enters Credentials
**User Action:**
```
1. User enters email address
2. User enters password
3. User clicks "Sign In" button
```

### Step 6: Amplify Authenticator Processes Login
**Behind the scenes:**
```
1. Amplify Authenticator validates form:
   - Email format check
   - Password not empty

2. Calls AWS Cognito:
   Amplify.Auth.signIn(
     username: email,
     password: password
   )

3. AWS Cognito validates credentials:
   - Checks if user exists
   - Verifies password
   - Checks if account is verified
   - Checks if account is active
```

**What happens:**
- Credentials sent to AWS Cognito User Pool
- Cognito validates against user database
- Returns authentication result

### Step 7: Authentication Response
**Possible outcomes:**

**✅ SUCCESS:**
```
→ Cognito returns authentication tokens:
   - Access Token
   - ID Token (contains user groups)
   - Refresh Token

→ Amplify stores tokens securely
→ User is now authenticated
```

**❌ FAILURE:**
```
Possible errors:
- "Incorrect username or password"
- "User is not confirmed"
- "Password attempts exceeded"
- "User account is disabled"

→ Error message shown to user
→ User can retry login
```

---

## ✅ **Phase 4: Post-Login Verification**

### Step 8: AuthBloc Re-checks User Groups
**File**: `lib/bloc/auth/auth_bloc.dart` - `_onCheckUserGroups()`

After successful login, AuthBloc automatically checks:

```
1. Get current user:
   await Amplify.Auth.getCurrentUser()
   → Returns user object

2. Fetch authentication session:
   await Amplify.Auth.fetchAuthSession()
   → Gets ID token with user claims

3. Extract user groups from ID token:
   idToken.claims['cognito:groups']
   → Checks if user is in "Employees" group
```

**What happens:**
- Retrieves user information
- Gets authentication session
- Extracts user groups from token

### Step 9: Check Employee Group Membership
**File**: `lib/services/auth_service.dart` - `checkIsEmployee()`

```
1. Parse ID token claims:
   claimsMap = idToken.claims.toJson()
   
2. Get groups:
   groupsValue = claimsMap['cognito:groups']
   
3. Check if "Employees" in groups:
   IF groupsValue == 'Employees' OR
      groupsValue.contains('Employees'):
     → return true (User is employee)
   ELSE:
     → return false (User not in Employees group)
```

**What happens:**
- Checks if user belongs to "Employees" group
- This determines if user can access the app

### Step 10: Authorization Decision
**File**: `lib/bloc/auth/auth_bloc.dart` - `_onCheckUserGroups()`

```
IF user is in Employees group:
  → Get username
  → Get user ID
  → Emit AuthAuthenticated state
  → User can access app ✅

IF user is NOT in Employees group:
  → Emit AuthUnauthenticated state
  → Show "Access denied. Employees only." message
  → User cannot access app ❌
```

**What happens:**
- Final authorization check
- Grants or denies access based on group membership

---

## 🎉 **Phase 5: Successful Login**

### Step 11: Show Main App
**File**: `lib/main.dart` - `AppContent` widget

```
IF state is AuthAuthenticated:
  → Show MainTabNavigator
  → Display app content:
     - Courses tab
     - Profile tab
```

**What happens:**
- User sees main app interface
- Can access courses and profile
- Login flow complete ✅

---

## 📊 **Visual Flow Diagram**

```
┌─────────────────────────────────────────┐
│  1. App Starts                          │
│     → Initialize Flutter                │
│     → Configure Amplify                 │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  2. Check Authentication                │
│     → AuthBloc checks if user logged in │
└──────────────┬──────────────────────────┘
               │
        ┌──────┴──────┐
        │             │
        ▼             ▼
   ┌────────┐   ┌──────────────┐
   │ Logged │   │ Not Logged   │
   │   In   │   │     In       │
   └───┬────┘   └──────┬───────┘
       │               │
       │               ▼
       │      ┌─────────────────┐
       │      │ 3. Show Login   │
       │      │    Screen       │
       │      └────────┬────────┘
       │               │
       │               ▼
       │      ┌─────────────────┐
       │      │ 4. User Enters   │
       │      │    Credentials   │
       │      └────────┬────────┘
       │               │
       │               ▼
       │      ┌─────────────────┐
       │      │ 5. AWS Cognito   │
       │      │    Validates     │
       │      └────────┬────────┘
       │               │
       │               ▼
       │      ┌─────────────────┐
       │      │ 6. Get Auth      │
       │      │    Tokens        │
       │      └────────┬────────┘
       │               │
       └───────┬───────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  7. Check User Groups                   │
│     → Extract groups from ID token     │
│     → Verify "Employees" membership    │
└──────────────┬──────────────────────────┘
               │
        ┌──────┴──────┐
        │             │
        ▼             ▼
   ┌────────┐   ┌──────────────┐
   │Employee│   │ Not Employee │
   │  Group │   │    Group      │
   └───┬────┘   └──────┬───────┘
       │               │
       │               ▼
       │      ┌─────────────────┐
       │      │ Access Denied    │
       │      └──────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  8. Show Main App                       │
│     → Courses Tab                       │
│     → Profile Tab                       │
└─────────────────────────────────────────┘
```

---

## 🔍 **Key Components**

### 1. **Amplify Authenticator**
- **Purpose**: Handles login UI and authentication
- **Location**: Wraps the entire app in `main.dart`
- **Features**: 
  - Login form
  - Registration form
  - Password reset
  - Email verification

### 2. **AuthBloc (BLoC Pattern)**
- **Purpose**: Manages authentication state
- **Location**: `lib/bloc/auth/auth_bloc.dart`
- **States**:
  - `AuthInitial` - Starting state
  - `AuthLoading` - Checking authentication
  - `AuthAuthenticated` - User logged in and authorized
  - `AuthUnauthenticated` - User not logged in or not authorized
  - `AuthError` - Error occurred

### 3. **AuthService**
- **Purpose**: Handles authentication operations
- **Location**: `lib/services/auth_service.dart`
- **Methods**:
  - `checkIsEmployee()` - Checks if user is in Employees group
  - `getCurrentUserId()` - Gets current user ID
  - `getCurrentUsername()` - Gets current username
  - `signOut()` - Signs out user

### 4. **AWS Cognito User Pool**
- **Purpose**: User authentication database
- **User Pool ID**: `ca-central-1_HeNIx5x65`
- **Groups**: `Employees`, `Managers`
- **Authentication**: Email + Password

---

## ⚠️ **Common Issues & Solutions**

### Issue 1: "Incorrect username or password"
**Cause**: Wrong credentials or user doesn't exist
**Solution**: 
- Verify email and password
- Check if user exists in Cognito
- Try password reset

### Issue 2: "Access denied. Employees only."
**Cause**: User is not in "Employees" group
**Solution**:
- Add user to "Employees" group in AWS Cognito Console
- Or use admin panel to create employee account

### Issue 3: "User is not confirmed"
**Cause**: Email not verified
**Solution**:
- Check email for verification code
- Enter verification code in app

### Issue 4: Login works but app doesn't load
**Cause**: User authenticated but not in Employees group
**Solution**:
- Add user to Employees group
- Re-login to refresh tokens

---

## 🧪 **Testing Login Flow**

### Manual Test Steps:
1. **Start App** → Should show login screen
2. **Enter Credentials** → Use valid email/password
3. **Click Sign In** → Should authenticate
4. **Check Status** → Should show main app
5. **Verify Profile** → Should show user info

### Automated Test:
- Use "Test Login Functionality" button in Profile screen
- Checks all authentication states
- Verifies group membership

---

## 📝 **Summary**

**Login Flow Steps:**
1. ✅ App initializes and configures Amplify
2. ✅ AuthBloc checks if user is logged in
3. ✅ If not logged in → Show login screen
4. ✅ User enters credentials
5. ✅ AWS Cognito validates credentials
6. ✅ Get authentication tokens
7. ✅ Check user groups from ID token
8. ✅ Verify "Employees" group membership
9. ✅ Grant access if authorized
10. ✅ Show main app interface

**Total Time**: ~2-5 seconds (depending on network)

**Security**: 
- Passwords encrypted
- Tokens stored securely
- Group-based authorization
- Session management

---

## 🔗 **Related Files**

- `lib/main.dart` - App initialization and routing
- `lib/bloc/auth/auth_bloc.dart` - Authentication state management
- `lib/services/auth_service.dart` - Authentication operations
- `lib/services/amplify_service.dart` - AWS Amplify configuration
- `amplify_outputs.json` - AWS service configuration

---

**Last Updated**: Based on current codebase structure


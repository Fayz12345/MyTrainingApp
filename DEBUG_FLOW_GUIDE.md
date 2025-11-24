# Complete Debug Flow Guide

## 🔍 What You Should See in Logs

This guide shows you the **complete debug flow** you'll see when running the app, including login attempts and errors.

---

## 📋 Expected Debug Flow

### **Phase 1: App Startup**

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

---

### **Phase 2: Initial Authentication Check**

```
[LOGIN_FLOW] [MyApp] Building app widget...
[LOGIN_FLOW] [MyApp] Creating AuthBloc and triggering CheckUserGroups...
[LOGIN_FLOW] [MyApp] Creating AuthBloc instance...
[LOGIN_FLOW] [MyApp] Triggering CheckUserGroups event...
[LOGIN_FLOW] [STEP 2] AuthBloc: CheckUserGroups event received
[LOGIN_FLOW] [STEP 2.1] Emitting AuthLoading state...
[LOGIN_FLOW] [AppContent] Current state: AuthLoading
[LOGIN_FLOW] [AppContent] Showing loading screen...
[LOGIN_FLOW] [AppContent] Initializing...
[LOGIN_FLOW] [AppContent] Setting up Amplify Hub listener...
[LOGIN_FLOW] [AppContent] ✅ Hub listener set up (subscription: ...)
[LOGIN_FLOW] [AppContent] Checking initial authentication state...
[LOGIN_FLOW] [STEP 2.2] Checking if user is authenticated...
```

**If user is NOT logged in:**
```
[LOGIN_FLOW] [AppContent] ❌ Initial check: User is NOT authenticated
[LOGIN_FLOW] [AppContent] Error: [error details]
[LOGIN_FLOW] [AppContent] Authenticator will show login screen
[LOGIN_FLOW] [STEP 2.2] ❌ User is NOT authenticated: [error]
[LOGIN_FLOW] [STEP 2.2] Emitting AuthUnauthenticated state (no user)
[LOGIN_FLOW] [AppContent] Current state: AuthUnauthenticated
[LOGIN_FLOW] [AppContent] Showing unauthenticated screen
[LOGIN_FLOW] [AppContent] Message: null
```

**Result:** Login screen appears (Amplify Authenticator UI)

---

### **Phase 3: Login Attempt**

When user tries to log in, you'll see:

#### **Step 1: User Enters Credentials**
```
[LOGIN_FLOW] [HUB] 🔔 Auth Hub Event Received
[LOGIN_FLOW] [HUB] Event Type: [event type]
[LOGIN_FLOW] [HUB] Event Payload: [payload]
```

#### **Step 2: Login Attempt (Success)**
```
[LOGIN_FLOW] ========================================
[LOGIN_FLOW] [HUB] 🔔 Auth Hub Event Received
[LOGIN_FLOW] [HUB] Event Type: AuthHubEventType.signedIn
[LOGIN_FLOW] [HUB] Event Payload: [user data]
[LOGIN_FLOW] ========================================
[LOGIN_FLOW] [HUB] ✅✅✅ USER SIGNED IN SUCCESSFULLY! ✅✅✅
[LOGIN_FLOW] [HUB] Event data: [payload]
[LOGIN_FLOW] [HUB] Triggering CheckUserGroups after sign in...
[LOGIN_FLOW] [STEP 2] AuthBloc: CheckUserGroups event received
[LOGIN_FLOW] [STEP 2.1] Emitting AuthLoading state...
[LOGIN_FLOW] [STEP 2.2] Checking if user is authenticated...
[LOGIN_FLOW] [STEP 2.2] ✅ User is authenticated
[LOGIN_FLOW] [STEP 2.2] User ID: [user-id]
[LOGIN_FLOW] [STEP 2.2] Username: [username]
[LOGIN_FLOW] [STEP 2.3] User authenticated, checking employee group membership...
[LOGIN_FLOW] [AUTH_SERVICE] checkIsEmployee() called
[LOGIN_FLOW] [AUTH_SERVICE] Getting current user...
[LOGIN_FLOW] [AUTH_SERVICE] ✅ Current user: [user-id]
[LOGIN_FLOW] [AUTH_SERVICE] Fetching auth session (fresh tokens)...
[LOGIN_FLOW] [AUTH_SERVICE] ✅ Session fetched
[LOGIN_FLOW] [AUTH_SERVICE] Session is CognitoAuthSession [session details]
[LOGIN_FLOW] [AUTH_SERVICE] Extracting ID token...
[LOGIN_FLOW] [AUTH_SERVICE] Parsing token claims... [token details]
[LOGIN_FLOW] [AUTH_SERVICE] Claims keys: [list of keys]
[LOGIN_FLOW] [AUTH_SERVICE] Groups value (raw): [groups] (type: [type])
[LOGIN_FLOW] [AUTH_SERVICE] Normalized groups: [normalized groups]
[LOGIN_FLOW] [AUTH_SERVICE] Is Employee: [true/false]
[LOGIN_FLOW] [AUTH_SERVICE] ✅ Group check complete
[LOGIN_FLOW] [STEP 2.3] Employee check result: [true/false]
```

#### **Step 3: Login Attempt (Failure - Wrong Credentials)**

When login fails with "Incorrect username or password":

```
ERROR | Authenticator | Error in AuthBloc: NotAuthorizedServiceException {
  "message": "Incorrect username or password.",
  "underlyingException": "NotAuthorizedException {
    message=Incorrect username or password.,
  }"
}
```

**What this means:**
- ✅ Amplify Authenticator is working
- ✅ Login attempt was made
- ❌ Credentials are incorrect
- ❌ AWS Cognito rejected the login

**Debug flow shows:**
```
[LOGIN_FLOW] [HUB] 🔔 Auth Hub Event Received
[LOGIN_FLOW] [HUB] Event Type: [error event]
[LOGIN_FLOW] [HUB] Event Payload: [error details]
[LOGIN_FLOW] [HUB] ⚠️ Other auth event: [event type]
```

**No signedIn event** = Login failed

---

### **Phase 4: After Successful Login**

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

---

## 🔍 Understanding Your Current Logs

Based on your logs:
```
I/flutter (10776): [LOGIN_FLOW] [MyApp] Building app widget...
I/flutter (10776): [LOGIN_FLOW] [MyApp] Creating AuthBloc and triggering CheckUserGroups...
I/flutter (10776): ERROR | Authenticator | Error in AuthBloc: NotAuthorizedServiceException {
  "message": "Incorrect username or password.",
}
```

**What happened:**
1. ✅ App started
2. ✅ AuthBloc created
3. ✅ CheckUserGroups triggered
4. ❌ **Login attempt failed** - Wrong credentials entered

**Missing logs:**
- You should see `[STEP 2.2]` logs (checking if user authenticated)
- You should see Hub events when login is attempted
- The error is from Authenticator's internal AuthBloc (not yours)

---

## 🎯 Complete Debug Flow Checklist

### **When App Starts:**
- [ ] `[LOGIN_FLOW] 🚀 APP STARTING`
- [ ] `[STEP 1]` Amplify configuration logs
- [ ] `[MyApp]` Building app widget
- [ ] `[STEP 2]` AuthBloc CheckUserGroups
- [ ] `[AppContent]` Initializing
- [ ] `[HUB]` Hub listener set up

### **When User is NOT Logged In:**
- [ ] `[STEP 2.2] ❌ User is NOT authenticated`
- [ ] `[AppContent]` Showing unauthenticated screen
- [ ] Login screen appears (Amplify Authenticator)

### **When User Tries to Login:**
- [ ] `[HUB] 🔔 Auth Hub Event Received` (when login button clicked)
- [ ] Either:
  - `[HUB] ✅✅✅ USER SIGNED IN SUCCESSFULLY!` (success)
  - `ERROR | Authenticator | Error` (failure)

### **After Successful Login:**
- [ ] `[HUB] ✅✅✅ USER SIGNED IN SUCCESSFULLY!`
- [ ] `[STEP 2.2] ✅ User is authenticated`
- [ ] `[STEP 2.3]` Checking employee group
- [ ] `[AUTH_SERVICE]` Group check logs
- [ ] `[STEP 2.5] ✅ Authentication successful!`
- [ ] `✅ LOGIN FLOW COMPLETE - USER LOGGED IN`

---

## 🐛 Troubleshooting Missing Logs

### **If you don't see Hub events:**
- Hub listener might not be set up
- Check: `[AppContent] ✅ Hub listener set up`

### **If you don't see STEP 2 logs:**
- AuthBloc might not be receiving events
- Check: `[MyApp] Triggering CheckUserGroups event...`

### **If you see error but no Hub event:**
- Error is from Authenticator's internal AuthBloc
- This is normal - Authenticator handles login UI internally
- Hub events fire after Authenticator processes login

---

## 📊 Log Filtering

**Filter for login flow only:**
```bash
flutter run | grep "\[LOGIN_FLOW\]"
```

**Filter for Hub events:**
```bash
flutter run | grep "\[HUB\]"
```

**Filter for errors:**
```bash
flutter run | grep "ERROR\|❌"
```

---

## 🔄 Expected Flow Diagram

```
App Start
  ↓
[STEP 1] Configure Amplify
  ↓
[STEP 2] Check User Groups
  ↓
User NOT authenticated?
  ↓ YES
Show Login Screen (Authenticator)
  ↓
User Enters Credentials
  ↓
[HUB] Login Attempt Event
  ↓
Credentials Valid?
  ↓ YES
[HUB] ✅ signedIn Event
  ↓
[STEP 2] Re-check Groups
  ↓
In Employees Group?
  ↓ YES
✅ Show Main App
```

---

**Last Updated**: Complete debug flow tracking added


# Debug: Authorization Header Not Being Sent

## Problem

Getting error: `"Valid authorization header not provided"`

This means the JWT token is **not being attached** to the GraphQL request.

---

## Root Cause Analysis

The `generateClient` from `aws-amplify/data` should automatically:
1. Get the current auth session
2. Extract the JWT token
3. Attach it as `Authorization: Bearer <token>` header

If this isn't happening, possible causes:

### 1. User Not Authenticated
- User session expired
- User not signed in
- Token not in session

### 2. Amplify Not Configured
- `Amplify.configure()` not called
- Wrong configuration
- `amplify_outputs.json` not loaded

### 3. Token Not Available When Client is Generated
- Client generated before user is authenticated
- Token expired between check and request
- Session not properly initialized

### 4. Amplify Version Issue
- Version mismatch between packages
- Bug in Amplify Gen 2 data client

---

## Debugging Steps

### Step 1: Check Browser Console

Look for the debug logs I added:
```javascript
Auth session: {
  hasToken: true/false,
  tokenExp: "...",
  tokenExpired: true/false,
  groups: [...],
  userId: "..."
}
```

**If `hasToken: false`:** User is not authenticated → Sign in

**If `tokenExpired: true`:** Token expired → Sign out and sign back in

### Step 2: Check Network Tab

1. Open DevTools → Network
2. Filter by "graphql"
3. Click on the failed request
4. Go to **Headers** tab
5. Look for `Authorization` header

**Expected:**
```
Authorization: Bearer eyJraWQiOiJcL1dlbGxLbm93bi5qc29uXCIsImFsZyI6IlJTMjU2In0...
```

**If missing:** Token is not being attached

### Step 3: Check Request Headers

In Network tab, check:
- **Request Headers** section
- Look for `authorization` (lowercase) or `Authorization`

### Step 4: Test Authentication Manually

In browser console:
```javascript
import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth';

// Check if user is authenticated
try {
  const user = await getCurrentUser();
  console.log('User:', user);
} catch (error) {
  console.error('Not authenticated:', error);
}

// Check token
const session = await fetchAuthSession({ forceRefresh: true });
console.log('Token:', session.tokens?.idToken);
console.log('Token string:', session.tokens?.idToken?.toString());
```

---

## Solutions

### Solution 1: Ensure User is Authenticated

The code now checks `getCurrentUser()` first to ensure user is authenticated.

### Solution 2: Force Token Refresh

The code uses `forceRefresh: true` to get a fresh token.

### Solution 3: Check Amplify Configuration

Verify `Amplify.configure()` is called **before** any components render:

```typescript
// In index.tsx
import { Amplify } from 'aws-amplify';
import outputs from './amplify_outputs.json';

Amplify.configure(outputs); // Must be before ReactDOM.render
```

### Solution 4: Verify amplify_outputs.json

Check that `amplify_outputs.json` has:
- `auth.user_pool_id`
- `auth.user_pool_client_id`
- `data.url`
- `data.default_authorization_type: "AMAZON_COGNITO_USER_POOLS"`

### Solution 5: Try Explicit Token Passing (If Needed)

If automatic token attachment doesn't work, you might need to pass it explicitly:

```typescript
// This is a workaround if generateClient doesn't attach token automatically
const session = await fetchAuthSession({ forceRefresh: true });
const token = session.tokens?.idToken?.toString();

if (!token) {
  throw new Error('No token available');
}

// Use the token in the request
// Note: This might require using the raw GraphQL client instead
```

---

## Common Issues

### Issue 1: Token Expired

**Symptom:** Token exists but request fails

**Fix:**
- Sign out completely
- Sign back in
- Token will be refreshed

### Issue 2: User Not in Session

**Symptom:** `getCurrentUser()` throws error

**Fix:**
- Ensure user is signed in
- Check Authenticator component is working
- Verify Cognito User Pool is correct

### Issue 3: Amplify Not Configured

**Symptom:** `generateClient` fails or doesn't attach token

**Fix:**
- Ensure `Amplify.configure(outputs)` is called
- Check `amplify_outputs.json` is imported correctly
- Verify configuration is loaded before components

### Issue 4: Version Mismatch

**Symptom:** `generateClient` doesn't work as expected

**Fix:**
- Check package versions:
  ```bash
  npm list aws-amplify @aws-amplify/ui-react
  ```
- Update to latest versions:
  ```bash
  npm update aws-amplify @aws-amplify/ui-react
  ```

---

## Test Script

Add this to your component to test:

```typescript
useEffect(() => {
  const testAuth = async () => {
    try {
      const { fetchAuthSession, getCurrentUser } = await import('aws-amplify/auth');
      
      // Test 1: Check user
      const user = await getCurrentUser();
      console.log('✅ User authenticated:', user.username);
      
      // Test 2: Check token
      const session = await fetchAuthSession({ forceRefresh: true });
      console.log('✅ Has token:', !!session.tokens?.idToken);
      console.log('✅ Token exp:', new Date(session.tokens?.idToken?.payload?.exp * 1000));
      
      // Test 3: Check groups
      const groups = session.tokens?.idToken?.payload?.['cognito:groups'];
      console.log('✅ Groups:', groups);
      
      // Test 4: Try generateClient
      const { generateClient } = await import('aws-amplify/data');
      const client = generateClient<Schema>({ authMode: 'userPool' });
      console.log('✅ Client generated:', !!client);
      
    } catch (error) {
      console.error('❌ Auth test failed:', error);
    }
  };
  
  testAuth();
}, []);
```

---

## Next Steps

1. **Check browser console** for debug logs
2. **Check Network tab** for Authorization header
3. **Sign out and sign back in** to refresh token
4. **Check if user is in SuperAdmin group**
5. **Verify Amplify configuration** is loaded

---

## If Still Not Working

1. **Clear browser cache and cookies**
2. **Restart the dev server**
3. **Check Amplify package versions**
4. **Try in incognito mode** to rule out cache issues
5. **Check browser console for any errors**

---

**The most common fix is signing out and signing back in to refresh the token!**


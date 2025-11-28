# Fix: Missing Authorization Header (401 Unauthorized)

## Problem

**Error:** `401 Unauthorized - Valid authorization header not provided.`

The GraphQL request is not including the Authorization header with the JWT token.

## Root Causes

1. **User not authenticated** - The user might not be signed in
2. **Token not available** - The auth session might not have a token
3. **Client generated before auth** - The client might be generated before authentication is complete
4. **Token expired** - The token might have expired

## Fixes Applied ✅

### 1. Added Authentication Check Before Requests

Updated `BusinessUnitList.tsx` and `BusinessUnitForm.tsx` to:
- ✅ Check if user is authenticated before making requests
- ✅ Force refresh the auth session to get latest token
- ✅ Throw clear error if user is not authenticated

### 2. Verify User is Signed In

The code now checks:
```typescript
const session = await fetchAuthSession({ forceRefresh: true });

if (!session.tokens || !session.tokens.idToken) {
  throw new Error('User is not authenticated. Please sign in again.');
}
```

## Troubleshooting Steps

### Step 1: Verify You're Signed In

Check in browser console:
```javascript
import { fetchAuthSession } from 'aws-amplify/auth';
const session = await fetchAuthSession({ forceRefresh: true });
console.log('Has token:', !!session.tokens?.idToken);
console.log('User ID:', session.userSub);
```

### Step 2: Check Token in Network Tab

1. Open DevTools → **Network** tab
2. Make a request (try to list BusinessUnits)
3. Click on the request
4. Check **Headers** tab
5. Look for **Authorization** header
   - ✅ Should have: `Authorization: Bearer <token>`
   - ❌ If missing: User is not authenticated

### Step 3: Sign Out and Sign Back In

If token is missing:
1. **Sign out** completely
2. **Sign back in**
3. Try the request again

### Step 4: Check Amplify Configuration

Verify `amplify_outputs.json` is loaded:
```javascript
import outputs from './amplify_outputs.json';
console.log('Auth config:', outputs.auth);
```

### Step 5: Check Browser Console for Errors

Look for:
- Authentication errors
- Token refresh errors
- Amplify configuration errors

## Common Issues

### Issue 1: User Not Signed In

**Symptom:** No Authorization header in request

**Fix:** Sign in through the Authenticator component

### Issue 2: Token Expired

**Symptom:** 401 error even though user is signed in

**Fix:** 
```typescript
// Force refresh token
const session = await fetchAuthSession({ forceRefresh: true });
```

### Issue 3: Client Generated Before Auth

**Symptom:** Client exists but no token attached

**Fix:** Always check authentication before generating client (already fixed)

### Issue 4: Wrong amplify_outputs.json

**Symptom:** Auth config doesn't match

**Fix:** Ensure you're using the correct `amplify_outputs.json` file

## Verification

After fixes, the request should include:
```
Authorization: Bearer eyJraWQiOiJ...
```

And the response should be successful (200 OK) instead of 401.

---

**Status:** ✅ Code updated to check authentication before requests. **Make sure you're signed in!**


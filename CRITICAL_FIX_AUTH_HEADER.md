# Critical Fix: Authorization Header Not Being Sent

## The Problem

Error: `"Valid authorization header not provided"`

This means the JWT token is **NOT being sent** with the GraphQL request to AppSync.

---

## What I've Done

1. ✅ Added `getCurrentUser()` check to ensure user is authenticated
2. ✅ Added token expiration check
3. ✅ Added comprehensive debug logging
4. ✅ Verified Amplify configuration is correct

---

## What You Need to Do NOW

### Step 1: Check Browser Console

Open DevTools → Console and look for:
```
Auth session: {
  hasToken: true/false,
  tokenExp: "...",
  tokenExpired: true/false,
  groups: [...],
  userId: "...",
  tokenString: "..."
}
```

**Share this output with me!**

### Step 2: Check Network Tab

1. Open DevTools → Network
2. Filter by "graphql"
3. Click on the failed request
4. Go to **Headers** tab
5. Look for `Authorization` header

**Is it there? What does it say?**

### Step 3: Try These Fixes

#### Fix 1: Sign Out and Sign Back In

1. Click "Sign Out" in your app
2. Clear browser cache (optional)
3. Sign back in
4. Try the request again

#### Fix 2: Check if User is in SuperAdmin Group

Run in browser console:
```javascript
import { fetchAuthSession } from 'aws-amplify/auth';
const session = await fetchAuthSession({ forceRefresh: true });
const groups = session.tokens?.idToken?.payload?.['cognito:groups'];
console.log('Groups:', groups);
```

**Should show:** `['SuperAdmin']` or `['SuperAdmin', ...]`

If not, add user to SuperAdmin group:
```bash
./create-superadmin.sh <your-email>
```

Then sign out and sign back in.

#### Fix 3: Verify Amplify Configuration

In browser console:
```javascript
import { Amplify } from 'aws-amplify';
console.log('Amplify config:', Amplify.getConfig());
```

Check that:
- `Auth` section has `userPoolId`
- `API` section has `GraphQL` endpoint

---

## Possible Root Causes

### 1. Token Not Being Attached by generateClient

**Symptom:** Token exists but Authorization header is missing

**Possible Fix:** This might be an Amplify Gen 2 bug. Try:
- Update Amplify packages
- Use a different approach to pass token

### 2. Amplify Not Properly Initialized

**Symptom:** `generateClient` doesn't have access to auth context

**Fix:** Ensure `Amplify.configure()` is called before any components render

### 3. Token Format Issue

**Symptom:** Token exists but AppSync rejects it

**Fix:** Check token format and ensure it's a valid JWT

### 4. CORS Issue

**Symptom:** Browser blocks Authorization header

**Fix:** Check AppSync CORS settings

---

## Alternative: Manual Token Passing (If Needed)

If `generateClient` isn't attaching the token automatically, we might need to use the raw GraphQL client:

```typescript
import { post } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth';

const session = await fetchAuthSession({ forceRefresh: true });
const token = session.tokens?.idToken?.toString();

const response = await post({
  apiName: 'MyGraphQLAPI',
  path: '/graphql',
  options: {
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: {
      query: 'query { listBusinessUnits { items { id name } } }'
    }
  }
});
```

But this should NOT be necessary - `generateClient` should handle this automatically.

---

## Next Steps

1. **Share the console logs** from the "Auth session" output
2. **Share the Network tab** screenshot showing if Authorization header exists
3. **Try signing out and back in**
4. **Check if user is in SuperAdmin group**

Once I have this information, I can provide a more targeted fix!

---

**The debug logs I added will help us identify exactly where the issue is!**


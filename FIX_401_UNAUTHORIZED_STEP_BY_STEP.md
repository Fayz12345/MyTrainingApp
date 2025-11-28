# Fix 401 Unauthorized - Step by Step Guide

## Current Status

✅ **Authorization Rules:** CORRECT
- Schema: SuperAdmin has create, read, update, delete
- Outputs: SuperAdmin has create, read, update, delete

❌ **Still Getting:** 401 Unauthorized

## Root Cause Analysis

The 401 error means one of these issues:

1. **User not in SuperAdmin group** (most common)
2. **JWT token doesn't have group claims** (token issued before joining group)
3. **Token expired or invalid**
4. **Authorization header not sent** (already fixed in code)

## Step-by-Step Fix

### Step 1: Verify User is in SuperAdmin Group

Run the debug script:
```bash
./debug-unauthorized.sh
```

Or manually check:
```bash
./check-user-groups.sh <your-email>
```

**Expected:** Should show SuperAdmin in the list

**If NOT in SuperAdmin:**
```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id ca-central-1_aKCLbCdhj \
  --username <your-email> \
  --group-name SuperAdmin \
  --region ca-central-1 \
  --profile amplify
```

### Step 2: Check Token in Browser

I've added an `AuthDebug` component to your SuperAdminDashboard. It will show:
- ✅ If you have a token
- ✅ Your user ID and email
- ✅ Groups in your token
- ✅ If you're in SuperAdmin
- ✅ Token expiration

**Look at the dashboard** - you should see the debug info at the top.

### Step 3: Sign Out and Sign Back In

**CRITICAL:** After adding to SuperAdmin group, you MUST:

1. **Sign out completely** from the app
2. **Wait 2-3 seconds**
3. **Sign back in** with the same credentials
4. This issues a NEW JWT token with group claims

### Step 4: Verify Token Has Groups

After signing back in, check the `AuthDebug` component or browser console:

```javascript
import { fetchAuthSession } from 'aws-amplify/auth';
const session = await fetchAuthSession({ forceRefresh: true });
const groups = session.tokens?.idToken?.payload['cognito:groups'];
console.log('Groups in token:', groups);
```

**Expected:** `["SuperAdmin"]`

**If empty or missing:** Token doesn't have groups - sign out/in again

### Step 5: Test the Query

Click the "🧪 Test BusinessUnit Query" button in the AuthDebug component.

**If it works:** The issue was token-related
**If it fails:** Check the error message

## Common Issues and Fixes

### Issue 1: User Not in SuperAdmin

**Symptom:** AuthDebug shows "Is SuperAdmin: ❌ No"

**Fix:**
1. Add user to SuperAdmin (Step 1)
2. Sign out and sign back in

### Issue 2: Token Doesn't Have Groups

**Symptom:** Groups in token is empty or doesn't include SuperAdmin

**Fix:**
1. Sign out completely
2. Clear browser cache (optional)
3. Sign back in
4. Check again

### Issue 3: Token Expired

**Symptom:** Token expiration date is in the past

**Fix:**
1. Sign out and sign back in
2. Or use `forceRefresh: true` when fetching session

### Issue 4: Wrong User Pool

**Symptom:** User is in SuperAdmin but token doesn't reflect it

**Fix:**
1. Verify you're using the correct Cognito User Pool
2. Check `amplify_outputs.json` has correct `user_pool_id`
3. Sign out and sign back in

## Quick Checklist

- [ ] User is in SuperAdmin group (check with `./check-user-groups.sh`)
- [ ] Signed out completely
- [ ] Signed back in
- [ ] Token has SuperAdmin group (check AuthDebug component)
- [ ] Test query works (click test button in AuthDebug)

## Debug Tools Available

1. **`./debug-unauthorized.sh`** - Comprehensive CLI debug script
2. **`AuthDebug` component** - Real-time auth info in UI
3. **`./check-user-groups.sh`** - Quick group check
4. **Browser console** - Check token directly

## Still Not Working?

If you've done all steps and still getting 401:

1. **Check Network Tab:**
   - Open DevTools → Network
   - Make a request
   - Check if `Authorization` header is present
   - Check the response error details

2. **Check AppSync Console:**
   - Go to AWS Console → AppSync
   - Check the API logs
   - Look for authorization errors

3. **Verify amplify_outputs.json:**
   - Check `data.url` is correct
   - Check `data.aws_appsync_graphql_api_id` is correct
   - Check `auth.user_pool_id` is correct

4. **Check Backend Deployment:**
   - Verify backend is deployed
   - Check if schema changes are synced

---

**The AuthDebug component is now in your dashboard - use it to see exactly what's happening!**


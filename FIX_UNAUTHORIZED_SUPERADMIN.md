# Fix: Unauthorized Error for SuperAdmin

## Problem

**Error:** `Failed to fetch business units: Unauthorized`

**User Status:** Logged in as SuperAdmin

## Root Causes

1. **JWT Token Missing Group Claims** - The user's JWT token might not have `cognito:groups` claim if:
   - User was added to SuperAdmin group AFTER logging in
   - Token hasn't been refreshed since being added to the group

2. **Missing authMode in Query** - The GraphQL query wasn't explicitly using `authMode: 'userPool'`

3. **Token Cache** - Amplify might be using a cached token without group claims

## Fixes Applied ✅

### 1. Added authMode to BusinessUnit Queries

Updated `BusinessUnitList.tsx`:
- ✅ Added `authMode: 'userPool'` to `list()` query
- ✅ Added `authMode: 'userPool'` to `delete()` mutation

### 2. Verify User is in SuperAdmin Group

Check if your user is actually in SuperAdmin:

```bash
./check-user-groups.sh <your-email>
```

### 3. Force Token Refresh

The frontend code already uses `forceRefresh: true` when checking user role, but you need to:

1. **Sign out completely**
2. **Sign back in** to get a fresh token with group claims

Or in the browser console:
```javascript
import { signOut, signIn } from 'aws-amplify/auth';
await signOut();
// Then sign in again
```

## Why This Happens

When a user is added to a Cognito group **after** they've already logged in, their existing JWT token doesn't include the new group membership. The token needs to be refreshed (by signing out and back in) to include the updated group claims.

## Verification Steps

1. **Check user groups:**
   ```bash
   ./check-user-groups.sh <your-email>
   ```

2. **If not in SuperAdmin, add:**
   ```bash
   aws cognito-idp admin-add-user-to-group \
     --user-pool-id ca-central-1_aKCLbCdhj \
     --username <your-email> \
     --group-name SuperAdmin \
     --region ca-central-1 \
     --profile amplify
   ```

3. **Sign out and sign back in** to refresh token

4. **Check token groups** (in browser console):
   ```javascript
   import { fetchAuthSession } from 'aws-amplify/auth';
   const session = await fetchAuthSession({ forceRefresh: true });
   console.log('Groups:', session.tokens?.idToken?.payload['cognito:groups']);
   ```

## Expected Result

After signing out and back in, the token should include:
```json
{
  "cognito:groups": ["SuperAdmin"]
}
```

And the BusinessUnit queries should work!

---

**Status:** ✅ Code fixed. **You need to sign out and sign back in to refresh your token!**


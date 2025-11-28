# Fix: "Valid authorization header not provided" Error

## Problem

Getting 401 Unauthorized with error:
```
"Valid authorization header not provided."
```

This means the JWT token is **not being sent** with the GraphQL request.

---

## Root Cause

The `generateClient` from `aws-amplify/data` should automatically attach the authentication token, but there might be an issue with:

1. **Token not being retrieved** from the current session
2. **Amplify configuration** not properly set up
3. **Token expired** or invalid
4. **Client generation** happening before authentication is complete

---

## Solution 1: Verify Amplify Configuration

Make sure `Amplify.configure()` is called **before** any component renders:

```typescript
// In index.tsx or App.tsx
import { Amplify } from 'aws-amplify';
import outputs from './amplify_outputs.json';

Amplify.configure(outputs);
```

✅ **Your code already does this correctly!**

---

## Solution 2: Ensure User is Authenticated

Before making GraphQL requests, verify the user is authenticated:

```typescript
const session = await fetchAuthSession({ forceRefresh: true });

if (!session.tokens || !session.tokens.idToken) {
  throw new Error('User is not authenticated. Please sign in again.');
}
```

✅ **Your code already does this!**

---

## Solution 3: Check Token Expiration

The token might be expired. Check in browser console:

```javascript
import { fetchAuthSession } from 'aws-amplify/auth';

const session = await fetchAuthSession({ forceRefresh: true });
const token = session.tokens?.idToken;

console.log('Token exp:', new Date(token.payload.exp * 1000));
console.log('Token now:', new Date());
console.log('Token expired?', Date.now() > token.payload.exp * 1000);
```

**If expired:** Sign out and sign back in.

---

## Solution 4: Verify generateClient Configuration

The `generateClient` should automatically use the current auth session. Make sure:

1. **Amplify is configured** before generating client
2. **User is authenticated** before making requests
3. **authMode is set** to 'userPool'

```typescript
// This should work automatically
const client = generateClient<Schema>({
  authMode: 'userPool'
});

// The client should automatically attach the token from the current session
const result = await client.models.BusinessUnit.list();
```

---

## Solution 5: Check Browser Network Tab

1. Open browser DevTools → Network tab
2. Make the request
3. Check the request headers
4. Look for `Authorization` header

**Expected:**
```
Authorization: eyJraWQiOiJcL1dlbGxLbm93bi5qc29uXCIsImFsZyI6IlJTMjU2In0...
```

**If missing:** The token isn't being attached.

---

## Solution 6: Force Token Refresh

If token is stale, force a refresh:

```typescript
// Force refresh before making request
const session = await fetchAuthSession({ forceRefresh: true });

// Then generate client
const client = generateClient<Schema>({
  authMode: 'userPool'
});
```

---

## Solution 7: Check Amplify Outputs Configuration

Verify `amplify_outputs.json` has correct auth configuration:

```json
{
  "auth": {
    "user_pool_id": "ca-central-1_aKCLbCdhj",
    "user_pool_client_id": "1kljta9eftlgp8dqa9rv3e0chv",
    "aws_region": "ca-central-1"
  },
  "data": {
    "url": "https://...",
    "default_authorization_type": "AMAZON_COGNITO_USER_POOLS"
  }
}
```

---

## Debugging Steps

### Step 1: Check if User is Authenticated

```typescript
import { fetchAuthSession } from 'aws-amplify/auth';

const session = await fetchAuthSession({ forceRefresh: true });
console.log('Has token:', !!session.tokens?.idToken);
console.log('Token payload:', session.tokens?.idToken?.payload);
```

### Step 2: Check Token Groups

```typescript
const groups = session.tokens?.idToken?.payload?.['cognito:groups'];
console.log('User groups:', groups);
```

### Step 3: Test GraphQL Query Manually

```typescript
const client = generateClient<Schema>({ authMode: 'userPool' });

try {
  const result = await client.models.BusinessUnit.list();
  console.log('Success:', result);
} catch (error) {
  console.error('Error:', error);
  console.error('Error details:', JSON.stringify(error, null, 2));
}
```

### Step 4: Check Network Request

1. Open DevTools → Network
2. Filter by "graphql"
3. Click on the failed request
4. Check:
   - **Headers** → Look for `Authorization` header
   - **Payload** → Check the GraphQL query
   - **Response** → Check error message

---

## Common Issues

### Issue 1: Token Not in Session

**Symptom:** `session.tokens` is null or undefined

**Fix:**
- Sign out completely
- Sign back in
- Check if token is now in session

### Issue 2: Token Expired

**Symptom:** Token exists but is expired

**Fix:**
- Sign out and sign back in
- Or use `forceRefresh: true` to get new token

### Issue 3: Amplify Not Configured

**Symptom:** `generateClient` fails or doesn't attach token

**Fix:**
- Ensure `Amplify.configure(outputs)` is called before any component renders
- Check that `amplify_outputs.json` is imported correctly

### Issue 4: Wrong Auth Mode

**Symptom:** Token exists but request still fails

**Fix:**
- Ensure `authMode: 'userPool'` is set
- Check that AppSync API uses `AMAZON_COGNITO_USER_POOLS` auth

---

## Quick Fix Checklist

- [ ] User is signed in
- [ ] `Amplify.configure()` is called before components render
- [ ] `amplify_outputs.json` is imported and correct
- [ ] Token exists in session (`session.tokens?.idToken`)
- [ ] Token is not expired
- [ ] `generateClient` uses `authMode: 'userPool'`
- [ ] User is in SuperAdmin group (for BusinessUnit access)
- [ ] AppSync API uses Cognito User Pool auth

---

## Test Script

Add this to your component to debug:

```typescript
useEffect(() => {
  const debugAuth = async () => {
    try {
      const { fetchAuthSession } = await import('aws-amplify/auth');
      const session = await fetchAuthSession({ forceRefresh: true });
      
      console.log('=== AUTH DEBUG ===');
      console.log('Has token:', !!session.tokens?.idToken);
      console.log('Token exp:', session.tokens?.idToken?.payload?.exp);
      console.log('Token now:', Math.floor(Date.now() / 1000));
      console.log('Token expired:', Date.now() > (session.tokens?.idToken?.payload?.exp || 0) * 1000);
      console.log('Groups:', session.tokens?.idToken?.payload?.['cognito:groups']);
      console.log('===============');
    } catch (error) {
      console.error('Auth debug error:', error);
    }
  };
  
  debugAuth();
}, []);
```

---

## If Still Not Working

1. **Clear browser cache and cookies**
2. **Sign out completely**
3. **Sign back in**
4. **Check browser console** for any errors
5. **Check Network tab** to see if Authorization header is sent
6. **Verify user is in SuperAdmin group** in Cognito Console

---

**The most common cause is an expired token or user not being properly authenticated. Sign out and sign back in!**

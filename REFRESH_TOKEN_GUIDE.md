# How to Refresh JWT Token After Adding User to SuperAdmin

## The Problem

When you add a user to the SuperAdmin group **after** they've already logged in, their existing JWT token doesn't include the new group membership. This causes "Unauthorized" errors even though the user is in SuperAdmin.

## Solution: Refresh the Token

### Option 1: Sign Out and Sign Back In (Recommended)

1. **Sign out** from your app
2. **Sign back in** with the same credentials
3. The new token will include `cognito:groups: ["SuperAdmin"]`

### Option 2: Force Token Refresh in Code

If you want to refresh without signing out, you can force a token refresh:

```javascript
import { fetchAuthSession } from 'aws-amplify/auth';

// Force refresh the session
const session = await fetchAuthSession({ forceRefresh: true });

// Check groups
const groups = session.tokens?.idToken?.payload['cognito:groups'];
console.log('User groups:', groups);
```

### Option 3: Clear Browser Storage

1. Open browser DevTools (F12)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Clear **Local Storage** and **Session Storage**
4. Refresh the page and sign in again

## Verify Token Has Groups

Check in browser console:

```javascript
import { fetchAuthSession } from 'aws-amplify/auth';

const session = await fetchAuthSession({ forceRefresh: true });
const token = session.tokens?.idToken?.payload;

console.log('User groups:', token['cognito:groups']);
console.log('Full token payload:', token);
```

**Expected output:**
```javascript
User groups: ["SuperAdmin"]
```

## Why This Happens

JWT tokens are **stateless** and contain claims at the time of issue. When you:
1. Log in → Token issued with current groups
2. Add user to SuperAdmin → User is in group, but token still has old claims
3. Make request → AppSync checks token, doesn't see SuperAdmin → Unauthorized

**Solution:** Get a new token by signing out/in or forcing refresh.

## Quick Fix Script

Add this to your app to automatically refresh token on load:

```javascript
// In your main App component or index.tsx
useEffect(() => {
  const refreshToken = async () => {
    try {
      const { fetchAuthSession } = await import('aws-amplify/auth');
      await fetchAuthSession({ forceRefresh: true });
    } catch (error) {
      console.error('Error refreshing token:', error);
    }
  };
  
  refreshToken();
}, []);
```

---

**Bottom Line:** Sign out and sign back in to get a fresh token with SuperAdmin group! 🔄


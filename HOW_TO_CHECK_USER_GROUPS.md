# How to Check Which Groups User is Logged In

## Method 1: Browser Console (Quick Check)

Open your browser's Developer Console (F12) and run:

```javascript
import { fetchAuthSession } from 'aws-amplify/auth';

const session = await fetchAuthSession({ forceRefresh: true });
const token = session.tokens?.idToken?.payload;

console.log('User groups:', token['cognito:groups']);
console.log('User ID:', token['sub']);
console.log('Email:', token['email']);
console.log('Full token:', token);
```

**Expected output:**
```javascript
User groups: ["SuperAdmin"]  // or ["Managers"], ["BusinessUnit"], etc.
```

---

## Method 2: Check in React Component

Add this to any component:

```typescript
import { useEffect, useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';

const [userGroups, setUserGroups] = useState<string[]>([]);

useEffect(() => {
  const checkGroups = async () => {
    try {
      const session = await fetchAuthSession({ forceRefresh: true });
      let groups = session.tokens?.idToken?.payload['cognito:groups'];
      
      if (typeof groups === 'string') {
        groups = [groups];
      } else if (!Array.isArray(groups)) {
        groups = [];
      }
      
      setUserGroups(groups as string[]);
      console.log('User groups:', groups);
    } catch (error) {
      console.error('Error checking groups:', error);
    }
  };
  
  checkGroups();
}, []);

// Display groups
console.log('Current user groups:', userGroups);
```

---

## Method 3: AWS CLI (Check User in Cognito)

### Check by Username/Email:

```bash
./check-user-groups.sh <your-email>
```

Or manually:
```bash
aws cognito-idp admin-list-groups-for-user \
  --user-pool-id ca-central-1_aKCLbCdhj \
  --username <your-email> \
  --region ca-central-1 \
  --profile amplify
```

### List All Users in SuperAdmin Group:

```bash
aws cognito-idp list-users-in-group \
  --user-pool-id ca-central-1_aKCLbCdhj \
  --group-name SuperAdmin \
  --region ca-central-1 \
  --profile amplify
```

---

## Method 4: Create a Debug Component

I'll create a component you can add to your app to always see your groups.

---

## Method 5: Check in Network Tab

1. Open DevTools → **Network** tab
2. Filter by **graphql** or **appsync**
3. Make a request (e.g., list BusinessUnits)
4. Click on the request
5. Go to **Headers** tab
6. Look for **Authorization** header
7. Copy the JWT token (the part after "Bearer ")
8. Go to https://jwt.io
9. Paste the token in the "Encoded" section
10. Look for `cognito:groups` in the payload

---

## Quick Script to Check Current User

Run this in browser console:

```javascript
(async () => {
  try {
    const { fetchAuthSession } = await import('aws-amplify/auth');
    const session = await fetchAuthSession({ forceRefresh: true });
    const token = session.tokens?.idToken?.payload;
    
    console.log('=== User Information ===');
    console.log('User ID:', token['sub']);
    console.log('Email:', token['email']);
    console.log('Groups:', token['cognito:groups'] || 'No groups found');
    console.log('Is SuperAdmin:', (token['cognito:groups'] || []).includes('SuperAdmin'));
    console.log('Token issued at:', new Date(token['iat'] * 1000));
    console.log('Token expires at:', new Date(token['exp'] * 1000));
    
    return {
      userId: token['sub'],
      email: token['email'],
      groups: token['cognito:groups'] || [],
      isSuperAdmin: (token['cognito:groups'] || []).includes('SuperAdmin')
    };
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
})();
```

---

## Common Issues

### Issue 1: Groups is `undefined`

**Cause:** Token doesn't have group claims

**Fix:** 
1. Verify user is in the group (AWS CLI)
2. Sign out and sign back in
3. Use `forceRefresh: true` when fetching session

### Issue 2: Groups is a String Instead of Array

**Fix:**
```javascript
let groups = token['cognito:groups'];
if (typeof groups === 'string') {
  groups = [groups];
}
```

### Issue 3: Token is Old

**Fix:** Use `forceRefresh: true`:
```javascript
const session = await fetchAuthSession({ forceRefresh: true });
```

---

## Expected Groups

Based on your setup, users can be in:
- **SuperAdmin** (precedence: 4) - Full access
- **BusinessUnit** (precedence: 3) - Manage stores
- **Store** (precedence: 2) - Manage managers
- **Managers** (precedence: 1) - Manage courses and employees
- **Employees** (precedence: 0) - Take courses

---

## Quick Check Commands

**In Browser Console:**
```javascript
import { fetchAuthSession } from 'aws-amplify/auth';
(await fetchAuthSession({ forceRefresh: true })).tokens?.idToken?.payload['cognito:groups']
```

**Via CLI:**
```bash
./check-user-groups.sh <email>
```

**In Code:**
```typescript
const session = await fetchAuthSession({ forceRefresh: true });
const groups = session.tokens?.idToken?.payload['cognito:groups'];
```


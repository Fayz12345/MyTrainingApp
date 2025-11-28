# SuperAdmin Access to BusinessUnit - Verified ✅

## Authorization Rules Status

### Schema (amplify/data/resource.ts)
✅ **SuperAdmin** has: `create, read, update, delete`

### Outputs (amplify_outputs.json)
✅ **SuperAdmin** has: `create, read, update, delete`

## CRUD Operations Available

| Operation | Status | Method |
|-----------|--------|--------|
| **Create** | ✅ Available | `client.models.BusinessUnit.create()` |
| **Read** | ✅ Available | `client.models.BusinessUnit.list()` |
| **Update** | ✅ Available | `client.models.BusinessUnit.update()` |
| **Delete** | ✅ Available | `client.models.BusinessUnit.delete()` |

## UI Features Added

1. ✅ **Create** - BusinessUnitForm (create mode)
2. ✅ **Read** - BusinessUnitList (displays all)
3. ✅ **Update** - BusinessUnitForm (edit mode) - **NEW**
4. ✅ **Delete** - Delete button in BusinessUnitList

## If Still Getting 401 Unauthorized

### Step 1: Verify User is in SuperAdmin Group

```bash
./check-user-groups.sh <your-email>
```

Expected output:
```
✅ User groups:
  - SuperAdmin (precedence: 4)
```

### Step 2: If NOT in SuperAdmin, Add User

```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id ca-central-1_aKCLbCdhj \
  --username <your-email> \
  --group-name SuperAdmin \
  --region ca-central-1 \
  --profile amplify
```

### Step 3: Refresh Token

**CRITICAL:** After adding to group, you MUST:

1. **Sign out** completely from the app
2. **Sign back in** with the same credentials
3. This refreshes the JWT token to include `cognito:groups: ["SuperAdmin"]`

### Step 4: Verify Token Has Groups

In browser console:
```javascript
import { fetchAuthSession } from 'aws-amplify/auth';
const session = await fetchAuthSession({ forceRefresh: true });
const groups = session.tokens?.idToken?.payload['cognito:groups'];
console.log('Groups in token:', groups);
```

Should show: `["SuperAdmin"]`

### Step 5: Check Network Request

1. Open DevTools → Network tab
2. Make a request (list BusinessUnits)
3. Check the request headers
4. Should see: `Authorization: Bearer <token>`
5. Decode token at https://jwt.io
6. Look for `"cognito:groups": ["SuperAdmin"]`

## Why Authorization Might Fail

1. **User not in SuperAdmin group** - Most common
2. **Token doesn't have group claims** - Need to sign out/in
3. **Token expired** - Force refresh should fix
4. **Wrong amplify_outputs.json** - Ensure using correct file
5. **AppSync schema not synced** - Backend needs redeploy

## Verification Script

Run:
```bash
./verify-superadmin-access.sh
```

This checks:
- ✅ Schema authorization rules
- ✅ Outputs authorization rules
- ✅ Provides instructions to fix issues

---

**Status:** ✅ All authorization rules are correct. SuperAdmin has full CRUD access to BusinessUnit.

**If still failing:** The issue is likely that your user is not in SuperAdmin group or your token doesn't have the group claim. Follow the steps above to fix.


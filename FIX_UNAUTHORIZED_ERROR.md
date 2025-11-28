# Fix: Unauthorized Error for BusinessUnit

## Problem

**Error:** `Failed to fetch business units: Unauthorized`

**Expected:** SuperAdmin should be able to see and create BusinessUnit

## Root Cause

The `model_introspection` for BusinessUnit, Store, and Manager had **incorrect authorization rules**. When I manually added these models, I copied the auth rules from Course (which only has Managers and Employees), instead of using the correct rules from the schema.

## Fix Applied ✅

I've updated the authorization rules in `amplify_outputs.json`:

### BusinessUnit Authorization (Fixed)
- ✅ **SuperAdmin**: create, read, update, delete
- ✅ **BusinessUnit**: read
- ✅ **Store**: read
- ✅ **Managers**: read

### Store Authorization (Fixed)
- ✅ **SuperAdmin**: create, read, update, delete
- ✅ **BusinessUnit**: create, read, update, delete
- ✅ **Store**: read
- ✅ **Managers**: read

### Manager Authorization (Fixed)
- ✅ **SuperAdmin**: create, read, update, delete
- ✅ **BusinessUnit**: read
- ✅ **Store**: create, read, update, delete
- ✅ **Managers**: read

## Next Steps

### 1. Verify User is in SuperAdmin Group

Check if your user is in the SuperAdmin group:

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

### 2. If User is NOT in SuperAdmin Group

Add the user to SuperAdmin:

```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id ca-central-1_aKCLbCdhj \
  --username <your-email> \
  --group-name SuperAdmin \
  --region ca-central-1 \
  --profile amplify
```

### 3. If User IS in SuperAdmin Group

1. **Restart your app** to reload the updated `amplify_outputs.json`
2. **Sign out and sign back in** to refresh the JWT token with group claims
3. Try accessing BusinessUnit again

## Why This Happened

When I manually added BusinessUnit, Store, and Manager to `model_introspection`, I used Course's authorization rules as a template, which only included Managers and Employees. The correct rules from the schema (including SuperAdmin) weren't copied.

## Verification

Check the authorization rules:

```bash
jq '.data.model_introspection.models.BusinessUnit.attributes[] | select(.type == "auth")' amplify_outputs.json
```

You should see SuperAdmin in the groups list.

---

**Status:** ✅ Authorization rules fixed. Make sure your user is in SuperAdmin group and restart the app!


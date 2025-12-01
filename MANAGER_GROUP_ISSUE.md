# Manager Cognito Group Assignment Issue

## Problem
When SuperAdmin creates a manager:
- ✅ Manager record is saved to the database
- ❌ User is NOT added to the "Managers" Cognito group (FIXED - see below)

## Root Cause
The external Lambda function (`https://zwkht7afhzzv777hxn6xx56vry0uniix.lambda-url.ca-central-1.on.aws/`) creates the Cognito user but:
1. Does NOT set the `custom:role="manager"` attribute
2. Does NOT add the user to the "Managers" group directly

The post-confirmation trigger checks for `custom:role` attribute, but since it's not set, it defaults to adding the user to the "Employees" group.

## ✅ SOLUTION IMPLEMENTED

**Automatic Assignment via Database Check**

The post-confirmation trigger (`assignEmployeeGroup/handler.js`) has been updated to:
1. Check for `custom:role` attribute (primary method)
2. If not found, wait 3 seconds for the Manager record to be created in the database
3. Query the AppSync GraphQL API to check if a Manager record exists with the user's `userId`
4. If a Manager record is found, automatically assign the user to the "Managers" group

**How it works:**
- When SuperAdmin creates a manager, the user is created in Cognito
- The post-confirmation trigger fires
- After a 3-second delay (to allow the Manager record to be created), the trigger queries the database
- If a Manager record is found, the user is automatically added to the "Managers" group

**Result:** ✅ Managers created by SuperAdmin are now automatically assigned to the "Managers" Cognito group!

## Solutions

### Solution 1: Update External Lambda Function (RECOMMENDED)
Update the external Lambda function to either:

**Option A: Set custom:role attribute**
```javascript
await cognitoClient.send(new AdminUpdateUserAttributesCommand({
  UserPoolId: userPoolId,
  Username: email,
  UserAttributes: [
    { Name: 'custom:role', Value: 'manager' }
  ]
}));
```

**Option B: Add user to Managers group directly**
```javascript
await cognitoClient.send(new AdminAddUserToGroupCommand({
  UserPoolId: userPoolId,
  Username: email,
  GroupName: 'Managers'
}));
```

### Solution 2: Manual Addition (IMMEDIATE FIX)
Use the provided script to manually add managers to the group:

```bash
cd my-training-admin
npm run add-manager-to-group -- manager@example.com
```

Or use AWS CLI:
```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id ca-central-1_aKCLbCdhj \
  --username manager@example.com \
  --group-name Managers \
  --region ca-central-1
```

### Solution 3: Check and Fix All Managers
Use the check script to see which managers are missing:

```bash
cd my-training-admin
npm run check-manager-groups
```

## Files Created

1. **`add-manager-to-group.js`** - Script to add a single manager to the Managers group
2. **`check-manager-groups.js`** - Script to check which managers are in the group
3. **`list-cognito-groups.js`** - Script to list all Cognito groups

## Testing

After creating a manager:
1. Run: `npm run check-manager-groups` to verify
2. If manager is not in group, run: `npm run add-manager-to-group -- <email>`
3. Verify in AWS Cognito Console → User Pools → Groups → Managers

## Long-term Fix (Optional)

While the automatic database check now works, the ideal solution is to update the external Lambda function to set `custom:role="manager"` when creating managers. This would make the assignment faster (no 3-second delay) and more reliable. However, the current implementation works without requiring changes to the external Lambda.


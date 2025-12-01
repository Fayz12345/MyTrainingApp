# External Lambda User Pool Mismatch Issue

## Problem
The external Lambda function (`https://zwkht7afhzzv777hxn6xx56vry0uniix.lambda-url.ca-central-1.on.aws/`) is creating users in the **WRONG Cognito User Pool**.

### Current Situation:
- **Correct User Pool ID** (Amplify): `ca-central-1_aKCLbCdhj`
- **Lambda is using**: `amplifyAuthUserPool4BA7F805-iY0f9DRMTOmt` ❌

### Impact:
1. ❌ Users created by Lambda don't appear in Amplify Console User Management
2. ❌ Post-confirmation trigger doesn't run (configured for correct pool)
3. ❌ Users aren't added to Managers/Employees groups
4. ❌ Users can't log in to the app (wrong pool)

## Solution

### Option 1: Update External Lambda (RECOMMENDED)
Update the external Lambda function to use the correct User Pool ID:

```javascript
const USER_POOL_ID = 'ca-central-1_aKCLbCdhj'; // Correct Amplify User Pool
const AWS_REGION = 'ca-central-1';
```

### Option 2: Manual User Creation (TEMPORARY WORKAROUND)
Instead of using the external Lambda, create users directly using AWS Amplify Admin APIs or Cognito Admin APIs with the correct User Pool ID.

## How to Verify

1. Check which User Pool the Lambda is using:
   - Look at Lambda logs for the User Pool ID
   - Or check Lambda function code/environment variables

2. Verify correct User Pool ID:
   - Check `amplify_outputs.json`: `auth.user_pool_id`
   - Should be: `ca-central-1_aKCLbCdhj`

3. Test after fix:
   - Create a manager
   - Check AWS Cognito Console → User Pools → `ca-central-1_aKCLbCdhj` → Users
   - User should appear in the correct pool
   - Post-confirmation trigger should run
   - User should be in Managers group

## Current Workaround

Until the Lambda is fixed, you can:
1. Use the `add-manager-to-group.js` script to manually add users to groups
2. But this won't work if users are in the wrong pool entirely
3. **The Lambda MUST be updated to use the correct User Pool ID**

## Files Affected
- External Lambda function (not in this repo)
- `my-training-admin/src/components/store/ManagerForm.tsx` (calls Lambda)
- `my-training-admin/src/components/manager/EmployeeForm.tsx` (calls Lambda)


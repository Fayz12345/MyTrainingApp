# Lambda Function Update - Verification Steps

## ✅ Update Completed

**Lambda Function:** `create-employee-function`  
**Environment Variable Updated:** `USER_POOL_ID = ca-central-1_aKCLbCdhj`  
**Status:** Update in progress (wait for completion)

---

## Next Steps

### Step 1: Verify Lambda Code Uses the Environment Variable

The Lambda code should use the environment variable like this:

```javascript
const USER_POOL_ID = process.env.USER_POOL_ID || 'ca-central-1_aKCLbCdhj';
```

**To verify:**
1. Go to AWS Console → Lambda → `create-employee-function`
2. Click on **Code** tab
3. Check the code file (usually `index.js` or `handler.js`)
4. Verify it uses: `process.env.USER_POOL_ID` or `process.env.USER_POOL_ID || 'ca-central-1_aKCLbCdhj'`

**If the code has a hardcoded User Pool ID:**
- Update it to use the environment variable
- Or change the hardcoded value to `ca-central-1_aKCLbCdhj`

### Step 2: Wait for Update to Complete

Check the update status:
```bash
aws lambda get-function-configuration \
  --function-name create-employee-function \
  --region ca-central-1 \
  --query 'LastUpdateStatus'
```

Wait until it shows: `"Successful"`

### Step 3: Test the Fix

1. **Create a new manager:**
   - Go to your admin portal
   - Log in as SuperAdmin
   - Create a new manager (e.g., `test-manager@mailinator.com`)

2. **Verify in Cognito Console:**
   - AWS Console → Cognito → User Pools
   - Select: `ca-central-1_aKCLbCdhj` (the correct pool)
   - Go to **Users** tab
   - Search for the email you just created
   - ✅ User should appear here

3. **Verify Group Assignment:**
   - In the same User Pool, go to **Groups** tab
   - Click on **Managers** group
   - Check **Users in group**
   - ✅ User should appear in Managers group

4. **Check Post-Confirmation Trigger:**
   - Go to CloudWatch → Log Groups
   - Find: `/aws/lambda/assignEmployeeGroup-...`
   - Check recent logs for the new user
   - Should show successful group assignment

### Step 4: Verify Lambda Logs

Check that the Lambda is using the correct User Pool:

```bash
# View recent Lambda logs
aws logs tail /aws/lambda/create-employee-function --follow --region ca-central-1
```

Look for logs showing:
- `Creating Cognito user...`
- The User Pool ID being used should be `ca-central-1_aKCLbCdhj`

---

## Troubleshooting

### If user still doesn't appear in correct pool:

1. **Check Lambda code:**
   - Make sure the code actually uses `process.env.USER_POOL_ID`
   - Not a hardcoded value

2. **Check Lambda logs:**
   - Look for any errors
   - Verify which User Pool ID is being used

3. **Verify environment variable:**
   ```bash
   aws lambda get-function-configuration \
     --function-name create-employee-function \
     --region ca-central-1 \
     --query 'Environment.Variables'
   ```
   Should show: `{"USER_POOL_ID": "ca-central-1_aKCLbCdhj"}`

### If user appears but not in Managers group:

1. Check post-confirmation trigger logs
2. Verify the trigger is running
3. Check if Manager record exists in database

---

## Success Criteria

✅ Lambda environment variable set to: `ca-central-1_aKCLbCdhj`  
✅ Lambda code uses the environment variable  
✅ New users appear in Cognito User Pool: `ca-central-1_aKCLbCdhj`  
✅ Users are automatically added to correct groups (Managers/Employees)  
✅ Post-confirmation trigger runs successfully  

---

## Important Notes

- **Old users** created in the wrong pool (`amplifyAuthUserPool4BA7F805-iY0f9DRMTOmt`) will NOT be automatically fixed
- You may need to manually migrate or recreate those users
- Only **new users** created after this fix will be in the correct pool


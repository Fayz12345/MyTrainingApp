# Deployment Guide: managerId and Code Deployment

## How `managerId` Works in the Model

### Current Schema Structure

The `Employee` model in `amplify/data/resource.ts` already has `managerId` defined:

```typescript
Employee: a.model({
  id: a.id(),
  userId: a.string().required(),
  email: a.string().required(),
  name: a.string().required(),
  department: a.string(),
  managerId: a.id(),                    // ✅ Already defined
  manager: a.belongsTo('Manager', 'managerId'),  // ✅ Relationship defined
  createdBy: a.string(),                // userId of the Manager who created it
  isActive: a.boolean().default(true),
  // ...
})
```

### How It Works

1. **When Creating an Employee** (in `EmployeeForm.tsx`):
   - The form fetches the current manager's ID (lines 25-46)
   - When creating an employee, it sets:
     - `managerId`: The Manager record ID (line 173)
     - `createdBy`: The Cognito userId of the manager creating the employee (line 174)

2. **Relationship**:
   - `managerId` → Links to the `Manager` model via `belongsTo` relationship
   - This allows you to query: `employee.manager.name` to get the manager's name

3. **In TrainingAnalytics**:
   - We filter employees by `createdBy` to show only employees created by the current manager
   - We use `managerId` to look up and display the manager's name

### The Model is Already Set Up! ✅

**No schema changes needed** - `managerId` is already in the schema and working.

---

## How to Deploy Code Changes

### Option 1: Automatic Deployment (Recommended)

If your Amplify app is connected to Git and Gen 2 backend is enabled:

1. **Commit your changes:**
   ```bash
   git add .
   git commit -m "Add manager filtering and display in TrainingAnalytics"
   git push origin dev
   ```

2. **Amplify will automatically:**
   - Detect the push
   - Deploy frontend changes
   - Deploy backend changes (if any schema changes were made)
   - Update `amplify_outputs.json` automatically

3. **Check deployment status:**
   - Go to: https://ca-central-1.console.aws.amazon.com/amplify/home?region=ca-central-1
   - Select your app
   - View the deployment progress

### Option 2: Manual Deployment Script

If automatic deployment isn't working, use the provided script:

```bash
# Make the script executable
chmod +x deploy-gen2-backend-to-dev.sh

# Run the deployment script
./deploy-gen2-backend-to-dev.sh
```

This script will:
1. Check AWS credentials
2. Verify backend setup
3. Trigger a deployment
4. Wait for completion
5. Generate `amplify_outputs.json`
6. Copy outputs to `my-training-admin/src/amplify_outputs.json`

### Option 3: Manual Steps

1. **Push code to Git:**
   ```bash
   git add .
   git commit -m "Update TrainingAnalytics with manager filtering"
   git push origin dev
   ```

2. **Trigger deployment manually:**
   ```bash
   aws amplify start-job \
     --app-id d1pvmv1j5xi2c9 \
     --branch-name dev \
     --job-type RELEASE \
     --region ca-central-1 \
     --profile amplify
   ```

3. **Generate outputs after deployment:**
   ```bash
   npx ampx generate outputs \
     --app-id d1pvmv1j5xi2c9 \
     --branch dev \
     --profile amplify
   ```

4. **Copy outputs to admin app:**
   ```bash
   cp amplify_outputs.json my-training-admin/src/amplify_outputs.json
   ```

---

## What Happens When You Deploy

### Frontend Changes (TypeScript/React)
- ✅ **No backend deployment needed** - These are just UI changes
- ✅ Changes take effect immediately after frontend deployment
- ✅ No database migration needed

### Backend Changes (Schema Changes)
If you modify `amplify/data/resource.ts`:
- ⚠️ **Backend deployment required** - Schema changes need to be deployed
- ⚠️ **May cause downtime** - Database tables may be updated
- ⚠️ **Takes 5-10 minutes** - Backend deployment is slower

### Current Situation
- ✅ **No schema changes needed** - `managerId` already exists
- ✅ **Only frontend changes** - Just TypeScript/React code updates
- ✅ **Quick deployment** - Frontend deploys in 2-3 minutes

---

## Verifying Deployment

### 1. Check Frontend Deployment
```bash
# Check deployment status
aws amplify list-jobs \
  --app-id d1pvmv1j5xi2c9 \
  --branch-name dev \
  --region ca-central-1 \
  --profile amplify \
  --max-results 1
```

### 2. Test the Application
1. Open your admin app
2. Navigate to Training Analytics
3. Verify:
   - ✅ Only employees created by current manager are shown
   - ✅ Manager column displays manager names
   - ✅ Statistics are filtered correctly

### 3. Check Backend (if needed)
```bash
# Check if backend exists
aws amplify get-branch \
  --app-id d1pvmv1j5xi2c9 \
  --branch-name dev \
  --region ca-central-1 \
  --profile amplify \
  | jq '.branch.backend'
```

---

## Troubleshooting

### Issue: Changes not showing after deployment
**Solution:**
1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
3. Check browser console for errors

### Issue: Backend not deploying
**Solution:**
1. Check if Gen 2 backend is enabled for your branch
2. Verify `amplify/` directory exists in repository
3. Check Amplify Console for error messages

### Issue: managerId not working
**Solution:**
1. Verify employees have `managerId` set (check in EmployeeForm)
2. Check that Manager records exist
3. Verify the relationship in the schema

---

## Summary

✅ **Schema is ready** - `managerId` is already defined and working  
✅ **Code is ready** - TrainingAnalytics now filters and displays managers  
✅ **Just deploy** - Push to Git or use deployment script  
✅ **No migration needed** - This is just frontend code changes  

The `managerId` field will work automatically because:
1. It's already in the schema
2. EmployeeForm already sets it when creating employees
3. TrainingAnalytics now uses it to display manager names


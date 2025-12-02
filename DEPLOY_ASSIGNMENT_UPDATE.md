# Deploy Assignment Update Permission

## ✅ Schema Already Updated

The Assignment model authorization has been updated to allow employees to update assignments:

**File**: `amplify/data/resource.ts` (Line 135)

```typescript
Assignment: a
  .model({
    // ... fields
  })
  .authorization(allow => [
    allow.group('Managers').to(['create', 'update', 'delete', 'read']),
    allow.group('Employees').to(['read', 'update']) // ✅ Employees can now update
  ]),
```

## ⚠️ Backend Deployment Required

**The permission change is in the code, but you MUST deploy the backend for it to take effect!**

### Deploy Command

```bash
cd /var/www/html/MyTrainingApp
npx @aws-amplify/backend-cli pipeline-deploy \
  --branch dev \
  --app-id d6c38s8spsb1t \
  --outputs-out-dir . \
  --outputs-format json
```

### After Deployment

1. The authorization rules will be updated in AppSync
2. Employees will be able to update assignments
3. Quiz completion will work without "Unauthorized" errors

## Verification

After deployment, test by:
1. Log in as an employee
2. Take a quiz and pass it
3. The assignment should update to "completed" without errors

## Current Status

- ✅ Schema updated (code)
- ⚠️ Backend NOT deployed (needs deployment)
- ❌ Permission NOT active (until deployment)

---

**Action Required**: Deploy the backend to activate the permission!


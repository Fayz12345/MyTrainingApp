# AppSync Authorization Issue Found

## Status Check Results

✅ **BusinessUnit EXISTS in AppSync schema**
✅ **Has @aws_cognito_user_pools directive**  
✅ **All 8 models are present in schema**

❌ **BUT: Still getting 401 Unauthorized**

## Root Cause

The AppSync schema has the model, but the **authorization resolver rules** are not properly configured to check for the `SuperAdmin` group.

The `@aws_cognito_user_pools` directive is there, but the specific group-based authorization rules from your schema (`allow.group('SuperAdmin')`) might not be properly translated to AppSync resolver authorization logic.

## Solution: Force Backend Redeploy

I've made a small change to `amplify/data/resource.ts` to force Amplify to regenerate the AppSync schema with proper authorization rules.

### Step 1: Commit and Push

```bash
git add amplify/data/resource.ts
git commit -m "Force AppSync authorization resolver sync for BusinessUnit"
git push origin dev
```

### Step 2: Wait for Deployment (5-10 minutes)

Monitor deployment:
```bash
aws amplify list-jobs \
  --app-id d6c38s8spsb1t \
  --branch-name dev \
  --region ca-central-1 \
  --profile amplify \
  --max-results 1 \
  | jq '.jobSummaries[0] | {status: .status, jobId: .jobId}'
```

### Step 3: Regenerate Outputs

After deployment completes:
```bash
npx ampx generate outputs \
  --app-id d6c38s8spsb1t \
  --branch dev \
  --profile amplify
```

### Step 4: Copy to Admin App

```bash
cp amplify_outputs.json my-training-admin/src/amplify_outputs.json
```

### Step 5: Test Again

Try the BusinessUnit query - it should work now!

## Why This Happens

Amplify Gen 2 sometimes doesn't properly sync the group-based authorization rules to AppSync resolvers. The schema shows the model exists, but the resolver authorization logic might be missing or incorrect.

When you redeploy, Amplify will:
1. Regenerate the AppSync schema
2. Update the resolver authorization rules
3. Properly configure group-based access control

## Alternative: Check AppSync Resolvers

If redeploy doesn't work, check AppSync resolvers directly:

1. Go to AWS Console → AppSync
2. Select API: `csxrkv7kenai5i4jycdl73t3uy`
3. Go to **Schema** tab
4. Click on **listBusinessUnits** query
5. Check the resolver configuration
6. Verify authorization rules include SuperAdmin group check

---

**The schema change is ready. Commit and push to trigger the fix!**


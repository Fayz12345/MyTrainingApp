# Force AppSync Authorization Sync

## Problem

Even though:
- ✅ User is authenticated
- ✅ User is in SuperAdmin group
- ✅ Token has SuperAdmin group
- ✅ Schema has correct authorization rules
- ✅ authMode is set in generateClient

**Still getting:** 401 Unauthorized

This suggests the **AppSync schema authorization rules are not synced** with the backend schema.

## Solution: Force Schema Update

The AppSync schema needs to be regenerated to include the authorization rules for BusinessUnit.

### Step 1: Make a Schema Change to Force Update

Add a comment or make a small change to trigger schema rebuild:

```bash
# Edit amplify/data/resource.ts
# Add a comment at the top or make a small change
```

### Step 2: Commit and Push

```bash
git add amplify/data/resource.ts
git commit -m "Force AppSync authorization sync for BusinessUnit"
git push origin dev
```

### Step 3: Wait for Deployment

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

Or check in AWS Console:
https://ca-central-1.console.aws.amazon.com/amplify/home?region=ca-central-1#/d6c38s8spsb1t

### Step 4: Verify Schema Updated

After deployment, check AppSync schema:
```bash
./check-appsync-schema.sh
```

Should show:
- ✅ BusinessUnit type exists
- ✅ Authorization directives present
- ✅ SuperAdmin in authorization rules

### Step 5: Regenerate Outputs

```bash
npx ampx generate outputs \
  --app-id d6c38s8spsb1t \
  --branch dev \
  --profile amplify
```

### Step 6: Test Again

Try the BusinessUnit query - it should work now!

## Alternative: Check AppSync Console Directly

1. Go to AWS Console → AppSync
2. Select your API: `csxrkv7kenai5i4jycdl73t3uy`
3. Go to **Schema** tab
4. Check if `BusinessUnit` type exists
5. Check if it has `@aws_auth` or `@aws_cognito_user_pools` directives
6. Check if `SuperAdmin` is in the authorization rules

## Why This Happens

Amplify Gen 2 sometimes doesn't properly sync authorization rules to AppSync, especially when:
- Models were added after initial deployment
- Authorization groups were created after schema deployment
- Schema changes weren't detected properly

## Quick Fix Script

I'll create a script to force the update:

```bash
# Add a timestamp comment to force rebuild
echo "// Force schema sync: $(date)" >> amplify/data/resource.ts
git add amplify/data/resource.ts
git commit -m "Force AppSync authorization sync"
git push origin dev
```

---

**The issue is likely that AppSync doesn't have the authorization rules synced. Force a backend redeploy to fix it!**


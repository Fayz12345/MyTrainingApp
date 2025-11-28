# Fix: AppSync Schema Sync Issue

## Problem
- ✅ DynamoDB tables exist for all 8 models
- ❌ AppSync GraphQL schema only has 5 models
- ❌ BusinessUnit, Store, Manager are missing from AppSync schema

## Solution Applied

I've made a change to force Amplify to rebuild the AppSync schema:

1. ✅ Updated `amplify/data/resource.ts` with a comment to trigger rebuild
2. ✅ Committed the change

## Next Steps

### Step 1: Push to Trigger Deployment

```bash
git push origin dev
```

### Step 2: Wait for Deployment (5-10 minutes)

Monitor deployment status:
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

### Step 3: Regenerate Outputs

After deployment completes:

```bash
npx ampx generate outputs \
  --app-id d6c38s8spsb1t \
  --branch dev \
  --profile amplify
```

### Step 4: Verify All Models

```bash
./check-models.sh
```

You should now see all 8 models:
- Assignment ✅
- BusinessUnit ✅
- Course ✅
- Employee ✅
- Manager ✅
- QuizQuestion ✅
- Result ✅
- Store ✅

### Step 5: Copy to Admin App

```bash
cp amplify_outputs.json my-training-admin/src/amplify_outputs.json
```

## Alternative: Use Sandbox (If Push Doesn't Work)

If the push doesn't trigger the schema update, use sandbox:

```bash
npx ampx sandbox --once --outputs-out-dir ./outputs --outputs-format json
cp outputs/amplify_outputs.json my-training-admin/src/amplify_outputs.json
./check-models.sh
```

Sandbox will rebuild everything from scratch and include all models.

## What This Fix Does

The change forces Amplify Gen 2 to:
1. Detect the schema change
2. Rebuild the AppSync GraphQL schema
3. Sync all 8 models from DynamoDB to AppSync
4. Update the schema introspection

This ensures BusinessUnit, Store, and Manager models are accessible via GraphQL.


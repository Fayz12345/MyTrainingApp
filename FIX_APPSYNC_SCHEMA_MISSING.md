# Fix: AppSync Schema Missing BusinessUnit

## Error

```
Validation error of type UnknownType: Unknown type ModelBusinessUnitFilterInput
Validation error of type FieldUndefined: Field 'listBusinessUnits' in type 'Query' is undefined
```

## Root Cause

The `amplify_outputs.json` has BusinessUnit in `model_introspection`, but the **actual AppSync GraphQL schema** doesn't have:
- `type BusinessUnit`
- `listBusinessUnits` query
- `ModelBusinessUnitFilterInput` type

This means the backend schema wasn't properly deployed to AppSync.

## Solution: Deploy Backend

The schema change I made earlier needs to be committed and deployed.

### Step 1: Commit Schema Change

```bash
git add amplify/data/resource.ts
git commit -m "Force AppSync schema sync - add BusinessUnit, Store, Manager"
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

Or check in AWS Console:
https://ca-central-1.console.aws.amazon.com/amplify/home?region=ca-central-1#/d6c38s8spsb1t

### Step 3: Verify Schema Updated

After deployment, check AppSync schema:
```bash
API_ID=$(jq -r '.data.aws_appsync_graphql_api_id' amplify_outputs.json)
aws appsync get-introspection-schema \
  --api-id "$API_ID" \
  --format SDL \
  --region ca-central-1 \
  --profile amplify \
  /tmp/appsync-schema.sdl

# Check for BusinessUnit
grep "listBusinessUnits" /tmp/appsync-schema.sdl
```

Should show: `listBusinessUnits(...)`

### Step 4: Regenerate Outputs

```bash
npx ampx generate outputs \
  --app-id d6c38s8spsb1t \
  --branch dev \
  --profile amplify
```

### Step 5: Copy to Admin App

```bash
cp amplify_outputs.json my-training-admin/src/amplify_outputs.json
```

### Step 6: Test Again

The BusinessUnit queries should now work!

## Why This Happens

Amplify Gen 2 needs to:
1. Build the backend from your schema
2. Deploy to AWS
3. Update AppSync GraphQL schema
4. Generate the GraphQL queries/mutations

If step 3 doesn't complete properly, the AppSync schema won't have the models even though they're in your code.

## Quick Check

Before deploying, verify the schema change is ready:
```bash
git diff amplify/data/resource.ts | head -20
```

Should show the comment I added: `// FORCE SYNC: Updated to ensure AppSync authorization rules are synced`

---

**The schema change is ready. Commit and push to deploy!**


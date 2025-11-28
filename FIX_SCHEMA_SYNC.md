# Fix: DynamoDB Tables Exist But Models Not in AppSync Schema

## Problem Found! ✅

The DynamoDB tables **DO exist**:
- ✅ `BusinessUnit-csxrkv7kenai5i4jycdl73t3uy-NONE`
- ✅ `Manager-csxrkv7kenai5i4jycdl73t3uy-NONE`
- ✅ `Store-csxrkv7kenai5i4jycdl73t3uy-NONE`

But they're **NOT in the AppSync GraphQL schema**, which is why:
- ❌ They don't show in `amplify_outputs.json`
- ❌ They're not accessible via GraphQL
- ❌ Your app can't use them

## Root Cause

The models were deployed to DynamoDB but the AppSync schema wasn't updated. This can happen when:
1. Authorization groups didn't exist during initial deployment
2. Schema update failed silently
3. Amplify Gen 2 didn't detect the schema changes

## Solution: Force Schema Update

### Option 1: Trigger Backend Redeploy (Recommended)

Make a small change to force Amplify to update the schema:

```bash
cd /var/www/html/MyTrainingApp

# Add a comment to trigger schema rebuild
# Edit amplify/data/resource.ts and add a comment, then:

git add amplify/data/resource.ts
git commit -m "Force AppSync schema update - sync all models"
git push origin dev

# Wait 5-10 minutes for deployment
# Then regenerate outputs:
npx ampx generate outputs --app-id d6c38s8spsb1t --branch dev --profile amplify
./check-models.sh
```

### Option 2: Use Sandbox (Fastest)

Sandbox will rebuild everything from scratch:

```bash
npx ampx sandbox --once --outputs-out-dir ./outputs --outputs-format json
cp outputs/amplify_outputs.json my-training-admin/src/amplify_outputs.json
./check-models.sh
```

### Option 3: Manual AppSync Schema Update

If the above doesn't work, you may need to manually update the AppSync schema. However, this is complex and not recommended.

## Verification

After fixing, verify:

```bash
# 1. Check DynamoDB tables (should already exist)
aws dynamodb list-tables --region ca-central-1 --profile amplify | grep -iE "businessunit|store|manager"

# 2. Check AppSync schema (should now include all models)
API_ID=$(jq -r '.data.url' amplify_outputs.json | sed 's|https://\([^.]*\).*|\1|')
aws appsync get-introspection-schema --api-id "$API_ID" --format SDL --region ca-central-1 --profile amplify | grep -E "^type " | sort

# 3. Check outputs
jq -r '.data.model_introspection.models | keys[]' amplify_outputs.json | sort
```

## Expected Result

After fix, you should see all 8 models:
- Assignment
- BusinessUnit ✅
- Course
- Employee
- Manager ✅
- QuizQuestion
- Result
- Store ✅


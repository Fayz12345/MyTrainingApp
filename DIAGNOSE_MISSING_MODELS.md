# Diagnosis: Why Only 5 Models Are Deploying

## Current Status

✅ **Schema File:** All 8 models correctly defined
✅ **Compiled Code:** All 8 models in resource.js
✅ **Backend Config:** Data resource correctly imported
✅ **Cognito Groups:** All 5 groups exist (SuperAdmin, BusinessUnit, Store, Managers, Employees)
✅ **Build:** TypeScript compiles successfully
✅ **Deployments:** All deployments succeed

❌ **Deployed Backend:** Only 5 models (missing BusinessUnit, Store, Manager)

## Root Cause Analysis

The three missing models (BusinessUnit, Store, Manager) share these characteristics:

1. **They reference authorization groups** that may not have existed when the backend was first deployed:
   - BusinessUnit: references 'SuperAdmin', 'BusinessUnit', 'Store', 'Managers'
   - Store: references 'SuperAdmin', 'BusinessUnit', 'Store', 'Managers'
   - Manager: references 'SuperAdmin', 'BusinessUnit', 'Store', 'Managers'

2. **They have circular relationships:**
   - BusinessUnit → Store → Manager
   - This creates a dependency chain

3. **They were likely added to the schema AFTER the initial deployment**

## The Problem

Amplify Gen 2 may have skipped deploying these models during initial deployment because:
- The authorization groups didn't exist yet
- There was a circular dependency issue
- The models were added after the initial schema was deployed

Even though subsequent deployments succeed, Amplify may not be detecting that these models need to be added to the existing schema.

## Solution: Force Full Schema Redeploy

### Option 1: Use Sandbox (Recommended for Testing)

Sandbox will deploy ALL models from scratch:

```bash
npx ampx sandbox --once --outputs-out-dir ./outputs --outputs-format json
cp outputs/amplify_outputs.json my-training-admin/src/amplify_outputs.json
./check-models.sh
```

### Option 2: Delete and Redeploy Backend

If sandbox works, you know the schema is correct. Then you can:

1. Delete the backend environment
2. Redeploy from scratch

⚠️ **Warning:** This will delete all data!

### Option 3: Check CloudFormation Stack

The models might be in CloudFormation but not in the AppSync schema. Check:

```bash
aws cloudformation describe-stack-resources \
  --stack-name amplify-d6c38s8spsb1t-dev-branch-5714f7d1b8 \
  --region ca-central-1 \
  --profile amplify \
  | jq -r '.StackResources[] | select(.ResourceType == "AWS::DynamoDB::Table") | .LogicalResourceId'
```

### Option 4: Manual AppSync Schema Update

If models exist in CloudFormation but not in AppSync, you may need to manually update the AppSync schema.

## Verification Steps

1. Check if DynamoDB tables exist:
```bash
aws dynamodb list-tables --region ca-central-1 --profile amplify | grep -i "businessunit\|store\|manager"
```

2. Check AppSync schema:
```bash
API_ID=$(jq -r '.data.url' amplify_outputs.json | sed 's|https://\([^.]*\).*|\1|')
aws appsync get-introspection-schema --api-id "$API_ID" --format SDL --region ca-central-1 --profile amplify | grep -E "^type (BusinessUnit|Store|Manager)"
```

3. Check CloudFormation resources:
```bash
aws cloudformation describe-stack-resources \
  --stack-name amplify-d6c38s8spsb1t-dev-branch-5714f7d1b8 \
  --region ca-central-1 \
  --profile amplify \
  | jq -r '.StackResources[] | select(.LogicalResourceId | contains("BusinessUnit") or contains("Store") or contains("Manager"))'
```

## Next Steps

1. **Test with Sandbox first** - This will confirm if the schema is correct
2. If sandbox works, the issue is with the deployed backend
3. Consider creating a new backend branch/environment
4. Or contact AWS Support if this is a known Amplify Gen 2 issue


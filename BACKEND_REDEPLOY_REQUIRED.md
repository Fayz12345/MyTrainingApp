# ⚠️ BACKEND REDEPLOYMENT REQUIRED

## Problem Identified

The GraphQL API is **NOT returning** `description` and `imageKey` fields for Course queries, even though:
- ✅ Fields are defined in the schema (`amplify/data/resource.ts`)
- ✅ Fields exist in the database (you can save them)
- ❌ Fields are NOT included in GraphQL queries (`list()` and `get()`)

## Root Cause

The backend GraphQL schema is **out of sync** with your local schema definition. The deployed backend doesn't know about these fields.

## Solution: Redeploy Backend

You **MUST** redeploy your Amplify backend to sync the GraphQL schema.

### Option 1: Using Amplify Sandbox (Recommended for Development)

```bash
cd /var/www/html/MyTrainingApp
npx ampx sandbox --once
```

This will:
- Deploy the updated schema to AWS
- Update the GraphQL API to include `description` and `imageKey`
- Regenerate the API with all fields

### Option 2: Using CI/CD Pipeline

If you're using GitHub Actions or another CI/CD:
1. Commit and push your changes
2. The pipeline should automatically deploy
3. Wait for deployment to complete

### Option 3: Manual Deployment

```bash
cd /var/www/html/MyTrainingApp
npx @aws-amplify/backend-cli pipeline-deploy --branch dev --app-id YOUR_APP_ID
```

## After Redeployment

1. **Verify the schema is updated:**
   - Check the GraphQL API in AWS AppSync console
   - The Course type should include `description` and `imageKey` fields

2. **Update amplify_outputs.json:**
   - After deployment, run: `./sync-amplify-outputs.sh`
   - Or manually copy `amplify_outputs.json` to `my-training-admin/src/amplify_outputs.json`

3. **Test:**
   - Refresh your React app
   - The debug panel should show "✅ Yes" for both fields in Step 2
   - Description and image should appear in the edit form

## Temporary Workaround (Current Code)

The current code has a workaround that:
- Fetches full course details using `get()` for each course
- But since `get()` also doesn't return these fields, it doesn't help

**This workaround will work AFTER you redeploy the backend.**

## Verification

After redeployment, check:
1. Debug panel Step 2 should show "Has Description: ✅ Yes"
2. Debug panel Step 2 should show "Has ImageKey: ✅ Yes"
3. Console logs should show description and imageKey values
4. Edit form should display description and image preview

## Important Notes

- **All existing courses** that have description/imageKey saved will work once backend is redeployed
- **New courses** created after redeployment will work immediately
- The workaround code can be removed after redeployment (optional cleanup)



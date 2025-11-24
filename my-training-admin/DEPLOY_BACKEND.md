# Deploy Amplify Backend to Include New Models

## Problem
The `BusinessUnit`, `Store`, and `Manager` models are defined in your schema but haven't been deployed to AWS. Your `amplify_outputs.json` only shows:
- Course
- QuizQuestion  
- Employee
- Assignment
- Result

But it's missing:
- BusinessUnit
- Store
- Manager

## Solution: Deploy Your Backend

You need to deploy your Amplify backend to include the new models.

### Option 1: Deploy to a Branch (Recommended for Production)

```bash
cd /var/www/html/MyTrainingApp
npx ampx pipeline-deploy --branch <your-branch-name>
```

Replace `<your-branch-name>` with your branch (e.g., `main`, `dev`, `develop`).

### Option 2: Run Amplify Sandbox (For Development/Testing)

If you're using a local sandbox environment:

```bash
cd /var/www/html/MyTrainingApp
npx ampx sandbox
```

This will:
- Deploy your backend changes
- Update `amplify_outputs.json` with all models
- Make the new models available in your app

### Option 3: Deploy via AWS Amplify Console

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Select your app
3. Go to **Backend environments**
4. Click **Deploy** or trigger a deployment

## After Deployment

Once deployed, your `amplify_outputs.json` should include all models:
- BusinessUnit
- Store
- Manager
- Course
- QuizQuestion
- Employee
- Assignment
- Result

## Verify Deployment

After deployment, check that the models are available:

```bash
cd my-training-admin
jq '.data.model_introspection.models | keys' src/amplify_outputs.json
```

You should see all 7 models listed.

## Important Notes

1. **Data Migration**: If you have existing data, it will be preserved. The new models will be created as new DynamoDB tables.

2. **Copy amplify_outputs.json**: After deployment, you may need to copy the updated file:
   ```bash
   cp amplify_outputs.json my-training-admin/src/amplify_outputs.json
   ```

3. **Authorization**: Make sure your user (SuperAdmin) has the correct permissions to access these models.

## Troubleshooting

If models still don't appear after deployment:
1. Check the deployment logs for errors
2. Verify the schema file is correct
3. Ensure you're looking at the correct `amplify_outputs.json` file
4. Try clearing browser cache and refreshing


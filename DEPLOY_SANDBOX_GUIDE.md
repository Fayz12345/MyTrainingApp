# How to Deploy Backend Using Amplify Sandbox

## Problem
The build is failing because it's looking for `package.json` in the root directory. Also, the `BusinessUnit`, `Store`, and `Manager` models need to be deployed.

## Solution: Use Amplify Sandbox

For Amplify Gen 2, the backend should be deployed using the Amplify CLI, not through the build process.

### Step 1: Install Dependencies in amplify/ directory

```bash
cd /var/www/html/MyTrainingApp/amplify
npm install
```

### Step 2: Run Amplify Sandbox

```bash
cd /var/www/html/MyTrainingApp
npx @aws-amplify/backend-cli sandbox
```

This will:
- Deploy your backend to AWS
- Create all models (BusinessUnit, Store, Manager, etc.)
- Generate updated `amplify_outputs.json`
- Keep running and watch for changes

### Step 3: Stop Sandbox and Copy Outputs

Once deployment is complete:
1. Press `Ctrl+C` to stop the sandbox
2. Copy the updated `amplify_outputs.json`:

```bash
cp amplify_outputs.json my-training-admin/src/amplify_outputs.json
```

### Alternative: One-time Sandbox Deployment

If you just want to deploy once without keeping it running:

```bash
cd /var/www/html/MyTrainingApp
npx @aws-amplify/backend-cli sandbox --once
```

## For Production Deployment (via Git)

If you're deploying via Git/Amplify Hosting:

1. **Commit your changes**:
   ```bash
   git add .
   git commit -m "Add BusinessUnit, Store, Manager models"
   git push
   ```

2. **Deploy backend separately** (before or after Git push):
   ```bash
   npx @aws-amplify/backend-cli pipeline-deploy --branch <your-branch>
   ```

## Important Notes

1. **Root package.json**: I've created a minimal `package.json` in the root to prevent build errors. This is just a placeholder.

2. **Backend Deployment**: For Amplify Gen 2, backend deployment happens via CLI, not through the build process.

3. **Models Will Be Created**: After deployment, DynamoDB tables will be created for:
   - BusinessUnit
   - Store
   - Manager
   - (Existing: Course, QuizQuestion, Employee, Assignment, Result)

4. **No Data Loss**: Existing data in current tables will be preserved.

## Verify Deployment

After sandbox deployment completes, verify models are available:

```bash
jq '.data.model_introspection.models | keys' amplify_outputs.json
```

You should see all 7 models:
- BusinessUnit
- Store
- Manager
- Course
- QuizQuestion
- Employee
- Assignment
- Result


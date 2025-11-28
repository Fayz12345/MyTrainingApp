# Force Deploy All Models: BusinessUnit, Store, Manager

## The Problem

You've deployed multiple times, but BusinessUnit, Store, and Manager models are still not appearing in the deployed backend.

**Root Cause:** The backend build was failing due to missing dependencies, which prevented the schema from deploying correctly.

## Solution: Fix Dependencies and Redeploy

### Step 1: Dependencies Fixed ✅

I've already fixed the missing dependencies:
- ✅ Added `@aws-sdk/client-sns`
- ✅ Added `@types/node`
- ✅ Build now succeeds

### Step 2: Commit and Push

```bash
cd /var/www/html/MyTrainingApp

# Commit the fixed dependencies
git add amplify/package.json amplify/package-lock.json
git commit -m "Fix missing dependencies to enable all models deployment"

# Push to trigger deployment
git push origin dev
```

### Step 3: Monitor Deployment

```bash
# Watch deployment status
aws amplify list-jobs \
  --app-id d6c38s8spsb1t \
  --branch-name dev \
  --region ca-central-1 \
  --profile amplify \
  --max-results 1 \
  | jq '.jobSummaries[0] | {status: .status, jobId: .jobId}'
```

### Step 4: Wait for Completion

Wait 5-10 minutes for deployment to complete. Check the Amplify Console:
- https://ca-central-1.console.aws.amazon.com/amplify/home?region=ca-central-1#/d6c38s8spsb1t

### Step 5: Regenerate Outputs

After deployment succeeds:

```bash
# Regenerate outputs
npx ampx generate outputs \
  --app-id d6c38s8spsb1t \
  --branch dev \
  --profile amplify

# Verify all models are present
jq '.data.model_introspection.models | keys' amplify_outputs.json
```

You should see all 8 models:
```json
[
  "Assignment",
  "BusinessUnit",
  "Course",
  "Employee",
  "Manager",
  "QuizQuestion",
  "Result",
  "Store"
]
```

### Step 6: Copy to Admin App

```bash
cp amplify_outputs.json my-training-admin/src/amplify_outputs.json
```

---

## Alternative: Use Sandbox to Test

If you want to test immediately:

```bash
# Deploy to sandbox (will include all models)
npx ampx sandbox --once \
  --outputs-out-dir ./outputs \
  --outputs-format json

# Copy outputs
cp outputs/amplify_outputs.json my-training-admin/src/amplify_outputs.json
```

---

## Why Previous Deployments Failed

The build was failing with these errors:
- ❌ Missing `@aws-sdk/client-sns` (for quizCompletion function)
- ❌ Missing `@types/node` (for process.env access)
- ❌ Build failures prevented schema deployment

**Now Fixed:** All dependencies are installed and build succeeds.

---

## Verify Schema is Correct

The schema file has all models. Verify:

```bash
# Check models in schema
grep -E "^\s+\w+:\s+a\.model" amplify/data/resource.ts
```

Should show:
- BusinessUnit
- Store
- Manager
- Course
- QuizQuestion
- Employee
- Assignment
- Result

---

## After Successful Deployment

Once all models are deployed:

1. ✅ BusinessUnitList will work
2. ✅ StoreList will work
3. ✅ ManagerList will work
4. ✅ All SuperAdmin features will work
5. ✅ All BusinessUnit features will work
6. ✅ All Store features will work

---

## Quick Command

```bash
# 1. Commit and push
git add amplify/package.json amplify/package-lock.json
git commit -m "Fix dependencies - deploy all models"
git push origin dev

# 2. Wait 5-10 minutes, then:
npx ampx generate outputs --app-id d6c38s8spsb1t --branch dev --profile amplify

# 3. Verify and copy
jq '.data.model_introspection.models | keys' amplify_outputs.json
cp amplify_outputs.json my-training-admin/src/amplify_outputs.json
```

---

**The build errors are now fixed. Push the code and the models should deploy!** 🚀



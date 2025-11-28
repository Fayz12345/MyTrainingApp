# Deploy Missing Models: BusinessUnit, Store, Manager

## Problem

Your `amplify/data/resource.ts` defines 8 models:
- ✅ BusinessUnit
- ✅ Store
- ✅ Manager
- ✅ Course
- ✅ QuizQuestion
- ✅ Employee
- ✅ Assignment
- ✅ Result

But your deployed backend only has 5 models:
- ✅ Course
- ✅ QuizQuestion
- ✅ Employee
- ✅ Assignment
- ✅ Result

**Missing:** BusinessUnit, Store, Manager

---

## Solution: Deploy Backend

### Step 1: Commit Your Schema

```bash
cd /var/www/html/MyTrainingApp

# Check if schema is committed
git status amplify/data/resource.ts

# If not committed, commit it
git add amplify/data/resource.ts
git commit -m "Add BusinessUnit, Store, Manager models to schema"
```

### Step 2: Deploy Backend

**Option A: Push to Git (Recommended)**

```bash
# Push to trigger deployment
git push origin dev

# Wait 5-10 minutes for deployment
# Check status: https://ca-central-1.console.aws.amazon.com/amplify/home?region=ca-central-1#/d6c38s8spsb1t
```

**Option B: Use Sandbox (For Testing)**

```bash
# Deploy to sandbox
npx ampx sandbox --once \
  --outputs-out-dir ./outputs \
  --outputs-format json

# Wait 3-5 minutes
```

### Step 3: Regenerate Outputs

After deployment completes:

```bash
# Generate new outputs
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

### Step 4: Copy to Admin App

```bash
cp amplify_outputs.json my-training-admin/src/amplify_outputs.json
```

### Step 5: Restart Your App

```bash
cd my-training-admin
npm start
```

---

## Quick Command (All in One)

```bash
# 1. Commit and push
git add amplify/data/resource.ts
git commit -m "Deploy all models"
git push origin dev

# 2. Wait 5-10 minutes, then:
npx ampx generate outputs --app-id d6c38s8spsb1t --branch dev --profile amplify

# 3. Verify and copy
jq '.data.model_introspection.models | keys' amplify_outputs.json
cp amplify_outputs.json my-training-admin/src/amplify_outputs.json
```

---

## Why This Happened

The backend was deployed before all models were added to the schema, or the outputs are from an older deployment. The schema file has all models, but they need to be deployed to AWS to be available.

---

## Verify Deployment Status

Check if backend is deploying:

```bash
# Check deployment status
aws amplify list-jobs \
  --app-id d6c38s8spsb1t \
  --branch-name dev \
  --region ca-central-1 \
  --profile amplify \
  --max-results 1 \
  | jq '.jobSummaries[0] | {status: .status, jobId: .jobId}'
```

---

## After Deployment

Once all models are deployed:
- ✅ BusinessUnitList will work
- ✅ StoreList will work
- ✅ ManagerList will work
- ✅ All SuperAdmin features will work
- ✅ All BusinessUnit features will work
- ✅ All Store features will work

---

**Bottom Line:** Push your code to deploy the backend with all models! 🚀


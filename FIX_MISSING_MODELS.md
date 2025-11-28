# Fix: BusinessUnit, Store, Manager Models Not Found

## The Problem

Your schema defines these models:
- ✅ BusinessUnit
- ✅ Store  
- ✅ Manager
- ✅ Course
- ✅ QuizQuestion
- ✅ Employee
- ✅ Assignment
- ✅ Result

But your deployed backend only has:
- ❌ Course
- ❌ QuizQuestion
- ❌ Employee
- ❌ Assignment
- ❌ Result

**Missing:** BusinessUnit, Store, Manager

---

## Solution: Deploy Backend with Full Schema

The backend needs to be redeployed to include all models. Here are your options:

### Option 1: Deploy via Git Push (Recommended)

```bash
# 1. Make sure all changes are committed
git add .
git commit -m "Add BusinessUnit, Store, Manager models to backend"

# 2. Push to trigger deployment
git push origin dev

# 3. Wait for deployment (5-10 minutes)
# Check status in Amplify Console

# 4. After deployment completes, regenerate outputs
npx ampx generate outputs \
  --app-id d6c38s8spsb1t \
  --branch dev \
  --profile amplify

# 5. Verify all models are now present
jq '.data.model_introspection.models | keys' amplify_outputs.json

# 6. Copy to admin app
cp amplify_outputs.json my-training-admin/src/amplify_outputs.json
```

### Option 2: Deploy via Sandbox (For Testing)

```bash
# 1. Deploy to sandbox
npx ampx sandbox --once \
  --outputs-out-dir ./outputs \
  --outputs-format json

# 2. Wait for completion (3-5 minutes)

# 3. Copy outputs
cp outputs/amplify_outputs.json my-training-admin/src/amplify_outputs.json

# 4. Test your app
cd my-training-admin
npm start
```

### Option 3: Use GitHub Actions (If Configured)

If you have GitHub Actions set up, just push:

```bash
git add .
git commit -m "Deploy backend with all models"
git push origin dev
```

GitHub Actions will automatically deploy the backend.

---

## Verify Models After Deployment

After deployment, check that all models are present:

```bash
# Check models in outputs
jq '.data.model_introspection.models | keys' amplify_outputs.json
```

You should see:
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

---

## Why This Happened

The backend was likely deployed before all models were added to the schema, or the outputs are from an older deployment. The schema file has all models, but they need to be deployed to AWS.

---

## Quick Fix (If You Need to Test Now)

If you need to test immediately, use sandbox:

```bash
# Deploy to sandbox (includes all models)
npx ampx sandbox --once --outputs-out-dir ./outputs --outputs-format json

# Copy outputs
cp outputs/amplify_outputs.json my-training-admin/src/amplify_outputs.json

# Start app
cd my-training-admin && npm start
```

---

## After Deployment

Once all models are deployed:

1. ✅ BusinessUnit model will be available
2. ✅ Store model will be available
3. ✅ Manager model will be available
4. ✅ All components will work correctly

---

## Summary

**The fix:** Deploy the backend to include all models from your schema.

**Quickest way:**
```bash
git push origin dev
# Wait 5-10 minutes
npx ampx generate outputs --app-id d6c38s8spsb1t --branch dev --profile amplify
cp amplify_outputs.json my-training-admin/src/amplify_outputs.json
```

Once deployed, all models will be available! 🚀


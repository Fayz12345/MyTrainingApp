# When to Regenerate amplify_outputs.json

## Current Situation

**Dev API:** `rq3xk7mcifgy7jhn2yokysdo7e`
- Currently has only **5 models** (Course, QuizQuestion, Employee, Assignment, Result)
- Missing: BusinessUnit, Store, Manager

**Your Schema:** `amplify/data/resource.ts`
- Has all **8 models** defined
- Ready to deploy

---

## ❌ Don't Regenerate Now

If you regenerate `amplify_outputs.json` **right now**:
- It will still only show **5 models**
- The dev API hasn't been updated yet
- You'll get the same incomplete model list

---

## ✅ Correct Order

### Step 1: Deploy Backend First

```bash
# Commit schema changes
git add amplify/data/resource.ts
git commit -m "Add BusinessUnit, Store, Manager models to dev API"
git push origin dev
```

This will:
- Trigger Amplify deployment
- Update the dev API (`rq3xk7mcifgy7jhn2yokysdo7e`)
- Add BusinessUnit, Store, Manager models
- Create/update DynamoDB tables

### Step 2: Wait for Deployment

Monitor deployment in AWS Console:
https://ca-central-1.console.aws.amazon.com/amplify/home?region=ca-central-1#/d6c38s8spsb1t

Or check via CLI:
```bash
aws amplify list-jobs \
  --app-id d6c38s8spsb1t \
  --branch-name dev \
  --region ca-central-1 \
  --profile amplify \
  --max-results 1 \
  | jq '.jobSummaries[0].status'
```

Wait until status is `SUCCEED`.

### Step 3: THEN Regenerate Outputs

After deployment completes:

```bash
npx ampx generate outputs \
  --app-id d6c38s8spsb1t \
  --branch dev \
  --profile amplify
```

This will:
- ✅ Fetch updated dev API schema
- ✅ Include all **8 models** in `model_introspection`
- ✅ Include BusinessUnit, Store, Manager definitions
- ✅ Update authorization rules

### Step 4: Copy to Admin App

```bash
cp amplify_outputs.json my-training-admin/src/amplify_outputs.json
```

---

## Why This Order Matters

**If you regenerate before deploying:**
```
Schema (8 models) → Deploy → API (8 models) → Regenerate → Outputs (8 models) ✅
```

**If you regenerate after deploying:**
```
Schema (8 models) → Deploy → API (8 models) → Regenerate → Outputs (8 models) ✅
```

**If you regenerate before deploying:**
```
Schema (8 models) → Regenerate → Outputs (5 models) ❌ → Deploy → API (8 models) → Need to regenerate again!
```

---

## Summary

**Answer: Not yet!**

1. ✅ **First:** Deploy backend (git push)
2. ✅ **Then:** Wait for deployment
3. ✅ **Finally:** Regenerate outputs

**After regeneration, you'll have all 8 models in `amplify_outputs.json`!**

---

## Quick Check

To verify the dev API has all 8 models after deployment:

```bash
API_ID="rq3xk7mcifgy7jhn2yokysdo7e"

aws appsync get-introspection-schema \
  --api-id "$API_ID" \
  --format SDL \
  --region ca-central-1 \
  --profile amplify \
  /tmp/dev-api-schema.sdl

# Count models
grep -E "^type [A-Z][a-zA-Z]+ " /tmp/dev-api-schema.sdl | \
  sed 's/^type //' | \
  sed 's/ @.*//' | \
  grep -vE "Query|Mutation|Subscription|Model|Connection|Filter|Sort|PageInfo|__" | \
  wc -l
```

Should show **8** after deployment.


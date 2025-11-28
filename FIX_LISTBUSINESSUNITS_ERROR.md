# Fix: "listBusinessUnits" is undefined

## Error

```
Failed to fetch business units: Validation error of type UnknownType: 
Unknown type ModelBusinessUnitFilterInput, 
Validation error of type FieldUndefined: 
Field 'listBusinessUnits' in type 'Query' is undefined @ 'listBusinessUnits'
```

## Root Cause

**The dev API doesn't have BusinessUnit model yet!**

- ✅ `amplify_outputs.json` has BusinessUnit model definition (metadata)
- ❌ Dev API (`rq3xk7mcifgy7jhn2yokysdo7e`) doesn't have BusinessUnit in GraphQL schema
- ❌ `listBusinessUnits` query doesn't exist in the API

**Why:**
- The dev API was deployed before BusinessUnit, Store, Manager were added to the schema
- Model definitions in `amplify_outputs.json` are just metadata - they don't create the actual API
- The AppSync GraphQL schema needs to be updated by deploying the backend

---

## Solution

### Step 1: Deploy Backend

The schema file (`amplify/data/resource.ts`) already has all 8 models defined. Deploy it:

```bash
# Make sure you're on dev branch
git checkout dev

# Add and commit schema changes
git add amplify/data/resource.ts
git commit -m "Deploy: Add BusinessUnit, Store, Manager to dev API"
git push origin dev
```

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

Wait until status is `SUCCEED` (usually 5-10 minutes).

### Step 3: Verify API Has Models

After deployment, verify the dev API has all 8 models:

```bash
API_ID="rq3xk7mcifgy7jhn2yokysdo7e"

aws appsync get-introspection-schema \
  --api-id "$API_ID" \
  --format SDL \
  --region ca-central-1 \
  --profile amplify \
  /tmp/dev-api-check.sdl

# Count models
grep -E "^type [A-Z][a-zA-Z]+ " /tmp/dev-api-check.sdl | \
  sed 's/^type //' | \
  sed 's/ @.*//' | \
  grep -vE "Query|Mutation|Subscription|Model|Connection|Filter|Sort|PageInfo|__" | \
  wc -l
```

Should show **8 models**.

### Step 4: Verify listBusinessUnits Exists

```bash
grep -q "listBusinessUnits" /tmp/dev-api-check.sdl && \
  echo "✅ listBusinessUnits exists!" || \
  echo "❌ Still missing"
```

### Step 5: Test in Frontend

After deployment, refresh your frontend app and try again. The error should be gone!

---

## Why This Happens

**amplify_outputs.json vs AppSync Schema:**

- `amplify_outputs.json` = Metadata/configuration file
  - Contains model definitions for frontend code generation
  - Doesn't create the actual API
  - Can be manually edited (but won't affect the API)

- AppSync GraphQL Schema = The actual API
  - Created/updated by Amplify deployments
  - Contains the actual queries, mutations, types
  - Must be deployed to change

**The Problem:**
- You manually added BusinessUnit to `amplify_outputs.json` ✅
- But the AppSync API still doesn't have it ❌
- So `listBusinessUnits` doesn't exist in the API

**The Solution:**
- Deploy backend to update AppSync schema
- Then both `amplify_outputs.json` and AppSync will have BusinessUnit ✅

---

## Current Status

**Dev API (`rq3xk7mcifgy7jhn2yokysdo7e`):**
- Has 5 models: Assignment, Course, Employee, QuizQuestion, Result
- Missing: BusinessUnit, Store, Manager

**After Deployment:**
- Will have all 8 models
- `listBusinessUnits`, `listStores`, `listManagers` will work
- Error will be fixed!

---

## Summary

**Error:** `listBusinessUnits` is undefined

**Cause:** Dev API doesn't have BusinessUnit model yet

**Fix:** Deploy backend (`git push origin dev`)

**After:** All 8 models will work!


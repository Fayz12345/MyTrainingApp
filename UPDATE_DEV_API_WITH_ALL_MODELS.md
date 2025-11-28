# Update Dev Branch API to Include All 8 Models

## Current Situation

**Dev Branch API:** `rq3xk7mcifgy7jhn2yokysdo7e`
- ✅ Connected to dev branch (`amplify:branch-name: dev`)
- ✅ Official dev API for your Amplify app
- ❌ Only has 5 models (Assignment, Course, Employee, QuizQuestion, Result)
- ❌ Missing: BusinessUnit, Store, Manager

**Why:** This API was deployed before you added BusinessUnit, Store, and Manager to your schema.

---

## Solution: Deploy Backend to Update Dev API

Your schema file (`amplify/data/resource.ts`) already has all 8 models defined. You just need to deploy it to update the dev API.

### Step 1: Verify Schema Has All Models

```bash
# Check schema file
grep -E "^\s+[A-Z][a-zA-Z]+:\s*a\.model" amplify/data/resource.ts
```

Should show all 8 models.

### Step 2: Commit Schema Changes

```bash
git add amplify/data/resource.ts
git commit -m "Update dev API - add BusinessUnit, Store, Manager models"
git push origin dev
```

### Step 3: Wait for Deployment

Monitor deployment:
```bash
aws amplify list-jobs \
  --app-id d6c38s8spsb1t \
  --branch-name dev \
  --region ca-central-1 \
  --profile amplify \
  --max-results 1 \
  | jq '.jobSummaries[0] | {status: .status, jobId: .jobId}'
```

Or check in AWS Console:
https://ca-central-1.console.aws.amazon.com/amplify/home?region=ca-central-1#/d6c38s8spsb1t

### Step 4: Verify Dev API Has All Models

After deployment completes:

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

Should show **8 models**.

### Step 5: Regenerate Outputs

```bash
npx ampx generate outputs \
  --app-id d6c38s8spsb1t \
  --branch dev \
  --profile amplify
```

This will update `amplify_outputs.json` with the updated dev API.

### Step 6: Copy to Admin App

```bash
cp amplify_outputs.json my-training-admin/src/amplify_outputs.json
```

---

## Why This Will Work

When you deploy:
1. Amplify reads your `amplify/data/resource.ts` schema
2. Generates GraphQL schema with all 8 models
3. Updates the dev branch API (`rq3xk7mcifgy7jhn2yokysdo7e`)
4. Adds BusinessUnit, Store, Manager models
5. Updates DynamoDB tables if needed

---

## Current Configuration

I've updated your `amplify_outputs.json` to use the dev API:
- URL: `https://mswo73fsfjh4thfaalt7d63i4a.appsync-api.ca-central-1.amazonaws.com/graphql`
- API ID: `rq3xk7mcifgy7jhn2yokysdo7e`

**But this API only has 5 models right now.**

**After you deploy, it will have all 8 models!**

---

## Alternative: Use Sandbox API Temporarily

If you need to test immediately while waiting for deployment:

The sandbox API (`csxrkv7kenai5i4jycdl73t3uy`) has all 8 models and works, but:
- ⚠️ It's temporary (sandbox)
- ⚠️ Not connected to your dev branch
- ⚠️ Will be deleted when sandbox stops

**Better to deploy and update the dev API properly.**

---

## Summary

**Current:** Dev API (`rq3xk7mcifgy7jhn2yokysdo7e`) only has 5 models

**Solution:** Deploy backend to update dev API with all 8 models

**After Deployment:** Dev API will have all 8 models and work correctly

---

**Deploy your backend now to update the dev API with all 8 models!**


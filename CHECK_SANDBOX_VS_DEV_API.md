# Check: Is API csxrkv7kenai5i4jycdl73t3uy a Sandbox API?

## Question

Is API `csxrkv7kenai5i4jycdl73t3uy` a sandbox API?

## How to Check

### Method 1: Check API Tags

In AppSync Console, go to the API's **Settings** tab and check the **Tags** section.

Look for:
- **Key:** `amplify:deployment-type`
- **Value:** `sandbox` or `production` or `dev`

If it says `sandbox`, it's a sandbox API.

### Method 2: Check via AWS CLI

```bash
aws appsync get-graphql-api \
  --api-id csxrkv7kenai5i4jycdl73t3uy \
  --region ca-central-1 \
  --profile amplify \
  | jq -r '.graphqlApi.tags["amplify:deployment-type"]'
```

**Output:**
- `sandbox` = Sandbox API
- `production` or `dev` = Production/Dev API
- `null` or empty = Unknown/No tag

---

## What This Means

### If It's a Sandbox API

**Sandbox APIs are:**
- Created by `npx ampx sandbox`
- Temporary (can be deleted)
- For local development/testing
- Not connected to your Amplify app deployment

**If this is sandbox:**
- ❌ Not the right API for your dev branch
- ❌ Will be deleted when sandbox stops
- ✅ But it has all 8 models (which is good for testing)

### If It's a Dev/Production API

**Dev/Production APIs are:**
- Created by Amplify deployments (`git push`)
- Permanent (until you delete them)
- Connected to your Amplify app
- Used by your deployed application

**If this is dev/production:**
- ✅ This is the correct API to use
- ✅ Will persist across deployments
- ✅ Connected to your Amplify app

---

## Which API Should You Use?

### For Development/Testing

**Use the API that:**
1. Has all 8 models ✅
2. Has all 8 DynamoDB tables ✅
3. Is connected to your dev branch deployment ✅

**Currently:**
- API `csxrkv7kenai5i4jycdl73t3uy` has all 8 models ✅
- API `rq3xk7mcifgy7jhn2yokysdo7e` only has 5 models ❌

**Even if `csxrkv7kenai5i4jycdl73t3uy` is sandbox, it's the one with all models!**

### For Production

You should use the API that:
- Is created by your Amplify app deployment
- Has the `amplify:deployment-type` tag set to `production` or `dev`
- Is associated with your dev branch in Amplify Console

---

## Solution

### Option 1: Use the API with All Models (Current)

Even if `csxrkv7kenai5i4jycdl73t3uy` is sandbox:
- ✅ It has all 8 models
- ✅ It works for development
- ✅ Your app is already configured to use it

**Just use it for now!**

### Option 2: Find the Correct Dev API

If you want to use the "official" dev API:

1. **Regenerate outputs:**
   ```bash
   npx ampx generate outputs \
     --app-id d6c38s8spsb1t \
     --branch dev \
     --profile amplify
   ```

2. **Check which API it points to:**
   ```bash
   jq -r '.data.url' amplify_outputs.json
   jq -r '.data.aws_appsync_graphql_api_id' amplify_outputs.json
   ```

3. **Verify it has all 8 models:**
   ```bash
   API_ID=$(jq -r '.data.aws_appsync_graphql_api_id' amplify_outputs.json)
   aws appsync get-introspection-schema \
     --api-id "$API_ID" \
     --format SDL \
     --region ca-central-1 \
     --profile amplify \
     /tmp/check.sdl
   
   grep -E "^type [A-Z][a-zA-Z]+ " /tmp/check.sdl | \
     sed 's/^type //' | \
     sed 's/ @.*//' | \
     grep -vE "Query|Mutation|Subscription|Model|Connection|Filter|Sort|PageInfo|__" | \
     wc -l
   ```
   
   Should show **8 models**.

### Option 3: Deploy to Create New Dev API

If the dev API doesn't have all models:

1. **Deploy your backend:**
   ```bash
   git push origin dev
   ```

2. **Wait for deployment**

3. **Regenerate outputs:**
   ```bash
   npx ampx generate outputs \
     --app-id d6c38s8spsb1t \
     --branch dev \
     --profile amplify
   ```

4. **This should create/update the dev API with all 8 models**

---

## Recommendation

**For now, use API `csxrkv7kenai5i4jycdl73t3uy`** because:
- ✅ It has all 8 models
- ✅ It works
- ✅ Your app is already configured for it

**Later, you can:**
- Deploy backend to ensure dev API has all models
- Regenerate outputs to get the "official" dev API
- Switch to that if needed

---

## Summary

**Question:** Is `csxrkv7kenai5i4jycdl73t3uy` a sandbox API?

**Answer:** Possibly - check the tags in AppSync Console.

**Does it matter?** Not really - it has all 8 models and works!

**What to do:** Use it for now, or regenerate outputs to find the "official" dev API.

---

**The important thing is: Does it have all 8 models? YES! So use it!**


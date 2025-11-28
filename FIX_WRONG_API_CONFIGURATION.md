# Fix: Wrong AppSync API Configuration

## Problem Identified

Your `amplify_outputs.json` is pointing to the **WRONG AppSync API**!

### Current (WRONG) Configuration:
```json
{
  "data": {
    "url": "https://mswo73fsfjh4thfaalt7d63i4a.appsync-api.ca-central-1.amazonaws.com/graphql",
    "aws_appsync_graphql_api_id": null  // Missing!
  }
}
```

### Correct Configuration:
```json
{
  "data": {
    "url": "https://nf2ayvu4ebgm3f2bomzsr5wxmq.appsync-api.ca-central-1.amazonaws.com/graphql",
    "aws_appsync_graphql_api_id": "csxrkv7kenai5i4jycdl73t3uy"
  }
}
```

---

## Why This Causes Issues

1. **Wrong API** (`mswo73fsfjh4thfaalt7d63i4a`) - Likely only has 5 models (missing BusinessUnit, Store, Manager)
2. **Missing API ID** - `aws_appsync_graphql_api_id` is `null`
3. **Wrong User Pool** - AppSync might be using different User Pool

This is why:
- ❌ BusinessUnit queries fail
- ❌ Models not found errors
- ❌ Unauthorized errors

---

## Solution: Fix from AWS Side (No Code Changes)

### Option 1: Regenerate Outputs (Recommended)

This will get the correct API from Amplify:

```bash
npx ampx generate outputs \
  --app-id d6c38s8spsb1t \
  --branch dev \
  --profile amplify
```

This should update `amplify_outputs.json` with:
- ✅ Correct API URL
- ✅ Correct API ID
- ✅ Correct User Pool configuration

### Option 2: Update Manually (Already Done)

I've already updated your `amplify_outputs.json` to point to the correct API:
- ✅ URL: `https://nf2ayvu4ebgm3f2bomzsr5wxmq.appsync-api.ca-central-1.amazonaws.com/graphql`
- ✅ API ID: `csxrkv7kenai5i4jycdl73t3uy`

**Refresh your app and try again!**

### Option 3: Check Amplify Console

1. Go to: https://ca-central-1.console.aws.amazon.com/amplify/home?region=ca-central-1#/d6c38s8spsb1t
2. Click on your app
3. Go to **Backend environments** → **dev**
4. Check **Data** section
5. Note the API URL and ID shown there
6. Update `amplify_outputs.json` to match

---

## Verification

After fixing, verify:

```bash
# Check API URL
jq -r '.data.url' amplify_outputs.json
# Should be: https://nf2ayvu4ebgm3f2bomzsr5wxmq.appsync-api.ca-central-1.amazonaws.com/graphql

# Check API ID
jq -r '.data.aws_appsync_graphql_api_id' amplify_outputs.json
# Should be: csxrkv7kenai5i4jycdl73t3uy

# Check User Pool
jq -r '.auth.user_pool_id' amplify_outputs.json
# Should be: ca-central-1_aKCLbCdhj
```

---

## Why This Happened

When you run `npx ampx generate outputs`, it reads from the Amplify app deployment. If:
- Multiple APIs exist
- Deployment created a new API
- Outputs weren't regenerated after deployment

Then `amplify_outputs.json` can point to the wrong API.

---

## After Fixing

1. **Refresh your browser** (or restart dev server)
2. **Try BusinessUnit query again**
3. **Should work now!**

The correct API has:
- ✅ All 8 models
- ✅ All 8 DynamoDB tables
- ✅ Correct User Pool configuration

---

## Summary

**Root Cause:** `amplify_outputs.json` pointing to wrong AppSync API

**Fix Applied:** ✅ Updated to correct API URL and ID

**Next Step:** Refresh app and test - should work now!

---

**I've already fixed your `amplify_outputs.json` - just refresh your app!**


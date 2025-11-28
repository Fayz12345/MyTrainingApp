# Updated amplify_outputs.json to Point to Correct API

## Changes Made

✅ **Updated API URL:**
- **Old:** `https://mswo73fsfjh4thfaalt7d63i4a.appsync-api.ca-central-1.amazonaws.com/graphql`
- **New:** `https://nf2ayvu4ebgm3f2bomzsr5wxmq.appsync-api.ca-central-1.amazonaws.com/graphql`

✅ **Updated API ID:**
- **New API ID:** `csxrkv7kenai5i4jycdl73t3uy`

## Why This API?

This API (`csxrkv7kenai5i4jycdl73t3uy`) is the one that has your DynamoDB tables:
- `BusinessUnit-csxrkv7kenai5i4jycdl73t3uy-NONE`
- `Store-csxrkv7kenai5i4jycdl73t3uy-NONE`
- `Manager-csxrkv7kenai5i4jycdl73t3uy-NONE`

## Next Steps

### 1. Verify in AppSync Console

Check if this API has all 8 models:
https://ca-central-1.console.aws.amazon.com/appsync/home?region=ca-central-1#/csxrkv7kenai5i4jycdl73t3uy/schema

Look for these types in the Schema tab:
- `type BusinessUnit` ✅
- `type Store` ✅
- `type Manager` ✅
- `type Course` ✅
- `type Employee` ✅
- `type Assignment` ✅
- `type QuizQuestion` ✅
- `type Result` ✅

### 2. If All Models Are There

The outputs are now pointing to the correct API. Your app should be able to access all models!

### 3. If Models Are Still Missing

If the AppSync schema still only shows 5 models, you'll need to:
1. Deploy your code changes to sync the schema
2. Or use sandbox to rebuild everything

## Current Status

- ✅ **Outputs updated** to point to correct API
- ✅ **Copied to admin app** (`my-training-admin/src/amplify_outputs.json`)
- ⚠️ **Model introspection** may still show old data (needs verification)

## Verify

Run this to check:
```bash
./check-models.sh
```

Or check the AppSync console directly to see which models are in the schema.


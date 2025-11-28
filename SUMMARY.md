# Why Only 5 Models Are Showing - Complete Analysis

## ✅ What I Found

1. **Schema File:** All 8 models correctly defined ✅
2. **Compiled Code:** All 8 models in resource.js ✅  
3. **DynamoDB Tables:** All 8 models have tables ✅
   - BusinessUnit-csxrkv7kenai5i4jycdl73t3uy-NONE ✅
   - Store-csxrkv7kenai5i4jycdl73t3uy-NONE ✅
   - Manager-csxrkv7kenai5i4jycdl73t3uy-NONE ✅
4. **AppSync Schema:** Only 5 models in GraphQL schema ❌

## 🔍 Root Cause

**The AppSync GraphQL schema is out of sync with DynamoDB tables.**

The DynamoDB tables exist, but the AppSync schema wasn't updated when these models were added. This happens when:
- Models are added after initial deployment
- Authorization groups don't exist during deployment
- Schema update fails silently

## 🚀 Solution

**Force a complete backend redeploy:**

```bash
# Option 1: Use the script
./FORCE_FULL_REDEPLOY.sh
git push origin dev

# Option 2: Use sandbox (fastest for testing)
npx ampx sandbox --once --outputs-out-dir ./outputs --outputs-format json
cp outputs/amplify_outputs.json my-training-admin/src/amplify_outputs.json
```

## 📊 Current Status

- **Schema:** 8 models ✅
- **DynamoDB:** 8 models ✅  
- **AppSync:** 5 models ❌
- **Outputs:** 5 models ❌

After redeploy, all should show 8 models!

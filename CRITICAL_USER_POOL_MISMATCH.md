# CRITICAL: User Pool Mismatch Found!

## Issue Discovered

**AppSync API is using a DIFFERENT User Pool than your application!**

- **Your App Uses:** `ca-central-1_aKCLbCdhj`
- **AppSync Uses:** `ca-central-1_4bZDDl469`

**This is why authorization fails!** Even if your token is valid, AppSync is checking it against a different User Pool that doesn't have your user or groups.

---

## Impact

1. ✅ Token is sent correctly
2. ✅ Token is valid for User Pool `ca-central-1_aKCLbCdhj`
3. ❌ AppSync checks token against User Pool `ca-central-1_4bZDDl469`
4. ❌ Token doesn't match → "Unauthorized"

---

## Solution

### Option 1: Update AppSync to Use Correct User Pool

This requires updating the AppSync API configuration. However, with Amplify Gen 2, this should be automatic.

**Check if this is a configuration issue:**

```bash
# Check what User Pool your amplify_outputs.json expects
jq -r '.auth.user_pool_id' amplify_outputs.json

# Check what AppSync is actually using
API_ID="csxrkv7kenai5i4jycdl73t3uy"
aws appsync get-graphql-api \
  --api-id "$API_ID" \
  --region ca-central-1 \
  --profile amplify \
  | jq -r '.graphqlApi.userPoolConfig.userPoolId'
```

If they don't match, this is the problem!

### Option 2: Regenerate Outputs

The `amplify_outputs.json` might be pointing to the wrong User Pool:

```bash
npx ampx generate outputs \
  --app-id d6c38s8spsb1t \
  --branch dev \
  --profile amplify

# Check if User Pool ID matches
jq -r '.auth.user_pool_id' amplify_outputs.json
```

### Option 3: Check Amplify Backend Configuration

The backend might be configured to use a different User Pool. Check:

```bash
# Check backend configuration
cat amplify/backend.ts 2>/dev/null || echo "No backend.ts found"
```

---

## Why This Happens

Amplify Gen 2 should automatically:
1. Create/configure Cognito User Pool
2. Create AppSync API
3. Link them together

If they're not linked correctly, you get this mismatch.

---

## Verification

After fixing, verify:

1. **User Pool IDs match:**
   ```bash
   OUTPUTS_POOL=$(jq -r '.auth.user_pool_id' amplify_outputs.json)
   APPSYNC_POOL=$(aws appsync get-graphql-api \
     --api-id csxrkv7kenai5i4jycdl73t3uy \
     --region ca-central-1 \
     --profile amplify \
     | jq -r '.graphqlApi.userPoolConfig.userPoolId')
   
   if [ "$OUTPUTS_POOL" = "$APPSYNC_POOL" ]; then
     echo "✅ User Pools match!"
   else
     echo "❌ User Pools don't match!"
     echo "  Outputs: $OUTPUTS_POOL"
     echo "  AppSync: $APPSYNC_POOL"
   fi
   ```

2. **User is in correct User Pool:**
   ```bash
   # Check which User Pool has your user
   aws cognito-idp list-users \
     --user-pool-id ca-central-1_aKCLbCdhj \
     --region ca-central-1 \
     --profile amplify \
     | jq -r '.Users[] | select(.Username == "<your-email>") | .Username'
   ```

---

## Quick Fix

If AppSync is using the wrong User Pool:

1. **Regenerate outputs** to get correct configuration
2. **Redeploy backend** to sync User Pool configuration
3. **Verify** User Pool IDs match

---

**This User Pool mismatch is likely the root cause of your authorization issues!**


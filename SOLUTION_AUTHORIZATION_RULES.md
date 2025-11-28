# Solution: Authorization Rules Not Syncing to AppSync

## Current Status

✅ **Token IS being sent** - No "header not provided" error  
✅ **Query executes** - No network errors  
❌ **AppSync returns "Unauthorized"** - Missing authorization rules

## Root Cause

The AppSync GraphQL schema is **missing `@auth` directives** for BusinessUnit (and likely Store, Manager).

Your schema file (`amplify/data/resource.ts`) correctly defines:
```typescript
.authorization(allow => [
  allow.group('SuperAdmin').to(['create', 'read', 'update', 'delete']),
  // ...
])
```

But these rules are **NOT being synced** to AppSync during deployment.

## Why This Happens

Amplify Gen 2 should automatically:
1. Parse authorization rules from schema
2. Generate `@auth` directives in GraphQL schema
3. Deploy to AppSync

**Step 2 is failing** - authorization rules aren't being converted to `@auth` directives.

## Solutions

### Solution 1: Force Schema Rebuild (Recommended)

Make a more significant change to force Amplify to rebuild the schema:

```typescript
// In amplify/data/resource.ts
// Add a dummy field or change something that forces schema regeneration
BusinessUnit: a
  .model({
    id: a.id(),
    name: a.string().required(),
    description: a.string(),
    createdBy: a.string(),
    stores: a.hasMany('Store', 'businessUnitId'),
    createdAt: a.datetime().required(),
    updatedAt: a.datetime().required(),
    // Add this temporarily to force rebuild
    _syncVersion: a.integer().default(1) // Force schema change
  })
```

Then:
```bash
git add amplify/data/resource.ts
git commit -m "Force schema rebuild with authorization rules"
git push origin dev
```

After deployment, remove the `_syncVersion` field.

### Solution 2: Use Sandbox to Rebuild

Sandbox often does a better job of syncing authorization:

```bash
npx ampx sandbox --once \
  --outputs-out-dir ./outputs \
  --outputs-format json

# Check if sandbox has @auth
grep -A 20 "type BusinessUnit" outputs/schema.graphql | grep "@auth"

# If it has @auth, you can:
# 1. Use sandbox outputs temporarily
# 2. Or check what's different in sandbox vs deployed
```

### Solution 3: Check Amplify Gen 2 Version

Update Amplify packages:

```bash
cd amplify
npm update @aws-amplify/backend @aws-amplify/backend-cli
```

Then redeploy.

### Solution 4: Manual Schema Update (Not Recommended)

You could manually add `@auth` directives in AppSync Console, but they'll be overwritten on next deployment.

## Verification

After deployment, check:

```bash
API_ID="csxrkv7kenai5i4jycdl73t3uy"

aws appsync get-introspection-schema \
  --api-id "$API_ID" \
  --format SDL \
  --region ca-central-1 \
  --profile amplify \
  /tmp/schema.sdl

# Should see @auth directive
grep -A 20 "type BusinessUnit" /tmp/schema.sdl
```

**Expected:**
```graphql
type BusinessUnit 
  @aws_cognito_user_pools 
  @aws_iam
  @auth(rules: [
    { allow: groups, groups: ["SuperAdmin"], operations: [create, read, update, delete] }
    { allow: groups, groups: ["BusinessUnit", "Store", "Managers"], operations: [read] }
  ]) {
  # ...
}
```

## Why Previous Deployments Didn't Work

Possible reasons:
1. **Schema change too small** - Amplify didn't detect it
2. **Authorization rules not processed** - Bug in Amplify Gen 2
3. **Deployment didn't complete** - Check deployment logs
4. **Wrong API deployed to** - Multiple APIs exist

## Test Other Models

To confirm this is a BusinessUnit-specific issue:

1. Try querying `Course` or `Employee` models
2. If they work → Issue is specific to BusinessUnit/Store/Manager
3. If they also fail → General authorization issue

## Immediate Workaround

While waiting for deployment:

1. **Use AppSync Console** to test queries directly:
   https://ca-central-1.console.aws.amazon.com/appsync/home?region=ca-central-1#/csxrkv7kenai5i4jycdl73t3uy/queries

2. **Check CloudWatch Logs** for AppSync to see detailed error:
   https://ca-central-1.console.aws.amazon.com/cloudwatch/home?region=ca-central-1#logsV2:log-groups

3. **Verify user is in SuperAdmin group**:
   ```bash
   ./debug-unauthorized.sh <your-email>
   ```

## Summary

**The issue is confirmed:**
- ✅ Token is being sent correctly
- ✅ Query executes successfully  
- ❌ AppSync schema missing `@auth` directives
- ❌ AppSync rejects requests because no authorization rules exist

**The fix:**
- Force a schema rebuild that properly syncs authorization rules
- Or use sandbox to rebuild everything
- Or update Amplify packages and redeploy

**Once @auth directives are in AppSync schema, your requests will work!**


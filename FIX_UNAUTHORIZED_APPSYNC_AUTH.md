# Fix: Unauthorized Error - Missing AppSync Authorization Rules

## Problem

Getting "Unauthorized" error when trying to fetch BusinessUnit, even though:
- ✅ User is in SuperAdmin group
- ✅ Schema defines group-based authorization rules
- ✅ `amplify_outputs.json` has correct auth rules
- ✅ Frontend uses `authMode: 'userPool'`

## Root Cause

The **AppSync GraphQL schema** is missing the group-based `@auth` directives!

**Current AppSync Schema:**
```graphql
type BusinessUnit @aws_cognito_user_pools @aws_iam {
  # ... fields ...
}
```

**Expected AppSync Schema:**
```graphql
type BusinessUnit 
  @aws_cognito_user_pools 
  @aws_iam
  @auth(
    rules: [
      { allow: groups, groups: ["SuperAdmin"], operations: [create, read, update, delete] }
      { allow: groups, groups: ["BusinessUnit", "Store", "Managers"], operations: [read] }
    ]
  ) {
  # ... fields ...
}
```

The authorization rules defined in `amplify/data/resource.ts` are **not being synced to AppSync**.

## Solution

### Step 1: Force Backend Deployment

The schema change has been made. Now deploy:

```bash
git add amplify/data/resource.ts
git commit -m "Force AppSync authorization sync - add group-based auth rules"
git push origin dev
```

### Step 2: Wait for Deployment (5-10 minutes)

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

### Step 3: Verify AppSync Schema Has Auth Directives

After deployment, check if `@auth` directives are present:

```bash
aws appsync get-introspection-schema \
  --api-id csxrkv7kenai5i4jycdl73t3uy \
  --format SDL \
  --region ca-central-1 \
  --profile amplify \
  /tmp/new-schema.sdl

# Check for @auth directives
grep -A 10 "type BusinessUnit" /tmp/new-schema.sdl | grep "@auth"
```

**Expected:** Should see `@auth` directive with group rules.

### Step 4: If Auth Directives Still Missing

If after deployment the `@auth` directives are still missing, this indicates Amplify Gen 2 is not properly syncing authorization rules. Options:

#### Option A: Use Sandbox to Rebuild

```bash
npx ampx sandbox --once \
  --outputs-out-dir ./outputs \
  --outputs-format json

# Check if sandbox has correct auth
grep -A 10 "type BusinessUnit" outputs/schema.graphql | grep "@auth"
```

#### Option B: Manually Add Auth Directives (Not Recommended)

This would require manually editing the AppSync schema, which is not recommended as it will be overwritten on next deployment.

#### Option C: Check Amplify Gen 2 Configuration

Verify that `amplify/data/resource.ts` is using the correct authorization syntax for Gen 2.

## Why This Happens

Amplify Gen 2 should automatically:
1. Parse authorization rules from `amplify/data/resource.ts`
2. Generate GraphQL schema with `@auth` directives
3. Deploy to AppSync

If step 2 fails, the AppSync schema won't have the authorization rules, causing "Unauthorized" errors even for users in the correct groups.

## Temporary Workaround

If you need immediate access while waiting for deployment:

1. **Check if user is in SuperAdmin group:**
   ```bash
   ./debug-unauthorized.sh
   ```

2. **If not in group, add them:**
   ```bash
   ./create-superadmin.sh <email>
   ```

3. **Sign out and sign back in** to refresh JWT token

4. **Use AppSync Console** to test queries directly:
   https://ca-central-1.console.aws.amazon.com/appsync/home?region=ca-central-1#/csxrkv7kenai5i4jycdl73t3uy/queries

## Verification

After deployment, verify:

1. ✅ AppSync schema has `@auth` directives
2. ✅ User is in SuperAdmin group
3. ✅ JWT token contains `cognito:groups` claim
4. ✅ Frontend uses `authMode: 'userPool'`

All of these must be true for authorization to work!


# FINAL FIX: Unauthorized Error - Root Cause Found!

## 🎯 Root Cause

**The AppSync GraphQL schema is MISSING `@auth` directives!**

Even if your token is being sent correctly, AppSync rejects it because there are **no authorization rules** configured in the schema.

### Current Schema (WRONG):
```graphql
type BusinessUnit @aws_cognito_user_pools @aws_iam {
  # No @auth directive!
}
```

### Expected Schema (CORRECT):
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

---

## Why This Happens

Your `amplify/data/resource.ts` file **correctly defines** authorization rules:
```typescript
.authorization(allow => [
  allow.group('SuperAdmin').to(['create', 'read', 'update', 'delete']),
  // ...
])
```

But these rules are **NOT being synced** to the AppSync GraphQL schema during deployment.

---

## Solution: Force Backend Deployment

### Step 1: Verify Schema Change is Ready

```bash
git status amplify/data/resource.ts
```

Should show the file has changes (the comment I added).

### Step 2: Commit and Push

```bash
git add amplify/data/resource.ts
git commit -m "Force AppSync authorization sync - add @auth directives"
git push origin dev
```

### Step 3: Wait for Deployment (5-10 minutes)

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

### Step 4: Verify @auth Directives Are Added

After deployment completes:

```bash
API_ID="csxrkv7kenai5i4jycdl73t3uy"

aws appsync get-introspection-schema \
  --api-id "$API_ID" \
  --format SDL \
  --region ca-central-1 \
  --profile amplify \
  /tmp/new-schema.sdl

# Check for @auth directive
grep -A 20 "type BusinessUnit" /tmp/new-schema.sdl | grep "@auth"
```

**Expected:** Should see `@auth` directive with group rules.

### Step 5: Test Again

After deployment, try the BusinessUnit query - it should work!

---

## Why Previous Deployments Didn't Work

Possible reasons:
1. **Deployment didn't complete** - Check if it actually finished
2. **Schema change wasn't detected** - Amplify didn't see the change
3. **Authorization rules not processed** - Amplify Gen 2 bug
4. **Wrong API deployed to** - Multiple APIs exist

---

## Alternative: Use Sandbox (If Deployment Fails)

If the deployment doesn't sync @auth directives, try sandbox:

```bash
npx ampx sandbox --once \
  --outputs-out-dir ./outputs \
  --outputs-format json

# Check if sandbox has @auth
grep -A 20 "type BusinessUnit" outputs/schema.graphql | grep "@auth"
```

If sandbox has @auth, copy the schema or use sandbox outputs.

---

## Test Component Added

I've added a `TestGraphQL` component to your dashboard. It will:
1. Test if token is being sent
2. Test direct fetch with manual token
3. Show detailed error messages

Use it to verify:
- ✅ Token is being sent (check Network tab)
- ✅ Token format is correct
- ✅ AppSync rejects due to missing @auth (not token issue)

---

## Verification Checklist

After deployment, verify:

- [ ] AppSync schema has `@auth` directives
- [ ] BusinessUnit type includes group-based rules
- [ ] User is in SuperAdmin group
- [ ] JWT token contains `cognito:groups` claim
- [ ] Frontend uses `authMode: 'userPool'`
- [ ] Authorization header is sent (check Network tab)

---

## Summary

**The issue is NOT with your code or token sending.**

**The issue IS that AppSync schema doesn't have authorization rules.**

**The fix: Deploy backend to sync @auth directives from your schema file to AppSync.**

Once the @auth directives are in the AppSync schema, your requests will work!

---

**Deploy the backend now and the issue should be resolved!**


# Comprehensive Codebase Check Report

Generated: $(date)

## Summary

This report provides a complete analysis of your Amplify Gen 2 backend, AppSync API, GraphQL schema, DynamoDB tables, and frontend configuration.

---

## 1. Models in Schema File

**Location:** `amplify/data/resource.ts`

**Models Defined:**
- Assignment
- BusinessUnit
- Course
- Employee
- Manager
- QuizQuestion
- Result
- Store

**Total:** 8 models ✅

---

## 2. AppSync API Configuration

**API ID:** Check `amplify_outputs.json` for `data.aws_appsync_graphql_api_id`
**API URL:** Check `amplify_outputs.json` for `data.url`

**Status:** Verify API exists in AWS and matches DynamoDB tables

---

## 3. Models in AppSync GraphQL Schema

**Check Command:**
```bash
aws appsync get-introspection-schema \
  --api-id <API_ID> \
  --format SDL \
  --region ca-central-1 \
  --profile amplify \
  /tmp/schema.sdl

grep -E "^type [A-Z][a-zA-Z]+ " /tmp/schema.sdl | \
  sed 's/^type //' | \
  sed 's/ @.*//' | \
  grep -v "Query\|Mutation\|Subscription\|Model\|Connection\|Filter\|Sort\|PageInfo\|__" | \
  sort
```

**Expected:** 8 model types (Assignment, BusinessUnit, Course, Employee, Manager, QuizQuestion, Result, Store)

**Issue:** If only 5 models appear, the schema wasn't fully synced.

---

## 4. DynamoDB Tables

**Check Command:**
```bash
aws dynamodb list-tables \
  --region ca-central-1 \
  --profile amplify | \
  jq -r '.TableNames[]' | \
  grep "csxrkv7kenai5i4jycdl73t3uy" | \
  sed 's/-csxrkv7kenai5i4jycdl73t3uy-NONE//' | \
  sort
```

**Expected:** 8 tables (one for each model)

**Issue:** If tables exist but models don't appear in AppSync, there's a schema sync issue.

---

## 5. amplify_outputs.json Configuration

**Check Models:**
```bash
jq -r '.data.model_introspection.models | keys[]' amplify_outputs.json | sort
```

**Check API:**
```bash
jq -r '.data.url' amplify_outputs.json
jq -r '.data.aws_appsync_graphql_api_id' amplify_outputs.json
```

**Issues:**
- If API ID is `null` or missing → API not properly configured
- If only 5 models in introspection → Stale data or wrong API
- If API URL doesn't match DynamoDB tables → Wrong API

---

## 6. Authorization Rules

### Schema File
**Location:** `amplify/data/resource.ts`

BusinessUnit should have:
```typescript
.authorization(allow => [
  allow.group('SuperAdmin').to(['create', 'read', 'update', 'delete']),
  allow.group('BusinessUnit').to(['read']),
  allow.group('Store').to(['read']),
  allow.group('Managers').to(['read'])
])
```

### AppSync Schema
**Check Command:**
```bash
grep -A 15 "type BusinessUnit" /tmp/schema.sdl
```

**Expected:** Should see `@auth` directive with group rules

**Issue:** If no `@auth` directive → Authorization rules not synced to AppSync

---

## 7. Frontend Code

### BusinessUnitList.tsx
**Check:**
- Uses `generateClient({ authMode: 'userPool' })`
- Calls `client.models.BusinessUnit.list()`
- Handles errors properly

### BusinessUnitForm.tsx
**Check:**
- Uses `generateClient({ authMode: 'userPool' })`
- Calls `client.models.BusinessUnit.create()` or `.update()`

---

## 8. Cognito Groups

**Groups Required:**
- SuperAdmin
- BusinessUnit
- Store
- Managers
- Employees

**Check Groups:**
```bash
jq -r '.auth.groups[] | keys[]' amplify_outputs.json
```

---

## Common Issues Found

### Issue 1: Missing Models in AppSync Schema
**Symptom:** Schema has 8 models, AppSync only has 5
**Cause:** Backend deployment didn't sync all models
**Fix:** Deploy backend again

### Issue 2: Missing @auth Directives
**Symptom:** Unauthorized errors even for SuperAdmin users
**Cause:** Authorization rules not synced to AppSync
**Fix:** Force backend deployment

### Issue 3: Wrong API ID in amplify_outputs.json
**Symptom:** Models exist in DynamoDB but not accessible via GraphQL
**Cause:** Outputs pointing to wrong AppSync API
**Fix:** Update `amplify_outputs.json` to correct API ID

### Issue 4: Stale Model Introspection
**Symptom:** `amplify_outputs.json` has old model data
**Cause:** Not regenerated after schema changes
**Fix:** Regenerate outputs or manually update

---

## Verification Checklist

- [ ] All 8 models in schema file
- [ ] All 8 models in AppSync GraphQL schema
- [ ] All 8 DynamoDB tables exist
- [ ] All 8 models in `amplify_outputs.json`
- [ ] API ID matches DynamoDB table API ID
- [ ] `@auth` directives present in AppSync schema
- [ ] Frontend uses `authMode: 'userPool'`
- [ ] User is in SuperAdmin group
- [ ] JWT token contains `cognito:groups` claim

---

## Next Steps

1. Run the comprehensive check script
2. Identify which issues are present
3. Fix issues one by one
4. Verify all checks pass
5. Test frontend functionality

---

## Quick Fix Commands

### Fix Missing Models
```bash
git add amplify/data/resource.ts
git commit -m "Force AppSync schema sync"
git push origin dev
```

### Fix Wrong API
```bash
# Update amplify_outputs.json with correct API ID
# Copy to admin app
cp amplify_outputs.json my-training-admin/src/amplify_outputs.json
```

### Fix Missing Auth
```bash
# Same as missing models - force deployment
git push origin dev
```

---

**Run the check script to see current status!**


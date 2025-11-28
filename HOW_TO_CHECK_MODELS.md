# How to Check All Models Are Available

## Quick Check (Recommended)

Run the check script:
```bash
./check-models.sh
```

This shows:
- ✅ Models in schema file
- ✅ Models in deployed backend (amplify_outputs.json)
- ✅ Models in admin app
- ✅ Comparison between schema and deployed

---

## Manual Checks

### 1. Check Models in Schema File

```bash
grep -E "^  [A-Z][a-zA-Z]+:" amplify/data/resource.ts | sed 's/:.*//' | sed 's/^  //' | sort
```

**Expected:** 8 models
- Assignment, BusinessUnit, Course, Employee, Manager, QuizQuestion, Result, Store

### 2. Check Models in amplify_outputs.json

```bash
jq -r '.data.model_introspection.models | keys[]' amplify_outputs.json | sort
```

**Expected:** 8 models

### 3. Check Models in Admin App

```bash
jq -r '.data.model_introspection.models | keys[]' my-training-admin/src/amplify_outputs.json | sort
```

**Expected:** 8 models

### 4. Count Models

```bash
# Schema
grep -E "^  [A-Z][a-zA-Z]+:" amplify/data/resource.ts | wc -l

# Outputs
jq '.data.model_introspection.models | keys | length' amplify_outputs.json
```

---

## Check in AWS Console

### 1. AppSync Console

**Link:** https://ca-central-1.console.aws.amazon.com/appsync/home?region=ca-central-1#/csxrkv7kenai5i4jycdl73t3uy/schema

1. Go to **Schema** tab
2. Look for these types:
   - `type BusinessUnit`
   - `type Store`
   - `type Manager`
   - `type Course`
   - `type Employee`
   - `type Assignment`
   - `type QuizQuestion`
   - `type Result`

### 2. DynamoDB Console

**Link:** https://ca-central-1.console.aws.amazon.com/dynamodbv2/home?region=ca-central-1#tables

Look for tables with API ID `csxrkv7kenai5i4jycdl73t3uy`:
- BusinessUnit-csxrkv7kenai5i4jycdl73t3uy-NONE
- Store-csxrkv7kenai5i4jycdl73t3uy-NONE
- Manager-csxrkv7kenai5i4jycdl73t3uy-NONE
- Course-csxrkv7kenai5i4jycdl73t3uy-NONE
- Employee-csxrkv7kenai5i4jycdl73t3uy-NONE
- Assignment-csxrkv7kenai5i4jycdl73t3uy-NONE
- QuizQuestion-csxrkv7kenai5i4jycdl73t3uy-NONE
- Result-csxrkv7kenai5i4jycdl73t3uy-NONE

---

## Check via AWS CLI

### Check DynamoDB Tables

```bash
aws dynamodb list-tables --region ca-central-1 --profile amplify | \
  jq -r '.TableNames[]' | \
  grep "csxrkv7kenai5i4jycdl73t3uy" | \
  sed 's/-csxrkv7kenai5i4jycdl73t3uy-NONE//' | \
  sort
```

### Check AppSync Schema

```bash
API_ID="csxrkv7kenai5i4jycdl73t3uy"
aws appsync get-introspection-schema \
  --api-id "$API_ID" \
  --format SDL \
  --region ca-central-1 \
  --profile amplify \
  | grep -E "^type " | \
  sed 's/^type //' | \
  sed 's/ {.*//' | \
  sort
```

---

## Verify Model Structure

Check if a model has all required fields:

```bash
# Check if BusinessUnit has primaryKeyInfo
jq '.data.model_introspection.models.BusinessUnit.primaryKeyInfo' amplify_outputs.json

# Check all models have primaryKeyInfo
for model in Assignment BusinessUnit Course Employee Manager QuizQuestion Result Store; do
  echo -n "$model: "
  jq -e ".data.model_introspection.models.$model.primaryKeyInfo" amplify_outputs.json > /dev/null 2>&1 && echo "✅" || echo "❌"
done
```

---

## Expected Result

All checks should show **8 models**:

1. ✅ Assignment
2. ✅ BusinessUnit
3. ✅ Course
4. ✅ Employee
5. ✅ Manager
6. ✅ QuizQuestion
7. ✅ Result
8. ✅ Store

---

## Quick One-Liner

```bash
echo "Schema: $(grep -E "^  [A-Z][a-zA-Z]+:" amplify/data/resource.ts | wc -l) models" && \
echo "Outputs: $(jq '.data.model_introspection.models | keys | length' amplify_outputs.json) models" && \
echo "Admin: $(jq '.data.model_introspection.models | keys | length' my-training-admin/src/amplify_outputs.json) models"
```

---

## Troubleshooting

### If models are missing:

1. **Check API URL is correct:**
   ```bash
   jq -r '.data.url' amplify_outputs.json
   ```
   Should be: `https://nf2ayvu4ebgm3f2bomzsr5wxmq.appsync-api.ca-central-1.amazonaws.com/graphql`

2. **Regenerate outputs:**
   ```bash
   npx ampx generate outputs --app-id d6c38s8spsb1t --branch dev --profile amplify
   ```

3. **Check for errors:**
   ```bash
   ./check-models.sh
   ```

---

**✅ All models are now fixed and available!**


# How to Identify Which API is Connected to Your Dev App

## Quick Answer

**Your Dev App API ID:** `csxrkv7kenai5i4jycdl73t3uy`

This is the API connected to your `dev` branch deployment.

---

## Why You Have 6 APIs

You have 6 AppSync APIs because:
- Each Amplify deployment (branch/environment) can create a new API
- Old deployments may have left APIs behind
- Sandbox deployments create temporary APIs
- Different branches may use different APIs

---

## Method 1: Check amplify_outputs.json (Easiest)

The API ID in your `amplify_outputs.json` is the one your app is using:

```bash
jq -r '.data.aws_appsync_graphql_api_id' amplify_outputs.json
```

**Output:** `csxrkv7kenai5i4jycdl73t3uy`

This is your dev app's API!

---

## Method 2: Check DynamoDB Tables

Your dev app's API will have all 8 DynamoDB tables:

```bash
# Check which API has all 8 tables
for API_ID in csxrkv7kenai5i4jycdl73t3uy qhkopfu5tbd7vax2vizzbqpjt4 r5sfexemufhprotulpmpdxxoiy rq3xk7mcifgy7jhn2yokysdo7e sreds2idrrfj7jjbmnxhzipe7e u6qx457cnnc63grvlgaiwedzgi; do
  COUNT=$(aws dynamodb list-tables --region ca-central-1 --profile amplify 2>&1 | \
    jq -r ".TableNames[] | select(contains(\"$API_ID\"))" | wc -l)
  echo "API $API_ID: $COUNT tables"
done
```

**Expected:** Only one API will have 8 tables - that's your dev app API.

---

## Method 3: Check GraphQL Schema

Your dev app's API will have all 8 models in the schema:

```bash
API_ID="csxrkv7kenai5i4jycdl73t3uy"

aws appsync get-introspection-schema \
  --api-id "$API_ID" \
  --format SDL \
  --region ca-central-1 \
  --profile amplify \
  /tmp/schema.sdl

# Count models
grep -E "^type [A-Z][a-zA-Z]+ " /tmp/schema.sdl | \
  sed 's/^type //' | \
  sed 's/ @.*//' | \
  grep -vE "Query|Mutation|Subscription|Model|Connection|Filter|Sort|PageInfo|__" | \
  wc -l
```

**Expected:** Should return 8 models.

---

## Method 4: Check Amplify Console

1. Go to Amplify Console:
   https://ca-central-1.console.aws.amazon.com/amplify/home?region=ca-central-1#/d6c38s8spsb1t

2. Click on your app: **MyTrainingApp**
3. Go to **Backend environments** → **dev**
4. Look for **Data** or **GraphQL API** section
5. The API ID shown there is your dev app's API

---

## Method 5: Compare All APIs

Check which API matches your requirements:

```bash
# Your required models
REQUIRED_MODELS="Assignment BusinessUnit Course Employee Manager QuizQuestion Result Store"

# Check each API
for API_ID in csxrkv7kenai5i4jycdl73t3uy qhkopfu5tbd7vax2vizzbqpjt4 r5sfexemufhprotulpmpdxxoiy rq3xk7mcifgy7jhn2yokysdo7e sreds2idrrfj7jjbmnxhzipe7e u6qx457cnnc63grvlgaiwedzgi; do
  echo "Checking API: $API_ID"
  
  # Check DynamoDB tables
  TABLES=$(aws dynamodb list-tables --region ca-central-1 --profile amplify 2>&1 | \
    jq -r ".TableNames[] | select(contains(\"$API_ID\"))" | \
    sed "s/-$API_ID-NONE//" | sort)
  
  TABLE_COUNT=$(echo "$TABLES" | wc -l)
  
  if [ "$TABLE_COUNT" -eq 8 ]; then
    echo "  ✅ HAS ALL 8 TABLES"
    echo "  Tables: $TABLES"
  else
    echo "  ❌ Only $TABLE_COUNT tables"
  fi
  
  echo ""
done
```

---

## Verification Checklist

Your dev app's API should have:

- [x] **API ID:** `csxrkv7kenai5i4jycdl73t3uy`
- [x] **8 DynamoDB Tables:**
  - Assignment-csxrkv7kenai5i4jycdl73t3uy-NONE
  - BusinessUnit-csxrkv7kenai5i4jycdl73t3uy-NONE
  - Course-csxrkv7kenai5i4jycdl73t3uy-NONE
  - Employee-csxrkv7kenai5i4jycdl73t3uy-NONE
  - Manager-csxrkv7kenai5i4jycdl73t3uy-NONE
  - QuizQuestion-csxrkv7kenai5i4jycdl73t3uy-NONE
  - Result-csxrkv7kenai5i4jycdl73t3uy-NONE
  - Store-csxrkv7kenai5i4jycdl73t3uy-NONE
- [x] **8 Models in GraphQL Schema:**
  - Assignment, BusinessUnit, Course, Employee, Manager, QuizQuestion, Result, Store
- [x] **In amplify_outputs.json:** ✅ Yes
- [x] **Connected to Amplify App:** ✅ Yes (d6c38s8spsb1t, branch: dev)

---

## What About the Other 5 APIs?

The other 5 APIs are likely:

1. **From other branches** (e.g., `develop` branch)
2. **From old deployments** that weren't cleaned up
3. **From sandbox environments** (temporary)
4. **From failed deployments** that created APIs but didn't complete

**You can safely ignore them** or delete them if you're sure they're not being used.

---

## How to Clean Up Unused APIs

⚠️ **Be careful!** Only delete APIs you're sure are not in use.

1. **Check which branches use which API:**
   - Check each branch's `amplify_outputs.json`
   - Or check Amplify Console for each branch

2. **Delete unused APIs:**
   ```bash
   # WARNING: This will delete the API permanently!
   aws appsync delete-graphql-api \
     --api-id <unused-api-id> \
     --region ca-central-1 \
     --profile amplify
   ```

3. **Or delete via Console:**
   - Go to AppSync Console
   - Select the unused API
   - Click "Delete API"

---

## Quick Reference

| API ID | Tables | Models | Status |
|--------|--------|--------|--------|
| `csxrkv7kenai5i4jycdl73t3uy` | 8 | 8 | ✅ **YOUR DEV APP** |
| `qhkopfu5tbd7vax2vizzbqpjt4` | ? | ? | ❓ Other branch/old |
| `r5sfexemufhprotulpmpdxxoiy` | ? | ? | ❓ Other branch/old |
| `rq3xk7mcifgy7jhn2yokysdo7e` | ? | ? | ❓ Other branch/old |
| `sreds2idrrfj7jjbmnxhzipe7e` | ? | ? | ❓ Other branch/old |
| `u6qx457cnnc63grvlgaiwedzgi` | ? | ? | ❓ Other branch/old |

---

## Summary

**Your Dev App API:** `csxrkv7kenai5i4jycdl73t3uy`

This is confirmed by:
- ✅ It's in your `amplify_outputs.json`
- ✅ It has all 8 DynamoDB tables
- ✅ It has all 8 models in GraphQL schema
- ✅ It's connected to your Amplify app (d6c38s8spsb1t, branch: dev)

**The other 5 APIs are not connected to your dev app** - they're likely from other branches or old deployments.

---

**Always check `amplify_outputs.json` - it tells you which API your app is using!**


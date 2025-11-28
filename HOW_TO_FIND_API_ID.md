# How to Find Your API ID and GraphQL API

## Quick Answer

**Your Current API ID:** `csxrkv7kenai5i4jycdl73t3uy`  
**GraphQL API URL:** `https://nf2ayvu4ebgm3f2bomzsr5wxmq.appsync-api.ca-central-1.amazonaws.com/graphql`

---

## Method 1: From amplify_outputs.json (Easiest)

```bash
# Get API ID
jq -r '.data.aws_appsync_graphql_api_id' amplify_outputs.json

# Get API URL
jq -r '.data.url' amplify_outputs.json

# Get all data API info
jq '.data' amplify_outputs.json
```

**Output:**
- API ID: `csxrkv7kenai5i4jycdl73t3uy`
- API URL: `https://nf2ayvu4ebgm3f2bomzsr5wxmq.appsync-api.ca-central-1.amazonaws.com/graphql`
- Region: `ca-central-1`

---

## Method 2: From AWS Amplify Console

1. Go to AWS Amplify Console:
   https://ca-central-1.console.aws.amazon.com/amplify/home?region=ca-central-1#/d6c38s8spsb1t

2. Click on your app: **MyTrainingApp**
3. Go to **Backend environments** or **Backend** section
4. Look for **Data** or **GraphQL API** section
5. You'll see the API ID and URL

**Your App Info:**
- App ID: `d6c38s8spsb1t`
- Branch: `dev` (Production)
- Region: `ca-central-1`

---

## Method 3: From AppSync Console

1. Go to AWS AppSync Console:
   https://ca-central-1.console.aws.amazon.com/appsync/home?region=ca-central-1

2. Look for API named **amplifyData**
3. Click on it to see details
4. The API ID is in the URL: `#/csxrkv7kenai5i4jycdl73t3uy/...`

**Direct Link:**
https://ca-central-1.console.aws.amazon.com/appsync/home?region=ca-central-1#/csxrkv7kenai5i4jycdl73t3uy/schema

---

## Method 4: From DynamoDB Tables

Your DynamoDB tables include the API ID in their names:

```bash
aws dynamodb list-tables \
  --region ca-central-1 \
  --profile amplify | \
  jq -r '.TableNames[]' | \
  grep -E "BusinessUnit|Store|Manager" | \
  head -3
```

**Example table names:**
- `BusinessUnit-csxrkv7kenai5i4jycdl73t3uy-NONE`
- `Store-csxrkv7kenai5i4jycdl73t3uy-NONE`
- `Manager-csxrkv7kenai5i4jycdl73t3uy-NONE`

The API ID is the middle part: `csxrkv7kenai5i4jycdl73t3uy`

---

## Method 5: Using AWS CLI

### List All AppSync APIs

```bash
aws appsync list-graphql-apis \
  --region ca-central-1 \
  --profile amplify | \
  jq -r '.graphqlApis[] | "\(.apiId) - \(.name)"'
```

### Get Specific API Details

```bash
API_ID="csxrkv7kenai5i4jycdl73t3uy"

aws appsync get-graphql-api \
  --api-id "$API_ID" \
  --region ca-central-1 \
  --profile amplify | \
  jq -r '.graphqlApi | {
    apiId: .apiId,
    name: .name,
    uris: .uris.GRAPHQL,
    creationDate: .creationDate
  }'
```

---

## Method 6: From Amplify Backend Code

If you're using Amplify Gen 2, the API is automatically created. You can find it by:

1. **Check deployment outputs:**
   ```bash
   npx ampx generate outputs \
     --app-id d6c38s8spsb1t \
     --branch dev \
     --profile amplify
   ```

2. **Check the generated `amplify_outputs.json`** for the API ID

---

## Verify API Association

### Check Which Tables Use This API

```bash
API_ID="csxrkv7kenai5i4jycdl73t3uy"

aws dynamodb list-tables \
  --region ca-central-1 \
  --profile amplify | \
  jq -r ".TableNames[] | select(contains(\"$API_ID\"))" | \
  sed "s/-$API_ID-NONE//" | \
  sort
```

**Expected output:**
- Assignment
- BusinessUnit
- Course
- Employee
- Manager
- QuizQuestion
- Result
- Store

---

## Quick Check Script

Save this as `find-api-id.sh`:

```bash
#!/bin/bash

echo "=========================================="
echo "Finding API ID and GraphQL API"
echo "=========================================="
echo ""

echo "1. From amplify_outputs.json:"
echo "   API ID: $(jq -r '.data.aws_appsync_graphql_api_id' amplify_outputs.json)"
echo "   API URL: $(jq -r '.data.url' amplify_outputs.json)"
echo ""

echo "2. From DynamoDB tables:"
API_ID=$(aws dynamodb list-tables --region ca-central-1 --profile amplify 2>&1 | \
  jq -r '.TableNames[]' | \
  grep "BusinessUnit" | \
  grep -oE "[a-z0-9]{26}" | \
  head -1)
echo "   API ID: $API_ID"
echo ""

echo "3. From AppSync:"
aws appsync get-graphql-api \
  --api-id "$API_ID" \
  --region ca-central-1 \
  --profile amplify 2>&1 | \
  jq -r '.graphqlApi | {
    name: .name,
    apiId: .apiId,
    url: .uris.GRAPHQL
  }'
```

Run it:
```bash
chmod +x find-api-id.sh
./find-api-id.sh
```

---

## Your Current Configuration

**API ID:** `csxrkv7kenai5i4jycdl73t3uy`  
**API Name:** `amplifyData`  
**API URL:** `https://nf2ayvu4ebgm3f2bomzsr5wxmq.appsync-api.ca-central-1.amazonaws.com/graphql`  
**Region:** `ca-central-1`  
**App ID:** `d6c38s8spsb1t`  
**Branch:** `dev`

**Associated DynamoDB Tables:**
- Assignment-csxrkv7kenai5i4jycdl73t3uy-NONE
- BusinessUnit-csxrkv7kenai5i4jycdl73t3uy-NONE
- Course-csxrkv7kenai5i4jycdl73t3uy-NONE
- Employee-csxrkv7kenai5i4jycdl73t3uy-NONE
- Manager-csxrkv7kenai5i4jycdl73t3uy-NONE
- QuizQuestion-csxrkv7kenai5i4jycdl73t3uy-NONE
- Result-csxrkv7kenai5i4jycdl73t3uy-NONE
- Store-csxrkv7kenai5i4jycdl73t3uy-NONE

---

## Troubleshooting

### If API ID is "null" in amplify_outputs.json

1. Regenerate outputs:
   ```bash
   npx ampx generate outputs \
     --app-id d6c38s8spsb1t \
     --branch dev \
     --profile amplify
   ```

2. Check if backend is deployed:
   - Go to Amplify Console
   - Check deployment status
   - Wait for deployment to complete

### If Multiple APIs Exist

You might have multiple AppSync APIs from different deployments. To find the correct one:

1. Check which API your DynamoDB tables use
2. Check which API is in `amplify_outputs.json`
3. Use the one that matches your tables

---

**The easiest way: Check `amplify_outputs.json` - it has everything you need!**


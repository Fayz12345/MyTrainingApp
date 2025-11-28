#!/bin/bash

echo "=========================================="
echo "Check Models in AWS"
echo "=========================================="
echo ""

echo "1. DynamoDB Tables:"
echo "──────────────────────────────────────────────────"
aws dynamodb list-tables --region ca-central-1 --profile amplify 2>&1 | \
  jq -r '.TableNames[]' | \
  grep -iE "businessunit|store|manager|course|employee|assignment|result|quiz" | \
  grep "csxrkv7kenai5i4jycdl73t3uy" | \
  sed 's/-csxrkv7kenai5i4jycdl73t3uy-NONE//' | \
  sort | \
  while read model; do
    echo "  ✅ $model"
  done

echo ""
echo "2. AppSync GraphQL Schema Types:"
echo "──────────────────────────────────────────────────"
API_ID=$(jq -r '.data.url' amplify_outputs.json 2>/dev/null | sed 's|https://\([^.]*\).*|\1|')
if [ -n "$API_ID" ] && [ "$API_ID" != "null" ]; then
  SCHEMA_TYPES=$(aws appsync get-introspection-schema \
    --api-id "$API_ID" \
    --format SDL \
    --region ca-central-1 \
    --profile amplify 2>&1 | \
    grep -E "^type " | \
    sed 's/^type //' | \
    sed 's/ {.*//' | \
    sort)
  
  if [ -n "$SCHEMA_TYPES" ]; then
    echo "$SCHEMA_TYPES" | while read type; do
      echo "  ✅ $type"
    done
  else
    echo "  ⚠️  Could not fetch schema (API might not exist or no access)"
  fi
else
  echo "  ⚠️  API ID not found in amplify_outputs.json"
fi

echo ""
echo "3. CloudFormation DynamoDB Tables:"
echo "──────────────────────────────────────────────────"
aws cloudformation describe-stack-resources \
  --stack-name amplify-d6c38s8spsb1t-dev-branch-5714f7d1b8 \
  --region ca-central-1 \
  --profile amplify 2>&1 | \
  jq -r '.StackResources[] | select(.ResourceType == "AWS::DynamoDB::Table") | .LogicalResourceId' | \
  sed 's/Table//' | \
  sort | \
  while read model; do
    echo "  ✅ $model"
  done || echo "  ⚠️  Could not fetch CloudFormation resources"

echo ""
echo "=========================================="
echo "Summary"
echo "=========================================="
echo ""
echo "DynamoDB: Check AWS Console → DynamoDB → Tables"
echo "AppSync:  Check AWS Console → AppSync → Your API → Schema"
echo "Amplify:  Check AWS Console → Amplify → Your App → Backend"
echo ""

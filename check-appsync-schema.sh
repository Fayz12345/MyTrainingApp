#!/bin/bash

# Script to check AppSync schema and authorization

echo "=========================================="
echo "Check AppSync Schema and Authorization"
echo "=========================================="
echo ""

API_ID=$(jq -r '.data.aws_appsync_graphql_api_id' amplify_outputs.json)
API_URL=$(jq -r '.data.url' amplify_outputs.json)

if [ -z "$API_ID" ] || [ "$API_ID" == "null" ]; then
    echo "❌ API ID not found in amplify_outputs.json"
    exit 1
fi

echo "API ID: $API_ID"
echo "API URL: $API_URL"
echo ""

echo "1. Checking if BusinessUnit type exists in AppSync..."
echo "------------------------------------------------"
SCHEMA=$(aws appsync get-introspection-schema \
    --api-id "$API_ID" \
    --format SDL \
    --region ca-central-1 \
    --profile amplify \
    /tmp/appsync-schema.sdl 2>&1 && cat /tmp/appsync-schema.sdl)

if [ $? -eq 0 ]; then
    if echo "$SCHEMA" | grep -q "type BusinessUnit"; then
        echo "✅ BusinessUnit type EXISTS in AppSync schema"
        echo ""
        echo "BusinessUnit definition:"
        echo "$SCHEMA" | grep -A 15 "type BusinessUnit" | head -20
    else
        echo "❌ BusinessUnit type NOT FOUND in AppSync schema"
        echo ""
        echo "Available types:"
        echo "$SCHEMA" | grep "^type " | head -10
    fi
else
    echo "❌ Error fetching schema:"
    echo "$SCHEMA"
fi

echo ""
echo "2. Checking authorization directives..."
echo "------------------------------------------------"
if echo "$SCHEMA" | grep -q "@aws_auth"; then
    echo "✅ Found @aws_auth directives"
    echo ""
    echo "BusinessUnit authorization:"
    echo "$SCHEMA" | grep -B 2 -A 10 "type BusinessUnit" | grep -A 10 "@aws_auth"
else
    echo "⚠️  No @aws_auth directives found (might be using @aws_cognito_user_pools)"
fi

echo ""
echo "3. Checking for SuperAdmin in schema..."
echo "------------------------------------------------"
if echo "$SCHEMA" | grep -q "SuperAdmin"; then
    echo "✅ SuperAdmin mentioned in schema"
    echo ""
    echo "Context:"
    echo "$SCHEMA" | grep -B 2 -A 2 "SuperAdmin" | head -10
else
    echo "❌ SuperAdmin NOT found in schema"
fi

echo ""
echo "4. Recommendations"
echo "------------------------------------------------"
if ! echo "$SCHEMA" | grep -q "type BusinessUnit"; then
    echo "❌ ISSUE: BusinessUnit not in AppSync schema"
    echo ""
    echo "Fix: Redeploy backend"
    echo "  1. Make a small change to amplify/data/resource.ts"
    echo "  2. Commit and push to trigger deployment"
    echo "  3. Wait for deployment to complete"
elif ! echo "$SCHEMA" | grep -q "SuperAdmin"; then
    echo "⚠️  WARNING: SuperAdmin not in schema"
    echo ""
    echo "This might mean authorization rules aren't synced"
    echo "Fix: Redeploy backend"
else
    echo "✅ Schema looks correct"
    echo ""
    echo "If still getting 401, check:"
    echo "  1. User is in SuperAdmin group (verified ✅)"
    echo "  2. Token has SuperAdmin group (verified ✅)"
    echo "  3. authMode is set in generateClient (fixed ✅)"
    echo "  4. Check AppSync logs for detailed error"
fi

echo ""
echo "5. Check AppSync Logs"
echo "------------------------------------------------"
echo "Go to AWS Console → AppSync → $API_ID → Logs"
echo "Look for authorization errors in the logs"


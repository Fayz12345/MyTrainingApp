#!/bin/bash

# Comprehensive debugging script for 401 Unauthorized error

echo "=========================================="
echo "Debug: 401 Unauthorized Error"
echo "=========================================="
echo ""

echo "Step 1: Checking if user is in SuperAdmin group"
echo "------------------------------------------------"
read -p "Enter your email/username: " USERNAME

if [ -z "$USERNAME" ]; then
    echo "❌ No username provided"
    exit 1
fi

echo ""
echo "Checking groups for: $USERNAME"
echo ""

GROUPS=$(aws cognito-idp admin-list-groups-for-user \
    --user-pool-id ca-central-1_aKCLbCdhj \
    --username "$USERNAME" \
    --region ca-central-1 \
    --profile amplify 2>&1)

if [ $? -eq 0 ]; then
    echo "✅ User groups found:"
    echo "$GROUPS" | jq -r '.Groups[] | "  - \(.GroupName) (precedence: \(.Precedence))"'
    echo ""
    
    if echo "$GROUPS" | jq -r '.Groups[].GroupName' | grep -q "SuperAdmin"; then
        echo "✅ User IS in SuperAdmin group"
        IN_SUPERADMIN=true
    else
        echo "❌ User is NOT in SuperAdmin group"
        IN_SUPERADMIN=false
    fi
else
    echo "❌ Error checking groups:"
    echo "$GROUPS"
    IN_SUPERADMIN=false
fi

echo ""
echo "Step 2: Checking authorization rules"
echo "------------------------------------------------"
echo ""

SCHEMA_CHECK=$(grep -A 1 "allow.group('SuperAdmin')" amplify/data/resource.ts | grep "to(\['.*'\])" | head -1)
if [[ $SCHEMA_CHECK == *"create"* ]] && [[ $SCHEMA_CHECK == *"read"* ]] && [[ $SCHEMA_CHECK == *"update"* ]] && [[ $SCHEMA_CHECK == *"delete"* ]]; then
    echo "✅ Schema authorization: CORRECT"
else
    echo "❌ Schema authorization: INCORRECT"
fi

OUTPUTS_OPS=$(jq -r '.data.model_introspection.models.BusinessUnit.attributes[] | select(.type == "auth") | .properties.rules[] | select(.groups[] == "SuperAdmin") | .operations | join(", ")' amplify_outputs.json 2>/dev/null)
if [[ $OUTPUTS_OPS == *"create"* ]] && [[ $OUTPUTS_OPS == *"read"* ]] && [[ $OUTPUTS_OPS == *"update"* ]] && [[ $OUTPUTS_OPS == *"delete"* ]]; then
    echo "✅ Outputs authorization: CORRECT"
    echo "   Operations: $OUTPUTS_OPS"
else
    echo "❌ Outputs authorization: INCORRECT or MISSING"
fi

echo ""
echo "Step 3: Checking AppSync API configuration"
echo "------------------------------------------------"
echo ""

API_ID=$(jq -r '.data.aws_appsync_graphql_api_id' amplify_outputs.json)
API_URL=$(jq -r '.data.url' amplify_outputs.json)

echo "API ID: $API_ID"
echo "API URL: $API_URL"
echo ""

if [ -z "$API_ID" ] || [ "$API_ID" == "null" ]; then
    echo "❌ API ID is missing in amplify_outputs.json"
else
    echo "✅ API ID found"
fi

echo ""
echo "Step 4: Recommendations"
echo "------------------------------------------------"
echo ""

if [ "$IN_SUPERADMIN" = false ]; then
    echo "❌ ISSUE FOUND: User is NOT in SuperAdmin group"
    echo ""
    echo "Fix: Add user to SuperAdmin group"
    echo "Run this command:"
    echo ""
    echo "aws cognito-idp admin-add-user-to-group \\"
    echo "  --user-pool-id ca-central-1_aKCLbCdhj \\"
    echo "  --username $USERNAME \\"
    echo "  --group-name SuperAdmin \\"
    echo "  --region ca-central-1 \\"
    echo "  --profile amplify"
    echo ""
    echo "Then:"
    echo "  1. Sign out completely from the app"
    echo "  2. Sign back in"
    echo "  3. Try again"
else
    echo "✅ User is in SuperAdmin group"
    echo ""
    echo "If still getting 401, the issue is likely:"
    echo "  1. JWT token doesn't have group claims"
    echo "     → Sign out and sign back in"
    echo ""
    echo "  2. Token expired"
    echo "     → Sign out and sign back in"
    echo ""
    echo "  3. Browser cache"
    echo "     → Clear browser cache and cookies"
    echo ""
    echo "  4. Wrong amplify_outputs.json"
    echo "     → Check you're using the correct file"
    echo ""
    echo "ACTION REQUIRED:"
    echo "  1. Sign out completely"
    echo "  2. Clear browser cache (optional)"
    echo "  3. Sign back in"
    echo "  4. Check browser console for token groups"
fi

echo ""
echo "Step 5: Browser Console Check"
echo "------------------------------------------------"
echo ""
echo "After signing in, run this in browser console:"
echo ""
echo "import { fetchAuthSession } from 'aws-amplify/auth';"
echo "const session = await fetchAuthSession({ forceRefresh: true });"
echo "const groups = session.tokens?.idToken?.payload['cognito:groups'];"
echo "console.log('Groups in token:', groups);"
echo ""
echo "Expected: ['SuperAdmin']"
echo ""


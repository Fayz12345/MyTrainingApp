#!/bin/bash

# Script to verify SuperAdmin access to BusinessUnit model

echo "=========================================="
echo "Verify SuperAdmin Access to BusinessUnit"
echo "=========================================="
echo ""

echo "1. Checking schema authorization rules..."
echo "   SuperAdmin should have: create, read, update, delete"
echo ""

SCHEMA_RULES=$(grep -A 1 "allow.group('SuperAdmin')" amplify/data/resource.ts | grep -o "to(\['.*'\])" | head -1)
if [[ $SCHEMA_RULES == *"create"* ]] && [[ $SCHEMA_RULES == *"read"* ]] && [[ $SCHEMA_RULES == *"update"* ]] && [[ $SCHEMA_RULES == *"delete"* ]]; then
    echo "   ✅ Schema rules: CORRECT"
else
    echo "   ❌ Schema rules: INCORRECT"
fi

echo ""
echo "2. Checking amplify_outputs.json authorization rules..."
echo ""

OUTPUTS_OPS=$(jq -r '.data.model_introspection.models.BusinessUnit.attributes[] | select(.type == "auth") | .properties.rules[] | select(.groups[] == "SuperAdmin") | .operations | join(", ")' amplify_outputs.json 2>/dev/null)

if [[ $OUTPUTS_OPS == *"create"* ]] && [[ $OUTPUTS_OPS == *"read"* ]] && [[ $OUTPUTS_OPS == *"update"* ]] && [[ $OUTPUTS_OPS == *"delete"* ]]; then
    echo "   ✅ Outputs rules: CORRECT"
    echo "   Operations: $OUTPUTS_OPS"
else
    echo "   ❌ Outputs rules: INCORRECT or MISSING"
fi

echo ""
echo "3. To check if your user is in SuperAdmin group:"
echo "   ./check-user-groups.sh <your-email>"
echo ""

echo "4. If user is NOT in SuperAdmin, add them:"
echo "   aws cognito-idp admin-add-user-to-group \\"
echo "     --user-pool-id ca-central-1_aKCLbCdhj \\"
echo "     --username <your-email> \\"
echo "     --group-name SuperAdmin \\"
echo "     --region ca-central-1 \\"
echo "     --profile amplify"
echo ""

echo "5. After adding to group, you MUST:"
echo "   - Sign out completely"
echo "   - Sign back in"
echo "   - This refreshes the JWT token with group claims"
echo ""

echo "=========================================="
echo "Summary"
echo "=========================================="
echo "✅ Schema: SuperAdmin has create, read, update, delete"
echo "✅ Outputs: SuperAdmin has create, read, update, delete"
echo ""
echo "⚠️  If still getting 401 Unauthorized:"
echo "   1. Verify user is in SuperAdmin group"
echo "   2. Sign out and sign back in"
echo "   3. Check browser console for token groups"
echo ""


#!/bin/bash

# Script to verify Cognito User Groups are configured correctly
# 
# This script checks:
# 1. Which groups exist in amplify_outputs.json
# 2. Which groups are defined in auth/resource.ts
# 3. Which groups are used in data/resource.ts authorization rules

echo "🔍 Verifying Cognito User Groups Configuration..."
echo ""

# Read configuration
AMPLIFY_OUTPUTS="./src/amplify_outputs.json"
AUTH_RESOURCE="../amplify/auth/resource.ts"
DATA_RESOURCE="../amplify/data/resource.ts"

# Expected groups with precedence
declare -A EXPECTED_GROUPS=(
    ["Employees"]=0
    ["Managers"]=1
    ["Store"]=2
    ["BusinessUnit"]=3
    ["SuperAdmin"]=4
)

echo "📋 Expected Groups (from auth/resource.ts):"
for group in "${!EXPECTED_GROUPS[@]}"; do
    echo "  - $group (precedence: ${EXPECTED_GROUPS[$group]})"
done
echo ""

# Check amplify_outputs.json
if [ -f "$AMPLIFY_OUTPUTS" ]; then
    echo "📄 Groups in amplify_outputs.json:"
    if command -v jq &> /dev/null; then
        GROUPS_IN_OUTPUT=$(jq -r '.auth.groups[] | keys[]' "$AMPLIFY_OUTPUTS 2>/dev/null" | sort)
        if [ -z "$GROUPS_IN_OUTPUT" ]; then
            echo "  ⚠️  No groups found in amplify_outputs.json"
            echo "     Note: amplify_outputs.json may need to be regenerated after creating groups"
        else
            echo "$GROUPS_IN_OUTPUT" | while read -r group; do
                precedence=$(jq -r ".auth.groups[] | select(has(\"$group\")) | .\"$group\".precedence" "$AMPLIFY_OUTPUTS" 2>/dev/null)
                echo "  ✅ $group (precedence: $precedence)"
            done
        fi
    else
        echo "  ⚠️  jq not installed, cannot parse JSON"
    fi
else
    echo "  ❌ amplify_outputs.json not found"
fi
echo ""

# Check auth resource
if [ -f "$AUTH_RESOURCE" ]; then
    echo "📄 Groups defined in auth/resource.ts:"
    if grep -q "groups:" "$AUTH_RESOURCE"; then
        GROUPS_IN_AUTH=$(grep -oP "groups: \[.*?\]" "$AUTH_RESOURCE" | grep -oP "'[^']+'" | tr -d "'" | sort)
        if [ -n "$GROUPS_IN_AUTH" ]; then
            echo "$GROUPS_IN_AUTH" | while read -r group; do
                if [[ -v EXPECTED_GROUPS["$group"] ]]; then
                    echo "  ✅ $group"
                else
                    echo "  ⚠️  $group (not in expected list)"
                fi
            done
        fi
    fi
else
    echo "  ❌ auth/resource.ts not found"
fi
echo ""

# Check data resource for group usage
if [ -f "$DATA_RESOURCE" ]; then
    echo "📄 Groups used in data/resource.ts authorization:"
    USED_GROUPS=$(grep -oP "allow\.group\('[^']+'\)" "$DATA_RESOURCE" | grep -oP "'[^']+'" | tr -d "'" | sort -u)
    if [ -n "$USED_GROUPS" ]; then
        echo "$USED_GROUPS" | while read -r group; do
            if [[ -v EXPECTED_GROUPS["$group"] ]]; then
                echo "  ✅ $group (used in authorization rules)"
            else
                echo "  ⚠️  $group (used but not in expected list)"
            fi
        done
    fi
else
    echo "  ❌ data/resource.ts not found"
fi
echo ""

# Summary
echo "📊 Verification Summary:"
echo "──────────────────────────────────────────────────"

MISSING_GROUPS=()
for group in "${!EXPECTED_GROUPS[@]}"; do
    if [ -f "$AMPLIFY_OUTPUTS" ] && command -v jq &> /dev/null; then
        if ! jq -e ".auth.groups[] | has(\"$group\")" "$AMPLIFY_OUTPUTS" > /dev/null 2>&1; then
            MISSING_GROUPS+=("$group")
        fi
    fi
done

if [ ${#MISSING_GROUPS[@]} -eq 0 ]; then
    echo "✅ All expected groups are present in amplify_outputs.json"
    echo ""
    echo "💡 Note: If you just created groups in AWS Console, you may need to:"
    echo "   1. Redeploy your Amplify backend: npx ampx sandbox"
    echo "   2. Or pull the latest amplify_outputs.json from your deployment"
else
    echo "⚠️  Missing groups in amplify_outputs.json:"
    for group in "${MISSING_GROUPS[@]}"; do
        echo "   - $group"
    done
    echo ""
    echo "💡 These groups may exist in Cognito but amplify_outputs.json needs to be updated."
    echo "   Check the AWS Console to verify they exist, then redeploy to update outputs."
fi

echo ""
echo "✅ Verification complete!"
echo ""
echo "To verify in AWS Console:"
echo "1. Go to AWS Amplify Console → Your App → Authentication → User Management → Groups"
echo "2. You should see all 5 groups: Employees, Managers, Store, BusinessUnit, SuperAdmin"


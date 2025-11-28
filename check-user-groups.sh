#!/bin/bash

# Script to check which Cognito groups a user belongs to
# Usage: ./check-user-groups.sh <username>

echo "=========================================="
echo "Check User Cognito Groups"
echo "=========================================="
echo ""

if [ -z "$1" ]; then
    echo "Usage: ./check-user-groups.sh <username>"
    echo ""
    echo "Example: ./check-user-groups.sh admin@example.com"
    exit 1
fi

USERNAME="$1"
USER_POOL_ID="ca-central-1_aKCLbCdhj"
REGION="ca-central-1"

echo "Checking groups for user: $USERNAME"
echo ""

# Get user groups
GROUPS=$(aws cognito-idp admin-list-groups-for-user \
    --user-pool-id "$USER_POOL_ID" \
    --username "$USERNAME" \
    --region "$REGION" \
    --profile amplify 2>&1)

if [ $? -eq 0 ]; then
    echo "✅ User groups:"
    echo "$GROUPS" | jq -r '.Groups[] | "  - \(.GroupName) (precedence: \(.Precedence))"'
    echo ""
    
    # Check if user is in SuperAdmin
    if echo "$GROUPS" | jq -r '.Groups[].GroupName' | grep -q "SuperAdmin"; then
        echo "✅ User IS in SuperAdmin group"
    else
        echo "❌ User is NOT in SuperAdmin group"
        echo ""
        echo "To add user to SuperAdmin group, run:"
        echo "  aws cognito-idp admin-add-user-to-group \\"
        echo "    --user-pool-id $USER_POOL_ID \\"
        echo "    --username $USERNAME \\"
        echo "    --group-name SuperAdmin \\"
        echo "    --region $REGION \\"
        echo "    --profile amplify"
    fi
else
    echo "❌ Error getting user groups:"
    echo "$GROUPS"
    echo ""
    echo "Make sure the username is correct and the user exists."
fi


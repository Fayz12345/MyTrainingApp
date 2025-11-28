#!/bin/bash

# Script to create Cognito groups after backend deployment
# This should be run after deploying the backend or generating outputs
# Usage: ./create-groups-after-deploy.sh

echo "=========================================="
echo "Create Cognito Groups After Deployment"
echo "=========================================="
echo ""

# Check if amplify_outputs.json exists
if [ ! -f "amplify_outputs.json" ]; then
    echo "❌ Error: amplify_outputs.json not found"
    echo "   Please generate outputs first:"
    echo "   npx ampx generate outputs --app-id <APP_ID> --branch <BRANCH> --profile amplify"
    exit 1
fi

# Read User Pool ID from outputs
USER_POOL_ID=$(jq -r '.auth.user_pool_id' amplify_outputs.json)
AWS_REGION=$(jq -r '.auth.aws_region' amplify_outputs.json)

if [ -z "$USER_POOL_ID" ] || [ "$USER_POOL_ID" == "null" ]; then
    echo "❌ Error: Could not read user_pool_id from amplify_outputs.json"
    exit 1
fi

echo "📋 User Pool ID: $USER_POOL_ID"
echo "🌍 Region: $AWS_REGION"
echo ""

# Define groups
GROUPS=(
    "Employees:0:Regular employees who can take courses"
    "Managers:1:Managers who can create courses and assign them to employees"
    "Store:2:Store administrators who can manage stores and managers"
    "BusinessUnit:3:Business unit administrators who can manage stores"
    "SuperAdmin:4:Super administrators with full system access"
)

CREATED=0
SKIPPED=0
FAILED=0

# Function to create a group
create_group() {
    local group_info=$1
    IFS=':' read -r group_name precedence description <<< "$group_info"
    
    echo "Processing group: $group_name..."
    
    # Check if group already exists
    if aws cognito-idp get-group \
        --user-pool-id "$USER_POOL_ID" \
        --group-name "$group_name" \
        --region "$AWS_REGION" \
        >/dev/null 2>&1; then
        echo "  ✅ Group '$group_name' already exists, skipping..."
        ((SKIPPED++))
        return 0
    else
        # Create the group
        if aws cognito-idp create-group \
            --user-pool-id "$USER_POOL_ID" \
            --group-name "$group_name" \
            --precedence "$precedence" \
            --description "$description" \
            --region "$AWS_REGION" \
            >/dev/null 2>&1; then
            echo "  ✅ Created group '$group_name' with precedence $precedence"
            ((CREATED++))
            return 0
        else
            echo "  ❌ Failed to create group '$group_name'"
            ((FAILED++))
            return 1
        fi
    fi
}

# Create all groups
for group_info in "${GROUPS[@]}"; do
    create_group "$group_info"
    sleep 0.5
done

echo ""
echo "📊 Summary:"
echo "──────────────────────────────────────────────────"
echo "✅ Created: $CREATED groups"
echo "⏭️  Skipped (already exist): $SKIPPED groups"
echo "❌ Failed: $FAILED groups"

if [ $FAILED -gt 0 ]; then
    echo ""
    echo "❌ Some groups failed to create. Please check AWS credentials and permissions."
    exit 1
else
    echo ""
    echo "🎉 All groups created successfully!"
    echo ""
    echo "✅ Groups are now available in your Cognito User Pool"
    echo "✅ They will appear in amplify_outputs.json after next deployment"
    exit 0
fi


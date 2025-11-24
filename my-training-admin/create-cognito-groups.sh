#!/bin/bash

# Script to create all Cognito User Groups for the MyTrainingApp
# 
# This script creates the following groups:
# - Employees (precedence: 0)
# - Managers (precedence: 1)
# - Store (precedence: 2)
# - BusinessUnit (precedence: 3)
# - SuperAdmin (precedence: 4)
# 
# Usage:
#   ./create-cognito-groups.sh
# 
# Prerequisites:
#   - AWS CLI installed and configured
#   - jq installed (for JSON parsing)

# Read configuration from amplify_outputs.json
AMPLIFY_OUTPUTS="./src/amplify_outputs.json"

if [ ! -f "$AMPLIFY_OUTPUTS" ]; then
    echo "❌ Error: amplify_outputs.json not found at $AMPLIFY_OUTPUTS"
    exit 1
fi

USER_POOL_ID=$(jq -r '.auth.user_pool_id' "$AMPLIFY_OUTPUTS")
AWS_REGION=$(jq -r '.auth.aws_region' "$AMPLIFY_OUTPUTS")

if [ -z "$USER_POOL_ID" ] || [ "$USER_POOL_ID" == "null" ]; then
    echo "❌ Error: Could not read user_pool_id from amplify_outputs.json"
    exit 1
fi

echo "🚀 Starting Cognito Group Creation..."
echo "User Pool ID: $USER_POOL_ID"
echo "Region: $AWS_REGION"
echo ""

CREATED=0
SKIPPED=0
FAILED=0

# Function to create a group
create_group() {
    local group_name=$1
    local precedence=$2
    local description=$3
    
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
        local error_output
        error_output=$(aws cognito-idp create-group \
            --user-pool-id "$USER_POOL_ID" \
            --group-name "$group_name" \
            --precedence "$precedence" \
            --description "$description" \
            --region "$AWS_REGION" \
            2>&1)
        local exit_code=$?
        
        if [ $exit_code -eq 0 ]; then
            echo "  ✅ Created group '$group_name' with precedence $precedence"
            ((CREATED++))
            return 0
        else
            echo "  ❌ Failed to create group '$group_name'"
            echo "     Error: $error_output" | head -1
            ((FAILED++))
            return 1
        fi
    fi
}

# Create all groups
create_group "Employees" "0" "Regular employees who can take courses"
sleep 0.5

create_group "Managers" "1" "Managers who can create courses and assign them to employees"
sleep 0.5

create_group "Store" "2" "Store administrators who can manage stores and managers"
sleep 0.5

create_group "BusinessUnit" "3" "Business unit administrators who can manage stores"
sleep 0.5

create_group "SuperAdmin" "4" "Super administrators with full system access"

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
    exit 0
fi

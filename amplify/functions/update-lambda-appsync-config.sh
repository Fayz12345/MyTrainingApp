#!/bin/bash

# Script to update ALL Lambda functions that need AppSync API configuration
# This reads from amplify_outputs.json and updates Lambda environment variables
# This ensures Lambda functions work correctly across all branches (dev, qa, main)
#
# Functions updated:
# - assignEmployeeGroup (needs APPSYNC_API_URL and APPSYNC_API_KEY)
# - quizCompletion (needs APPSYNC_API_URL and APPSYNC_API_KEY)

# Don't exit on error - we want to process all functions even if one fails
set +e

echo "🔄 Updating Lambda functions AppSync configuration..."
echo "   This will update all Lambda functions that use AppSync API"
echo ""

# Check if amplify_outputs.json exists (look in project root, two levels up from this script)
AMPLIFY_OUTPUTS="../../amplify_outputs.json"
if [ ! -f "$AMPLIFY_OUTPUTS" ]; then
    # Try current directory as fallback
    AMPLIFY_OUTPUTS="./amplify_outputs.json"
    if [ ! -f "$AMPLIFY_OUTPUTS" ]; then
        echo "❌ Error: amplify_outputs.json not found"
        echo "   Looked in: ../../amplify_outputs.json and ./amplify_outputs.json"
        echo "   Make sure you've deployed the backend first!"
        exit 1
    fi
fi

echo "✅ Found amplify_outputs.json"

# Extract AppSync API URL and API key from amplify_outputs.json
APPSYNC_URL=$(cat "$AMPLIFY_OUTPUTS" | grep -o '"url": "[^"]*"' | head -1 | cut -d'"' -f4)
APPSYNC_API_KEY=$(cat "$AMPLIFY_OUTPUTS" | grep -o '"api_key": "[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$APPSYNC_URL" ]; then
    echo "❌ Error: Could not extract AppSync API URL from amplify_outputs.json"
    exit 1
fi

if [ -z "$APPSYNC_API_KEY" ]; then
    echo "❌ Error: Could not extract AppSync API key from amplify_outputs.json"
    exit 1
fi

echo "📋 AppSync Configuration:"
echo "   URL: $APPSYNC_URL"
echo "   API Key: ${APPSYNC_API_KEY:0:10}..." # Show only first 10 chars for security
echo ""

# Get AWS region (default to ca-central-1 if not set)
AWS_REGION=${AWS_REGION:-ca-central-1}

# List of Lambda function name patterns that need AppSync configuration
FUNCTION_PATTERNS=("assignEmployeeGroup" "quizCompletion")

# Filter for dev branch only (functions containing "-dev-")
BRANCH_FILTER="dev"

# Track success/failure
SUCCESS_COUNT=0
FAILED_FUNCTIONS=()

# Update each function that needs AppSync configuration
for PATTERN in "${FUNCTION_PATTERNS[@]}"; do
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔍 Processing: $PATTERN (dev branch only)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Find Lambda functions matching this pattern AND dev branch
    # Filter for functions containing both the pattern and "-dev-"
    FUNCTIONS=$(aws lambda list-functions \
        --region "$AWS_REGION" \
        --query "Functions[?contains(FunctionName, '$PATTERN') && contains(FunctionName, '-$BRANCH_FILTER-')].FunctionName" \
        --output text 2>/dev/null || echo "")
    
    if [ -z "$FUNCTIONS" ]; then
        echo "⚠️  No Lambda functions found for pattern: $PATTERN"
        echo "   (This is OK if the function hasn't been deployed yet)"
        echo ""
        continue
    fi
    
    # Process each function found
    for FUNCTION_NAME in $FUNCTIONS; do
        echo "📦 Function: $FUNCTION_NAME"
        
        # Get current environment variables and merge with AppSync config
        CURRENT_ENV_JSON=$(aws lambda get-function-configuration \
            --function-name "$FUNCTION_NAME" \
            --region "$AWS_REGION" \
            --query 'Environment.Variables' \
            --output json 2>/dev/null || echo "{}")
        
        # Build environment variables string
        # Start with AppSync config (these will override any existing values)
        ENV_VARS="APPSYNC_API_URL=$APPSYNC_URL,APPSYNC_API_KEY=$APPSYNC_API_KEY"
        
        # Add other existing environment variables (excluding the ones we're setting)
        if command -v jq &> /dev/null && [ "$CURRENT_ENV_JSON" != "{}" ]; then
            # Use jq to extract other environment variables
            OTHER_VARS=$(echo "$CURRENT_ENV_JSON" | jq -r 'to_entries | map(select(.key != "APPSYNC_API_URL" and .key != "APPSYNC_API_KEY")) | map("\(.key)=\(.value)") | join(",")' 2>/dev/null || echo "")
            if [ -n "$OTHER_VARS" ]; then
                ENV_VARS="$ENV_VARS,$OTHER_VARS"
            fi
        fi
        
        # Update Lambda environment variables
        echo "   📝 Updating environment variables..."
        UPDATE_OUTPUT=$(aws lambda update-function-configuration \
            --function-name "$FUNCTION_NAME" \
            --region "$AWS_REGION" \
            --environment "Variables={$ENV_VARS}" \
            --output json 2>&1)
        UPDATE_EXIT_CODE=$?
        
        if [ $UPDATE_EXIT_CODE -eq 0 ]; then
            echo "   ✅ Successfully updated: $FUNCTION_NAME"
            ((SUCCESS_COUNT++))
        else
            echo "   ❌ Failed to update: $FUNCTION_NAME"
            echo "   Error: $UPDATE_OUTPUT" | head -3
            FAILED_FUNCTIONS+=("$FUNCTION_NAME")
        fi
        echo ""
    done
done

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   ✅ Successfully updated: $SUCCESS_COUNT function(s)"
if [ ${#FAILED_FUNCTIONS[@]} -gt 0 ]; then
    echo "   ❌ Failed: ${#FAILED_FUNCTIONS[@]} function(s)"
    for FUNC in "${FAILED_FUNCTIONS[@]}"; do
        echo "      - $FUNC"
    done
    exit 1
else
    echo "   ✅ All functions updated successfully!"
    echo ""
    echo "📋 AppSync Configuration Applied:"
    echo "   URL: $APPSYNC_URL"
    echo "   API Key: ${APPSYNC_API_KEY:0:10}..."
    echo ""
    echo "✅ Configuration complete!"
fi


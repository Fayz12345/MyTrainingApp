#!/bin/bash

# Script to check if backend exists for dev branch
# Usage: ./check-backend-exists.sh

echo "=== Checking if Backend Exists for dev Branch ==="
echo ""

APP_ID="d6c38s8spsb1t"
BRANCH="dev"
REGION="ca-central-1"

# Check if AWS credentials are configured
echo "1. Checking AWS credentials..."
if aws sts get-caller-identity &>/dev/null; then
    echo "   ✅ AWS credentials configured"
    aws sts get-caller-identity | jq -r '"   Account: \(.Account) | User: \(.Arn)"'
else
    echo "   ❌ AWS credentials not configured"
    echo "   Run: npx ampx configure profile"
    exit 1
fi

echo ""
echo "2. Checking if backend exists for dev branch..."

# Try to generate outputs (this will fail if backend doesn't exist)
if npx ampx generate outputs --app-id "$APP_ID" --branch "$BRANCH" --out-dir /tmp/amplify-check &>/dev/null; then
    echo "   ✅ Backend EXISTS for dev branch!"
    echo ""
    echo "   To use it, run:"
    echo "   npx ampx generate outputs --app-id $APP_ID --branch $BRANCH"
    echo ""
    
    # Clean up temp file
    rm -rf /tmp/amplify-check
    
    exit 0
else
    echo "   ❌ Backend does NOT exist for dev branch"
    echo ""
    echo "   You need to deploy it first:"
    echo "   npx ampx pipeline-deploy --branch $BRANCH"
    echo ""
    echo "   Then generate outputs:"
    echo "   npx ampx generate outputs --app-id $APP_ID --branch $BRANCH"
    echo ""
    
    exit 1
fi



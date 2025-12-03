#!/bin/bash

# Quick script to check if subscribeManagerToSNS Lambda function exists

REGION="ca-central-1"
FUNCTION_PATTERN="subscribeManagerToSNS"

echo "🔍 Checking for Lambda function: $FUNCTION_PATTERN"
echo "================================================"
echo ""

FUNCTION_NAME=$(aws lambda list-functions --region $REGION \
    --query "Functions[?contains(FunctionName, '$FUNCTION_PATTERN')].FunctionName" \
    --output text 2>/dev/null | head -1)

if [ -z "$FUNCTION_NAME" ]; then
    echo "❌ Function NOT FOUND"
    echo ""
    echo "The function doesn't exist yet. You need to:"
    echo "  1. Deploy the backend: npx ampx sandbox"
    echo "  2. Wait for deployment to complete"
    echo "  3. Run this check again"
    exit 1
fi

echo "✅ Function FOUND: $FUNCTION_NAME"
echo ""

# Get function status
STATUS=$(aws lambda get-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --region $REGION \
    --query State \
    --output text 2>/dev/null)

echo "📋 Status: $STATUS"
echo ""

# Check Function URL
FUNCTION_URL=$(aws lambda get-function-url-config \
    --function-name "$FUNCTION_NAME" \
    --region $REGION \
    --query FunctionUrl \
    --output text 2>/dev/null || echo "Not configured")

if [ "$FUNCTION_URL" != "None" ] && [ -n "$FUNCTION_URL" ] && [ "$FUNCTION_URL" != "Not configured" ]; then
    echo "✅ Function URL: $FUNCTION_URL"
else
    echo "❌ Function URL: Not configured"
fi

echo ""
echo "================================================"


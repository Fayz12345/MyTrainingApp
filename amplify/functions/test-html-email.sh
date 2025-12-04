#!/bin/bash

# Test script to verify HTML email rendering
# Tests the complete flow: SNS → Lambda → SES → HTML Email

set -e

REGION="ca-central-1"
TOPIC_ARN="arn:aws:sns:ca-central-1:216348571084:training-completion-notifications"
TEST_MANAGER_EMAIL="circular360dev@gmail.com"

echo "🧪 Testing HTML Email Rendering"
echo "================================"
echo ""

# Step 1: Check if Lambda exists
echo "🔍 Step 1: Checking if sendManagerNotification Lambda exists..."
LAMBDA_ARN=$(aws lambda list-functions \
    --region "$REGION" \
    --query "Functions[?contains(FunctionName, 'sendManagerNotification')].FunctionArn" \
    --output text | head -1)

if [ -z "$LAMBDA_ARN" ] || [ "$LAMBDA_ARN" == "None" ]; then
    echo "❌ Lambda function not found!"
    echo ""
    echo "Please deploy the Lambda first:"
    echo "   1. npx ampx sandbox"
    echo "   2. Wait for deployment to complete"
    echo "   3. Run this test again"
    exit 1
fi

LAMBDA_NAME=$(echo "$LAMBDA_ARN" | awk -F':' '{print $NF}')
echo "✅ Found Lambda: $LAMBDA_NAME"
echo ""

# Step 2: Check if Lambda is subscribed to SNS
echo "🔍 Step 2: Checking SNS subscription..."
EXISTING_SUB=$(aws sns list-subscriptions-by-topic \
    --topic-arn "$TOPIC_ARN" \
    --region "$REGION" \
    --query "Subscriptions[?Protocol==\`lambda\` && Endpoint==\`$LAMBDA_ARN\`].SubscriptionArn" \
    --output text 2>/dev/null || echo "")

if [ -z "$EXISTING_SUB" ] || [ "$EXISTING_SUB" == "None" ]; then
    echo "⚠️  Lambda not subscribed to SNS topic"
    echo "   Run: ./setup-html-email.sh"
    exit 1
fi

echo "✅ Lambda subscribed to SNS"
echo ""

# Step 3: Check SES email verification
echo "🔍 Step 3: Checking SES email verification..."
FROM_EMAIL=$(aws lambda get-function-configuration \
    --function-name "$LAMBDA_NAME" \
    --region "$REGION" \
    --query 'Environment.Variables.FROM_EMAIL' \
    --output text 2>/dev/null || echo "circular360dev@gmail.com")

SES_STATUS=$(aws ses get-identity-verification-attributes \
    --identities "$FROM_EMAIL" \
    --region "$REGION" \
    --query "VerificationAttributes.\"$FROM_EMAIL\".VerificationStatus" \
    --output text 2>/dev/null || echo "Unknown")

if [ "$SES_STATUS" != "Success" ]; then
    echo "⚠️  SES Email not verified: $FROM_EMAIL"
    echo "   Status: $SES_STATUS"
    echo "   Please verify the email in SES Console"
    echo ""
    echo "   This test will still run, but email may not be delivered"
fi
echo ""

# Step 4: Create test SNS message
echo "📧 Step 4: Publishing test message to SNS..."
TEST_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TEST_MESSAGE_ID=$(aws sns publish \
    --topic-arn "$TOPIC_ARN" \
    --subject "Test: Training Completed - HTML Rendering Test" \
    --message "<html><body><h1>Test HTML Message</h1><p>This is a test message to verify HTML rendering.</p></body></html>" \
    --message-attributes "{
        \"employeeName\": {\"DataType\": \"String\", \"StringValue\": \"Test Employee\"},
        \"courseTitle\": {\"DataType\": \"String\", \"StringValue\": \"Introduction to Software Testing\"},
        \"score\": {\"DataType\": \"Number\", \"StringValue\": \"100\"},
        \"managerEmail\": {\"DataType\": \"String\", \"StringValue\": \"$TEST_MANAGER_EMAIL\"},
        \"managerName\": {\"DataType\": \"String\", \"StringValue\": \"Test Manager\"},
        \"assignmentId\": {\"DataType\": \"String\", \"StringValue\": \"test-assignment-$(date +%s)\"},
        \"timestamp\": {\"DataType\": \"String\", \"StringValue\": \"$TEST_TIMESTAMP\"}
    }" \
    --region "$REGION" \
    --query 'MessageId' \
    --output text)

echo "✅ Test message published to SNS"
echo "   MessageId: $TEST_MESSAGE_ID"
echo ""

# Step 5: Wait and check Lambda logs
echo "⏳ Step 5: Waiting for Lambda to process (5 seconds)..."
sleep 5

echo ""
echo "📋 Step 6: Checking Lambda execution logs..."
LOG_GROUP="/aws/lambda/$LAMBDA_NAME"
RECENT_LOGS=$(aws logs filter-log-events \
    --log-group-name "$LOG_GROUP" \
    --region "$REGION" \
    --start-time $(($(date +%s) - 60))000 \
    --filter-pattern "Email sent successfully" \
    --max-items 1 \
    --output json 2>/dev/null || echo "{}")

if echo "$RECENT_LOGS" | python3 -c "import sys, json; data = json.load(sys.stdin); print('Found', len(data.get('events', [])), 'successful email sends')" 2>/dev/null | grep -q "Found [1-9]"; then
    echo "✅ Lambda executed successfully"
    echo "✅ HTML email sent via SES"
else
    echo "⚠️  No recent successful email sends found in logs"
    echo "   Check CloudWatch logs manually:"
    echo "   aws logs tail $LOG_GROUP --region $REGION --follow"
fi
echo ""

# Summary
echo "================================================================"
echo "✅ Test Complete!"
echo "================================================================"
echo ""
echo "📋 Test Results:"
echo "   Lambda Function: $LAMBDA_NAME ✅"
echo "   SNS Subscription: ✅"
echo "   Test Message Published: ✅"
echo "   SES Email Status: $SES_STATUS"
echo ""
echo "📧 Check Email Inbox:"
echo "   Email: $TEST_MANAGER_EMAIL"
echo "   Subject: Training Completed: Test Employee - Introduction to Software Testing"
echo ""
echo "✅ Expected Result:"
echo "   - HTML email with formatted table"
echo "   - Green header and styling"
echo "   - All data displayed correctly"
echo "   - NO raw HTML code visible"
echo ""
echo "❌ If you see raw HTML code:"
echo "   - Lambda may not be subscribed to SNS"
echo "   - Check CloudWatch logs for errors"
echo "   - Verify SES email is verified"
echo ""


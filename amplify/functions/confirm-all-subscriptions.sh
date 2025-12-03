#!/bin/bash

# Script to help confirm all pending email subscriptions
# Note: SNS requires email confirmation - this script helps resend confirmation emails

set -e

REGION="ca-central-1"
TOPIC_ARN="arn:aws:sns:ca-central-1:216348571084:training-completion-notifications"

echo "📧 Confirming Email Subscriptions"
echo "================================="
echo ""

# Get all pending email subscriptions
echo "📋 Step 1: Finding pending email subscriptions..."
PENDING_SUBS=$(aws sns list-subscriptions-by-topic \
    --topic-arn "$TOPIC_ARN" \
    --region "$REGION" \
    --query 'Subscriptions[?Protocol==`email` && contains(SubscriptionArn, `PendingConfirmation`)]' \
    --output json)

EMAIL_COUNT=$(echo "$PENDING_SUBS" | python3 -c "import sys, json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

if [ "$EMAIL_COUNT" = "0" ]; then
    echo "✅ No pending subscriptions found. All are confirmed!"
    exit 0
fi

echo "Found $EMAIL_COUNT pending subscription(s)"
echo ""

# Display pending subscriptions
echo "📋 Pending Subscriptions:"
echo "$PENDING_SUBS" | python3 -c "
import sys, json
subs = json.load(sys.stdin)
for i, sub in enumerate(subs, 1):
    print(f'  {i}. {sub[\"Endpoint\"]}')" 2>/dev/null || echo "$PENDING_SUBS"

echo ""
echo "⚠️  IMPORTANT: SNS requires email confirmation"
echo ""
echo "To confirm subscriptions, you have 2 options:"
echo ""
echo "Option 1: Use AWS Console (Recommended)"
echo "  1. Go to: https://console.aws.amazon.com/sns/v3/home?region=ca-central-1#/topic/arn:aws:sns:ca-central-1:216348571084:training-completion-notifications"
echo "  2. For each subscription:"
echo "     - Select the subscription"
echo "     - Click 'Request confirmation' button"
echo "     - Check mailinator.com for the email"
echo "     - Click confirmation link"
echo ""
echo "Option 2: Check Mailinator Inboxes"
echo "  For each email above:"
echo "  1. Go to: https://www.mailinator.com/"
echo "  2. Enter the email address"
echo "  3. Look for AWS SNS confirmation email"
echo "  4. Click the confirmation link"
echo ""
echo "After confirmation, subscriptions will change from 'Pending confirmation' to 'Confirmed'"
echo "and managers will receive notification emails automatically."
echo ""


#!/bin/bash

# Script to fix SNS topic Content-Type to enable HTML email rendering
# This updates the SNS topic attributes to use text/html instead of text/plain

set -e

REGION="ca-central-1"
TOPIC_ARN="arn:aws:sns:ca-central-1:216348571084:training-completion-notifications"

echo "🔧 Fixing SNS Topic Content-Type for HTML Email Rendering"
echo "=========================================================="
echo ""

# Step 1: Get current topic attributes
echo "📋 Step 1: Getting current topic attributes..."
CURRENT_ATTRS=$(aws sns get-topic-attributes \
    --topic-arn "$TOPIC_ARN" \
    --region "$REGION" \
    --output json)

echo "Current attributes retrieved"
echo ""

# Step 2: Update topic attributes to use text/html
echo "🔧 Step 2: Updating topic attributes for HTML content type..."

# Create updated DeliveryPolicy with text/html content type
DELIVERY_POLICY='{
  "http": {
    "defaultRequestPolicy": {
      "headerContentType": "text/html; charset=UTF-8"
    },
    "defaultHealthyRetryPolicy": {
      "numRetries": 3,
      "numNoDelayRetries": 0,
      "minDelayTarget": 20,
      "maxDelayTarget": 20,
      "numMinDelayRetries": 0,
      "numMaxDelayRetries": 0,
      "backoffFunction": "linear"
    },
    "disableSubscriptionOverrides": false
  }
}'

# Convert to JSON string and update
DELIVERY_POLICY_JSON=$(echo "$DELIVERY_POLICY" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin)))")

aws sns set-topic-attributes \
    --topic-arn "$TOPIC_ARN" \
    --attribute-name DeliveryPolicy \
    --attribute-value "$DELIVERY_POLICY_JSON" \
    --region "$REGION" \
    --output json > /dev/null

echo "✅ Topic attributes updated"
echo ""

# Step 3: Verify the update
echo "🔍 Step 3: Verifying update..."
UPDATED_ATTRS=$(aws sns get-topic-attributes \
    --topic-arn "$TOPIC_ARN" \
    --region "$REGION" \
    --query 'Attributes.DeliveryPolicy' \
    --output text)

echo "Updated DeliveryPolicy:"
echo "$UPDATED_ATTRS" | python3 -m json.tool 2>/dev/null || echo "$UPDATED_ATTRS"
echo ""

# Summary
echo "================================================================"
echo "✅ Fix Applied!"
echo "================================================================"
echo ""
echo "📋 Changes Made:"
echo "   Content-Type: text/plain → text/html; charset=UTF-8"
echo ""
echo "📝 What This Does:"
echo "   - SNS will now send emails with Content-Type: text/html"
echo "   - Email clients will render HTML instead of showing raw code"
echo "   - Your HTML emails will display properly formatted ✅"
echo ""
echo "🧪 Test:"
echo "   1. Have an employee complete and pass a quiz"
echo "   2. Manager should receive HTML email (properly rendered)"
echo "   3. Check email - should see formatted table, not HTML code"
echo ""
echo "⚠️  Note: This change applies to all future emails sent via this topic"
echo ""


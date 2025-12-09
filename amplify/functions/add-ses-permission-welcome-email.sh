#!/bin/bash

# Quick script to add SES permissions to sendWelcomeEmail Lambda
# Usage: ./add-ses-permission-welcome-email.sh

set -e

REGION="ca-central-1"

echo "📧 Adding SES Permissions to sendWelcomeEmail Lambda"
echo "===================================================="
echo ""

# Find Lambda function
LAMBDA_ARN=$(aws lambda list-functions \
    --region "$REGION" \
    --query "Functions[?contains(FunctionName, 'sendWelcomeEmail')].FunctionArn" \
    --output text | head -1)

if [ -z "$LAMBDA_ARN" ] || [ "$LAMBDA_ARN" == "None" ]; then
    echo "❌ Lambda function not found. Please deploy first with: npx ampx sandbox"
    exit 1
fi

LAMBDA_NAME=$(echo "$LAMBDA_ARN" | awk -F':' '{print $NF}')
echo "✅ Found Lambda: $LAMBDA_NAME"

# Get execution role
ROLE_ARN=$(aws lambda get-function-configuration \
    --function-name "$LAMBDA_NAME" \
    --region "$REGION" \
    --query Role \
    --output text)

ROLE_NAME=$(echo "$ROLE_ARN" | awk -F'/' '{print $NF}')
echo "✅ Execution Role: $ROLE_NAME"
echo ""

# Add SES permissions
echo "🔐 Adding SES send permissions..."
aws iam put-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-name SESSendEmailPermission \
    --policy-document '{
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow",
            "Action": [
                "ses:SendEmail",
                "ses:SendRawEmail"
            ],
            "Resource": "*"
        }]
    }' \
    --output json > /dev/null

echo "✅ SES permissions added successfully!"
echo ""
echo "The Lambda can now send emails via SES."


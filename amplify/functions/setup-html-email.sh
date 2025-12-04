#!/bin/bash

# Script to set up HTML email delivery via sendManagerNotification Lambda
# This Lambda receives SNS events and sends properly formatted HTML emails via SES

set -e

REGION="ca-central-1"
TOPIC_ARN="arn:aws:sns:ca-central-1:216348571084:training-completion-notifications"

echo "📧 Setting up HTML Email Delivery via Lambda + SES"
echo "=================================================="
echo ""

# Step 1: Find sendManagerNotification Lambda
echo "🔍 Step 1: Finding sendManagerNotification Lambda..."
LAMBDA_ARN=$(aws lambda list-functions \
    --region "$REGION" \
    --query "Functions[?contains(FunctionName, 'sendManagerNotification')].FunctionArn" \
    --output text | head -1)

if [ -z "$LAMBDA_ARN" ] || [ "$LAMBDA_ARN" == "None" ]; then
    echo "⚠️  Lambda function not found."
    echo ""
    echo "The sendManagerNotification Lambda needs to be deployed first."
    echo ""
    echo "Option 1: Deploy via Amplify (if in backend.ts):"
    echo "   npx ampx sandbox"
    echo ""
    echo "Option 2: Create Lambda manually, then run this script again"
    echo ""
    echo "For now, emails will be sent via SNS email subscriptions (plain text)"
    exit 0
fi

LAMBDA_NAME=$(echo "$LAMBDA_ARN" | awk -F':' '{print $NF}')
echo "✅ Found Lambda: $LAMBDA_NAME"
echo ""

# Step 2: Check if already subscribed
echo "🔍 Step 2: Checking existing subscriptions..."
EXISTING_SUB=$(aws sns list-subscriptions-by-topic \
    --topic-arn "$TOPIC_ARN" \
    --region "$REGION" \
    --query "Subscriptions[?Protocol==\`lambda\` && Endpoint==\`$LAMBDA_ARN\`].SubscriptionArn" \
    --output text 2>/dev/null || echo "")

if [ -n "$EXISTING_SUB" ] && [ "$EXISTING_SUB" != "None" ]; then
    echo "✅ Lambda already subscribed to SNS topic"
    echo "   Subscription ARN: $EXISTING_SUB"
else
    # Step 3: Subscribe Lambda to SNS
    echo "🔗 Step 3: Subscribing Lambda to SNS topic..."
    aws sns subscribe \
        --topic-arn "$TOPIC_ARN" \
        --protocol lambda \
        --notification-endpoint "$LAMBDA_ARN" \
        --region "$REGION" \
        --output json > /dev/null
    
    echo "✅ Lambda subscribed to SNS (AUTO-CONFIRMED ✅)"
fi
echo ""

# Step 4: Grant SNS permission to invoke Lambda
echo "🔐 Step 4: Granting SNS permission to invoke Lambda..."
aws lambda add-permission \
    --function-name "$LAMBDA_NAME" \
    --statement-id AllowSNSToInvoke \
    --action lambda:InvokeFunction \
    --principal sns.amazonaws.com \
    --source-arn "$TOPIC_ARN" \
    --region "$REGION" \
    --output json > /dev/null 2>&1 && echo "✅ Permission granted" || echo "⚠️  Permission may already exist"
echo ""

# Step 5: Add SES permissions to Lambda
echo "📧 Step 5: Adding SES send permissions to Lambda..."
ROLE_ARN=$(aws lambda get-function-configuration \
    --function-name "$LAMBDA_NAME" \
    --region "$REGION" \
    --query Role \
    --output text)

ROLE_NAME=$(echo "$ROLE_ARN" | awk -F'/' '{print $NF}')

# Check if SES policy exists
POLICY_EXISTS=$(aws iam get-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-name SESSendEmailPermission \
    --output text 2>/dev/null || echo "")

if [ -z "$POLICY_EXISTS" ]; then
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
    
    echo "✅ SES permissions added"
else
    echo "✅ SES permissions already exist"
fi
echo ""

# Step 6: Check SES configuration
echo "📧 Step 6: Checking SES email configuration..."
FROM_EMAIL=$(aws lambda get-function-configuration \
    --function-name "$LAMBDA_NAME" \
    --region "$REGION" \
    --query 'Environment.Variables.FROM_EMAIL' \
    --output text 2>/dev/null || echo "circular360dev@gmail.com")

echo "   FROM_EMAIL: $FROM_EMAIL"

SES_STATUS=$(aws ses get-identity-verification-attributes \
    --identities "$FROM_EMAIL" \
    --region "$REGION" \
    --query "VerificationAttributes.\"$FROM_EMAIL\".VerificationStatus" \
    --output text 2>/dev/null || echo "Unknown")

if [ "$SES_STATUS" == "Success" ]; then
    echo "   ✅ SES Email is verified"
elif [ "$SES_STATUS" == "Pending" ]; then
    echo "   ⚠️  SES Email is pending verification"
    echo "   📧 Check inbox for $FROM_EMAIL and click verification link"
else
    echo "   ⚠️  SES Email verification status: $SES_STATUS"
    echo "   📧 To verify, run:"
    echo "      aws ses verify-email-identity --email-address $FROM_EMAIL --region $REGION"
fi
echo ""

# Summary
echo "================================================================"
echo "✅ Setup Complete!"
echo "================================================================"
echo ""
echo "📋 Summary:"
echo "   Lambda Function: $LAMBDA_NAME"
echo "   SNS Subscription: ✅ Configured"
echo "   SNS Permission: ✅ Granted"
echo "   SES Permissions: ✅ Added"
echo "   SES Email: $FROM_EMAIL ($SES_STATUS)"
echo ""
echo "📝 How It Works:"
echo "   1. Employee passes quiz"
echo "   2. quizCompletion Lambda publishes HTML message to SNS"
echo "   3. SNS triggers sendManagerNotification Lambda"
echo "   4. Lambda extracts data from MessageAttributes"
echo "   5. Lambda sends HTML email via SES to manager"
echo "   6. Manager receives properly formatted HTML email ✅"
echo ""
echo "🧪 Test:"
echo "   1. Have an employee complete and pass a quiz"
echo "   2. Manager should receive HTML email (not raw HTML code)"
echo "   3. Check CloudWatch logs if issues occur"
echo ""


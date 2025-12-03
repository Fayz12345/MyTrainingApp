#!/bin/bash

# Script to set up automatic email system using Lambda + SES
# This bypasses the need for email subscription confirmation

set -e

REGION="ca-central-1"
TOPIC_ARN="arn:aws:sns:ca-central-1:216348571084:training-completion-notifications"
FROM_EMAIL="circular360dev@gmail.com"  # Update with your verified SES email

echo "🚀 Setting Up Auto-Email System (No Confirmation Required)"
echo "========================================================="
echo ""

# Step 1: Verify SES Email
echo "📧 Step 1: Verifying SES email address..."
echo "   Email: $FROM_EMAIL"
echo ""
echo "   ⚠️  IMPORTANT: You need to verify this email in SES first:"
echo "   1. Go to: https://console.aws.amazon.com/ses/home?region=$REGION#/verified-identities"
echo "   2. Click 'Create identity'"
echo "   3. Select 'Email address'"
echo "   4. Enter: $FROM_EMAIL"
echo "   5. Check your Gmail and click verification link"
echo ""
read -p "Have you verified the email in SES? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Please verify the email in SES first, then run this script again."
    exit 1
fi

# Check verification status
VERIFICATION_STATUS=$(aws ses get-identity-verification-attributes \
    --identities "$FROM_EMAIL" \
    --region "$REGION" \
    --query "VerificationAttributes.\"$FROM_EMAIL\".VerificationStatus" \
    --output text 2>/dev/null || echo "NotFound")

if [ "$VERIFICATION_STATUS" != "Success" ]; then
    echo "❌ Email not verified in SES. Status: $VERIFICATION_STATUS"
    echo "   Please verify the email first, then run this script again."
    exit 1
fi

echo "✅ Email verified in SES"
echo ""

# Step 2: Find sendManagerNotification Lambda
echo "🔍 Step 2: Finding sendManagerNotification Lambda..."
LAMBDA_ARN=$(aws lambda list-functions --region "$REGION" \
    --query "Functions[?contains(FunctionName, 'sendManagerNotification')].FunctionArn" \
    --output text | head -1)

if [ -z "$LAMBDA_ARN" ]; then
    echo "❌ Lambda function not found. Please deploy it first:"
    echo "   npx ampx sandbox"
    exit 1
fi

LAMBDA_NAME=$(echo "$LAMBDA_ARN" | awk -F':' '{print $NF}')
echo "✅ Found Lambda: $LAMBDA_NAME"
echo ""

# Step 3: Subscribe Lambda to SNS (Auto-Confirmed)
echo "🔗 Step 3: Subscribing Lambda to SNS topic..."
EXISTING_SUB=$(aws sns list-subscriptions-by-topic \
    --topic-arn "$TOPIC_ARN" \
    --region "$REGION" \
    --query "Subscriptions[?Protocol==\`lambda\` && Endpoint==\`$LAMBDA_ARN\`].SubscriptionArn" \
    --output text 2>/dev/null || echo "")

if [ -n "$EXISTING_SUB" ] && [ "$EXISTING_SUB" != "None" ]; then
    echo "✅ Lambda already subscribed to SNS"
else
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

# Check if policy exists
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

# Step 6: Update Lambda environment variable
echo "⚙️  Step 6: Updating Lambda environment variables..."
aws lambda update-function-configuration \
    --function-name "$LAMBDA_NAME" \
    --environment "Variables={FROM_EMAIL=$FROM_EMAIL}" \
    --region "$REGION" \
    --output json > /dev/null

echo "✅ Environment variable updated: FROM_EMAIL=$FROM_EMAIL"
echo ""

# Summary
echo "========================================================="
echo "✅ Setup Complete!"
echo "========================================================="
echo ""
echo "📋 Summary:"
echo "   Lambda Function: $LAMBDA_NAME"
echo "   SNS Subscription: Auto-confirmed ✅"
echo "   SES Email: $FROM_EMAIL (verified)"
echo "   Permissions: Configured ✅"
echo ""
echo "📝 How It Works:"
echo "   1. Employee completes quiz"
echo "   2. quizCompletion Lambda publishes to SNS"
echo "   3. sendManagerNotification Lambda receives notification (auto-confirmed ✅)"
echo "   4. Lambda sends email via SES to manager"
echo "   5. Manager receives email ✅ (NO CONFIRMATION NEEDED)"
echo ""
echo "🧪 Test:"
echo "   1. Have an employee complete a quiz"
echo "   2. Manager should receive email automatically"
echo "   3. Check CloudWatch logs if issues occur"
echo ""


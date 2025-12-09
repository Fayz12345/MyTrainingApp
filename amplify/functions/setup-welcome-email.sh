#!/bin/bash

# Script to set up sendWelcomeEmail Lambda function
# This script:
# 1. Creates Function URL for HTTP access
# 2. Adds SES send permissions to Lambda execution role
# 3. Updates frontend .env file with Function URL

set -e

REGION="ca-central-1"
FROM_EMAIL="circular360dev@gmail.com"

echo "📧 Setting up sendWelcomeEmail Lambda Function"
echo "=============================================="
echo ""

# Step 1: Find sendWelcomeEmail Lambda
echo "🔍 Step 1: Finding sendWelcomeEmail Lambda..."
LAMBDA_ARN=$(aws lambda list-functions \
    --region "$REGION" \
    --query "Functions[?contains(FunctionName, 'sendWelcomeEmail')].FunctionArn" \
    --output text | head -1)

if [ -z "$LAMBDA_ARN" ] || [ "$LAMBDA_ARN" == "None" ]; then
    echo "❌ Lambda function not found."
    echo ""
    echo "The sendWelcomeEmail Lambda needs to be deployed first."
    echo ""
    echo "Deploy via Amplify:"
    echo "   cd /var/www/html/MyTrainingApp"
    echo "   npx ampx sandbox"
    echo ""
    echo "Then run this script again."
    exit 1
fi

LAMBDA_NAME=$(echo "$LAMBDA_ARN" | awk -F':' '{print $NF}')
echo "✅ Found Lambda: $LAMBDA_NAME"
echo ""

# Step 2: Check if Function URL already exists
echo "🔍 Step 2: Checking for existing Function URL..."
EXISTING_URL=$(aws lambda get-function-url-config \
    --function-name "$LAMBDA_NAME" \
    --region "$REGION" \
    --query FunctionUrl \
    --output text 2>/dev/null || echo "")

if [ -n "$EXISTING_URL" ] && [ "$EXISTING_URL" != "None" ]; then
    echo "✅ Function URL already exists: $EXISTING_URL"
    FUNCTION_URL="$EXISTING_URL"
else
    # Step 3: Create Function URL
    echo ""
    echo "🔗 Step 3: Creating Function URL..."
    aws lambda create-function-url-config \
        --function-name "$LAMBDA_NAME" \
        --auth-type NONE \
        --cors '{"AllowOrigins":["*"],"AllowMethods":["POST"],"AllowHeaders":["content-type"]}' \
        --region "$REGION" \
        --output json > /tmp/function-url.json
    
    FUNCTION_URL=$(cat /tmp/function-url.json | python3 -c "import sys, json; print(json.load(sys.stdin)['FunctionUrl'])" 2>/dev/null || \
                   cat /tmp/function-url.json | grep -o '"FunctionUrl":"[^"]*"' | cut -d'"' -f4)
    echo "✅ Function URL created: $FUNCTION_URL"
fi
echo ""

# Step 4: Add public access permission
echo "🔓 Step 4: Adding public access permission..."
aws lambda add-permission \
    --function-name "$LAMBDA_NAME" \
    --statement-id FunctionURLAllowPublicAccess \
    --action lambda:InvokeFunctionUrl \
    --principal "*" \
    --function-url-auth-type NONE \
    --region "$REGION" \
    --output json > /dev/null 2>&1 && echo "✅ Public access added" || echo "⚠️  Permission may already exist"
echo ""

# Step 5: Add SES permissions to Lambda
echo "📧 Step 5: Adding SES send permissions to Lambda..."
ROLE_ARN=$(aws lambda get-function-configuration \
    --function-name "$LAMBDA_NAME" \
    --region "$REGION" \
    --query Role \
    --output text)

ROLE_NAME=$(echo "$ROLE_ARN" | awk -F'/' '{print $NF}')
echo "   Role: $ROLE_NAME"

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

# Step 6: Check SES email verification
echo "📧 Step 6: Checking SES email verification..."
SES_STATUS=$(aws ses get-identity-verification-attributes \
    --identities "$FROM_EMAIL" \
    --region "$REGION" \
    --query "VerificationAttributes.\"$FROM_EMAIL\".VerificationStatus" \
    --output text 2>/dev/null || echo "Unknown")

if [ "$SES_STATUS" == "Success" ]; then
    echo "   ✅ SES Email is verified: $FROM_EMAIL"
elif [ "$SES_STATUS" == "Pending" ]; then
    echo "   ⚠️  SES Email is pending verification: $FROM_EMAIL"
    echo "   📧 Check inbox for $FROM_EMAIL and click verification link"
else
    echo "   ⚠️  SES Email verification status: $SES_STATUS"
    echo "   📧 To verify, run:"
    echo "      aws ses verify-email-identity --email-address $FROM_EMAIL --region $REGION"
fi
echo ""

# Step 7: Update frontend .env file
echo "📝 Step 7: Updating frontend .env file..."
ENV_FILE="my-training-admin/.env"
ENV_VAR="REACT_APP_SEND_WELCOME_EMAIL_LAMBDA_URL"

if [ ! -f "$ENV_FILE" ]; then
    echo "   Creating .env file..."
    touch "$ENV_FILE"
fi

# Check if variable already exists
if grep -q "^$ENV_VAR=" "$ENV_FILE"; then
    # Update existing variable
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|^$ENV_VAR=.*|$ENV_VAR=$FUNCTION_URL|" "$ENV_FILE"
    else
        sed -i "s|^$ENV_VAR=.*|$ENV_VAR=$FUNCTION_URL|" "$ENV_FILE"
    fi
    echo "   ✅ Updated $ENV_VAR in .env file"
else
    # Add new variable
    echo "$ENV_VAR=$FUNCTION_URL" >> "$ENV_FILE"
    echo "   ✅ Added $ENV_VAR to .env file"
fi
echo ""

# Summary
echo "================================================================"
echo "✅ Setup Complete!"
echo "================================================================"
echo ""
echo "📋 Summary:"
echo "   Lambda Function: $LAMBDA_NAME"
echo "   Function URL: $FUNCTION_URL"
echo "   Public Access: ✅ Configured"
echo "   SES Permissions: ✅ Added"
echo "   SES Email: $FROM_EMAIL ($SES_STATUS)"
echo "   Frontend Config: ✅ Updated (.env)"
echo ""
echo "📝 Environment Variable:"
echo "   $ENV_VAR=$FUNCTION_URL"
echo ""
echo "🧪 Test the Lambda:"
echo "   curl -X POST $FUNCTION_URL \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"email\":\"test@example.com\",\"name\":\"Test User\",\"password\":\"TempPass123!\",\"role\":\"employee\"}'"
echo ""
echo "⚠️  Important:"
if [ "$SES_STATUS" != "Success" ]; then
    echo "   - SES email verification is required before emails will send"
    echo "   - Check inbox for $FROM_EMAIL and click verification link"
fi
echo "   - Restart React dev server after updating .env file"
echo ""


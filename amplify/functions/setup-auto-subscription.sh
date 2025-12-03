#!/bin/bash

# Script to automatically set up manager SNS subscription Lambda
# This script deploys the Lambda and creates the Function URL

set -e

REGION="ca-central-1"
SNS_TOPIC_ARN="arn:aws:sns:ca-central-1:216348571084:training-completion-notifications"

echo "🚀 Setting up Automatic Manager SNS Subscription"
echo "================================================"
echo ""

# Step 1: Deploy backend (if using sandbox)
echo "📦 Step 1: Deploying backend..."
echo "⚠️  Note: You need to deploy the backend first using:"
echo "   npx ampx sandbox"
echo "   OR"
echo "   npx ampx pipeline-deploy --branch dev"
echo ""
read -p "Have you deployed the backend? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Please deploy the backend first, then run this script again."
    exit 1
fi

# Step 2: Find the Lambda function
echo ""
echo "🔍 Step 2: Finding Lambda function..."
FUNCTION_NAME=$(aws lambda list-functions --region $REGION \
    --query "Functions[?contains(FunctionName, 'subscribeManagerToSNS')].FunctionName" \
    --output text | head -1)

if [ -z "$FUNCTION_NAME" ]; then
    echo "❌ Lambda function not found. Please ensure backend is deployed."
    echo "   Try: npx ampx sandbox"
    exit 1
fi

echo "✅ Found function: $FUNCTION_NAME"

# Step 3: Check if Function URL already exists
echo ""
echo "🔍 Step 3: Checking for existing Function URL..."
EXISTING_URL=$(aws lambda get-function-url-config \
    --function-name "$FUNCTION_NAME" \
    --region $REGION \
    --query FunctionUrl \
    --output text 2>/dev/null || echo "")

if [ -n "$EXISTING_URL" ] && [ "$EXISTING_URL" != "None" ]; then
    echo "✅ Function URL already exists: $EXISTING_URL"
    FUNCTION_URL="$EXISTING_URL"
else
    # Step 4: Create Function URL
    echo ""
    echo "🔗 Step 4: Creating Function URL..."
    aws lambda create-function-url-config \
        --function-name "$FUNCTION_NAME" \
        --auth-type NONE \
        --cors '{"AllowOrigins":["*"],"AllowMethods":["POST"],"AllowHeaders":["content-type"]}' \
        --region $REGION \
        --output json > /tmp/function-url.json
    
    FUNCTION_URL=$(cat /tmp/function-url.json | python3 -c "import sys, json; print(json.load(sys.stdin)['FunctionUrl'])")
    echo "✅ Function URL created: $FUNCTION_URL"
    
    # Step 5: Add public access permission
    echo ""
    echo "🔓 Step 5: Adding public access permission..."
    aws lambda add-permission \
        --function-name "$FUNCTION_NAME" \
        --statement-id FunctionURLAllowPublicAccess \
        --action lambda:InvokeFunctionUrl \
        --principal "*" \
        --function-url-auth-type NONE \
        --region $REGION \
        --output json > /dev/null 2>&1 || echo "⚠️  Permission may already exist"
    echo "✅ Public access permission added"
fi

# Step 6: Add SNS permissions
echo ""
echo "🔐 Step 6: Adding SNS permissions to Lambda execution role..."
ROLE_ARN=$(aws lambda get-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --region $REGION \
    --query Role \
    --output text)

ROLE_NAME=$(echo $ROLE_ARN | awk -F'/' '{print $NF}')
echo "   Role: $ROLE_NAME"

# Check if policy already exists
POLICY_EXISTS=$(aws iam get-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-name SNSSubscribePermission \
    --output text 2>/dev/null || echo "")

if [ -z "$POLICY_EXISTS" ]; then
    aws iam put-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-name SNSSubscribePermission \
        --policy-document "{
            \"Version\": \"2012-10-17\",
            \"Statement\": [{
                \"Effect\": \"Allow\",
                \"Action\": [
                    \"sns:Subscribe\",
                    \"sns:ListSubscriptionsByTopic\"
                ],
                \"Resource\": \"$SNS_TOPIC_ARN\"
            }]
        }" \
        --output json > /dev/null
    echo "✅ SNS permissions added"
else
    echo "✅ SNS permissions already exist"
fi

# Step 7: Update frontend .env file
echo ""
echo "📝 Step 7: Updating frontend environment variable..."
ENV_FILE="my-training-admin/.env"
ENV_VAR="REACT_APP_SUBSCRIBE_MANAGER_SNS_LAMBDA_URL"

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "   Creating .env file..."
    touch "$ENV_FILE"
fi

# Check if variable already exists
if grep -q "^$ENV_VAR=" "$ENV_FILE"; then
    # Update existing variable
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|^$ENV_VAR=.*|$ENV_VAR=$FUNCTION_URL|" "$ENV_FILE"
    else
        # Linux
        sed -i "s|^$ENV_VAR=.*|$ENV_VAR=$FUNCTION_URL|" "$ENV_FILE"
    fi
    echo "✅ Updated $ENV_VAR in .env file"
else
    # Add new variable
    echo "$ENV_VAR=$FUNCTION_URL" >> "$ENV_FILE"
    echo "✅ Added $ENV_VAR to .env file"
fi

# Summary
echo ""
echo "================================================"
echo "✅ Setup Complete!"
echo "================================================"
echo ""
echo "📋 Summary:"
echo "   Function Name: $FUNCTION_NAME"
echo "   Function URL:  $FUNCTION_URL"
echo "   Environment Variable: $ENV_VAR=$FUNCTION_URL"
echo ""
echo "📝 Next Steps:"
echo "   1. Restart your frontend development server:"
echo "      cd my-training-admin && npm start"
echo ""
echo "   2. Test by creating a new manager:"
echo "      - Manager will be automatically subscribed to SNS"
echo "      - Manager will receive confirmation email"
echo "      - Manager clicks link to confirm subscription"
echo ""
echo "   3. Verify subscription:"
echo "      aws sns list-subscriptions-by-topic \\"
echo "        --topic-arn $SNS_TOPIC_ARN \\"
echo "        --region $REGION \\"
echo "        --query 'Subscriptions[?Protocol==\`email\`]'"
echo ""


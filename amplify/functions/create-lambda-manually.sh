#!/bin/bash

# Script to manually create subscribeManagerToSNS Lambda function via AWS CLI
# This is a workaround if Amplify deployment doesn't create it

set -e

REGION="ca-central-1"
FUNCTION_NAME="subscribeManagerToSNS-manual"
SNS_TOPIC_ARN="arn:aws:sns:ca-central-1:216348571084:training-completion-notifications"
RUNTIME="nodejs20.x"
TIMEOUT=10
MEMORY_SIZE=256

echo "🚀 Creating Lambda Function Manually"
echo "===================================="
echo ""

# Step 1: Get Lambda execution role (use existing quizCompletion role as template)
echo "📋 Step 1: Finding Lambda execution role..."
QUIZ_ROLE=$(aws lambda get-function-configuration \
    --function-name "amplify-d6c38s8spsb1t-dev-quizCompletionlambdaBBA5-WWbEkGNeew8c" \
    --region $REGION \
    --query Role \
    --output text 2>/dev/null || echo "")

if [ -z "$QUIZ_ROLE" ]; then
    echo "❌ Could not find existing Lambda role. Please provide a role ARN:"
    read -p "Enter Lambda execution role ARN: " LAMBDA_ROLE
else
    # Extract account ID and create a similar role name
    ACCOUNT_ID=$(echo $QUIZ_ROLE | awk -F':' '{print $5}')
    ROLE_NAME_PREFIX=$(echo $QUIZ_ROLE | awk -F'/' '{print $NF}' | sed 's/-quizCompletion.*//')
    LAMBDA_ROLE="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME_PREFIX}-subscribeManagerToSNS-*"
    
    echo "⚠️  Using role pattern: $LAMBDA_ROLE"
    echo "   We'll need to create a role or use an existing one."
    echo ""
    read -p "Enter Lambda execution role ARN (or press Enter to use quizCompletion role): " CUSTOM_ROLE
    
    if [ -n "$CUSTOM_ROLE" ]; then
        LAMBDA_ROLE="$CUSTOM_ROLE"
    else
        # Use the quizCompletion role directly (not ideal but works)
        LAMBDA_ROLE="$QUIZ_ROLE"
        echo "✅ Using quizCompletion role: $LAMBDA_ROLE"
    fi
fi

# Step 2: Create deployment package
echo ""
echo "📦 Step 2: Creating deployment package..."
cd /var/www/html/MyTrainingApp/amplify/functions/subscribeManagerToSNS

# Create a temporary directory for the package
TEMP_DIR=$(mktemp -d)

# Compile TypeScript to JavaScript using esbuild
echo "   Compiling TypeScript to JavaScript..."
cd /var/www/html/MyTrainingApp/amplify

# Check if esbuild is available
if command -v npx &> /dev/null; then
    npx esbuild functions/subscribeManagerToSNS/handler.ts \
        --bundle \
        --platform=node \
        --target=node20 \
        --format=esm \
        --outfile="$TEMP_DIR/handler.js" \
        --external:@aws-sdk/client-sns \
        --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);" \
        2>/dev/null || {
        echo "   ⚠️  esbuild failed, using simple conversion..."
        # Fallback: simple TypeScript removal (not perfect but works for basic cases)
        sed 's/: [A-Za-z<>|&\[\]{}?]*//g; s/interface [A-Za-z]* {/\/\/ interface/g; s/^import type.*/\/\/ type import/g' \
            functions/subscribeManagerToSNS/handler.ts | \
            sed 's/export const handler/export const handler/g' > "$TEMP_DIR/handler.js"
    }
else
    echo "   ⚠️  npx not found, using simple conversion..."
    sed 's/: [A-Za-z<>|&\[\]{}?]*//g; s/interface [A-Za-z]* {/\/\/ interface/g; s/^import type.*/\/\/ type import/g' \
        functions/subscribeManagerToSNS/handler.ts | \
        sed 's/export const handler/export const handler/g' > "$TEMP_DIR/handler.js"
fi

# Create package.json for dependencies
cat > "$TEMP_DIR/package.json" << EOF
{
  "name": "subscribeManagerToSNS",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@aws-sdk/client-sns": "^3.0.0"
  }
}
EOF

# Install dependencies
cd "$TEMP_DIR"
echo "   Installing dependencies..."
npm install --production --silent 2>/dev/null || {
    echo "   ⚠️  npm install failed, trying with npm cache..."
    npm cache clean --force 2>/dev/null
    npm install --production --silent
}

# Create zip file
ZIP_FILE="/tmp/subscribeManagerToSNS-$(date +%s).zip"
cd "$TEMP_DIR"
zip -r "$ZIP_FILE" . -q
echo "✅ Package created: $ZIP_FILE ($(du -h "$ZIP_FILE" | cut -f1))"

# Step 3: Create Lambda function
echo ""
echo "🔧 Step 3: Creating Lambda function..."
cd /var/www/html/MyTrainingApp

# Check if function already exists
EXISTING=$(aws lambda get-function \
    --function-name "$FUNCTION_NAME" \
    --region $REGION \
    --query Configuration.FunctionName \
    --output text 2>/dev/null || echo "")

if [ -n "$EXISTING" ]; then
    echo "⚠️  Function already exists. Updating..."
    aws lambda update-function-code \
        --function-name "$FUNCTION_NAME" \
        --zip-file "fileb://$ZIP_FILE" \
        --region $REGION \
        --output json > /dev/null
    
    aws lambda update-function-configuration \
        --function-name "$FUNCTION_NAME" \
        --timeout $TIMEOUT \
        --memory-size $MEMORY_SIZE \
        --environment "Variables={SNS_TOPIC_ARN=$SNS_TOPIC_ARN}" \
        --region $REGION \
        --output json > /dev/null
    
    echo "✅ Function updated"
else
    # Create new function
    aws lambda create-function \
        --function-name "$FUNCTION_NAME" \
        --runtime $RUNTIME \
        --role "$LAMBDA_ROLE" \
        --handler "handler.handler" \
    --package-type Zip \
        --zip-file "fileb://$ZIP_FILE" \
        --timeout $TIMEOUT \
        --memory-size $MEMORY_SIZE \
        --environment "Variables={SNS_TOPIC_ARN=$SNS_TOPIC_ARN}" \
        --region $REGION \
        --output json > /tmp/lambda-create.json
    
    echo "✅ Function created: $FUNCTION_NAME"
fi

# Step 4: Add SNS permissions to role
echo ""
echo "🔐 Step 4: Adding SNS permissions..."
ROLE_NAME=$(echo "$LAMBDA_ROLE" | awk -F'/' '{print $NF}')

# Try to add inline policy
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
    --output json > /dev/null 2>&1 && echo "✅ SNS permissions added" || echo "⚠️  Could not add permissions (may already exist or need manual setup)"

# Step 5: Create Function URL
echo ""
echo "🔗 Step 5: Creating Function URL..."
FUNCTION_URL=$(aws lambda get-function-url-config \
    --function-name "$FUNCTION_NAME" \
    --region $REGION \
    --query FunctionUrl \
    --output text 2>/dev/null || echo "")

if [ -z "$FUNCTION_URL" ] || [ "$FUNCTION_URL" == "None" ]; then
    aws lambda create-function-url-config \
        --function-name "$FUNCTION_NAME" \
        --auth-type NONE \
        --cors '{"AllowOrigins":["*"],"AllowMethods":["POST"],"AllowHeaders":["content-type"]}' \
        --region $REGION \
        --output json > /tmp/function-url.json
    
    FUNCTION_URL=$(cat /tmp/function-url.json | python3 -c "import sys, json; print(json.load(sys.stdin)['FunctionUrl'])")
    echo "✅ Function URL created: $FUNCTION_URL"
else
    echo "✅ Function URL already exists: $FUNCTION_URL"
fi

# Step 6: Add public access permission
echo ""
echo "🔓 Step 6: Adding public access permission..."
aws lambda add-permission \
    --function-name "$FUNCTION_NAME" \
    --statement-id FunctionURLAllowPublicAccess \
    --action lambda:InvokeFunctionUrl \
    --principal "*" \
    --function-url-auth-type NONE \
    --region $REGION \
    --output json > /dev/null 2>&1 && echo "✅ Public access added" || echo "⚠️  Permission may already exist"

# Step 7: Update frontend .env
echo ""
echo "📝 Step 7: Updating frontend .env file..."
ENV_FILE="my-training-admin/.env"
ENV_VAR="REACT_APP_SUBSCRIBE_MANAGER_SNS_LAMBDA_URL"

if [ ! -f "$ENV_FILE" ]; then
    touch "$ENV_FILE"
fi

if grep -q "^$ENV_VAR=" "$ENV_FILE"; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|^$ENV_VAR=.*|$ENV_VAR=$FUNCTION_URL|" "$ENV_FILE"
    else
        sed -i "s|^$ENV_VAR=.*|$ENV_VAR=$FUNCTION_URL|" "$ENV_FILE"
    fi
    echo "✅ Updated $ENV_VAR in .env"
else
    echo "$ENV_VAR=$FUNCTION_URL" >> "$ENV_FILE"
    echo "✅ Added $ENV_VAR to .env"
fi

# Cleanup
rm -rf "$TEMP_DIR"
rm -f "$ZIP_FILE"

# Summary
echo ""
echo "===================================="
echo "✅ Setup Complete!"
echo "===================================="
echo ""
echo "📋 Summary:"
echo "   Function Name: $FUNCTION_NAME"
echo "   Function URL:  $FUNCTION_URL"
echo "   Environment Variable: $ENV_VAR=$FUNCTION_URL"
echo ""
echo "📝 Next Steps:"
echo "   1. Restart frontend: cd my-training-admin && npm start"
echo "   2. Test by creating a new manager"
echo "   3. Check CloudWatch logs if issues occur"
echo ""


#!/bin/bash

# Script to add SNS Publish permission to Lambda execution role
# Requires AWS CLI with admin permissions
# Usage: ./add-sns-permission.sh

set -e

FUNCTION_NAME="amplify-d6c38s8spsb1t-dev-quizCompletionlambdaBBA5-WWbEkGNeew8c"
REGION="ca-central-1"
SNS_TOPIC_ARN="arn:aws:sns:ca-central-1:216348571084:training-completion-notifications"
POLICY_NAME="SNSPublishPermission"

echo "🔧 Adding SNS Publish Permission to Lambda Function"
echo "=================================================="
echo "Function: $FUNCTION_NAME"
echo "Region: $REGION"
echo "SNS Topic: $SNS_TOPIC_ARN"
echo ""

# Get Lambda function details
echo "📋 Step 1: Getting Lambda function details..."
ROLE_ARN=$(aws lambda get-function \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --query 'Configuration.Role' \
  --output text)

if [ -z "$ROLE_ARN" ]; then
  echo "❌ Error: Could not get Lambda function role"
  exit 1
fi

echo "✅ Execution Role ARN: $ROLE_ARN"

# Extract role name from ARN (everything after the last /)
ROLE_NAME=$(echo "$ROLE_ARN" | awk -F'/' '{print $NF}')
echo "✅ Role Name: $ROLE_NAME"
echo ""

# Create policy document
echo "📝 Step 2: Creating IAM policy document..."
POLICY_DOC=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sns:Publish"
      ],
      "Resource": "$SNS_TOPIC_ARN"
    }
  ]
}
EOF
)

# Save policy to temp file
TEMP_POLICY=$(mktemp)
echo "$POLICY_DOC" > "$TEMP_POLICY"
echo "✅ Policy document created"
echo ""

# Check if policy already exists
echo "🔍 Step 3: Checking if policy already exists..."
if aws iam get-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "$POLICY_NAME" \
  --region "$REGION" \
  2>/dev/null; then
  echo "⚠️  Policy already exists. Updating..."
  UPDATE_MODE="update"
else
  echo "✅ Policy does not exist. Creating new policy..."
  UPDATE_MODE="create"
fi
echo ""

# Add/update inline policy
echo "💾 Step 4: Adding inline policy to role..."
if aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "$POLICY_NAME" \
  --policy-document "file://$TEMP_POLICY" \
  --region "$REGION"; then
  echo "✅ Policy $UPDATE_MODE successful!"
else
  echo "❌ Error: Failed to $UPDATE_MODE policy"
  rm "$TEMP_POLICY"
  exit 1
fi

# Clean up temp file
rm "$TEMP_POLICY"
echo ""

# Verify policy was added
echo "✅ Step 5: Verifying policy..."
if aws iam get-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "$POLICY_NAME" \
  --region "$REGION" \
  --query 'PolicyDocument' \
  --output json > /dev/null 2>&1; then
  echo "✅ Policy verified successfully!"
else
  echo "⚠️  Warning: Could not verify policy (but it may have been added)"
fi
echo ""

echo "=================================================="
echo "✅ SUCCESS: SNS Publish permission added!"
echo ""
echo "📋 Next Steps:"
echo "   1. Test Lambda function to verify it works"
echo "   2. Check CloudWatch logs for successful SNS publish"
echo "   3. Verify managers receive email notifications"
echo ""
echo "🧪 Test command:"
echo "   aws lambda invoke \\"
echo "     --function-name $FUNCTION_NAME \\"
echo "     --region $REGION \\"
echo "     --payload '{\"assignmentId\":\"test-id\",\"passed\":true,\"score\":100}' \\"
echo "     response.json"
echo ""


#!/bin/bash

# Script to add mobile redirect URL to Cognito User Pool for Flutter app
# This fixes Google OAuth login by adding com.mytrainingapp:// to callback URLs

set -e

echo "🔧 Fixing Cognito OAuth Redirect URLs for Flutter App..."
echo ""

USER_POOL_ID="ca-central-1_aKCLbCdhj"
CLIENT_ID="1kljta9eftlgp8dqa9rv3e0chv"
REGION="ca-central-1"
MOBILE_REDIRECT="com.mytrainingapp://"

echo "📋 Configuration:"
echo "   User Pool ID: $USER_POOL_ID"
echo "   Client ID: $CLIENT_ID"
echo "   Region: $REGION"
echo "   Mobile Redirect: $MOBILE_REDIRECT"
echo ""

# Get current client configuration
echo "🔍 Getting current client configuration..."
CURRENT_CONFIG=$(aws cognito-idp describe-user-pool-client \
  --user-pool-id "$USER_POOL_ID" \
  --client-id "$CLIENT_ID" \
  --region "$REGION" \
  --output json)

# Extract current callback and logout URLs
CURRENT_CALLBACKS=$(echo "$CURRENT_CONFIG" | grep -o '"CallbackURLs": \[[^]]*\]' || echo '[]')
CURRENT_LOGOUTS=$(echo "$CURRENT_CONFIG" | grep -o '"LogoutURLs": \[[^]]*\]' || echo '[]')

echo "   Current Callback URLs: $CURRENT_CALLBACKS"
echo "   Current Logout URLs: $CURRENT_LOGOUTS"
echo ""

# Check if mobile redirect is already present
if echo "$CURRENT_CALLBACKS" | grep -q "com.mytrainingapp"; then
  echo "✅ Mobile redirect URL already present in Callback URLs"
else
  echo "⚠️  Mobile redirect URL NOT found in Callback URLs"
  echo "   Need to add: $MOBILE_REDIRECT"
fi

if echo "$CURRENT_LOGOUTS" | grep -q "com.mytrainingapp"; then
  echo "✅ Mobile redirect URL already present in Logout URLs"
else
  echo "⚠️  Mobile redirect URL NOT found in Logout URLs"
  echo "   Need to add: $MOBILE_REDIRECT"
fi

echo ""
echo "📝 To fix this, run the following AWS CLI command:"
echo ""
echo "aws cognito-idp update-user-pool-client \\"
echo "  --user-pool-id $USER_POOL_ID \\"
echo "  --client-id $CLIENT_ID \\"
echo "  --region $REGION \\"
echo "  --callback-urls http://localhost:3000 https://dev.d6c38s8spsb1t.amplifyapp.com $MOBILE_REDIRECT \\"
echo "  --logout-urls http://localhost:3000 https://dev.d6c38s8spsb1t.amplifyapp.com $MOBILE_REDIRECT"
echo ""
echo "Or update via AWS Console:"
echo "1. Go to Cognito → User Pools → $USER_POOL_ID"
echo "2. App integration → App client → $CLIENT_ID"
echo "3. Edit Hosted UI settings"
echo "4. Add '$MOBILE_REDIRECT' to both Callback URLs and Sign-out URLs"
echo "5. Save changes"
echo ""


#!/bin/bash

# Script to configure Google OAuth in Cognito User Pool using AWS CLI
# This avoids the domain conflict issue with Amplify Gen 2

set -e

USER_POOL_ID="ca-central-1_aKCLbCdhj"
REGION="ca-central-1"
GOOGLE_CLIENT_ID="64933722244-t2lppekiik9oo1him4jd170tuhomletr.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="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"

# Cognito only accepts HTTP/HTTPS URLs for callback/logout URLs
# Mobile app URLs (com.mytrainingapp://) are configured separately in the app
CALLBACK_URLS=(
  "http://localhost:3000"
  "https://dev.d6c38s8spsb1t.amplifyapp.com"
)

LOGOUT_URLS=(
  "http://localhost:3000"
  "https://dev.d6c38s8spsb1t.amplifyapp.com"
)

echo "🔐 Configuring Google OAuth in Cognito User Pool..."
echo "   User Pool ID: $USER_POOL_ID"
echo "   Region: $REGION"
echo ""

# Get the app client ID
APP_CLIENT_ID=$(aws cognito-idp list-user-pool-clients \
  --user-pool-id "$USER_POOL_ID" \
  --region "$REGION" \
  --query "UserPoolClients[0].ClientId" \
  --output text)

if [ -z "$APP_CLIENT_ID" ] || [ "$APP_CLIENT_ID" == "None" ]; then
  echo "❌ Error: Could not find app client ID"
  exit 1
fi

echo "📱 App Client ID: $APP_CLIENT_ID"
echo ""

# Configure Google as identity provider
echo "1️⃣  Adding Google as identity provider..."
aws cognito-idp create-identity-provider \
  --user-pool-id "$USER_POOL_ID" \
  --provider-name Google \
  --provider-type Google \
  --provider-details \
    "client_id=$GOOGLE_CLIENT_ID,client_secret=$GOOGLE_CLIENT_SECRET,authorize_scopes=openid profile email" \
  --region "$REGION" 2>/dev/null || \
aws cognito-idp update-identity-provider \
  --user-pool-id "$USER_POOL_ID" \
  --provider-name Google \
  --provider-details \
    "client_id=$GOOGLE_CLIENT_ID,client_secret=$GOOGLE_CLIENT_SECRET,authorize_scopes=openid profile email" \
  --region "$REGION"

echo "   ✅ Google identity provider configured"
echo ""

# Configure app client settings
echo "2️⃣  Configuring app client OAuth settings..."

# Convert arrays to space-separated strings for AWS CLI
CALLBACK_URLS_STR=$(printf '%s ' "${CALLBACK_URLS[@]}" | sed 's/[[:space:]]*$//')
LOGOUT_URLS_STR=$(printf '%s ' "${LOGOUT_URLS[@]}" | sed 's/[[:space:]]*$//')

aws cognito-idp update-user-pool-client \
  --user-pool-id "$USER_POOL_ID" \
  --client-id "$APP_CLIENT_ID" \
  --supported-identity-providers Google \
  --callback-urls "${CALLBACK_URLS[@]}" \
  --logout-urls "${LOGOUT_URLS[@]}" \
  --allowed-o-auth-flows code \
  --allowed-o-auth-scopes openid email profile aws.cognito.signin.user.admin \
  --allowed-o-auth-flows-user-pool-client \
  --region "$REGION"

echo "   ✅ App client OAuth settings configured"
echo ""

echo "✅ Google OAuth configuration complete!"
echo ""

# Add OAuth to amplify_outputs.json if it exists
echo "3️⃣  Adding OAuth configuration to amplify_outputs.json..."
if [ -f "../amplify_outputs.json" ]; then
  cd ..
  ./amplify/add-oauth-to-outputs.sh
  cd amplify
elif [ -f "amplify_outputs.json" ]; then
  ./add-oauth-to-outputs.sh
else
  echo "   ⚠️  amplify_outputs.json not found. Run this after deployment:"
  echo "      cd .. && ./amplify/add-oauth-to-outputs.sh"
fi

echo ""
echo "📝 Next steps:"
echo "   1. Configure Google Cloud Console:"
echo "      - Authorized JavaScript Origins: https://mytrainingapp.auth.ca-central-1.amazoncognito.com"
echo "      - Authorized Redirect URIs: https://mytrainingapp.auth.ca-central-1.amazoncognito.com/oauth2/idpresponse"
echo "   2. Test Google login in your application"


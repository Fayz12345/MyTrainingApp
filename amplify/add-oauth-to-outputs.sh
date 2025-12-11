#!/bin/bash

# Script to add OAuth configuration to amplify_outputs.json after deployment
# This is needed when externalProviders is not in the resource file

set -e

OUTPUTS_FILE="amplify_outputs.json"
REGION="ca-central-1"
DOMAIN="mytrainingapp"

if [ ! -f "$OUTPUTS_FILE" ]; then
  echo "❌ Error: $OUTPUTS_FILE not found"
  echo "   Run this script after deploying: npx ampx sandbox"
  exit 1
fi

echo "🔧 Adding OAuth configuration to $OUTPUTS_FILE..."

# Get OAuth domain
OAUTH_DOMAIN="${DOMAIN}.auth.${REGION}.amazoncognito.com"

# Use jq to add OAuth config if it doesn't exist
if command -v jq &> /dev/null; then
  # Check if oauth already exists
  if jq -e '.auth.oauth' "$OUTPUTS_FILE" > /dev/null 2>&1; then
    echo "   ℹ️  OAuth configuration already exists, updating..."
    jq '.auth.oauth = {
      "domain": "'"$OAUTH_DOMAIN"'",
      "scopes": ["email", "openid", "profile", "aws.cognito.signin.user.admin"],
      "redirectSignIn": [
        "http://localhost:3000",
        "https://dev.d6c38s8spsb1t.amplifyapp.com",
        "com.mytrainingapp://"
      ],
      "redirectSignOut": [
        "http://localhost:3000",
        "https://dev.d6c38s8spsb1t.amplifyapp.com",
        "com.mytrainingapp://"
      ],
      "responseType": "code",
      "providers": ["Google"]
    }' "$OUTPUTS_FILE" > "${OUTPUTS_FILE}.tmp" && mv "${OUTPUTS_FILE}.tmp" "$OUTPUTS_FILE"
  else
    echo "   ➕ Adding OAuth configuration..."
    jq '.auth.oauth = {
      "domain": "'"$OAUTH_DOMAIN"'",
      "scopes": ["email", "openid", "profile", "aws.cognito.signin.user.admin"],
      "redirectSignIn": [
        "http://localhost:3000",
        "https://dev.d6c38s8spsb1t.amplifyapp.com",
        "com.mytrainingapp://"
      ],
      "redirectSignOut": [
        "http://localhost:3000",
        "https://dev.d6c38s8spsb1t.amplifyapp.com",
        "com.mytrainingapp://"
      ],
      "responseType": "code",
      "providers": ["Google"]
    }' "$OUTPUTS_FILE" > "${OUTPUTS_FILE}.tmp" && mv "${OUTPUTS_FILE}.tmp" "$OUTPUTS_FILE"
  fi
  echo "   ✅ OAuth configuration added successfully"
else
  echo "   ⚠️  jq not found, using Python instead..."
  python3 << EOF
import json
import sys

try:
    with open('$OUTPUTS_FILE', 'r') as f:
        data = json.load(f)
    
    if 'auth' not in data:
        data['auth'] = {}
    
    data['auth']['oauth'] = {
        "domain": "$OAUTH_DOMAIN",
        "scopes": ["email", "openid", "profile", "aws.cognito.signin.user.admin"],
        "redirectSignIn": [
            "http://localhost:3000",
            "https://dev.d6c38s8spsb1t.amplifyapp.com",
            "com.mytrainingapp://"
        ],
        "redirectSignOut": [
            "http://localhost:3000",
            "https://dev.d6c38s8spsb1t.amplifyapp.com",
            "com.mytrainingapp://"
        ],
        "responseType": "code",
        "providers": ["Google"]
    }
    
    with open('$OUTPUTS_FILE', 'w') as f:
        json.dump(data, f, indent=2)
    
    print("   ✅ OAuth configuration added successfully")
except Exception as e:
    print(f"   ❌ Error: {e}")
    sys.exit(1)
EOF
fi

echo ""
echo "✅ Done! OAuth configuration is now in $OUTPUTS_FILE"


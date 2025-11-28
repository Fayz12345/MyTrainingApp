#!/bin/bash

# Script to create or promote a user to SuperAdmin
# Usage: ./create-superadmin.sh <email>

if [ -z "$1" ]; then
    echo "Usage: ./create-superadmin.sh <email>"
    echo ""
    echo "This script will:"
    echo "  1. Create a new user in Cognito (if doesn't exist)"
    echo "  2. Assign them to SuperAdmin group"
    echo ""
    echo "Example:"
    echo "  ./create-superadmin.sh admin@company.com"
    exit 1
fi

EMAIL="$1"

# Read User Pool ID from outputs
if [ ! -f "amplify_outputs.json" ]; then
    echo "❌ Error: amplify_outputs.json not found"
    echo "   Please generate outputs first:"
    echo "   npx ampx generate outputs --app-id d6c38s8spsb1t --branch dev --profile amplify"
    exit 1
fi

USER_POOL_ID=$(jq -r '.auth.user_pool_id' amplify_outputs.json)
AWS_REGION=$(jq -r '.auth.aws_region' amplify_outputs.json)

if [ -z "$USER_POOL_ID" ] || [ "$USER_POOL_ID" == "null" ]; then
    echo "❌ Error: Could not read user_pool_id from amplify_outputs.json"
    exit 1
fi

echo "=========================================="
echo "Create/Promote SuperAdmin"
echo "=========================================="
echo "📧 Email: $EMAIL"
echo "📋 User Pool ID: $USER_POOL_ID"
echo "🌍 Region: $AWS_REGION"
echo ""

# Check if user exists
USER_EXISTS=$(aws cognito-idp admin-get-user \
    --user-pool-id "$USER_POOL_ID" \
    --username "$EMAIL" \
    --region "$AWS_REGION" \
    --profile amplify \
    2>&1)

if echo "$USER_EXISTS" | grep -q "UserNotFoundException"; then
    echo "📝 User does not exist. Creating new user..."
    
    # Generate temporary password
    TEMP_PASSWORD=$(openssl rand -base64 12 | tr -d "=+/" | cut -c1-12)
    TEMP_PASSWORD="${TEMP_PASSWORD}A1!"  # Ensure it meets requirements
    
    # Create user
    CREATE_RESULT=$(aws cognito-idp admin-create-user \
        --user-pool-id "$USER_POOL_ID" \
        --username "$EMAIL" \
        --user-attributes Name=email,Value="$EMAIL" Name=email_verified,Value=true \
        --temporary-password "$TEMP_PASSWORD" \
        --message-action SUPPRESS \
        --region "$AWS_REGION" \
        --profile amplify \
        2>&1)
    
    if [ $? -eq 0 ]; then
        echo "✅ User created successfully"
        echo "🔑 Temporary Password: $TEMP_PASSWORD"
        echo ""
        echo "⚠️  IMPORTANT: User must change password on first login"
    else
        echo "❌ Failed to create user:"
        echo "$CREATE_RESULT"
        exit 1
    fi
else
    echo "✅ User already exists"
fi

# Add user to SuperAdmin group
echo ""
echo "Adding user to SuperAdmin group..."

ADD_GROUP_RESULT=$(aws cognito-idp admin-add-user-to-group \
    --user-pool-id "$USER_POOL_ID" \
    --username "$EMAIL" \
    --group-name "SuperAdmin" \
    --region "$AWS_REGION" \
    --profile amplify \
    2>&1)

if [ $? -eq 0 ]; then
    echo "✅ User added to SuperAdmin group successfully!"
    echo ""
    echo "🎉 SuperAdmin setup complete!"
    echo ""
    echo "User can now:"
    echo "  1. Log in at: http://localhost:3000 (or your app URL)"
    echo "  2. Use email: $EMAIL"
    if [ -n "$TEMP_PASSWORD" ]; then
        echo "  3. Use temporary password: $TEMP_PASSWORD"
        echo "  4. Change password on first login"
    fi
    echo ""
    echo "✅ User will have SuperAdmin access with full permissions"
else
    echo "❌ Failed to add user to SuperAdmin group:"
    echo "$ADD_GROUP_RESULT"
    exit 1
fi


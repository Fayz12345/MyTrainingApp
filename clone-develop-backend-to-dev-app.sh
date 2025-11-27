#!/bin/bash

# Script to clone backend from develop app (d6c38s8spsb1t) to dev app (d1pvmv1j5xi2c9)
# Usage: ./clone-develop-backend-to-dev-app.sh

SOURCE_APP_ID="d6c38s8spsb1t"  # Develop app
TARGET_APP_ID="d1pvmv1j5xi2c9"  # Dev app
SOURCE_BRANCH="develop"
TARGET_BRANCH="dev"
REGION="ca-central-1"

echo "=========================================="
echo "Clone Backend: Develop App → Dev App"
echo "=========================================="
echo "Source: App $SOURCE_APP_ID, Branch: $SOURCE_BRANCH"
echo "Target: App $TARGET_APP_ID, Branch: $TARGET_BRANCH"
echo ""

# Check AWS credentials
echo "1. Checking AWS credentials..."
if aws sts get-caller-identity --profile amplify &>/dev/null 2>&1; then
    echo "   ✅ AWS credentials configured (amplify profile)"
    aws sts get-caller-identity --profile amplify | jq -r '"   Account: \(.Account) | User: \(.Arn)"'
    AWS_PROFILE="amplify"
else
    echo "   ❌ AWS credentials not configured"
    echo "   Run: npx ampx configure profile"
    exit 1
fi

echo ""
echo "2. Checking source backend (develop app)..."
SOURCE_BACKEND=$(aws amplify get-branch --app-id "$SOURCE_APP_ID" --branch-name "$SOURCE_BRANCH" --region "$REGION" --profile "$AWS_PROFILE" 2>&1 | jq -r '.branch.backend.stackArn // empty')

if [ -n "$SOURCE_BACKEND" ] && [ "$SOURCE_BACKEND" != "null" ]; then
    echo "   ✅ Source backend exists"
    echo "   Stack ARN: $SOURCE_BACKEND"
else
    echo "   ❌ Source backend not found"
    echo "   The develop branch may not have a backend deployed"
    exit 1
fi

echo ""
echo "3. Checking target backend (dev app)..."
TARGET_BACKEND=$(aws amplify get-branch --app-id "$TARGET_APP_ID" --branch-name "$TARGET_BRANCH" --region "$REGION" --profile "$AWS_PROFILE" 2>&1 | jq -r '.branch.backend.stackArn // empty')

if [ -n "$TARGET_BACKEND" ] && [ "$TARGET_BACKEND" != "null" ]; then
    echo "   ⚠️  Target backend already exists"
    echo "   Stack ARN: $TARGET_BACKEND"
    read -p "   Continue anyway? This will update the existing backend. (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "   ℹ️  Target backend does not exist (will be created)"
fi

echo ""
echo "=========================================="
echo "Backend Cloning Strategy"
echo "=========================================="
echo ""
echo "Since both apps are connected to the same git repository,"
echo "the backend code in your amplify/ directory will be deployed"
echo "to both apps when you push or trigger a deployment."
echo ""
echo "To clone the backend:"
echo ""
echo "OPTION 1: Deploy via Git (Recommended)"
echo "----------------------------------------"
echo "1. Ensure you're on the dev branch:"
echo "   git checkout dev"
echo ""
echo "2. Push your code (this will trigger deployment):"
echo "   git push origin dev"
echo ""
echo "3. Wait for deployment to complete in Amplify Console"
echo ""
echo "OPTION 2: Trigger Deployment in Console"
echo "----------------------------------------"
echo "1. Go to: https://${REGION}.console.aws.amazon.com/amplify/home?region=${REGION}#/${TARGET_APP_ID}"
echo "2. Click 'Branches' tab"
echo "3. Click on 'dev' branch"
echo "4. Click 'Redeploy this version' or 'Start new deployment'"
echo "5. Wait for deployment to complete"
echo ""
read -p "Have you triggered a deployment? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Please trigger a deployment first, then run this script again."
    echo ""
    echo "Quick command to push and trigger:"
    echo "  git checkout dev"
    echo "  git push origin dev"
    exit 0
fi

echo ""
echo "4. Waiting for backend deployment to complete..."
echo "   This may take 5-10 minutes..."
echo ""

MAX_RETRIES=60
RETRY_COUNT=0
SUCCESS=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    TARGET_BACKEND=$(aws amplify get-branch --app-id "$TARGET_APP_ID" --branch-name "$TARGET_BRANCH" --region "$REGION" --profile "$AWS_PROFILE" 2>&1 | jq -r '.branch.backend.stackArn // empty')
    
    if [ -n "$TARGET_BACKEND" ] && [ "$TARGET_BACKEND" != "null" ]; then
        echo "   ✅ Backend deployed successfully!"
        echo "   Stack ARN: $TARGET_BACKEND"
        SUCCESS=true
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $((RETRY_COUNT % 6)) -eq 0 ]; then
        echo "   Still waiting... ($RETRY_COUNT/$MAX_RETRIES) - Check status in console"
    fi
    sleep 10
done

if [ "$SUCCESS" = false ]; then
    echo "   ⚠️  Backend may still be deploying"
    echo "   Check deployment status in:"
    echo "   https://${REGION}.console.aws.amazon.com/amplify/home?region=${REGION}#/${TARGET_APP_ID}"
    echo ""
    echo "   Once deployment completes, run:"
    echo "   npx ampx generate outputs --app-id $TARGET_APP_ID --branch $TARGET_BRANCH --profile amplify"
    exit 1
fi

echo ""
echo "5. Generating outputs for dev app..."
if npx ampx generate outputs --app-id "$TARGET_APP_ID" --branch "$TARGET_BRANCH" --profile "$AWS_PROFILE"; then
    echo "   ✅ Outputs generated successfully!"
    echo ""
    echo "6. Copying outputs to admin app..."
    if cp amplify_outputs.json my-training-admin/src/amplify_outputs.json; then
        echo "   ✅ Copied to my-training-admin/src/amplify_outputs.json"
    else
        echo "   ⚠️  Could not copy to admin app (file may not exist)"
    fi
    echo ""
    echo "=========================================="
    echo "✅ SUCCESS: Backend cloned to dev app!"
    echo "=========================================="
    echo ""
    echo "Next steps:"
    echo "1. Verify amplify_outputs.json was generated"
    echo "2. Update your Flutter app if needed"
    echo "3. Test the dev app to ensure backend is working"
else
    echo "   ❌ Failed to generate outputs"
    echo "   Try manually:"
    echo "   npx ampx generate outputs --app-id $TARGET_APP_ID --branch $TARGET_BRANCH --profile amplify"
fi


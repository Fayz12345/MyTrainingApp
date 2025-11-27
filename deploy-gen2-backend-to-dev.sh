#!/bin/bash

# Script to deploy Gen 2 backend from develop app to dev app
# Usage: ./deploy-gen2-backend-to-dev.sh

SOURCE_APP_ID="d6c38s8spsb1t"  # Develop app
TARGET_APP_ID="d1pvmv1j5xi2c9"  # Dev app
SOURCE_BRANCH="develop"
TARGET_BRANCH="dev"
REGION="ca-central-1"

echo "=========================================="
echo "Deploy Gen 2 Backend to Dev App"
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
    exit 1
fi

echo ""
echo "2. Verifying Gen 1 backend is deleted..."
GEN1_BACKENDS=$(aws amplify list-backend-environments --app-id "$TARGET_APP_ID" --region "$REGION" --profile "$AWS_PROFILE" 2>&1 | jq -r '.backendEnvironments | length')

if [ "$GEN1_BACKENDS" -eq 0 ]; then
    echo "   ✅ No Gen 1 backend environments found (good!)"
else
    echo "   ⚠️  Gen 1 backend environments still exist: $GEN1_BACKENDS"
    echo "   Please delete them first"
    exit 1
fi

echo ""
echo "3. Checking source backend (develop app)..."
SOURCE_BACKEND=$(aws amplify get-branch --app-id "$SOURCE_APP_ID" --branch-name "$SOURCE_BRANCH" --region "$REGION" --profile "$AWS_PROFILE" 2>&1 | jq -r '.branch.backend.stackArn // empty')

if [ -n "$SOURCE_BACKEND" ] && [ "$SOURCE_BACKEND" != "null" ]; then
    echo "   ✅ Source Gen 2 backend exists"
    echo "   Stack ARN: $SOURCE_BACKEND"
else
    echo "   ❌ Source backend not found"
    exit 1
fi

echo ""
echo "4. Checking target backend (dev app)..."
TARGET_BACKEND=$(aws amplify get-branch --app-id "$TARGET_APP_ID" --branch-name "$TARGET_BRANCH" --region "$REGION" --profile "$AWS_PROFILE" 2>&1 | jq -r '.branch.backend.stackArn // empty')

if [ -n "$TARGET_BACKEND" ] && [ "$TARGET_BACKEND" != "null" ]; then
    echo "   ⚠️  Backend already exists (will be updated)"
    echo "   Stack ARN: $TARGET_BACKEND"
else
    echo "   ℹ️  No backend exists (will be created)"
fi

echo ""
echo "5. Triggering deployment to deploy Gen 2 backend..."
echo "   This will deploy the backend from your amplify/ directory"
echo ""

# Trigger a new deployment
JOB_RESULT=$(aws amplify start-job --app-id "$TARGET_APP_ID" --branch-name "$TARGET_BRANCH" --job-type RELEASE --region "$REGION" --profile "$AWS_PROFILE" 2>&1)

if echo "$JOB_RESULT" | grep -q "jobId"; then
    JOB_ID=$(echo "$JOB_RESULT" | jq -r '.jobSummary.jobId')
    echo "   ✅ Deployment triggered successfully!"
    echo "   Job ID: $JOB_ID"
    echo ""
    echo "6. Waiting for backend deployment to complete..."
    echo "   This may take 5-10 minutes..."
    echo ""
    
    MAX_RETRIES=60
    RETRY_COUNT=0
    SUCCESS=false
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        # Check job status
        JOB_STATUS=$(aws amplify get-job --app-id "$TARGET_APP_ID" --branch-name "$TARGET_BRANCH" --job-id "$JOB_ID" --region "$REGION" --profile "$AWS_PROFILE" 2>&1 | jq -r '.job.summary.status // "UNKNOWN"')
        
        # Check if backend exists
        TARGET_BACKEND=$(aws amplify get-branch --app-id "$TARGET_APP_ID" --branch-name "$TARGET_BRANCH" --region "$REGION" --profile "$AWS_PROFILE" 2>&1 | jq -r '.branch.backend.stackArn // empty')
        
        if [ -n "$TARGET_BACKEND" ] && [ "$TARGET_BACKEND" != "null" ]; then
            echo "   ✅ Backend deployed successfully!"
            echo "   Stack ARN: $TARGET_BACKEND"
            SUCCESS=true
            break
        fi
        
        if [ "$JOB_STATUS" = "SUCCEED" ] && [ -z "$TARGET_BACKEND" ]; then
            echo "   ⚠️  Deployment succeeded but backend not detected yet"
            echo "   Waiting a bit more..."
        elif [ "$JOB_STATUS" = "FAILED" ]; then
            echo "   ❌ Deployment failed!"
            echo "   Check the console for details"
            exit 1
        fi
        
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $((RETRY_COUNT % 6)) -eq 0 ]; then
            echo "   Still waiting... ($RETRY_COUNT/$MAX_RETRIES) - Job Status: $JOB_STATUS"
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
else
    echo "   ❌ Failed to trigger deployment"
    echo "$JOB_RESULT"
    exit 1
fi

echo ""
echo "7. Generating outputs for dev app..."
if npx ampx generate outputs --app-id "$TARGET_APP_ID" --branch "$TARGET_BRANCH" --profile "$AWS_PROFILE"; then
    echo "   ✅ Outputs generated successfully!"
    echo ""
    echo "8. Copying outputs to admin app..."
    if cp amplify_outputs.json my-training-admin/src/amplify_outputs.json; then
        echo "   ✅ Copied to my-training-admin/src/amplify_outputs.json"
    else
        echo "   ⚠️  Could not copy to admin app"
    fi
    echo ""
    echo "=========================================="
    echo "✅ SUCCESS: Gen 2 Backend Deployed!"
    echo "=========================================="
    echo ""
    echo "Next steps:"
    echo "1. Verify amplify_outputs.json was generated"
    echo "2. Test the dev app to ensure backend is working"
    echo "3. Both apps now use Gen 2 backend architecture"
else
    echo "   ❌ Failed to generate outputs"
    echo "   Try manually:"
    echo "   npx ampx generate outputs --app-id $TARGET_APP_ID --branch $TARGET_BRANCH --profile amplify"
fi


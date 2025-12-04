# 🚀 Deploy Lambda Using Command Line

## Deployment Methods

### Method 1: Amplify Gen 2 (Recommended)

Since you're using Amplify Gen 2 (`@aws-amplify/backend`), use:

```bash
cd /var/www/html/MyTrainingApp
npx ampx sandbox
```

**What this does**:
- Deploys all Lambda functions in `backend.ts`
- Includes `sendManagerNotification` Lambda
- Sets up environment variables
- Creates IAM roles and permissions

**Wait for**: Deployment to complete (usually 2-5 minutes)

### Method 2: Amplify Pipeline Deploy

For production or specific branch:

```bash
# For dev branch
npx ampx pipeline-deploy --branch dev

# For main branch
npx ampx pipeline-deploy --branch main
```

### Method 3: Manual Lambda Deployment (Alternative)

If you prefer to deploy Lambda manually without Amplify:

```bash
cd /var/www/html/MyTrainingApp/amplify/functions/sendManagerNotification

# Install dependencies
npm install

# Create deployment package
zip -r function.zip . -x "*.git*" "*.md" "node_modules/.bin/*"

# Deploy using AWS CLI (requires Lambda function to exist first)
aws lambda update-function-code \
  --function-name sendManagerNotification \
  --zip-file fileb://function.zip \
  --region ca-central-1
```

**Note**: Manual deployment requires Lambda function to already exist. Amplify creates it automatically.

## Complete Deployment Steps

### Step 1: Deploy All Functions

```bash
cd /var/www/html/MyTrainingApp
npx ampx sandbox
```

**Output**: You'll see deployment progress:
```
✓ Deploying backend...
✓ Creating resources...
✓ Deploying functions...
  ✓ quizCompletion
  ✓ sendManagerNotification  ← This is what we need
  ✓ subscribeManagerToSNS
...
✓ Deployment complete!
```

### Step 2: Verify Lambda Deployment

```bash
aws lambda list-functions \
  --region ca-central-1 \
  --query "Functions[?contains(FunctionName, 'sendManagerNotification')].{Name:FunctionName,LastModified:LastModified}" \
  --output table
```

**Expected**: Should show the Lambda function with recent LastModified timestamp.

### Step 3: Setup SNS Subscription

After deployment, subscribe Lambda to SNS:

```bash
cd amplify/functions
./setup-html-email.sh
```

This script will:
- Find the deployed Lambda
- Subscribe it to SNS topic
- Add SES permissions
- Verify setup

## Quick Deploy Command

One-liner to deploy and setup:

```bash
cd /var/www/html/MyTrainingApp && \
npx ampx sandbox && \
cd amplify/functions && \
./setup-html-email.sh
```

## Deployment Verification

### Check Lambda Exists

```bash
aws lambda get-function \
  --function-name $(aws lambda list-functions --region ca-central-1 --query "Functions[?contains(FunctionName, 'sendManagerNotification')].FunctionName" --output text) \
  --region ca-central-1 \
  --query 'Configuration.{Name:FunctionName,Status:State,LastModified:LastModified}' \
  --output table
```

### Check Environment Variables

```bash
aws lambda get-function-configuration \
  --function-name $(aws lambda list-functions --region ca-central-1 --query "Functions[?contains(FunctionName, 'sendManagerNotification')].FunctionName" --output text) \
  --region ca-central-1 \
  --query 'Environment.Variables' \
  --output json
```

**Expected**: Should show `FROM_EMAIL: circular360dev@gmail.com`

### Check SNS Subscription

```bash
aws sns list-subscriptions-by-topic \
  --topic-arn arn:aws:sns:ca-central-1:216348571084:training-completion-notifications \
  --region ca-central-1 \
  --query 'Subscriptions[?Protocol==`lambda`]' \
  --output table
```

**Expected**: Should show Lambda subscription to `sendManagerNotification`

## Troubleshooting

### Issue: "Command not found: npx"

**Solution**:
```bash
# Install Node.js and npm first
# Or use npm directly
npm install -g @aws-amplify/cli
amplify sandbox
```

### Issue: Deployment fails

**Check**:
1. AWS credentials configured: `aws sts get-caller-identity`
2. Node.js version: `node --version` (should be 18+)
3. Amplify CLI: `npx ampx --version`

### Issue: Lambda not found after deployment

**Wait**: Deployment can take 2-5 minutes
**Check**: CloudWatch logs or AWS Console
**Retry**: Run `npx ampx sandbox` again

## Deployment Status Check

Quick status check script:

```bash
#!/bin/bash
echo "🔍 Checking Deployment Status..."
echo ""

# Check Lambda
LAMBDA=$(aws lambda list-functions --region ca-central-1 \
  --query "Functions[?contains(FunctionName, 'sendManagerNotification')].FunctionName" \
  --output text)

if [ -n "$LAMBDA" ]; then
  echo "✅ Lambda deployed: $LAMBDA"
  
  # Check subscription
  SUB=$(aws sns list-subscriptions-by-topic \
    --topic-arn arn:aws:sns:ca-central-1:216348571084:training-completion-notifications \
    --region ca-central-1 \
    --query "Subscriptions[?contains(Endpoint, 'sendManagerNotification')].SubscriptionArn" \
    --output text)
  
  if [ -n "$SUB" ]; then
    echo "✅ SNS subscription: Active"
  else
    echo "⚠️  SNS subscription: Not found (run ./setup-html-email.sh)"
  fi
else
  echo "❌ Lambda not deployed (run: npx ampx sandbox)"
fi
```

## Summary

**Recommended Method**: `npx ampx sandbox`

**Complete Flow**:
1. `npx ampx sandbox` → Deploys Lambda
2. `./setup-html-email.sh` → Subscribes to SNS
3. Test → Employee passes quiz → HTML email sent ✅

---

**Ready to deploy? Run `npx ampx sandbox` now!** 🚀


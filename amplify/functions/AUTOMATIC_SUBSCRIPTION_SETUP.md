# Automatic Manager SNS Subscription Setup

## Overview

This setup automatically subscribes managers to the SNS topic when they are created, so they receive email notifications when employees complete training.

## Components

### 1. Lambda Function: `subscribeManagerToSNS`

**Location**: `amplify/functions/subscribeManagerToSNS/`

**Purpose**: Subscribes a manager's email to the SNS topic for training completion notifications.

**Features**:
- Checks if manager is already subscribed
- Creates new subscription if needed
- Returns confirmation URL if subscription is pending
- Handles errors gracefully (non-blocking)

### 2. Frontend Integration

**Location**: `my-training-admin/src/components/store/ManagerForm.tsx`

**Integration**: Automatically calls the Lambda function after manager is created in the database.

**Flow**:
1. Manager created in Cognito
2. Manager record created in database
3. **Automatic SNS subscription** (new step)
4. Manager can now receive notifications

## Setup Steps

### Step 1: Deploy the Lambda Function

The Lambda function needs to be deployed:

```bash
# If using Amplify sandbox
npx ampx sandbox

# Or if using pipeline
npx ampx pipeline-deploy --branch dev
```

### Step 2: Create Function URL

After deployment, create a Function URL for the Lambda:

```bash
# Get the function name (will be something like: amplify-xxx-dev-subscribeManagerToSNS-xxx)
aws lambda list-functions --region ca-central-1 --query "Functions[?contains(FunctionName, 'subscribeManagerToSNS')].FunctionName" --output text

# Create Function URL (replace FUNCTION_NAME with actual name)
aws lambda create-function-url-config \
  --function-name <FUNCTION_NAME> \
  --auth-type NONE \
  --cors '{"AllowOrigins":["*"],"AllowMethods":["POST"],"AllowHeaders":["content-type"]}' \
  --region ca-central-1

# Get the Function URL
aws lambda get-function-url-config \
  --function-name <FUNCTION_NAME> \
  --region ca-central-1 \
  --query FunctionUrl \
  --output text
```

### Step 3: Add Public Access Permission

```bash
aws lambda add-permission \
  --function-name <FUNCTION_NAME> \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE \
  --region ca-central-1
```

### Step 4: Add SNS Permissions to Lambda

The Lambda execution role needs SNS permissions:

```bash
# Get the Lambda execution role name
aws lambda get-function-configuration \
  --function-name <FUNCTION_NAME> \
  --region ca-central-1 \
  --query Role \
  --output text | awk -F'/' '{print $NF}'

# Add inline policy (replace ROLE_NAME)
aws iam put-role-policy \
  --role-name <ROLE_NAME> \
  --policy-name SNSSubscribePermission \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "sns:Subscribe",
          "sns:ListSubscriptionsByTopic"
        ],
        "Resource": "arn:aws:sns:ca-central-1:216348571084:training-completion-notifications"
      }
    ]
  }'
```

### Step 5: Set Frontend Environment Variable

Add to `my-training-admin/.env`:

```
REACT_APP_SUBSCRIBE_MANAGER_SNS_LAMBDA_URL=https://xxx.lambda-url.ca-central-1.on.aws/
```

### Step 6: Restart Frontend

```bash
cd my-training-admin
npm start
```

## How It Works

### Automatic Subscription Flow

```
1. Admin creates Manager
   ↓
2. Manager created in Cognito
   ↓
3. Manager record created in database
   ↓
4. Frontend calls subscribeManagerToSNS Lambda
   ↓
5. Lambda subscribes manager email to SNS topic
   ↓
6. Manager receives confirmation email
   ↓
7. Manager clicks confirmation link
   ↓
8. Manager is subscribed ✅
   ↓
9. Manager receives notifications automatically
```

### Subscription Status

The Lambda function handles three scenarios:

1. **Not Subscribed**: Creates new subscription, returns confirmation URL
2. **Pending Confirmation**: Returns existing confirmation URL
3. **Already Confirmed**: Returns success (no action needed)

### Error Handling

- If subscription fails, manager creation still succeeds
- Errors are logged but don't block the manager creation process
- Admin can manually subscribe managers later if needed

## Testing

### Test Automatic Subscription

1. Create a new manager via the admin panel
2. Check browser console for subscription logs
3. Check CloudWatch logs for Lambda execution
4. Check manager's email inbox for SNS confirmation email
5. Click confirmation link
6. Verify subscription in AWS Console:
   ```bash
   aws sns list-subscriptions-by-topic \
     --topic-arn arn:aws:sns:ca-central-1:216348571084:training-completion-notifications \
     --region ca-central-1 \
     --query 'Subscriptions[?Protocol==`email`]'
   ```

### Test Notification Flow

1. Manager creates employee
2. Manager assigns course to employee
3. Employee completes quiz (passes)
4. Manager should receive email notification

## Benefits

✅ **Automatic**: No manual subscription needed  
✅ **Non-blocking**: Manager creation succeeds even if subscription fails  
✅ **Idempotent**: Safe to call multiple times (checks existing subscriptions)  
✅ **User-friendly**: Returns confirmation URL for easy access  

## Troubleshooting

### Lambda Function Not Found
- Ensure function is deployed: `npx ampx sandbox`
- Check function name matches in AWS Console

### Permission Denied
- Verify Function URL has public access permission
- Check Lambda execution role has SNS permissions

### Subscription Not Created
- Check CloudWatch logs for Lambda errors
- Verify SNS topic ARN is correct
- Check Lambda has `sns:Subscribe` permission

### Confirmation Email Not Received
- Check spam folder
- Verify email address is correct
- Check SNS topic has email subscription enabled

## Manual Subscription (Fallback)

If automatic subscription fails, managers can be subscribed manually:

```bash
# Subscribe single manager
aws sns subscribe \
  --topic-arn arn:aws:sns:ca-central-1:216348571084:training-completion-notifications \
  --protocol email \
  --notification-endpoint manager@example.com \
  --region ca-central-1

# Or use the subscription script
cd amplify/functions
npx tsx subscribe-all-managers.ts
```


# Request: Add SNS Publish Permission to Lambda Function

## Summary

The `quizCompletion` Lambda function needs IAM permission to publish messages to SNS so managers can receive notifications when employees complete quizzes.

## Required Action

**Who**: AWS Administrator with IAM permissions  
**What**: Add inline policy to Lambda execution role  
**Priority**: High (blocks manager notifications)

## Lambda Function Details

- **Function Name**: `amplify-d6c38s8spsb1t-dev-quizCompletionlambdaBBA5-WWbEkGNeew8c`
- **Region**: `ca-central-1`
- **Execution Role**: (Check in Lambda Console → Configuration → Permissions)

## Required IAM Policy

Add this inline policy to the Lambda execution role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sns:Publish"
      ],
      "Resource": "arn:aws:sns:ca-central-1:216348571084:training-completion-notifications"
    }
  ]
}
```

## Step-by-Step Instructions for Admin

### Option 1: AWS Console (Easiest)

1. **Navigate to Lambda Console**
   - Go to: https://console.aws.amazon.com/lambda/
   - Region: `ca-central-1`
   - Search for: `quizCompletionlambdaBBA5-WWbEkGNeew8c`

2. **Open Function**
   - Click on the function name

3. **Go to Permissions**
   - Click **Configuration** tab
   - Click **Permissions** in left sidebar
   - Note the **Execution role** name (e.g., `amplify-d6c38s8spsb1t-dev-...`)

4. **Open IAM Role**
   - Click on the **Execution role** name (opens IAM Console in new tab)

5. **Add Inline Policy**
   - In IAM Console, click **Add permissions** → **Create inline policy**
   - Click **JSON** tab
   - Delete existing content
   - Paste the policy JSON above
   - Click **Next**

6. **Name the Policy**
   - Policy name: `SNSPublishPermission` or `QuizCompletionSNSPublish`
   - Click **Create policy**

7. **Verify**
   - Policy should appear in the role's inline policies list
   - Test Lambda function to confirm it works

### Option 2: AWS CLI

If you have AWS CLI access with admin permissions:

```bash
# Get the execution role name
aws lambda get-function \
  --function-name amplify-d6c38s8spsb1t-dev-quizCompletionlambdaBBA5-WWbEkGNeew8c \
  --region ca-central-1 \
  --query 'Configuration.Role' \
  --output text

# This will output something like: arn:aws:iam::216348571084:role/amplify-...

# Extract role name from ARN (everything after the last /)
ROLE_NAME="amplify-d6c38s8spsb1t-dev-..."

# Create policy file
cat > sns-publish-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sns:Publish"
      ],
      "Resource": "arn:aws:sns:ca-central-1:216348571084:training-completion-notifications"
    }
  ]
}
EOF

# Attach inline policy
aws iam put-role-policy \
  --role-name $ROLE_NAME \
  --policy-name SNSPublishPermission \
  --policy-document file://sns-publish-policy.json \
  --region ca-central-1
```

### Option 3: CloudFormation/SAM Template

If managing via Infrastructure as Code, add to the Lambda function's Policies:

```yaml
Policies:
  - Statement:
      - Effect: Allow
        Action:
          - logs:CreateLogGroup
          - logs:CreateLogStream
          - logs:PutLogEvents
        Resource: '*'
      - Effect: Allow
        Action:
          - sns:Publish
        Resource: 'arn:aws:sns:ca-central-1:216348571084:training-completion-notifications'
```

## Verification Steps

After adding the policy, verify it works:

1. **Test Lambda Function**
   ```bash
   aws lambda invoke \
     --function-name amplify-d6c38s8spsb1t-dev-quizCompletionlambdaBBA5-WWbEkGNeew8c \
     --region ca-central-1 \
     --payload '{"assignmentId":"test-id","passed":true,"score":100}' \
     response.json
   ```

2. **Check Response**
   ```bash
   cat response.json
   ```
   Should show: `"status":"success"` and `"snsMessageId":"..."`

3. **Check CloudWatch Logs**
   - Go to CloudWatch → Log groups → `/aws/lambda/quizCompletionlambdaBBA5-WWbEkGNeew8c`
   - Look for: `[STEP 3.5] ✅ SNS notification sent successfully`
   - Should NOT see: `AuthorizationError` or `AccessDenied`

4. **Check SNS Metrics**
   - Go to SNS Console → Topics → `training-completion-notifications`
   - Check Metrics tab
   - `NumberOfMessagesPublished` should increase

## Additional Configuration

### Increase Timeout (If Needed)

The Lambda timeout should be at least 10-15 seconds:

1. Lambda Console → Configuration → General configuration
2. Click **Edit**
3. Set timeout to **15 seconds**
4. Click **Save**

## Impact if Not Fixed

- ❌ Managers will NOT receive email notifications
- ❌ Lambda will fail with `AuthorizationError` when trying to publish to SNS
- ❌ Quiz completion notifications will not work

## Current Status

- ✅ Lambda function exists and is deployed
- ✅ Environment variables are configured correctly
- ✅ SNS topic exists and has email subscriptions
- ❌ **Missing IAM permission for SNS publish** ← **BLOCKER**

## Contact Information

If you need help or have questions, please contact:
- Developer: [Your contact info]
- AWS Account: 216348571084
- Region: ca-central-1

## Alternative: Temporary Workaround

If permissions cannot be granted immediately, you could:

1. **Use a different notification method** (not recommended)
2. **Have an admin run a script** to add permissions
3. **Wait for permissions** before testing notifications

However, the proper solution is to add the IAM policy as described above.


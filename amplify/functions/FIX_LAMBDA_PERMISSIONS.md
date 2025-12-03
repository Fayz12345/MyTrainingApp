# Fix Lambda IAM Permissions for SNS

## Critical Issue

Your Lambda function is **missing IAM permission** to publish to SNS. This is why managers are not receiving notifications.

## Quick Fix Steps

### Step 1: Add SNS Publish Permission

1. **Go to AWS Lambda Console**
   - Navigate to: https://console.aws.amazon.com/lambda/
   - Region: `ca-central-1`
   - Find function: `amplify-d6c38s8spsb1t-dev-quizCompletionlambdaBBA5-WWbEkGNeew8c`

2. **Go to Permissions**
   - Click on **Configuration** tab
   - Click on **Permissions** in left sidebar
   - Click on the **Execution role** name (opens IAM)

3. **Add Inline Policy**
   - In IAM Console, click **Add permissions** → **Create inline policy**
   - Click **JSON** tab
   - Paste this policy:

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

4. **Name the Policy**
   - Policy name: `SNSPublishPermission`
   - Click **Create policy**

### Step 2: Verify Timeout

1. **Check Lambda Timeout**
   - Go back to Lambda Console
   - Configuration → General configuration
   - Timeout should be at least **10-15 seconds**
   - If it's 3 seconds, update it:
     - Click **Edit**
     - Set timeout to **15 seconds**
     - Click **Save**

### Step 3: Remove SNS Event Trigger (If Not Needed)

If your Lambda is invoked via HTTP/Function URL (not via SNS events):

1. **Go to Lambda Console**
2. **Configuration** → **Triggers**
3. **If you see an SNS trigger**, you can remove it:
   - Click on the SNS trigger
   - Click **Delete**
   - Confirm deletion

**Note**: Only remove if Lambda is invoked via Function URL from frontend, not via SNS events.

## Verification

After adding permissions, test:

1. **Invoke Lambda** with test event:
   ```json
   {
     "assignmentId": "test-assignment-id",
     "employeeId": "test-employee-id",
     "courseId": "test-course-id",
     "score": 100,
     "passed": true
   }
   ```

2. **Check CloudWatch Logs**:
   - Should see: `[STEP 3.5] ✅ SNS notification sent successfully`
   - Should NOT see: `AuthorizationError` or `AccessDenied`

3. **Check SNS Metrics**:
   - Go to SNS Console → Topics → `training-completion-notifications`
   - Check **Metrics** tab
   - `NumberOfMessagesPublished` should increase

## Current Configuration Summary

### ✅ Correct:
- Environment variables set correctly
- SNS Topic ARN matches
- Runtime and memory are appropriate

### ❌ Missing:
- **IAM permission for `sns:Publish`** ← **CRITICAL - ADD THIS**
- Timeout might be too short (3 seconds) ← **Increase to 15 seconds**

### ⚠️ Optional:
- SNS event trigger (remove if using Function URL)

## After Fixing

Once permissions are added:
1. Lambda can publish to SNS ✅
2. SNS sends emails to subscribed managers ✅
3. Managers receive notifications ✅

## Quick Test Command

```bash
# Test Lambda invocation
aws lambda invoke \
  --function-name amplify-d6c38s8spsb1t-dev-quizCompletionlambdaBBA5-WWbEkGNeew8c \
  --region ca-central-1 \
  --payload '{"assignmentId":"test-id","passed":true,"score":100}' \
  response.json

# Check response
cat response.json
```

If you see `"status":"success"` and `"snsMessageId"` in the response, it's working!


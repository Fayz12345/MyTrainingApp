# Next Steps: Complete Notification Setup

## ✅ What's Working

1. **Lambda Function**: Invoked successfully (Status 200)
2. **SNS Permission**: Added and verified ✅
3. **Lambda Execution**: No authorization errors
4. **Error Handling**: Working correctly

## ⚠️ Current Issue

**"Assignment not found"** - The AppSync query is not finding the assignment.

## Root Cause

The schema changes we made (adding `allow.publicApiKey().to(['read'])`) **have not been deployed yet**. 

The Lambda is using API key authentication, but AppSync still has the old authorization rules that only allow Cognito groups.

## Solution: Redeploy Backend

You need to **redeploy the backend** to apply the schema changes:

```bash
# If using sandbox
npx ampx sandbox

# Or if using pipeline
npx ampx pipeline-deploy --branch dev
```

This will:
- Update AppSync schema with API key permissions
- Allow Lambda to query Assignment, Employee, Manager, Course models
- Fix the "Assignment not found" error

## After Redeployment

### Step 1: Test Lambda Again

```bash
aws lambda invoke \
  --function-name amplify-d6c38s8spsb1t-dev-quizCompletionlambdaBBA5-WWbEkGNeew8c \
  --region ca-central-1 \
  --cli-binary-format raw-in-base64-out \
  --payload '{"assignmentId":"b977f015-c8a7-4d6f-b28e-c422e22a4fe2","employeeId":"emp_1764587275130_tzkx25fsp","courseId":"691c32f5-12b7-4e72-8639-2e01761ac12f","score":100,"passed":true}' \
  /tmp/lambda-response.json

cat /tmp/lambda-response.json
```

**Expected Result**: Should see `"status":"success"` and `"snsMessageId"`

### Step 2: Test Real Quiz Submission

1. Log in as employee in web app
2. Complete a quiz and pass it
3. Check CloudWatch logs for successful SNS publish
4. Check manager email inbox

## Verification Checklist

After redeployment, verify:

- [ ] Lambda can query AppSync (no "Assignment not found" error)
- [ ] Lambda can get employee and manager details
- [ ] Lambda can publish to SNS successfully
- [ ] CloudWatch logs show: `[STEP 3.5] ✅ SNS notification sent successfully`
- [ ] Manager receives email notification

## Current Status Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Lambda Function | ✅ Working | Invokes successfully |
| SNS Permission | ✅ Added | IAM policy created |
| Environment Variables | ✅ Set | All configured correctly |
| Schema Changes | ⚠️ Not Deployed | Need to redeploy |
| AppSync Query | ❌ Failing | Authorization issue |
| SNS Publish | ⏳ Pending | Will work after schema fix |

## Quick Action

**Redeploy the backend now** to apply schema changes:

```bash
cd /var/www/html/MyTrainingApp/amplify
npx ampx sandbox
```

Then test again!


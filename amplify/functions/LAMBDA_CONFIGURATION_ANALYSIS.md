# Lambda Function Configuration Analysis

## Current SAM Template Analysis

### ✅ What's Correct

1. **Environment Variables** - All correctly set:
   - `APPSYNC_API_URL` ✅
   - `APPSYNC_API_KEY` ✅
   - `SNS_TOPIC_ARN` ✅ (points to `training-completion-notifications`)

2. **Basic Configuration**:
   - Runtime: `nodejs20.x` ✅
   - Memory: `512 MB` ✅
   - Handler: `index.handler` ✅

3. **Security**:
   - KMS encryption for SNS topic ✅

### ⚠️ Issues Found

#### 1. **Missing IAM Permissions** ❌ CRITICAL

The Lambda only has CloudWatch Logs permissions. It needs:

```yaml
Policies:
  - Statement:
      - Effect: Allow
        Action:
          - logs:CreateLogGroup
          - logs:CreateLogStream
          - logs:PutLogEvents
        Resource: '*'
      # MISSING: SNS Publish permission
      - Effect: Allow
        Action:
          - sns:Publish
        Resource: 'arn:aws:sns:ca-central-1:216348571084:training-completion-notifications'
```

**Impact**: Lambda cannot publish to SNS → Managers won't receive notifications

#### 2. **SNS Event Trigger** ⚠️ CONFUSING

The template shows:
```yaml
Events:
  SNS1:
    Type: SNS
    Properties:
      Topic:
        Ref: SNSTopic1
```

**Problem**: 
- Lambda is configured to RECEIVE SNS events (as a subscriber)
- But Lambda should PUBLISH to SNS (as a publisher)
- The Lambda is invoked via HTTP/Function URL, not via SNS events

**Recommendation**: Remove this SNS event trigger if Lambda is invoked via Function URL

#### 3. **Timeout Too Short** ⚠️

```yaml
Timeout: 3
```

**Problem**: 3 seconds might be too short for:
- AppSync GraphQL query (can take 1-2 seconds)
- SNS publish (can take 0.5-1 second)
- Network latency

**Recommendation**: Increase to at least 10-15 seconds

#### 4. **SNS Topic Mismatch** ⚠️

- Template creates: `SNSTopic1` (new topic)
- Environment variable uses: `training-completion-notifications` (existing topic)

**Problem**: These are different topics. The Lambda will try to publish to `training-completion-notifications`, but the template creates `SNSTopic1`.

**Recommendation**: Either:
- Use the existing topic (`training-completion-notifications`) - Recommended
- Or update environment variable to use `SNSTopic1`

## Recommended Fixes

### Option 1: Update Lambda Resource (Recommended)

Update `amplify/functions/quizCompletion/resource.ts` to add IAM permissions:

```typescript
import { defineFunction } from '@aws-amplify/backend';

export const quizCompletion = defineFunction({
  name: 'quizCompletion',
  entry: './handler.ts',
  timeoutSeconds: 15, // Increase timeout
  environment: {
    APPSYNC_API_URL: 'https://mswo73fsfjh4thfaalt7d63i4a.appsync-api.ca-central-1.amazonaws.com/graphql',
    APPSYNC_API_KEY: 'da2-la7esrklanbehi5v7e574ao7fq',
    SNS_TOPIC_ARN: 'arn:aws:sns:ca-central-1:216348571084:training-completion-notifications'
  },
  // Add IAM permissions for SNS
  access: (allow) => [
    allow.resource('arn:aws:sns:ca-central-1:216348571084:training-completion-notifications').to(['publish'])
  ]
});
```

**Note**: Amplify Gen 2 might handle IAM permissions automatically. Check if this syntax is supported.

### Option 2: Manual IAM Policy Update

If Amplify doesn't support the above, manually add IAM policy:

1. Go to AWS Console → Lambda → Functions → `quizCompletionlambdaBBA5-WWbEkGNeew8c`
2. Go to Configuration → Permissions
3. Click on Execution role
4. Add inline policy:

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

### Option 3: Update SAM Template Directly

If you're managing via SAM/CloudFormation, update the template:

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

And increase timeout:
```yaml
Timeout: 15  # Changed from 3
```

## Verification Checklist

After applying fixes, verify:

- [ ] Lambda has `sns:Publish` permission
- [ ] Timeout is at least 10-15 seconds
- [ ] SNS_TOPIC_ARN matches actual topic ARN
- [ ] Function URL is configured (if using HTTP invocation)
- [ ] SNS event trigger removed (if using HTTP invocation)

## Testing

After fixes, test by:

1. **Invoke Lambda directly**:
   ```bash
   aws lambda invoke \
     --function-name amplify-d6c38s8spsb1t-dev-quizCompletionlambdaBBA5-WWbEkGNeew8c \
     --payload '{"assignmentId":"test-id","passed":true,"score":100}' \
     response.json
   ```

2. **Check CloudWatch Logs** for:
   - `[STEP 3.5] ✅ SNS notification sent successfully`
   - No authorization errors

3. **Check SNS Metrics**:
   - `NumberOfMessagesPublished` should increase
   - `NumberOfNotificationsDelivered` should match

## Summary

**Critical Issues**:
1. ❌ Missing `sns:Publish` IAM permission
2. ⚠️ Timeout too short (3 seconds)
3. ⚠️ SNS event trigger may be unnecessary

**Action Required**:
1. Add SNS publish permission to Lambda execution role
2. Increase timeout to 15 seconds
3. Remove SNS event trigger if using Function URL invocation
4. Verify topic ARN matches

Once these are fixed, the notification flow should work correctly!


# Automatic Lambda Trigger Setup for Quiz Completion

## Current Situation

**Problem**: Lambda function is manually invoked from frontend, which requires:
- Employee update permission (already added)
- Manual HTTP call from React app
- Lambda Function URL configuration

**Solution**: Set up automatic Lambda triggering when Assignment is updated to "completed"

---

## Option 1: Trigger on Result Creation (Recommended)

Trigger Lambda automatically when a `Result` is created with `passed: true`.

### Implementation

Since Amplify Gen 2 doesn't have built-in DynamoDB Streams support, we can:

1. **Keep manual invocation** (current approach) - Works but requires permission
2. **Use AppSync Pipeline Resolver** - More complex, requires custom resolver
3. **Use EventBridge Rule** - Requires custom resource setup

### Best Approach: Keep Manual + Add Fallback

The current approach is actually good because:
- ✅ Employees can update assignments (permission added)
- ✅ Lambda is invoked immediately after update
- ✅ Non-blocking (quiz completes even if Lambda fails)

**The key is**: Employees MUST have update permission for this to work.

---

## Option 2: Automatic Trigger via DynamoDB Streams (Advanced)

If you want fully automatic triggering without frontend involvement:

### Steps:

1. **Enable DynamoDB Streams on Assignment Table**
   - Requires custom CDK resource
   - Stream triggers Lambda automatically

2. **Lambda Event Handler Update**
   - Handle DynamoDB stream events
   - Filter for status='completed' and isTrainingComplete=true
   - Extract assignmentId, employeeId, courseId from stream record

3. **Update Lambda Handler**

```typescript
// amplify/functions/quizCompletion/handler.ts
export const handler = async (event: any) => {
  // Handle both HTTP events and DynamoDB stream events
  if (event.Records) {
    // DynamoDB Stream event
    for (const record of event.Records) {
      if (record.eventName === 'MODIFY') {
        const newImage = record.dynamodb.NewImage;
        if (newImage.status?.S === 'completed' && newImage.isTrainingComplete?.BOOL === true) {
          // Trigger notification
          await processQuizCompletion({
            assignmentId: newImage.id.S,
            employeeId: newImage.employeeId.S,
            courseId: newImage.courseId.S
          });
        }
      }
    }
  } else {
    // HTTP event (current implementation)
    // ... existing code
  }
};
```

---

## Recommended Solution: Keep Current + Ensure Permission

**The simplest and most reliable approach**:

1. ✅ **Keep employee update permission** (already in schema)
2. ✅ **Keep manual Lambda invocation** (already implemented)
3. ✅ **Deploy backend** to activate permission

This works because:
- Employees can update assignments (after deployment)
- Lambda is called immediately after update
- Non-blocking - quiz completes even if Lambda fails
- Simple and maintainable

---

## Why Permission is Required

**Without employee update permission**:
- ❌ Assignment update fails → "Unauthorized" error
- ❌ Lambda never gets called
- ❌ Status doesn't update
- ❌ Notification never sent

**With employee update permission**:
- ✅ Assignment updates successfully
- ✅ Lambda gets invoked
- ✅ Status updates to "completed"
- ✅ Notification sent to manager

---

## Action Required

1. **Deploy Backend** (to activate employee update permission):
   ```bash
   npx @aws-amplify/backend-cli pipeline-deploy \
     --branch dev \
     --app-id d6c38s8spsb1t \
     --outputs-out-dir . \
     --outputs-format json
   ```

2. **Verify Permission** (after deployment):
   - Check AppSync console
   - Verify Employees group can update Assignment model

3. **Test Flow**:
   - Employee takes quiz
   - Quiz passes
   - Assignment updates (no error)
   - Lambda invokes (check CloudWatch logs)
   - Notification sent

---

## Alternative: Fully Automatic (Future Enhancement)

If you want to remove the need for employee update permission entirely, you can:

1. Set up DynamoDB Streams on Assignment table
2. Configure Lambda to trigger on stream events
3. Remove manual Lambda invocation from frontend
4. Employees only create Results, Lambda handles Assignment update

This requires custom CDK resources and is more complex, but provides fully automatic triggering.

---

## Summary

**Current Status**:
- ✅ Schema has employee update permission
- ✅ Lambda invocation code in place
- ⚠️ Backend needs deployment to activate permission

**After Deployment**:
- ✅ Employees can update assignments
- ✅ Lambda triggers automatically after update
- ✅ Notifications sent to managers

**The permission IS required for automatic Lambda triggering** because the Lambda is invoked right after the assignment update. Without the permission, the update fails and Lambda never gets called.


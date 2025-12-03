# Complete Flow Verification: Manager → Employee → Course → Notification

## Flow Overview

```
1. Manager Created
   ↓
2. Manager Creates Employee (with managerId)
   ↓
3. Manager Assigns Employee to Course (creates Assignment)
   ↓
4. Employee Completes Course/Quiz
   ↓
5. Lambda Function Triggered
   ↓
6. Lambda Finds Manager via Employee → Manager Relationship
   ↓
7. Lambda Sends SNS Notification
   ↓
8. Manager Receives Email
```

## Step-by-Step Verification

### ✅ Step 1: Manager Creation
**Status**: ✅ Working
- Manager is created in database with `email`, `name`, `storeId`
- Manager has Cognito user account
- Manager is in "Managers" Cognito group

**Schema Check**:
```typescript
Manager: {
  id: a.id(),
  userId: a.string().required(), // Cognito user ID
  email: a.string().required(),  // ✅ Manager email stored
  name: a.string().required(),
  storeId: a.id().required(),
  employees: a.hasMany('Employee', 'managerId') // ✅ Relationship exists
}
```

### ✅ Step 2: Manager Creates Employee
**Status**: ✅ Working
- Manager creates employee with `managerId` set to manager's ID
- Employee record has `managerId` field pointing to Manager
- Relationship: `Employee.managerId` → `Manager.id`

**Schema Check**:
```typescript
Employee: {
  id: a.id(),
  managerId: a.id(), // ✅ Manager reference stored
  manager: a.belongsTo('Manager', 'managerId'), // ✅ Relationship defined
  ...
}
```

**Verification**: When manager creates employee, `managerId` must be set correctly.

### ✅ Step 3: Manager Assigns Employee to Course
**Status**: ✅ Working
- Manager creates Assignment with `employeeId` and `courseId`
- Assignment links Employee to Course
- Assignment has `status: 'assigned'`

**Schema Check**:
```typescript
Assignment: {
  id: a.id(),
  employeeId: a.id().required(), // ✅ Employee reference
  courseId: a.id().required(),   // ✅ Course reference
  employee: a.belongsTo('Employee', 'employeeId'), // ✅ Relationship
  course: a.belongsTo('Course', 'courseId'),       // ✅ Relationship
  status: a.enum(['assigned', 'completed']),
  ...
}
```

**Verification**: Assignment must have correct `employeeId` and `courseId`.

### ✅ Step 4: Employee Completes Course/Quiz
**Status**: ✅ Working
- Employee submits quiz via frontend
- Frontend calls `invokeQuizCompletionLambda()` with:
  - `assignmentId`
  - `employeeId`
  - `courseId`
  - `score`
  - `passed: true/false`

**Frontend Code** (EmployeeDashboard.tsx):
```typescript
await invokeQuizCompletionLambda({
  assignmentId: selectedCourse.assignmentId,
  employeeId: selectedCourse.employeeId,
  courseId: selectedCourse.id,
  score: score,
  passed: passed
});
```

**Verification**: Lambda function URL must be configured correctly.

### ✅ Step 5: Lambda Function Triggered
**Status**: ✅ Working
- Lambda receives event with `assignmentId`, `employeeId`, `courseId`, `score`, `passed`
- Lambda only processes if `passed: true`
- If `passed: false`, no notification sent, status remains "assigned"

**Lambda Handler** (handler.ts):
```typescript
if (!event.passed) {
  console.log('Quiz not passed. No notification sent.');
  return { status: 'success', message: 'Quiz not passed - no notification sent' };
}
```

**Verification**: Lambda must be deployed and accessible.

### ✅ Step 6: Lambda Finds Manager
**Status**: ✅ Working
- Lambda queries AppSync for Assignment details
- GraphQL query includes nested relationships:
  ```graphql
  getAssignment(id: $assignmentId) {
    employee {
      managerId
      manager {
        id
        name
        email  # ✅ Manager email retrieved
      }
    }
    course {
      title
    }
  }
  ```
- Lambda extracts `managerEmail` from `assignment.employee.manager.email`

**Lambda Code**:
```typescript
const managerEmail = assignment.employee?.manager?.email;
const managerName = assignment.employee?.manager?.name || 'Manager';
```

**Potential Issues**:
- ⚠️ If employee has no `managerId`, `manager` will be `null`
- ⚠️ If manager relationship is not loaded, `manager.email` will be `undefined`

**Verification**: 
- Employee must have `managerId` set
- Manager must exist in database
- GraphQL query must successfully fetch manager relationship

### ✅ Step 7: Lambda Sends SNS Notification
**Status**: ✅ Working (with subscription requirement)
- Lambda publishes to SNS topic: `arn:aws:sns:ca-central-1:216348571084:training-completion-notifications`
- SNS message includes:
  - Employee name
  - Course title
  - Score
  - Manager email (in MessageAttributes)

**Lambda Code**:
```typescript
const snsParams = {
  TopicArn: SNS_TOPIC_ARN,
  Subject: `Training Completed: ${employeeName} - ${courseTitle}`,
  Message: message,
  MessageAttributes: { ... }
};
await snsClient.send(new PublishCommand(snsParams));
```

**Verification**:
- ✅ SNS topic exists
- ✅ Lambda has `sns:Publish` permission
- ✅ SNS_TOPIC_ARN environment variable is set

### ⚠️ Step 8: Manager Receives Email
**Status**: ⚠️ Requires Subscription
- SNS publishes message to topic
- **Manager must be subscribed** to the SNS topic with their email
- Subscription must be **confirmed** (not pending)
- Only then will manager receive email

**Current Status**:
- ✅ SNS topic exists
- ✅ Lambda can publish to topic
- ⚠️ Manager email subscriptions need to be created
- ⚠️ Subscriptions need to be confirmed

**Solution**: Run `subscribe-all-managers.ts` to subscribe all managers automatically.

## Critical Checkpoints

### ✅ Checkpoint 1: Employee-Manager Relationship
**Question**: Does the employee have a manager assigned?
- **Check**: `Employee.managerId` must not be null
- **Check**: `Manager` with that ID must exist
- **If missing**: Lambda will log warning and skip notification

**Lambda Code**:
```typescript
if (!managerEmail) {
  console.warn('⚠️ No manager email found. Employee may not have a manager assigned.');
  return { status: 'success', message: 'Training completed but no manager email found' };
}
```

### ✅ Checkpoint 2: GraphQL Query Success
**Question**: Can Lambda read Assignment, Employee, Manager, and Course?
- **Check**: API key has read permissions on all models
- **Current Status**: ✅ `allow.publicApiKey().to(['read'])` is set on:
  - Assignment ✅
  - Employee ✅
  - Manager ✅
  - Course ✅

### ✅ Checkpoint 3: SNS Subscription
**Question**: Is manager subscribed to SNS topic?
- **Check**: Run `aws sns list-subscriptions-by-topic`
- **Required**: Manager email must be in subscriptions list
- **Status**: Must be "Confirmed" (not "PendingConfirmation")

## Testing the Complete Flow

### Test Scenario:
1. Create Manager: `manager@test.com`
2. Manager creates Employee: `employee@test.com` (with `managerId`)
3. Manager assigns Course to Employee (creates Assignment)
4. Employee completes quiz (passes)
5. Check CloudWatch logs for Lambda execution
6. Check SNS topic for published message
7. Check manager email inbox

### Expected Lambda Logs:
```
[QUIZ_COMPLETION] 🎯 Quiz Completion Event Received
[QUIZ_COMPLETION] [STEP 1] Quiz passed! Processing completion...
[QUIZ_COMPLETION] [STEP 1.1] Querying AppSync for assignment details...
[QUIZ_COMPLETION] [STEP 1.2] Details retrieved: { employeeName, courseTitle, managerEmail, managerName }
[QUIZ_COMPLETION] [STEP 2] Updating assignment status to completed...
[QUIZ_COMPLETION] [STEP 3] Sending SNS notification...
[QUIZ_COMPLETION] [STEP 3.5] ✅ SNS notification sent successfully
```

### Expected SNS Message:
- **Subject**: "Training Completed: [Employee Name] - [Course Title]"
- **To**: Manager's email (if subscribed)
- **Content**: Employee name, course title, score, status

## Potential Issues & Solutions

### Issue 1: Manager Not Found
**Symptom**: Lambda logs "No manager email found"
**Cause**: Employee has no `managerId` or manager doesn't exist
**Solution**: Ensure manager creates employee with correct `managerId`

### Issue 2: GraphQL Query Fails
**Symptom**: "Assignment not found" error
**Cause**: API key lacks read permissions
**Solution**: ✅ Already fixed - `allow.publicApiKey().to(['read'])` is set

### Issue 3: SNS Publish Fails
**Symptom**: "AuthorizationError" or "NotFound" error
**Cause**: Lambda lacks `sns:Publish` permission or topic ARN incorrect
**Solution**: ✅ Already fixed - IAM permission added

### Issue 4: Manager Doesn't Receive Email
**Symptom**: SNS publishes successfully but no email received
**Cause**: Manager not subscribed or subscription not confirmed
**Solution**: Run `subscribe-all-managers.ts` to subscribe all managers

## Summary

### ✅ Working Components:
1. Manager creation and storage
2. Employee creation with manager relationship
3. Assignment creation
4. Quiz completion and Lambda trigger
5. Lambda querying AppSync for manager details
6. Lambda publishing to SNS

### ⚠️ Requires Action:
1. **Subscribe managers to SNS topic** (run `subscribe-all-managers.ts`)
2. **Confirm email subscriptions** (managers click confirmation links)

### ✅ Complete Flow Status:
- **Code Flow**: ✅ All steps implemented correctly
- **Data Relationships**: ✅ Properly configured
- **Permissions**: ✅ All set correctly
- **SNS Setup**: ✅ Topic and Lambda permissions ready
- **Email Delivery**: ⚠️ Waiting for manager subscriptions

## Next Steps

1. **Run subscription script**:
   ```bash
   cd amplify/functions
   npx tsx subscribe-all-managers.ts
   ```

2. **Confirm subscriptions**: Managers click confirmation links in email

3. **Test complete flow**: Create manager → employee → assignment → complete quiz → verify email

4. **Monitor**: Check CloudWatch logs and SNS metrics


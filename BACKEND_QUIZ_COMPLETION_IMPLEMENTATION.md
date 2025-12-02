# Backend Quiz Completion Implementation

## ✅ Backend Changes Implemented

### 1. Data Schema Update (`amplify/data/resource.ts`)

**Added `isTrainingComplete` field to Assignment model:**
```typescript
Assignment: a.model({
  // ... existing fields
  isTrainingComplete: a.boolean().default(false),
  // ...
})
```

**Purpose**: Tracks training completion for future scheduling API validation.

### 2. Lambda Function Enhancement (`amplify/functions/quizCompletion/handler.ts`)

**Enhanced functionality:**
- ✅ Queries AppSync GraphQL API to fetch:
  - Employee name and email
  - Course title
  - Manager email and name
- ✅ Sends SNS notification to manager with:
  - Employee name (not just ID)
  - Course title (not just ID)
  - Score percentage
  - Professional formatted message
- ✅ Uses correct region: `ca-central-1` (was `us-east-1`)
- ✅ Logs completion for future API validation (always logs, even on errors)
- ✅ Handles errors gracefully
- ✅ Only processes when `event.passed === true`
- ✅ Returns detailed response with employee/course info

**Event Interface:**
```typescript
interface QuizCompletionEvent {
  assignmentId: string;
  employeeId: string;
  courseId: string;
  score: number;
  passed: boolean;
}
```

### 3. Lambda Resource Configuration (`amplify/functions/quizCompletion/resource.ts`)

**Added environment variables:**
- `APPSYNC_API_URL`: GraphQL endpoint for querying database
- `APPSYNC_API_KEY`: API key for AppSync authentication
- `SNS_TOPIC_ARN`: (To be configured after SNS topic creation)

---

## Lambda Function Flow

```
Event Received (passed=true)
    ↓
Query AppSync:
  - Get Assignment with Employee & Course
  - Get Manager Email
    ↓
Extract:
  - Employee Name
  - Course Title
  - Manager Email
    ↓
Log Completion for Future API
    ↓
Send SNS Notification to Manager
    ↓
Return Success Response
```

---

## What the Lambda Does

### On Quiz Pass (`passed: true`):
1. ✅ Queries AppSync to get assignment details with employee and course info
2. ✅ Extracts employee name and course title
3. ✅ Gets manager email from employee's manager relationship
4. ✅ Logs completion for future scheduling API validation
5. ✅ Sends SNS notification to manager with:
   - Subject: "Training Completed: [Employee Name] - [Course Title]"
   - Message: Formatted notification with all details
   - Message attributes: employeeName, courseTitle, score, assignmentId

### On Quiz Fail (`passed: false`):
1. ✅ Logs completion attempt (for future API validation)
2. ✅ Returns success (no notification sent)
3. ✅ No SNS message sent

### Error Handling:
- ✅ If manager email not found: Logs completion, returns success (no notification)
- ✅ If SNS not configured: Logs completion, returns success (no notification)
- ✅ If AppSync query fails: Logs error, still logs completion for validation
- ✅ All errors are logged to CloudWatch for debugging

---

## Next Steps (After Backend Deployment)

### 1. Deploy Backend

```bash
cd /var/www/html/MyTrainingApp
npx @aws-amplify/backend-cli pipeline-deploy --branch dev --app-id d6c38s8spsb1t --outputs-out-dir . --outputs-format json
```

This will:
- Add `isTrainingComplete` field to Assignment table
- Deploy enhanced Lambda function
- Set environment variables (except SNS_TOPIC_ARN)

### 2. Create SNS Topic

1. AWS Console → SNS → Create topic
2. Name: `training-completion-notifications`
3. Region: `ca-central-1`
4. Copy Topic ARN

### 3. Configure Lambda Environment Variable

1. Lambda Console → Find `quizCompletion` function
2. Configuration → Environment variables
3. Add/Update: `SNS_TOPIC_ARN` = Your topic ARN

### 4. Grant Lambda Permissions

1. Lambda → Configuration → Permissions
2. Click execution role
3. Add policy: **AmazonSNSFullAccess** (or custom policy for your topic)

### 5. Update Flutter App (Separate Task)

The Flutter app needs to:
1. Set `isTrainingComplete = true` when updating assignment
2. Invoke Lambda function after quiz pass

See `lib/services/quiz_service.dart` - needs update to:
- Include `isTrainingComplete: true` in UpdateAssignment mutation
- Invoke Lambda function (via HTTP or AppSync resolver)

---

## Lambda Invocation Options

### Option 1: HTTP Invocation (Function URL)

1. Lambda → Configuration → Function URL
2. Create Function URL
3. Flutter app calls URL via HTTP POST

### Option 2: AppSync Resolver (Recommended)

Create an AppSync resolver that triggers Lambda when Result is created with `passed: true`.

### Option 3: Direct Invocation

Flutter app can invoke Lambda directly using AWS SDK (requires IAM permissions).

---

## Testing the Lambda

### Test Event Format:
```json
{
  "assignmentId": "assignment-id-here",
  "employeeId": "employee-id-here",
  "courseId": "course-id-here",
  "score": 85,
  "passed": true
}
```

### Expected Response (Success):
```json
{
  "status": "success",
  "message": "Notification sent and completion logged",
  "employeeName": "John Doe",
  "courseTitle": "Safety Training",
  "managerEmail": "manager@example.com",
  "score": 85,
  "logged": true
}
```

### Expected Response (No Manager):
```json
{
  "status": "success",
  "message": "Training completed but no manager email found",
  "logged": true,
  "employeeName": "John Doe",
  "courseTitle": "Safety Training",
  "score": 85
}
```

---

## Files Modified

1. ✅ `amplify/data/resource.ts` - Added `isTrainingComplete` field
2. ✅ `amplify/functions/quizCompletion/handler.ts` - Enhanced Lambda function
3. ✅ `amplify/functions/quizCompletion/resource.ts` - Added environment variables

---

## Verification Checklist

- [ ] Backend deployed successfully
- [ ] Assignment table has `isTrainingComplete` field
- [ ] Lambda function deployed with enhanced handler
- [ ] Lambda environment variables configured (APPSYNC_API_URL, APPSYNC_API_KEY)
- [ ] SNS topic created
- [ ] SNS_TOPIC_ARN added to Lambda environment variables
- [ ] Lambda has SNS publish permissions
- [ ] Test Lambda with sample event (via Lambda Console Test)
- [ ] Verify AppSync query works (gets employee/course/manager data)
- [ ] Verify SNS notification sent successfully

---

## Important Notes

1. **Region**: All resources use `ca-central-1` (Lambda, SNS, AppSync)
2. **Logging**: All completion events logged for future API validation
3. **Non-blocking**: Lambda errors don't prevent quiz completion (handled in Flutter)
4. **Manager Email**: If employee has no manager, notification is skipped but completion is logged
5. **SNS Configuration**: Must be done manually in AWS Console after deployment

---

## Next: Flutter App Updates

The Flutter app (`lib/services/quiz_service.dart`) needs to:
1. Update assignment with `isTrainingComplete: true` when quiz passes
2. Invoke Lambda function with assignment details

This is a separate frontend task.


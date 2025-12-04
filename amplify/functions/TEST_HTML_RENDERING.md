# 🧪 Test HTML Email Rendering

## HTML Template Validation

### ✅ Template Structure Check

The HTML template in `sendManagerNotification/handler.ts` includes:

**Required Elements**:
- ✅ `<!DOCTYPE html>` - HTML5 declaration
- ✅ `<html>`, `<head>`, `<body>` tags
- ✅ `<style>` section with CSS
- ✅ `<table>` with proper structure
- ✅ All data fields in table rows

**Data Fields in Table**:
- ✅ Employee Name
- ✅ Course Title  
- ✅ Score (with score-cell styling)
- ✅ Status (with status-cell styling)
- ✅ Assignment ID
- ✅ Completion Date (formatted)

**Styling**:
- ✅ Container with max-width 600px
- ✅ Green header (#4CAF50)
- ✅ Table with alternating row colors
- ✅ Score highlighted in green
- ✅ Professional footer

## Testing Steps

### Step 1: Deploy Lambda (If Not Deployed)

```bash
cd /var/www/html/MyTrainingApp
npx ampx sandbox
```

Wait for deployment to complete.

### Step 2: Setup Lambda Subscription

```bash
cd amplify/functions
./setup-html-email.sh
```

This will:
- Subscribe Lambda to SNS topic
- Add SES permissions
- Verify setup

### Step 3: Test HTML Rendering

**Option A: Test via Real Quiz Completion**

1. Have an employee complete and pass a quiz
2. Check manager email inbox
3. Verify HTML email is properly formatted

**Option B: Test via SNS Console**

1. Go to AWS SNS Console
2. Select your topic: `training-completion-notifications`
3. Click "Publish message"
4. Fill in:
   - **Subject**: `Test: Training Completed`
   - **Message body**: Any HTML (Lambda will use MessageAttributes)
   - **Message attributes**:
     - `employeeName`: String → `Test Employee`
     - `courseTitle`: String → `Test Course`
     - `score`: Number → `100`
     - `managerEmail`: String → `circular360dev@gmail.com`
     - `managerName`: String → `Test Manager`
     - `assignmentId`: String → `test-123`
     - `timestamp`: String → Current ISO timestamp
5. Click "Publish message"
6. Check email inbox

**Option C: Use Test Script**

```bash
cd amplify/functions
./test-html-email.sh
```

## Expected Result

### ✅ HTML Email Should Show:

1. **Green Header Banner**
   - Title: "🎉 Training Completion Notification"
   - White text on green background

2. **Formatted Table**
   - Green header row
   - Alternating row colors
   - All data in table cells:
     - Employee Name
     - Course Title
     - Score (highlighted in green, bold, larger font)
     - Status (✅ Passed, in green)
     - Assignment ID
     - Completion Date (formatted)

3. **Professional Layout**
   - Centered container
   - Proper spacing
   - Footer with system info

### ❌ Should NOT Show:

- Raw HTML code (like `<!DOCTYPE html>`)
- HTML tags visible (like `<table>`, `<tr>`, etc.)
- CSS code visible
- Unformatted text

## Verification Checklist

After receiving email, verify:

- [ ] Email subject: "Training Completed: {Employee} - {Course}"
- [ ] Green header banner visible
- [ ] Table displays correctly (not HTML code)
- [ ] Employee name shown in table
- [ ] Course title shown in table
- [ ] Score displayed (highlighted, bold)
- [ ] Status shows "✅ Passed" (green)
- [ ] Assignment ID shown
- [ ] Completion date formatted correctly
- [ ] Footer visible at bottom
- [ ] NO raw HTML code visible

## Troubleshooting

### Issue: Still seeing raw HTML code

**Possible Causes**:
1. Lambda not subscribed to SNS
2. Lambda not receiving events
3. SES not sending emails (using SNS email subscriptions instead)

**Solution**:
1. Check Lambda subscription: `./setup-html-email.sh`
2. Check CloudWatch logs for Lambda execution
3. Verify SES email is verified

### Issue: Email not received

**Check**:
1. SES email verification status
2. Lambda CloudWatch logs for errors
3. SNS subscription status
4. Spam/junk folder

### Issue: HTML renders but data missing

**Check**:
1. MessageAttributes in SNS message
2. Lambda extraction logic
3. CloudWatch logs for extraction

## Quick Test Command

```bash
# Publish test message to SNS
aws sns publish \
  --topic-arn arn:aws:sns:ca-central-1:216348571084:training-completion-notifications \
  --subject "Test: HTML Rendering" \
  --message "Test message" \
  --message-attributes '{
    "employeeName": {"DataType": "String", "StringValue": "Test Employee"},
    "courseTitle": {"DataType": "String", "StringValue": "Test Course"},
    "score": {"DataType": "Number", "StringValue": "100"},
    "managerEmail": {"DataType": "String", "StringValue": "circular360dev@gmail.com"},
    "managerName": {"DataType": "String", "StringValue": "Test Manager"},
    "assignmentId": {"DataType": "String", "StringValue": "test-123"},
    "timestamp": {"DataType": "String", "StringValue": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"}
  }' \
  --region ca-central-1
```

Then check email inbox for HTML email.

---

**The HTML template is ready. Deploy and test to verify rendering!** 🚀


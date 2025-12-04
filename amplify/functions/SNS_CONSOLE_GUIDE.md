# 📧 SNS Console Guide - How to Use & HTML Rendering

## Understanding the SNS Console Form

### 1. Message Details Section

- **Topic ARN**: Your topic (already set) ✅
- **Subject**: Email subject line (optional, max 100 chars)
  - Example: `Training Completed: John Doe - Introduction to Testing`
- **Message group ID**: For SQS queues (not needed for emails)
- **Time to Live (TTL)**: For mobile push (not needed for emails)

### 2. Message Body Section

**Current Setting**: "Identical payload for all delivery protocols"

This means:
- Same message sent to **all** subscribers (email, Lambda, etc.)
- **Problem**: Email subscribers see HTML as raw code (plain text)

**Alternative**: "Custom payload for each delivery protocol"
- Still won't help - email protocol still sends as plain text
- SNS email subscriptions **cannot render HTML** (AWS limitation)

### 3. Message Attributes Section

Add structured data here:
- **Type**: String, Number, or Binary
- **Name**: Attribute name (e.g., `employeeName`, `courseTitle`)
- **Value**: The actual value

**Example Attributes**:
```
Type: String, Name: employeeName, Value: "John Doe"
Type: String, Name: courseTitle, Value: "Introduction to Testing"
Type: Number, Name: score, Value: 100
Type: String, Name: managerEmail, Value: "manager@example.com"
```

## How Your Current Code Works

Your `quizCompletion` Lambda already publishes messages like this:

```typescript
{
  TopicArn: "arn:aws:sns:ca-central-1:216348571084:training-completion-notifications",
  Subject: "Training Completed: John Doe - Introduction to Testing",
  Message: "<html>...your HTML code...</html>",
  MessageAttributes: {
    employeeName: { DataType: 'String', StringValue: 'John Doe' },
    courseTitle: { DataType: 'String', StringValue: 'Introduction to Testing' },
    score: { DataType: 'Number', StringValue: '100' },
    managerEmail: { DataType: 'String', StringValue: 'manager@example.com' },
    managerName: { DataType: 'String', StringValue: 'Manager Name' }
  }
}
```

## The Problem: HTML Rendering

**SNS email subscriptions send plain text only**:
- HTML code appears as raw text
- Tables, styling, colors don't work
- This is an AWS SNS limitation

## The Solution: Lambda + SES

To render HTML properly, you need:

```
quizCompletion → SNS Topic → Lambda Function → SES → HTML Email ✅
```

### How It Works:

1. **quizCompletion Lambda** publishes to SNS:
   - HTML message (for Lambda subscribers)
   - MessageAttributes (all the data)

2. **SNS Topic** has two types of subscribers:
   - **Email subscriptions** → Get plain text (HTML visible as code) ❌
   - **Lambda subscription** → Gets HTML + MessageAttributes ✅

3. **Lambda Function** (sendManagerNotification):
   - Receives SNS event
   - Extracts data from MessageAttributes
   - Creates HTML email
   - Sends via SES (which renders HTML properly)
   - Manager receives formatted HTML email ✅

## Manual Testing via Console

You can test by manually publishing a message:

### For Plain Text (Current):
**Subject**: `Test: Training Completed`

**Message Body**:
```
🎉 TRAINING COMPLETION NOTIFICATION
====================================

Employee Name: Test Employee
Course Title: Test Course
Score: 100%
Status: ✅ Passed
```

**Message Attributes** (optional):
- `employeeName`: String → `Test Employee`
- `courseTitle`: String → `Test Course`
- `score`: Number → `100`

### For HTML (Requires Lambda):
The console can't send HTML emails directly. You need the Lambda function.

## Current Status

✅ **Your code is ready**:
- quizCompletion publishes HTML + MessageAttributes
- All data is in MessageAttributes
- Ready for Lambda subscriber

❌ **Missing**:
- sendManagerNotification Lambda not deployed
- Lambda not subscribed to SNS topic

## To Enable HTML Rendering

**Option 1: Deploy Lambda** (Recommended)
1. Add `sendManagerNotification` to `backend.ts`
2. Deploy: `npx ampx sandbox`
3. Run: `./setup-html-email.sh`

**Option 2: Keep Plain Text**
- Current setup works
- Emails show HTML as code
- Not ideal but functional

## Summary

- **SNS Console**: Can publish messages manually
- **Email Subscriptions**: Plain text only (HTML won't render)
- **Solution**: Lambda function receives SNS → sends HTML via SES
- **Your Code**: Already configured correctly, just needs Lambda deployment

---

**The SNS console is for testing. For HTML emails, you need the Lambda function!** 🚀


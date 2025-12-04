# 📧 How to Use SNS Console for HTML Email Rendering

## Understanding the SNS Console Form

The form you're seeing allows you to manually publish messages to your SNS topic. Here's how each section works:

### 1. Message Details

- **Topic ARN**: Already set to your topic
- **Subject**: The email subject line (max 100 characters)
- **Message group ID**: For SQS queues (not needed for emails)
- **Time to Live (TTL)**: For mobile push notifications (not needed for emails)

### 2. Message Body

**Important**: SNS email subscriptions **cannot render HTML** - they only send plain text.

**Option 1: Identical payload for all protocols** (Current)
- Same message sent to all subscribers (email, Lambda, etc.)
- **Problem**: Email subscribers see HTML as raw code

**Option 2: Custom payload for each protocol**
- Different messages for different protocols
- **Still won't work**: Email protocol still sends as plain text

### 3. Message Attributes

You can add structured data here:
- **Type**: String, Number, Binary
- **Name**: Attribute name (e.g., "employeeName")
- **Value**: The actual value

## The Problem

**SNS email subscriptions fundamentally cannot render HTML**, even with:
- Custom payloads
- Different message structures
- Message attributes

AWS SNS email subscriptions are **plain text only**.

## The Solution: Lambda + SES

To render HTML emails, you need:

```
SNS Topic → Lambda Function → SES → HTML Email ✅
```

### How It Works

1. **quizCompletion Lambda** publishes to SNS with:
   - HTML message (for Lambda subscribers)
   - MessageAttributes (employeeName, courseTitle, score, etc.)

2. **SNS Topic** triggers:
   - Email subscriptions → Get plain text (HTML code visible)
   - Lambda subscription → Gets HTML + MessageAttributes

3. **sendManagerNotification Lambda** (if subscribed):
   - Receives SNS event
   - Extracts data from MessageAttributes
   - Sends HTML email via SES
   - Manager receives properly formatted HTML ✅

## Current Setup

Your `quizCompletion` Lambda already:
- ✅ Publishes HTML message to SNS
- ✅ Includes MessageAttributes with all data
- ✅ Ready for Lambda subscriber

## Options

### Option 1: Use Lambda for HTML (Recommended)

**Setup**:
1. Deploy `sendManagerNotification` Lambda
2. Subscribe it to SNS topic
3. Lambda sends HTML emails via SES

**Result**: HTML emails render properly ✅

### Option 2: Use Plain Text (Current)

**Keep current setup**:
- SNS sends plain text to email subscriptions
- HTML code appears as text
- Not ideal, but works

### Option 3: Manual Testing via Console

You can test by publishing a message manually:

**Message Body** (for testing):
```
🎉 TRAINING COMPLETION NOTIFICATION
====================================

Employee Name: Test Employee
Course Title: Test Course
Score: 100%
Status: ✅ Passed
```

**Message Attributes**:
- Name: `employeeName`, Type: String, Value: `Test Employee`
- Name: `courseTitle`, Type: String, Value: `Test Course`
- Name: `score`, Type: Number, Value: `100`
- Name: `managerEmail`, Type: String, Value: `manager@example.com`

## Recommendation

**Use Option 1** (Lambda + SES) for proper HTML rendering. The Lambda is already coded and ready - you just need to deploy and subscribe it.

---

**Bottom line**: SNS console cannot make HTML render in emails. You need a Lambda function to send HTML via SES.


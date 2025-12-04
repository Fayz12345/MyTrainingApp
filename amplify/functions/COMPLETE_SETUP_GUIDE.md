# 🚀 Complete Setup Guide: HTML Email with Lambda + SNS + SES

## Overview

This setup enables **proper HTML email rendering** by using:
- **SNS**: For pub/sub messaging
- **Lambda**: To process SNS events
- **SES**: To send HTML emails (which render properly)

## Architecture

```
Employee Passes Quiz
    ↓
quizCompletion Lambda
    ↓
Publishes to SNS Topic:
  - HTML Message (for Lambda)
  - MessageAttributes (all data)
    ↓
SNS Topic → Triggers sendManagerNotification Lambda
    ↓
sendManagerNotification Lambda:
  - Receives SNS event
  - Extracts data from MessageAttributes
  - Creates HTML email with table
  - Sends via SES (Content-Type: text/html)
    ↓
Manager Receives HTML Email ✅ (Properly Formatted)
```

## Setup Steps

### Step 1: Deploy the Lambda Function

The `sendManagerNotification` Lambda is now in `backend.ts`. Deploy it:

```bash
cd /var/www/html/MyTrainingApp
npx ampx sandbox
```

**Wait for deployment to complete** - this may take a few minutes.

### Step 2: Subscribe Lambda to SNS Topic

After deployment, run the setup script:

```bash
cd amplify/functions
./setup-html-email.sh
```

This script will:
1. ✅ Find the deployed `sendManagerNotification` Lambda
2. ✅ Subscribe it to the SNS topic
3. ✅ Grant SNS permission to invoke the Lambda
4. ✅ Add SES permissions to Lambda execution role
5. ✅ Check SES email verification status

### Step 3: Verify SES Email

Make sure `circular360dev@gmail.com` is verified in SES:

```bash
aws ses get-identity-verification-attributes \
  --identities circular360dev@gmail.com \
  --region ca-central-1
```

**If not verified**:
1. Go to AWS SES Console
2. Verify the email address
3. Check email inbox and click verification link

## How It Works

### 1. quizCompletion Lambda

When employee passes quiz:
- Publishes HTML message to SNS
- Includes MessageAttributes:
  - `employeeName`
  - `courseTitle`
  - `score`
  - `managerEmail`
  - `managerName`
  - `assignmentId`
  - `timestamp`

### 2. SNS Topic

Receives message and triggers:
- **Email subscriptions** → Get plain text (HTML as code) ❌
- **Lambda subscription** → Gets HTML + MessageAttributes ✅

### 3. sendManagerNotification Lambda

Receives SNS event:
- Extracts data from MessageAttributes
- Creates HTML email with:
  - Professional styling
  - Formatted table
  - All training details
- Sends via SES with `Content-Type: text/html`

### 4. Manager Receives Email

- ✅ HTML renders properly
- ✅ Table displays correctly
- ✅ Colors and styling work
- ✅ Professional appearance

## Email Format

The email includes:
- **Header**: Green banner with title
- **Greeting**: Personalized to manager name
- **Table** with:
  - Employee Name
  - Course Title
  - Score (highlighted)
  - Status (Passed ✅)
  - Assignment ID
  - Completion Date (formatted)
- **Footer**: System information

## Testing

### Test the Complete Flow

1. **Deploy**: `npx ampx sandbox`
2. **Setup**: `./setup-html-email.sh`
3. **Test**: Have an employee complete and pass a quiz
4. **Verify**: Check manager's email inbox

### Expected Result

Manager receives:
- ✅ HTML email (not raw code)
- ✅ Formatted table
- ✅ Professional styling
- ✅ All data displayed correctly

### Troubleshooting

**If Lambda not found**:
- Wait for deployment to complete
- Check: `aws lambda list-functions --region ca-central-1`

**If emails not sending**:
- Check SES email verification
- Check CloudWatch logs for Lambda errors
- Verify Lambda has SES permissions

**If HTML still shows as code**:
- Make sure Lambda is subscribed to SNS
- Check Lambda is receiving SNS events (CloudWatch logs)
- Verify SES is sending emails (not SNS email subscriptions)

## Verification Commands

### Check Lambda Deployment

```bash
aws lambda list-functions \
  --region ca-central-1 \
  --query "Functions[?contains(FunctionName, 'sendManagerNotification')]"
```

### Check SNS Subscription

```bash
aws sns list-subscriptions-by-topic \
  --topic-arn arn:aws:sns:ca-central-1:216348571084:training-completion-notifications \
  --region ca-central-1 \
  --query 'Subscriptions[?Protocol==`lambda`]'
```

### Check Lambda Logs

```bash
aws logs tail /aws/lambda/amplify-*-sendManagerNotification-* \
  --region ca-central-1 \
  --follow
```

## Summary

✅ **Code Ready**: All Lambda functions configured  
✅ **HTML Template**: Professional formatting with table  
✅ **MessageAttributes**: All data included  
✅ **Setup Script**: Automated configuration  

**Next**: Deploy and run setup script to enable HTML email rendering! 🚀


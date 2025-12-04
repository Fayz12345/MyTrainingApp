# 🔧 HTML Email Rendering Solution

## Problem

SNS email subscriptions **cannot render HTML**. They only support plain text. Even if you set Content-Type to `text/html`, AWS SNS will reject it because:
- SNS DeliveryPolicy only allows: `application/json` or `text/plain`
- Email subscriptions are sent as plain text by default
- HTML code appears as raw text in emails

## Solution: Lambda + SES for HTML Emails

To send properly formatted HTML emails, you need:

1. **quizCompletion Lambda** → Publishes to SNS (with MessageAttributes)
2. **SNS Topic** → Triggers Lambda subscription
3. **sendManagerNotification Lambda** → Receives SNS event, sends HTML email via SES
4. **SES** → Delivers properly formatted HTML email ✅

## Setup Steps

### Option 1: Add to Amplify Backend (Recommended)

1. **Add sendManagerNotification to backend.ts**:
   ```typescript
   import { sendManagerNotification } from './functions/sendManagerNotification/resource';
   
   defineBackend({
     // ... other resources
     sendManagerNotification
   });
   ```

2. **Deploy**:
   ```bash
   npx ampx sandbox
   ```

3. **Run setup script**:
   ```bash
   cd amplify/functions
   ./setup-html-email.sh
   ```

### Option 2: Manual Lambda Setup

If you prefer not to add it to backend.ts, you can:

1. **Deploy the Lambda manually** (using AWS Console or CLI)
2. **Run the setup script** to subscribe it to SNS:
   ```bash
   ./setup-html-email.sh
   ```

## How It Works

```
Employee Passes Quiz
    ↓
quizCompletion Lambda
    ↓
Publishes HTML message + MessageAttributes to SNS
    ↓
SNS Topic → Triggers sendManagerNotification Lambda
    ↓
sendManagerNotification Lambda:
  - Extracts data from MessageAttributes
  - Creates HTML email (already has template)
  - Sends via SES
    ↓
Manager Receives HTML Email ✅ (Properly Formatted)
```

## Current Status

- ✅ **HTML code restored** in quizCompletion handler
- ✅ **sendManagerNotification Lambda exists** with HTML template
- ⚠️ **Lambda not deployed** (needs to be added to backend or deployed manually)
- ⚠️ **Lambda not subscribed** to SNS topic

## Next Steps

1. **Deploy sendManagerNotification Lambda** (Option 1 or 2 above)
2. **Run setup script**: `./setup-html-email.sh`
3. **Verify SES email** is verified (circular360dev@gmail.com)
4. **Test**: Have employee pass quiz → Manager receives HTML email

## Why This Is Necessary

**SNS Email Subscriptions Limitations**:
- ❌ Cannot render HTML
- ❌ Only support plain text
- ❌ Content-Type limited to text/plain or application/json

**Lambda + SES Solution**:
- ✅ Renders HTML properly
- ✅ Professional formatting
- ✅ Tables, colors, styling all work
- ✅ No raw HTML code in emails

---

**The HTML code is ready. You just need to deploy the Lambda and set it up!** 🚀


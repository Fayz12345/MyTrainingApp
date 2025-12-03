# Quick Fix: Add Email Subscription

## Problem Found

**No email subscriptions exist** on the SNS topic! That's why you're not receiving emails.

Current subscriptions:
- ✅ Lambda subscription (for Lambda to receive SNS events)
- ❌ **No email subscriptions** ← **THIS IS THE PROBLEM**

## Solution: Add Email Subscription

### Method 1: AWS Console (Easiest)

1. **Go to SNS Console**
   - https://console.aws.amazon.com/sns/
   - Region: `ca-central-1`

2. **Select Topic**
   - Click on: `training-completion-notifications`

3. **Create Subscription**
   - Click **"Create subscription"** button
   - **Protocol**: Select `Email`
   - **Endpoint**: Enter your email address (e.g., `your-email@example.com`)
   - Click **"Create subscription"**

4. **Confirm Subscription**
   - **Check your email inbox** for confirmation message from AWS SNS
   - **Click the confirmation link** in the email
   - Subscription status will change to "Confirmed"

5. **Repeat for Each Manager**
   - Create a subscription for each manager who should receive notifications

### Method 2: AWS CLI

```bash
# Subscribe your email
aws sns subscribe \
  --topic-arn arn:aws:sns:ca-central-1:216348571084:training-completion-notifications \
  --protocol email \
  --notification-endpoint your-email@example.com \
  --region ca-central-1
```

Then check your email and click the confirmation link.

### Method 3: Using the Script

```bash
cd amplify/functions
export MANAGER_EMAILS="your-email@example.com,manager1@example.com"
npx ts-node add-email-subscriptions.ts
```

## Verify Subscription

After creating subscription, verify it:

```bash
aws sns list-subscriptions-by-topic \
  --topic-arn arn:aws:sns:ca-central-1:216348571084:training-completion-notifications \
  --region ca-central-1 \
  --query 'Subscriptions[?Protocol==`email`]'
```

Should show your email subscription.

## Test After Adding Subscription

1. **Wait for confirmation** (if subscription was pending)
2. **Send test message**:
   ```bash
   aws sns publish \
     --topic-arn arn:aws:sns:ca-central-1:216348571084:training-completion-notifications \
     --subject "Test Notification" \
     --message "This is a test to verify email delivery" \
     --region ca-central-1
   ```
3. **Check email inbox** - should receive the test message

## Important Notes

- **Email subscriptions must be confirmed** before they receive messages
- **Check spam/junk folder** if email doesn't arrive
- **Confirmation link expires** - check email soon after creating subscription
- **Each manager needs their own subscription**

## Current Status

- ✅ Lambda publishing to SNS: Working
- ✅ SNS topic exists: Working
- ❌ **Email subscriptions: MISSING** ← **ADD THIS**
- ❌ Email delivery: Not working (no subscriptions)

## After Adding Email Subscription

Once you add and confirm email subscriptions:
1. Lambda publishes to SNS ✅
2. SNS sends to email subscriptions ✅
3. You receive email notifications ✅

**Add email subscriptions now to receive notifications!**


# Debugging Email Delivery Issues

## Problem
Lambda successfully publishes to SNS (MessageId received), but emails are not being delivered.

## Diagnostic Steps

### Step 1: Check Email Subscription Status

**Critical**: Email subscriptions must be **"Confirmed"** to receive emails.

```bash
aws sns list-subscriptions-by-topic \
  --topic-arn arn:aws:sns:ca-central-1:216348571084:training-completion-notifications \
  --region ca-central-1
```

**Look for**:
- `Protocol: email`
- `SubscriptionArn` - If it contains "PendingConfirmation", the subscription is NOT confirmed
- `Endpoint` - The email address

**If subscription is pending**:
1. Check the email inbox for confirmation message from AWS SNS
2. Click the confirmation link
3. Subscription status will change to "Confirmed"

### Step 2: Check SNS Delivery Metrics

```bash
# Check messages published
aws cloudwatch get-metric-statistics \
  --namespace AWS/SNS \
  --metric-name NumberOfMessagesPublished \
  --dimensions Name=TopicName,Value=training-completion-notifications \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum \
  --region ca-central-1

# Check emails delivered
aws cloudwatch get-metric-statistics \
  --namespace AWS/SNS \
  --metric-name NumberOfNotificationsDelivered \
  --dimensions Name=TopicName,Value=training-completion-notifications \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum \
  --region ca-central-1

# Check delivery failures
aws cloudwatch get-metric-statistics \
  --namespace AWS/SNS \
  --metric-name NumberOfNotificationsFailed \
  --dimensions Name=TopicName,Value=training-completion-notifications \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum \
  --region ca-central-1
```

### Step 3: Check SNS Delivery Logs

1. Go to CloudWatch Console
2. Log groups → Look for `/aws/sns/ca-central-1/216348571084/training-completion-notifications`
3. Check for delivery errors or bounces

### Step 4: Verify Email Address

**Common Issues**:
- Email address typo
- Email domain doesn't accept emails (some test domains block emails)
- Email provider blocking AWS SNS emails
- Email in spam/junk folder

### Step 5: Check Email Provider

**For mailinator.com**:
- Go to https://www.mailinator.com/
- Enter the email address (without @mailinator.com, just the part before @)
- Check all emails in the inbox
- Emails may take 1-2 minutes to appear

**For other email providers**:
- Check spam/junk folder
- Check if emails from AWS are being blocked
- Check email provider's security settings

## Common Issues and Solutions

### Issue 1: Subscription Not Confirmed

**Symptom**: Subscription ARN contains "PendingConfirmation"

**Solution**:
1. Check email inbox for AWS SNS confirmation message
2. Click confirmation link
3. Verify subscription status changes to "Confirmed"

**Resend confirmation**:
```bash
aws sns confirm-subscription \
  --topic-arn arn:aws:sns:ca-central-1:216348571084:training-completion-notifications \
  --token <confirmation-token-from-email> \
  --region ca-central-1
```

### Issue 2: Email Provider Blocking

**Symptom**: Messages published but not delivered, no failures in metrics

**Solution**:
- Try a different email provider (Gmail, Outlook, etc.)
- Check email provider's spam filters
- Whitelist AWS SNS emails

### Issue 3: Email in Spam Folder

**Symptom**: Email delivered but not in inbox

**Solution**:
- Check spam/junk folder
- Mark as "Not Spam" if found
- Add AWS SNS to contacts/whitelist

### Issue 4: Wrong Email Address

**Symptom**: Subscription confirmed but wrong email

**Solution**:
1. Delete incorrect subscription
2. Create new subscription with correct email
3. Confirm new subscription

## Quick Fix: Re-subscribe Email

If subscription is pending or not working:

```bash
# List current subscriptions
aws sns list-subscriptions-by-topic \
  --topic-arn arn:aws:sns:ca-central-1:216348571084:training-completion-notifications \
  --region ca-central-1

# Unsubscribe if needed
aws sns unsubscribe \
  --subscription-arn <subscription-arn> \
  --region ca-central-1

# Re-subscribe
aws sns subscribe \
  --topic-arn arn:aws:sns:ca-central-1:216348571084:training-completion-notifications \
  --protocol email \
  --notification-endpoint your-email@example.com \
  --region ca-central-1
```

## Test Email Delivery

Send a test message directly to SNS:

```bash
aws sns publish \
  --topic-arn arn:aws:sns:ca-central-1:216348571084:training-completion-notifications \
  --subject "Test Notification" \
  --message "This is a test message to verify email delivery" \
  --region ca-central-1
```

Then check your email inbox.

## Verification Checklist

- [ ] Email subscription exists
- [ ] Subscription status is "Confirmed" (not "PendingConfirmation")
- [ ] Email address is correct
- [ ] Checked spam/junk folder
- [ ] SNS metrics show messages published
- [ ] SNS metrics show notifications delivered (or failed)
- [ ] Test message sent directly to SNS
- [ ] Email provider not blocking AWS emails


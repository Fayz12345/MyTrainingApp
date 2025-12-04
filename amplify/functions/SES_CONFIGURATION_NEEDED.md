# 📧 SES Configuration - What's Needed

## Current Status

**SES Email Verification**: ⚠️ **Pending**
- Email: `circular360dev@gmail.com`
- Status: Pending (needs verification)

## What's Automatic vs Manual

### ✅ Automatic (Setup Script Handles)

The `setup-html-email.sh` script automatically:

1. ✅ **SES Permissions** - Adds `ses:SendEmail` and `ses:SendRawEmail` to Lambda execution role
2. ✅ **SNS Subscription** - Subscribes Lambda to SNS topic
3. ✅ **SNS Permissions** - Grants SNS permission to invoke Lambda
4. ✅ **Environment Variables** - FROM_EMAIL already set in resource.ts

**You don't need to configure these manually!**

### ⚠️ Manual (You Need to Do)

**SES Email Verification** - One-time setup required:

1. **Verify Sender Email** (`circular360dev@gmail.com`)
   - Check email inbox for verification email from AWS SES
   - Click the verification link
   - Status changes from "Pending" to "Success"

2. **SES Sandbox Mode** (if applicable)
   - In sandbox mode: Recipient emails must also be verified
   - For production: Request production access to send to any email

## What Happens If Not Verified

**If SES email is not verified**:
- ❌ Lambda will fail to send emails
- ❌ CloudWatch logs will show: "Email address is not verified"
- ❌ Managers won't receive emails

**If SES email IS verified**:
- ✅ Lambda can send emails
- ✅ HTML emails render properly
- ✅ Managers receive formatted emails

## Quick Setup Steps

### Step 1: Verify SES Email (Required)

**Option A: Via AWS Console**
1. Go to: https://console.aws.amazon.com/ses/home?region=ca-central-1#/verified-identities
2. Find `circular360dev@gmail.com`
3. Check email inbox for verification email
4. Click verification link
5. Status changes to "Success" ✅

**Option B: Via AWS CLI**
```bash
# Request verification email
aws ses verify-email-identity \
  --email-address circular360dev@gmail.com \
  --region ca-central-1

# Then check email inbox and click verification link
```

**Option C: Check if Already Verified**
```bash
aws ses get-identity-verification-attributes \
  --identities circular360dev@gmail.com \
  --region ca-central-1
```

### Step 2: Deploy Lambda

```bash
npx ampx sandbox
```

### Step 3: Run Setup Script

```bash
cd amplify/functions
./setup-html-email.sh
```

This automatically:
- ✅ Adds SES permissions
- ✅ Subscribes to SNS
- ✅ Grants all permissions

## SES Sandbox vs Production

### Sandbox Mode (Default)

**Limitations**:
- ✅ Can send FROM verified sender email
- ⚠️ Can only send TO verified recipient emails
- ⚠️ Each recipient must be verified

**Current Status**: Your account is likely in sandbox mode

### Production Mode (Recommended for Production)

**Benefits**:
- ✅ Can send to ANY email address
- ✅ No recipient verification needed
- ✅ Higher sending limits

**To Request**:
1. Go to: https://console.aws.amazon.com/ses/home?region=ca-central-1#/account
2. Click "Request production access"
3. Fill out form (use case: "Training completion notifications")
4. Wait for approval (usually 24-48 hours)

## Configuration Checklist

Before testing, verify:

- [ ] SES sender email verified (`circular360dev@gmail.com`)
- [ ] Lambda deployed (`npx ampx sandbox`)
- [ ] Lambda subscribed to SNS (`./setup-html-email.sh`)
- [ ] SES permissions added (automatic via setup script)
- [ ] SNS permissions granted (automatic via setup script)

## What Works Without Configuration

**Won't work**:
- ❌ Sending emails (requires SES email verification)

**Will work**:
- ✅ Lambda deployment
- ✅ SNS subscription
- ✅ Permission setup
- ✅ Code execution

## Summary

### ✅ Automatic (No Action Needed)
- SES permissions for Lambda
- SNS subscription setup
- IAM role configuration
- Environment variables

### ⚠️ Manual (Required)
- **SES email verification** (one-time)
  - Check `circular360dev@gmail.com` inbox
  - Click verification link
  - Status: Pending → Success

### 🚀 Optional (For Production)
- Request SES production access (to send to any email)

---

**Bottom Line**: You need to verify the SES email address. Everything else is automatic! 📧


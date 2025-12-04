# 🚀 Quick Deploy Guide - Command Line

## Fastest Way to Deploy

### Option 1: Automated Script (Recommended)

```bash
cd /var/www/html/MyTrainingApp
./deploy-lambda.sh
```

This script will:
1. Deploy all Lambda functions (including `sendManagerNotification`)
2. Wait for deployment to complete
3. Run setup script to subscribe Lambda to SNS
4. Verify everything is configured

### Option 2: Manual Commands

**Step 1: Deploy Lambda**
```bash
cd /var/www/html/MyTrainingApp
npx ampx sandbox
```

**Step 2: Setup SNS Subscription**
```bash
cd amplify/functions
./setup-html-email.sh
```

## What Gets Deployed

When you run `npx ampx sandbox`, it deploys:

- ✅ `quizCompletion` Lambda
- ✅ `sendManagerNotification` Lambda ← **This enables HTML emails**
- ✅ `subscribeManagerToSNS` Lambda
- ✅ All other functions in `backend.ts`

## Deployment Time

- **First deployment**: 3-5 minutes
- **Updates**: 1-3 minutes
- **Wait for**: "✅ Deployment complete" message

## After Deployment

The Lambda will be available at:
- **Function Name**: `amplify-{env}-sendManagerNotification-{id}`
- **Region**: `ca-central-1`
- **Runtime**: Node.js

## Verify Deployment

```bash
# Check if Lambda exists
aws lambda list-functions \
  --region ca-central-1 \
  --query "Functions[?contains(FunctionName, 'sendManagerNotification')]"
```

## ⚠️ Important: SES Email Verification (Required)

**Before emails will work**, you need to verify the SES sender email:

```bash
cd amplify/functions
./verify-ses-email.sh
```

**Or manually**:
1. Check inbox for `circular360dev@gmail.com`
2. Look for AWS SES verification email
3. Click verification link
4. Status changes: Pending → Success ✅

**Without verification**: Emails will fail to send!

## Next Steps After Deployment

1. ✅ **Verify SES email** (check inbox, click link)
2. ✅ Lambda deployed (`npx ampx sandbox`)
3. ✅ Run `./setup-html-email.sh` to subscribe to SNS
4. ✅ Test by having employee pass quiz
5. ✅ Manager receives HTML email ✅

## What's Automatic vs Manual

### ✅ Automatic (No Action Needed)
- SES permissions for Lambda (via setup script)
- SNS subscription setup
- IAM role configuration
- Environment variables

### ⚠️ Manual (Required)
- **SES email verification** (one-time)
  - Check `circular360dev@gmail.com` inbox
  - Click verification link

---

**Ready? Run `./deploy-lambda.sh` or `npx ampx sandbox`** 🚀


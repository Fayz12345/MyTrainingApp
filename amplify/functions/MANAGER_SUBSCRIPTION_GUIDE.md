# Manager Email Subscription Guide

## Question: Does Each Manager Need to Subscribe?

**Answer**: Yes, each manager email address needs its own subscription to the SNS topic. However, you can automate this process!

## Options for Subscribing Managers

### Option 1: Automatic Subscription (Recommended)

**Subscribe all managers at once** using the script:

```bash
cd amplify/functions
npx ts-node subscribe-all-managers.ts
```

This script will:
- ✅ Fetch all managers from your database
- ✅ Subscribe each manager's email automatically
- ✅ Show confirmation URLs for pending subscriptions
- ✅ Skip managers already subscribed

**Advantages**:
- One-time setup
- Automatic for all existing managers
- Easy to run again when new managers are added

### Option 2: Manual Subscription (Per Manager)

Each manager can subscribe themselves:

1. **Manager goes to**: AWS SNS Console (or you provide them a link)
2. **Manager subscribes**: Their email to the topic
3. **Manager confirms**: Clicks link in confirmation email

**Advantages**:
- Managers control their own subscription
- No admin intervention needed

**Disadvantages**:
- Requires each manager to do it manually
- More time-consuming

### Option 3: Admin Subscribes Each Manager

Admin subscribes managers one by one via AWS Console or CLI.

## Recommended Workflow

### Initial Setup (One Time)

1. **Run the automatic script**:
   ```bash
   npx ts-node subscribe-all-managers.ts
   ```

2. **Get confirmation URLs** from script output

3. **Send confirmation URLs to managers** OR click them yourself if you have access

4. **Managers confirm** their subscriptions

### When New Managers Are Added

**Option A**: Run the script again (it skips existing subscriptions)
```bash
npx ts-node subscribe-all-managers.ts
```

**Option B**: Subscribe manually via AWS Console

**Option C**: Add to subscription script and run it

## How It Works

### Current Flow

```
Manager Added to Database
    ↓
Admin Runs Subscription Script
    ↓
Script Subscribes Manager Email to SNS
    ↓
Manager Receives Confirmation Email
    ↓
Manager Clicks Confirmation Link
    ↓
Subscription Confirmed ✅
    ↓
Manager Receives Notifications Automatically
```

### After Setup

Once subscriptions are confirmed:
- ✅ Managers automatically receive notifications
- ✅ No action needed when employees complete quizzes
- ✅ New managers just need to be subscribed (one-time)

## Finding Confirmation URLs

### Method 1: From Script Output

The `subscribe-all-managers.ts` script shows confirmation URLs in the output.

### Method 2: From Email

Check manager's email inbox for AWS SNS confirmation message with link.

### Method 3: From AWS Console

1. Go to SNS Console → Topics → `training-completion-notifications`
2. Click **Subscriptions** tab
3. Find pending subscription
4. Click on it to see details

### Method 4: Generate Confirmation URL

If you have the subscription token, the URL format is:

```
https://sns.ca-central-1.amazonaws.com/?Action=ConfirmSubscription&TopicArn=arn:aws:sns:ca-central-1:216348571084:training-completion-notifications&Token=<TOKEN>
```

## Best Practice

**Recommended Approach**:

1. **Initial Setup**: Run `subscribe-all-managers.ts` to subscribe all existing managers
2. **New Managers**: 
   - Option A: Run script again (it handles new managers automatically)
   - Option B: Subscribe manually when creating new manager
3. **Confirmation**: Managers confirm via email or you provide confirmation URLs

## Automation Opportunity

You could also:
- **Add subscription step** when creating a new manager in the admin panel
- **Auto-subscribe** new managers via a Lambda function
- **Bulk subscribe** via a management script

## Summary

- ✅ **Yes**, each manager needs a subscription
- ✅ **But** you can automate it with the script
- ✅ **One-time** confirmation per manager
- ✅ **After confirmation**, notifications work automatically

**Run the script now to subscribe all managers at once!**


# Enable Gen 2 Backend Deployment for Dev App

## Current Situation

- ✅ Gen 1 backend deleted from dev app
- ✅ Backend code exists in `amplify/` directory
- ❌ Gen 2 backend not deploying automatically

## The Issue

In Amplify Gen 2, the backend should deploy automatically when:
1. App is connected to git repository ✅
2. `amplify/` directory exists in repository ✅
3. Code is pushed to branch ✅

But the backend isn't deploying. This might be because the app was originally Gen 1.

## Solutions

### Option 1: Check Branch Settings in Console

1. Go to: https://ca-central-1.console.aws.amazon.com/amplify/home?region=ca-central-1#/d1pvmv1j5xi2c9
2. Click **"Branches"** tab (not "Backend environments")
3. Click on the **"dev"** branch
4. Look for:
   - **"Backend"** section or settings
   - Options to enable backend deployment
   - Any settings related to Gen 2 backend

### Option 2: Push a New Commit

Sometimes a fresh push triggers backend detection:

```bash
# Make sure you're on dev branch
git checkout dev

# Make a small change to trigger deployment
echo "# Backend deployment" >> README.md
git add README.md
git commit -m "Trigger Gen 2 backend deployment"
git push origin dev
```

### Option 3: Use Develop App's Backend Directly

Since both apps use the same repository, you can use the develop app's backend:

```bash
# Generate outputs from develop app
npx ampx generate outputs --app-id d6c38s8spsb1t --branch develop --profile amplify

# Copy to your apps
cp amplify_outputs.json my-training-admin/src/amplify_outputs.json
```

This makes the dev app use the develop app's backend resources (they'll share the same backend).

### Option 4: Check if Backend Needs Manual Enable

In the Amplify Console:
1. Go to **"Branches"** → **"dev"** branch
2. Look for **"Backend"** or **"Backend deployment"** settings
3. There might be a toggle or button to enable backend deployment

## Recommended Next Steps

1. **First, check the Branches tab** in the console to see if there are backend settings
2. **If no backend settings found**, use Option 3 (share develop app's backend) - this is the quickest solution
3. **If you want separate backends**, try Option 2 (push a new commit) to trigger backend detection

## What to Look For in Console

When you go to **Branches → dev branch**, look for:
- A "Backend" section
- Backend deployment status
- Options to enable/configure backend
- Any Gen 2 backend indicators


# Google Sign-In Setup Guide

This guide will help you set up Google Sign-In for your Flutter training app.

## Prerequisites

1. ✅ Google Identity Provider is already configured in AWS Cognito (you can see `ca-central-1_aKCLbCdhj_Google` in User Management)
2. ✅ Backend auth resource has been updated to include Google OAuth

## Step 1: Configure Google OAuth in AWS Cognito Console

1. Go to AWS Cognito Console → User Pools → Your User Pool (`ca-central-1_aKCLbCdhj`)
2. Navigate to **Sign-in experience** → **Federated identity provider sign-in**
3. Click on **Google** provider
4. Ensure the following redirect URLs are configured:
   - `com.mytrainingapp://`
   - `com.myTrainingApp://`
   - `http://localhost:3000/` (for web/testing)
5. Save the configuration

## Step 2: Configure Google OAuth Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Find your OAuth 2.0 Client ID (the one used in Cognito)
4. Add the following **Authorized redirect URIs**:
   - `com.mytrainingapp://`
   - `com.myTrainingApp://`
   - `http://localhost:3000/`
5. Save the changes

## Step 3: Redeploy Backend

After updating the auth resource, you need to redeploy your Amplify backend:

```bash
# From the project root directory
cd amplify
npx ampx sandbox
# OR if using sandbox already running:
# The changes will be automatically detected and deployed
```

Wait for the deployment to complete. This will:
- Update the Cognito User Pool configuration
- Regenerate `amplify_outputs.json` with Google OAuth settings

## Step 4: Update amplify_outputs.json

After backend deployment:

1. Copy the new `amplify_outputs.json` from the `amplify/` directory to:
   - `lib/assets/amplify_outputs.json` (or root directory)
   - `my-training-admin/src/amplify_outputs.json` (for admin panel)

2. Or use the sync script:
   ```bash
   ./sync-amplify-outputs.sh
   ```

## Step 5: Test Google Sign-In

1. **Rebuild your Flutter app:**
   ```bash
   flutter clean
   flutter pub get
   flutter run
   ```

2. **In the app:**
   - The `amplify_authenticator` widget should now show a "Sign in with Google" button
   - Tap it to test the Google sign-in flow

## Troubleshooting

### Error: "No user pool registered for this account"

**Cause:** The `amplify_outputs.json` is outdated or doesn't include the OAuth configuration.

**Solution:**
1. Ensure backend is redeployed (Step 3)
2. Update `amplify_outputs.json` (Step 4)
3. Rebuild the app (Step 5)

### Error: "Invalid redirect URI"

**Cause:** The redirect URI in your app doesn't match what's configured in Cognito/Google.

**Solution:**
1. Verify redirect URLs in Cognito Console (Step 1)
2. Verify redirect URLs in Google Cloud Console (Step 2)
3. Ensure they match exactly: `com.mytrainingapp://` and `com.myTrainingApp://`

### Google Sign-In Button Not Showing

**Cause:** The `amplify_outputs.json` might not have the OAuth configuration.

**Solution:**
1. Check `amplify_outputs.json` for `oauth` section in `auth` object
2. It should include:
   ```json
   "auth": {
     "oauth": {
       "domain": "...",
       "scopes": ["email", "profile", "openid"],
       "redirectSignIn": ["com.mytrainingapp://", ...],
       "redirectSignOut": ["com.mytrainingapp://", ...],
       "responseType": "code"
     }
   }
   ```

### Post-Confirmation Trigger Not Working

**Note:** The `assignEmployeeGroup` post-confirmation trigger should work automatically with Google sign-in. It:
- Checks user attributes from the event
- Fetches user data from Cognito if needed
- Checks database for Manager/Employee records
- Assigns user to appropriate group (default: Employees)

If users aren't being assigned to groups:
1. Check CloudWatch logs for the `assignEmployeeGroup` function
2. Verify the trigger is enabled in Cognito Console
3. Check that the user has an email attribute (Google sign-in should provide this)

## Verification Checklist

- [ ] Google Identity Provider configured in Cognito
- [ ] Redirect URLs configured in Cognito
- [ ] Redirect URLs configured in Google Cloud Console
- [ ] Backend redeployed with updated auth resource
- [ ] `amplify_outputs.json` updated with OAuth config
- [ ] Flutter app rebuilt with new config
- [ ] Google sign-in button appears in app
- [ ] Google sign-in flow completes successfully
- [ ] User is assigned to Employees group after sign-in

## Additional Notes

- The app uses `amplify_authenticator` which automatically handles OAuth flows
- No additional Flutter code changes are needed - the authenticator widget will show Google sign-in option automatically
- Users signing in with Google will be automatically assigned to the "Employees" group via the post-confirmation trigger
- Managers can still be manually assigned to the "Managers" group after sign-in if needed


# Google OAuth Login Setup for Flutter App

## Issue

The Flutter app is trying to use Google login, but Google OAuth is not configured in the AWS Cognito User Pool.

## Solution

Google OAuth needs to be configured in the AWS Cognito User Pool console. This cannot be done through Amplify Gen 2 code configuration alone.

## Setup Steps

### Step 1: Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable Google+ API
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure OAuth consent screen if prompted
6. Create OAuth client:
   - **Application type**: Web application
   - **Name**: My Training App (or your app name)
   - **Authorized redirect URIs**: 
     - `https://<your-cognito-domain>/oauth2/idpresponse`
     - You'll get the Cognito domain in Step 2
7. Copy the **Client ID** and **Client Secret**

### Step 2: Configure Cognito User Pool

1. **Go to AWS Cognito Console**
   - Navigate to your Cognito User Pool
   - User Pool ID should be in `amplify_outputs.json` → `auth.user_pool_id`

2. **Configure Hosted UI Domain**
   - Go to **App integration** tab
   - Scroll to **Domain** section
   - If no domain exists, create one (e.g., `mytrainingapp-dev`)
   - Note the domain URL (e.g., `https://mytrainingapp-dev.auth.ca-central-1.amazoncognito.com`)

3. **Add Google as Identity Provider**
   - Go to **Sign-in experience** tab
   - Under **Federated identity provider sign-in**, click **Add identity provider**
   - Select **Google**
   - Enter:
     - **Client ID**: From Step 1
     - **Client Secret**: From Step 1
   - Click **Save**

4. **Configure OAuth 2.0 Settings**
   - Go to **App integration** tab
   - Scroll to **Hosted UI** section
   - Click **Edit**
   - Under **OAuth 2.0 grant types**, select:
     - ✅ **Authorization code grant**
     - ✅ **Implicit grant** (optional, for mobile apps)
   - Under **OpenID Connect scopes**, select:
     - ✅ **openid**
     - ✅ **email**
     - ✅ **profile**
   - Under **Callback URLs**, add:
     - `com.mytrainingapp://` (for Flutter mobile app)
     - `http://localhost:3000` (for web/React app)
     - `https://dev.d6c38s8spsb1t.amplifyapp.com` (your Amplify app URL)
   - Under **Sign-out URLs**, add the same URLs
   - Click **Save changes**

5. **Update Google OAuth Redirect URI**
   - Go back to Google Cloud Console
   - Edit your OAuth 2.0 Client ID
   - Add the Cognito callback URL:
     - `https://<your-cognito-domain>/oauth2/idpresponse`
   - Example: `https://mytrainingapp-dev.auth.ca-central-1.amazoncognito.com/oauth2/idpresponse`

### Step 3: Verify Configuration

1. **Check amplify_outputs.json**
   - After deploying, check that `auth.oauth` section exists
   - Should contain `domain`, `redirectSignIn`, `redirectSignOut`

2. **Test in Flutter App**
   - Run the Flutter app
   - Click "Sign in with Google"
   - Should open Google login page
   - After login, should redirect back to app

## Troubleshooting

### Error: "GOOGLE_LOGIN_NOT_AVAILABLE"

This means Google OAuth is not configured in Cognito. Follow Step 2 above.

### Error: "Invalid redirect URI"

- Check that `com.mytrainingapp://` is added to Cognito callback URLs
- Check that Cognito domain is added to Google OAuth authorized redirect URIs
- Make sure the redirect URI format matches exactly

### Error: "No user pool registered"

- Verify Amplify is properly configured
- Check that `amplify_outputs.json` has the correct `auth` configuration
- Make sure the Flutter app is reading from the correct config file

### Google Login Opens But Fails

- Check Google OAuth credentials are correct
- Verify the redirect URI in Google Console matches Cognito domain
- Check Cognito logs for detailed error messages

## Important Notes

- **Mobile App Redirect**: The Flutter app uses `com.mytrainingapp://` as the redirect scheme
- **Android Configuration**: Already configured in `AndroidManifest.xml`
- **iOS Configuration**: May need to add URL scheme in `Info.plist` if not already done
- **Branch-Specific**: Each branch (dev, qa, main) needs its own Cognito User Pool configuration

## After Setup

Once configured, the Flutter app's `signInWithGoogle()` function will work automatically. The app already has all the necessary code - it just needs the backend OAuth configuration.


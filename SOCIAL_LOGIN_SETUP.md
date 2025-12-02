# Social Login Setup Guide (Google & Apple)

Complete guide for implementing Google and Apple sign-in with AWS Cognito in your Flutter app.

## Table of Contents
1. [Backend Configuration](#backend-configuration)
2. [Google Setup](#google-setup)
3. [Apple Setup](#apple-setup)
4. [Flutter App Configuration](#flutter-app-configuration)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)

---

## Backend Configuration

### Step 1: Update Auth Resource

The backend auth resource has been updated to include both Google and Apple:

```typescript
// amplify/auth/resource.ts
export const auth = defineAuth({
  loginWith: {
    email: true,
    oauth: {
      providers: ['Google', 'Apple'],
      scopes: ['email', 'profile', 'openid'],
      redirectSignIn: [
        'com.mytrainingapp://',
        'com.myTrainingApp://',
        'http://localhost:3000/'
      ],
      redirectSignOut: [
        'com.mytrainingapp://',
        'com.myTrainingApp://',
        'http://localhost:3000/'
      ],
    },
  },
  // ... rest of config
});
```

### Step 2: Deploy Backend

Deploy the updated backend to apply OAuth configuration:

```bash
cd /var/www/html/MyTrainingApp
npx @aws-amplify/backend-cli pipeline-deploy --branch dev --app-id d6c38s8spsb1t --outputs-out-dir . --outputs-format json
```

Or if using sandbox:
```bash
npx ampx sandbox --once
```

### Step 3: Sync amplify_outputs.json

After deployment, sync the outputs:
```bash
./sync-amplify-outputs.sh
```

---

## Google Setup

### Step 1: Configure Google OAuth in AWS Cognito

1. Go to [AWS Cognito Console](https://console.aws.amazon.com/cognito/)
2. Select your User Pool: `ca-central-1_aKCLbCdhj`
3. Navigate to **Sign-in experience** → **Federated identity provider sign-in**
4. Click **Add identity provider** → **Google** (if not already added)
5. Configure:
   - **App client ID**: Your Google OAuth 2.0 Client ID
   - **App client secret**: Your Google OAuth 2.0 Client Secret
6. Under **Attribute mapping**:
   - Map `email` → `email`
   - Map `name` → `name`
   - Map `sub` → `username`
7. **Authorized scopes**: `email`, `profile`, `openid`
8. Save configuration

### Step 2: Configure Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Select your OAuth 2.0 Client ID (or create one)
4. Add **Authorized redirect URIs**:
   ```
   https://<your-cognito-domain>.auth.ca-central-1.amazoncognito.com/oauth2/idpresponse
   ```
   (Get the domain from Cognito → App integration → Domain)
5. For iOS, also add:
   ```
   com.myTrainingApp://
   ```
6. For Android, also add:
   ```
   com.mytrainingapp://
   ```
7. Save changes

### Step 3: Get Google OAuth Credentials

1. In Google Cloud Console → **Credentials**
2. Create OAuth 2.0 Client ID (if needed):
   - Application type: **Web application**
   - Name: Your app name
   - Authorized redirect URIs: (as above)
3. Copy **Client ID** and **Client Secret**
4. Add these to Cognito (Step 1)

---

## Apple Setup

### Step 1: Configure Apple in AWS Cognito

1. Go to [AWS Cognito Console](https://console.aws.amazon.com/cognito/)
2. Select your User Pool: `ca-central-1_aKCLbCdhj`
3. Navigate to **Sign-in experience** → **Federated identity provider sign-in**
4. Click **Add identity provider** → **Apple**
5. Configure:
   - **Services ID**: Your Apple Services ID (e.g., `com.myTrainingApp`)
   - **Team ID**: Your Apple Developer Team ID
   - **Key ID**: Your Apple Key ID
   - **Private Key**: Your Apple Private Key (download from Apple Developer)
6. Under **Attribute mapping**:
   - Map `email` → `email`
   - Map `name` → `name`
   - Map `sub` → `username`
7. **Authorized scopes**: `email`, `name`
8. Save configuration

### Step 2: Configure Apple Developer Console

#### 2.1 Create Services ID

1. Go to [Apple Developer Console](https://developer.apple.com/account/)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Click **Identifiers** → **+** (Add)
4. Select **Services IDs** → **Continue**
5. Fill in:
   - **Description**: My Training App
   - **Identifier**: `com.myTrainingApp` (must match your bundle ID)
6. Enable **Sign in with Apple**
7. Click **Configure**:
   - **Primary App ID**: Select your app
   - **Website URLs**:
     - **Domains**: `auth.ca-central-1.amazoncognito.com`
     - **Return URLs**: 
       ```
       https://<your-cognito-domain>.auth.ca-central-1.amazoncognito.com/oauth2/idpresponse
       ```
8. Save and Continue → Register

#### 2.2 Create Key for Sign in with Apple

1. In Apple Developer Console → **Keys**
2. Click **+** (Add)
3. Fill in:
   - **Key Name**: Sign in with Apple Key
   - Enable **Sign in with Apple**
4. Click **Configure**:
   - **Primary App ID**: Select your app
5. Click **Save** → **Continue** → **Register**
6. **Download the key** (`.p8` file) - **You can only download once!**
7. Note the **Key ID**

#### 2.3 Get Team ID

1. In Apple Developer Console → **Membership**
2. Copy your **Team ID** (10-character string)

### Step 3: Add Apple Key to Cognito

1. Open the downloaded `.p8` key file
2. Copy the entire contents (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`)
3. In Cognito → Apple provider configuration:
   - **Services ID**: `com.myTrainingApp`
   - **Team ID**: Your Team ID
   - **Key ID**: Your Key ID
   - **Private Key**: Paste the entire `.p8` file contents
4. Save configuration

---

## Flutter App Configuration

### Step 1: No Additional Dependencies Needed

The `amplify_authenticator` package automatically handles OAuth flows. No additional packages needed!

### Step 2: iOS Configuration

#### 2.1 Update Info.plist

Add URL scheme for OAuth redirects:

```xml
<!-- ios/Runner/Info.plist -->
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleTypeRole</key>
    <string>Editor</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.myTrainingApp</string>
    </array>
  </dict>
</array>
```

#### 2.2 Enable Sign in with Apple Capability

1. Open `ios/Runner.xcworkspace` in Xcode
2. Select **Runner** target
3. Go to **Signing & Capabilities**
4. Click **+ Capability**
5. Add **Sign in with Apple**
6. Ensure your **Bundle Identifier** matches: `com.myTrainingApp`

### Step 3: Android Configuration

#### 3.1 Update AndroidManifest.xml

Add intent filter for OAuth redirects:

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<activity
    android:name=".MainActivity"
    android:exported="true"
    ...>
    <!-- Existing intent filters -->
    
    <!-- OAuth redirect intent filter -->
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data
            android:scheme="com.mytrainingapp"
            android:host="oauth" />
    </intent-filter>
</activity>
```

#### 3.2 Configure OAuth Client (if needed)

For Google Sign-In on Android, you may need to add SHA-1 fingerprint:

1. Get your app's SHA-1:
   ```bash
   cd android
   ./gradlew signingReport
   ```
2. Copy the SHA-1 fingerprint
3. In Google Cloud Console → **Credentials** → Your OAuth Client
4. Add **SHA-1 certificate fingerprint**
5. Save

### Step 4: Verify amplify_outputs.json

After backend deployment, ensure `amplify_outputs.json` includes OAuth:

```json
{
  "auth": {
    "oauth": {
      "domain": "your-domain.auth.ca-central-1.amazoncognito.com",
      "scopes": ["email", "profile", "openid"],
      "redirectSignIn": ["com.mytrainingapp://", "com.myTrainingApp://"],
      "redirectSignOut": ["com.mytrainingapp://", "com.myTrainingApp://"],
      "responseType": "code"
    }
  }
}
```

---

## Testing

### Step 1: Rebuild Flutter App

```bash
flutter clean
flutter pub get
flutter run
```

### Step 2: Test Google Sign-In

1. Open the app
2. You should see **"Sign in with Google"** button in the authenticator
3. Tap it
4. Complete Google sign-in flow
5. User should be authenticated and assigned to "Employees" group

### Step 3: Test Apple Sign-In (iOS only)

1. On iOS device/simulator
2. Open the app
3. You should see **"Sign in with Apple"** button
4. Tap it
5. Complete Apple sign-in flow
6. User should be authenticated and assigned to "Employees" group

---

## Troubleshooting

### Google Sign-In Not Working

**Issue**: Button doesn't appear or sign-in fails

**Solutions**:
1. Verify `amplify_outputs.json` has OAuth configuration
2. Check redirect URLs match exactly in Cognito and Google Console
3. Ensure Google OAuth Client ID/Secret are correct in Cognito
4. Check browser console for errors
5. Verify SHA-1 fingerprint is added (Android)

### Apple Sign-In Not Working

**Issue**: Button doesn't appear or sign-in fails

**Solutions**:
1. Verify Apple provider is configured in Cognito
2. Check Services ID matches bundle identifier exactly
3. Ensure Private Key is correctly pasted (entire file including headers)
4. Verify Team ID and Key ID are correct
5. Check that Sign in with Apple capability is enabled in Xcode
6. Apple Sign-In only works on iOS devices (not Android)

### "No user pool registered" Error

**Solution**:
1. Regenerate `amplify_outputs.json`:
   ```bash
   npx ampx generate outputs --branch dev --app-id d6c38s8spsb1t --format json --out-dir .
   ```
2. Sync outputs: `./sync-amplify-outputs.sh`
3. Rebuild app: `flutter clean && flutter pub get && flutter run`

### Post-Confirmation Trigger Not Assigning Groups

**Solution**:
1. Check CloudWatch logs for `assignEmployeeGroup` function
2. Verify trigger is enabled in Cognito
3. Social sign-in users should automatically get email attribute
4. Users are assigned to "Employees" group by default

### Redirect URI Mismatch

**Error**: "redirect_uri_mismatch"

**Solution**:
1. Ensure redirect URLs in Cognito match exactly:
   - `com.mytrainingapp://` (Android)
   - `com.myTrainingApp://` (iOS)
2. Verify these are in Google/Apple console redirect URIs
3. Check for typos or extra spaces

---

## Verification Checklist

### Backend
- [ ] Auth resource includes `['Google', 'Apple']` providers
- [ ] Backend deployed successfully
- [ ] `amplify_outputs.json` includes OAuth configuration

### Google
- [ ] Google provider added in Cognito
- [ ] Google OAuth Client ID/Secret configured
- [ ] Redirect URIs added in Google Cloud Console
- [ ] SHA-1 fingerprint added (Android)

### Apple
- [ ] Apple provider added in Cognito
- [ ] Services ID created in Apple Developer
- [ ] Key created and downloaded
- [ ] Private Key added to Cognito
- [ ] Sign in with Apple capability enabled (iOS)

### Flutter
- [ ] Info.plist updated with URL scheme (iOS)
- [ ] AndroidManifest.xml updated with intent filter (Android)
- [ ] `amplify_outputs.json` synced to app
- [ ] App rebuilt and tested

---

## Additional Notes

1. **Automatic UI**: `amplify_authenticator` automatically shows social sign-in buttons when OAuth is configured
2. **Group Assignment**: Social sign-in users are automatically assigned to "Employees" group via post-confirmation trigger
3. **Email Required**: Both Google and Apple provide email, which is required for your app
4. **iOS Only**: Apple Sign-In only works on iOS devices, not Android
5. **Testing**: Use real devices for best results (especially for Apple Sign-In)

---

## Next Steps

After setup:
1. Test both sign-in methods
2. Verify users are assigned to correct groups
3. Check that course access works for social sign-in users
4. Monitor CloudWatch logs for any issues


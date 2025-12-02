# Backend OAuth Setup Status (Google & Apple)

## ✅ Backend Configuration Status

### 1. Auth Resource Configuration (`amplify/auth/resource.ts`)

**Status**: ✅ **CONFIGURED**

The backend auth resource is properly configured with both Google and Apple:

```typescript
export const auth = defineAuth({
  loginWith: {
    email: true,
    oauth: {
      providers: ['Google', 'Apple'],
      scopes: ['email', 'profile', 'openid'],
      redirectSignIn: [
        'com.mytrainingapp://',      // Android
        'com.myTrainingApp://',      // iOS
        'http://localhost:3000/'     // Local dev
      ],
      redirectSignOut: [
        'com.mytrainingapp://',      // Android
        'com.myTrainingApp://',      // iOS
        'http://localhost:3000/'      // Local dev
      ],
    },
  },
  groups: ['Employees', 'Managers', 'Store', 'BusinessUnit', 'SuperAdmin'],
  triggers: {
    postConfirmation: assignEmployeeGroup
  }
});
```

**✅ Configuration is correct for Flutter app**

---

### 2. amplify_outputs.json Status

**Status**: ⚠️ **NEEDS DEPLOYMENT**

Current `amplify_outputs.json` does **NOT** contain OAuth configuration:
```bash
$ jq '.auth.oauth' amplify_outputs.json
null
```

**This means**: Backend needs to be deployed to generate OAuth configuration in outputs.

---

### 3. iOS Configuration

**Status**: ✅ **CONFIGURED**

`ios/Runner/Info.plist` has URL scheme configured:
```xml
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

**✅ Ready for OAuth redirects**

---

### 4. Android Configuration

**Status**: ✅ **CONFIGURED**

`android/app/src/main/AndroidManifest.xml` has intent filter:
```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data
    android:scheme="com.mytrainingapp"
    android:host="oauth" />
</intent-filter>
```

**✅ Ready for OAuth redirects**

---

## 🔧 What Needs to Be Done

### Step 1: Deploy Backend (REQUIRED)

The backend code is configured, but it needs to be deployed to AWS:

```bash
cd /var/www/html/MyTrainingApp
npx @aws-amplify/backend-cli pipeline-deploy \
  --branch dev \
  --app-id d6c38s8spsb1t \
  --outputs-out-dir . \
  --outputs-format json
```

**After deployment**, `amplify_outputs.json` will include:
```json
{
  "auth": {
    "oauth": {
      "domain": "your-domain.auth.ca-central-1.amazoncognito.com",
      "scopes": ["email", "profile", "openid"],
      "redirectSignIn": [
        "com.mytrainingapp://",
        "com.myTrainingApp://",
        "http://localhost:3000/"
      ],
      "redirectSignOut": [
        "com.mytrainingapp://",
        "com.myTrainingApp://",
        "http://localhost:3000/"
      ],
      "responseType": "code"
    }
  }
}
```

### Step 2: Configure Providers in AWS Cognito Console

After deployment, configure the actual OAuth providers:

#### Google Setup:
1. AWS Cognito Console → User Pool → Sign-in experience
2. Add identity provider → **Google**
3. Enter:
   - **App client ID**: From Google Cloud Console
   - **App client secret**: From Google Cloud Console
4. Map attributes:
   - `email` → `email`
   - `name` → `name`
5. Save

#### Apple Setup:
1. AWS Cognito Console → User Pool → Sign-in experience
2. Add identity provider → **Apple**
3. Enter:
   - **Services ID**: `com.myTrainingApp`
   - **Team ID**: From Apple Developer
   - **Key ID**: From Apple Developer
   - **Private Key**: From Apple Developer (.p8 file)
4. Map attributes:
   - `email` → `email`
   - `name` → `name`
5. Save

### Step 3: Sync Outputs to Flutter App

After deployment:
```bash
./sync-amplify-outputs.sh
```

This copies `amplify_outputs.json` to:
- `assets/amplify_outputs.json` (Flutter)
- `my-training-admin/src/amplify_outputs.json` (React)

---

## 📋 Verification Checklist

### Backend Code
- [x] ✅ Auth resource includes `['Google', 'Apple']` providers
- [x] ✅ Redirect URLs configured for iOS and Android
- [x] ✅ Scopes configured: `['email', 'profile', 'openid']`
- [x] ✅ Post-confirmation trigger configured for group assignment

### Backend Deployment
- [ ] ⚠️ **Backend needs to be deployed**
- [ ] ⚠️ **amplify_outputs.json needs OAuth section**

### AWS Cognito Configuration
- [ ] ⚠️ Google provider needs to be added in Cognito Console
- [ ] ⚠️ Apple provider needs to be added in Cognito Console
- [ ] ⚠️ OAuth domain needs to be configured

### Flutter App Configuration
- [x] ✅ iOS Info.plist has URL scheme
- [x] ✅ Android AndroidManifest.xml has intent filter
- [ ] ⚠️ amplify_outputs.json needs to be synced after deployment

---

## 🎯 Current Status Summary

| Component | Status | Action Required |
|-----------|--------|----------------|
| Backend Code | ✅ Ready | None |
| Backend Deployment | ⚠️ Pending | Deploy backend |
| amplify_outputs.json | ⚠️ Missing OAuth | Deploy backend |
| iOS Config | ✅ Ready | None |
| Android Config | ✅ Ready | None |
| Cognito Google | ⚠️ Not Configured | Add in Console |
| Cognito Apple | ⚠️ Not Configured | Add in Console |
| Flutter App | ⚠️ Waiting | Sync outputs after deployment |

---

## 🚀 Next Steps

1. **Deploy Backend** (Required first step)
   ```bash
   npx @aws-amplify/backend-cli pipeline-deploy --branch dev --app-id d6c38s8spsb1t --outputs-out-dir . --outputs-format json
   ```

2. **Verify amplify_outputs.json** has OAuth section

3. **Configure Google in Cognito Console**
   - Get credentials from Google Cloud Console
   - Add to Cognito

4. **Configure Apple in Cognito Console**
   - Get credentials from Apple Developer
   - Add to Cognito

5. **Sync Outputs**
   ```bash
   ./sync-amplify-outputs.sh
   ```

6. **Test in Flutter App**
   - Rebuild app
   - Test Google sign-in
   - Test Apple sign-in (iOS only)

---

## 📝 Notes

1. **Backend code is ready** - All configuration is correct
2. **Deployment required** - OAuth won't work until backend is deployed
3. **Cognito configuration required** - Providers must be added manually in AWS Console
4. **Flutter app will automatically show buttons** - `amplify_authenticator` detects OAuth config
5. **Group assignment works** - Post-confirmation trigger assigns social users to "Employees" group

---

## 🔍 Quick Verification Commands

```bash
# Check if OAuth is in amplify_outputs.json
jq '.auth.oauth' amplify_outputs.json

# Check auth resource configuration
cat amplify/auth/resource.ts | grep -A 10 "oauth"

# Check iOS URL scheme
grep -A 5 "CFBundleURLSchemes" ios/Runner/Info.plist

# Check Android intent filter
grep -A 5 "com.mytrainingapp" android/app/src/main/AndroidManifest.xml
```

---

For detailed setup instructions, see `SOCIAL_LOGIN_SETUP.md`


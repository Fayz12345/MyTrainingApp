# Fix 404 Error on Amplify Hosting

## Problem
Your React app at `https://dev.d1pvmv1j5xi2c9.amplifyapp.com/` is showing a 404 error.

## What Was Fixed

1. **Updated `amplify.yml`** - Fixed directory paths and added build verification
2. **Added `_redirects` file** - Ensures SPA routing works correctly
3. **Added build verification** - Lists build directory to verify artifacts are created

## Solution Steps

### Step 1: Commit and Push Changes

```bash
cd /var/www/html/MyTrainingApp
git add amplify.yml my-training-admin/public/_redirects
git commit -m "Fix Amplify Hosting build configuration"
git push origin dev
```

### Step 2: Trigger a New Build

After pushing, Amplify should automatically trigger a new build. If not:

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Select your app
3. Click on the **dev** branch
4. Click **Redeploy this version** or wait for automatic deployment

### Step 3: Check Build Logs

1. In Amplify Console, go to your app
2. Click on the latest build
3. Check the build logs for:
   - ✅ "Build completed. Listing build directory:" - Should show files
   - ✅ "npm run build" - Should complete successfully
   - ❌ Any errors about missing files or directories

### Step 4: Verify Build Output

The build should create files in `my-training-admin/build/`:
- `index.html`
- `static/` folder with JS and CSS files
- `asset-manifest.json`

## Common Issues and Fixes

### Issue 1: Build Fails with "amplify_outputs.json not found"

**Fix:** Make sure `amplify_outputs.json` exists in the root directory:
```bash
ls -la amplify_outputs.json
```

If missing, deploy backend first:
```bash
npx @aws-amplify/backend-cli sandbox --once
```

### Issue 2: Build Succeeds but Still 404

**Possible causes:**
1. **Wrong baseDirectory** - Check that `baseDirectory: my-training-admin/build` is correct
2. **Build artifacts not generated** - Check build logs for "Build directory not found!"
3. **Cache issue** - Clear Amplify cache and redeploy

**Fix:**
1. Check build logs to see if `ls -la build/` shows files
2. Verify the `baseDirectory` in `amplify.yml` matches where build outputs are
3. In Amplify Console → App settings → Build settings → Clear cache and rebuild

### Issue 3: npm ci Fails

**Fix:** Make sure `package-lock.json` exists:
```bash
cd my-training-admin
ls package-lock.json
```

If missing, generate it:
```bash
npm install
git add package-lock.json
git commit -m "Add package-lock.json"
git push
```

### Issue 4: Wrong Branch Configuration

**Check:**
1. Go to Amplify Console → App settings → General
2. Verify the branch name matches your Git branch (should be `dev`)
3. Verify `amplify.yml` is in the root of your repository

## Verify Your Configuration

Run these commands to verify everything is set up correctly:

```bash
# Check amplify.yml exists
ls -la amplify.yml

# Check _redirects file exists
ls -la my-training-admin/public/_redirects

# Check amplify_outputs.json exists
ls -la amplify_outputs.json

# Check package.json exists in React app
ls -la my-training-admin/package.json
```

## Manual Build Test (Local)

To test the build locally before pushing:

```bash
cd /var/www/html/MyTrainingApp

# Copy amplify_outputs.json
cp amplify_outputs.json my-training-admin/src/amplify_outputs.json

# Build React app
cd my-training-admin
npm install
npm run build

# Check build output
ls -la build/
```

If this works locally, the Amplify build should work too.

## After Successful Deployment

Once the build succeeds:
1. ✅ Your app should be accessible at `https://dev.d1pvmv1j5xi2c9.amplifyapp.com/`
2. ✅ You should see the Amplify Authenticator login page
3. ✅ After login, you'll see the appropriate dashboard based on your user role

## Still Having Issues?

1. **Check Amplify Console Build Logs** - Look for specific error messages
2. **Verify AWS Credentials** - Make sure Amplify has access to your repository
3. **Check Branch Name** - Ensure it matches between Git and Amplify
4. **Review amplify.yml Syntax** - Make sure YAML is properly formatted

## Next Steps

After fixing the hosting issue:
1. Deploy backend resources (BusinessUnit, Store, Manager models)
2. Test the admin dashboard functionality
3. Verify all user roles can access their dashboards


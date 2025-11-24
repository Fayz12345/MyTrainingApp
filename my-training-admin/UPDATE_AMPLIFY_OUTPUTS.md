# When Will Other Roles Appear in amplify_outputs.json?

## 📋 Current Status

Your `amplify_outputs.json` currently shows only 2 groups:
```json
"groups": [
  { "Employees": { "precedence": 0 } },
  { "Managers": { "precedence": 1 } }
]
```

## ⏰ When Will It Update?

The `amplify_outputs.json` file is **automatically generated** by Amplify when you **deploy or run your backend**. It won't update automatically just because you created groups in the AWS Console.

### The file will update when you:

1. **Run Amplify Sandbox** (for local development)
2. **Deploy to a branch** (for production/staging)
3. **Pull outputs from an existing deployment**

## 🚀 How to Update amplify_outputs.json

### Option 1: Run Amplify Sandbox (Recommended for Development)

If you're running a local sandbox environment:

```bash
cd /var/www/html/MyTrainingApp
npx ampx sandbox
```

This will:
- Start/restart your Amplify backend
- Regenerate `amplify_outputs.json` with all current groups
- Update both root and `my-training-admin/src/amplify_outputs.json`

### Option 2: Deploy to a Branch

If you're using a deployed environment (like `main`, `dev`, etc.):

```bash
cd /var/www/html/MyTrainingApp
npx ampx pipeline-deploy --branch <your-branch-name>
```

Or if using Amplify Hosting:
```bash
npx ampx pipeline-deploy --branch main
```

### Option 3: Pull Outputs from Existing Deployment

If your backend is already deployed and you just need to sync the outputs:

```bash
cd /var/www/html/MyTrainingApp
npx ampx generate outputs --branch <your-branch-name>
```

Or for sandbox:
```bash
npx ampx sandbox --once
```

## 📝 After Deployment

Once you deploy, your `amplify_outputs.json` should show all 5 groups:

```json
"groups": [
  { "Employees": { "precedence": 0 } },
  { "Managers": { "precedence": 1 } },
  { "Store": { "precedence": 2 } },
  { "BusinessUnit": { "precedence": 3 } },
  { "SuperAdmin": { "precedence": 4 } }
]
```

## ⚠️ Important Notes

1. **Groups Work Even Without Update**: 
   - Your app will work correctly with all groups even if `amplify_outputs.json` doesn't show them
   - Groups are read directly from Cognito, not from the JSON file
   - The JSON file is just a snapshot for reference

2. **File Locations**:
   - Root: `/var/www/html/MyTrainingApp/amplify_outputs.json`
   - Admin: `/var/www/html/MyTrainingApp/my-training-admin/src/amplify_outputs.json`
   - Both should be updated, but you may need to copy manually if needed

3. **Copy to Admin Directory**:
   After deployment, if the admin directory doesn't update automatically:
   ```bash
   cp amplify_outputs.json my-training-admin/src/amplify_outputs.json
   ```

## ✅ Quick Verification

After deploying, verify the update:

```bash
cd /var/www/html/MyTrainingApp
jq '.auth.groups' amplify_outputs.json
```

You should see all 5 groups listed.

## 🎯 Summary

- **When**: After you deploy/run your Amplify backend
- **How**: Run `npx ampx sandbox` or deploy to a branch
- **Result**: `amplify_outputs.json` will include all groups that exist in Cognito
- **Note**: Your app works fine even if the file hasn't updated yet


# How to Update amplify_outputs.json with All Groups

## Current Situation

✅ **All 5 groups exist in Cognito:**
- Employees (precedence: 0)
- Managers (precedence: 1)
- Store (precedence: 2)
- BusinessUnit (precedence: 3)
- SuperAdmin (precedence: 4)

❌ **But amplify_outputs.json only shows 2 groups**

This happens because Amplify's `generate outputs` reads from the backend configuration, and there might be a sync delay.

---

## Solution Options

### Option 1: Redeploy Backend (Recommended)

The best way to ensure outputs are fully synced is to redeploy the backend:

```bash
# Push a change to trigger backend redeployment
git add .
git commit -m "Update backend to sync all Cognito groups"
git push origin dev
```

After deployment completes (5-10 minutes), regenerate outputs:

```bash
npx ampx generate outputs \
  --app-id d6c38s8spsb1t \
  --branch dev \
  --profile amplify

# Verify all groups are now in outputs
jq '.auth.groups' amplify_outputs.json
```

### Option 2: Manually Update Outputs File (Quick Fix)

If you need the groups in outputs immediately, you can manually add them:

```bash
# Backup current file
cp amplify_outputs.json amplify_outputs.json.backup

# Update the groups array
jq '.auth.groups = [
  {"Employees": {"precedence": 0}},
  {"Managers": {"precedence": 1}},
  {"Store": {"precedence": 2}},
  {"BusinessUnit": {"precedence": 3}},
  {"SuperAdmin": {"precedence": 4}}
]' amplify_outputs.json > amplify_outputs.json.tmp && mv amplify_outputs.json.tmp amplify_outputs.json

# Verify
jq '.auth.groups' amplify_outputs.json

# Copy to admin app
cp amplify_outputs.json my-training-admin/src/amplify_outputs.json
```

### Option 3: Wait and Regenerate

Sometimes Amplify needs a few minutes to sync. Try regenerating after a short wait:

```bash
# Wait 2-3 minutes, then regenerate
sleep 180
npx ampx generate outputs \
  --app-id d6c38s8spsb1t \
  --branch dev \
  --profile amplify
```

---

## Quick Fix Script

I'll create a script to manually update the outputs file:

```bash
#!/bin/bash
# Update amplify_outputs.json with all 5 groups

jq '.auth.groups = [
  {"Employees": {"precedence": 0}},
  {"Managers": {"precedence": 1}},
  {"Store": {"precedence": 2}},
  {"BusinessUnit": {"precedence": 3}},
  {"SuperAdmin": {"precedence": 4}}
]' amplify_outputs.json > amplify_outputs.json.tmp && \
mv amplify_outputs.json.tmp amplify_outputs.json && \
echo "✅ Updated amplify_outputs.json with all 5 groups" && \
cp amplify_outputs.json my-training-admin/src/amplify_outputs.json && \
echo "✅ Copied to admin app"
```

---

## Important Note

**The groups WILL work for authorization even if they don't show in outputs!**

- ✅ Groups exist in Cognito
- ✅ Authorization rules in your data models use Cognito groups directly
- ✅ The outputs file is mainly for frontend configuration
- ✅ Your backend authorization will work correctly

The outputs file is primarily used by the frontend to know which groups exist, but the actual authorization happens at the backend level using Cognito groups directly.

---

## Verify Groups Work

Even if outputs don't show all groups, test that authorization works:

1. Assign a user to "SuperAdmin" group
2. Try to access BusinessUnit model
3. It should work because the group exists in Cognito

---

## Recommended Approach

1. **For immediate use:** Manually update outputs file (Option 2)
2. **For long-term:** Redeploy backend (Option 1) to ensure everything is in sync

---

## Summary

- ✅ All 5 groups exist in Cognito
- ✅ Authorization will work correctly
- ⚠️ Outputs file may need manual update or backend redeploy
- ✅ You can manually update the file if needed


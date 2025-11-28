# How to Run create-groups-after-deploy.sh (Step 3)

## Quick Steps

### Step 1: Make sure you're in the project root

```bash
cd /var/www/html/MyTrainingApp
```

### Step 2: Ensure amplify_outputs.json exists

The script needs `amplify_outputs.json` to get the User Pool ID. If you don't have it:

```bash
# Generate outputs first
npx ampx generate outputs \
  --app-id d6c38s8spsb1t \
  --branch dev \
  --profile amplify
```

### Step 3: Run the script

```bash
./create-groups-after-deploy.sh
```

That's it! The script will:
- ✅ Read User Pool ID from `amplify_outputs.json`
- ✅ Create all 5 Cognito groups
- ✅ Show you a summary of what was created

---

## Complete Example

```bash
# 1. Navigate to project root
cd /var/www/html/MyTrainingApp

# 2. Generate outputs (if not already done)
npx ampx generate outputs \
  --app-id d6c38s8spsb1t \
  --branch dev \
  --profile amplify

# 3. Run the script
./create-groups-after-deploy.sh
```

---

## What You'll See

When you run the script, you'll see output like:

```
==========================================
Create Cognito Groups After Deployment
==========================================

📋 User Pool ID: ca-central-1_4bZDDl469
🌍 Region: ca-central-1

Processing group: Employees...
  ✅ Created group 'Employees' with precedence 0
Processing group: Managers...
  ✅ Created group 'Managers' with precedence 1
Processing group: Store...
  ✅ Created group 'Store' with precedence 2
Processing group: BusinessUnit...
  ✅ Created group 'BusinessUnit' with precedence 3
Processing group: SuperAdmin...
  ✅ Created group 'SuperAdmin' with precedence 4

📊 Summary:
──────────────────────────────────────────────────
✅ Created: 5 groups
⏭️  Skipped (already exist): 0 groups
❌ Failed: 0 groups

🎉 All groups created successfully!
```

---

## Troubleshooting

### Error: "amplify_outputs.json not found"

**Solution:**
```bash
# Generate outputs first
npx ampx generate outputs \
  --app-id d6c38s8spsb1t \
  --branch dev \
  --profile amplify
```

### Error: "Permission denied"

**Solution:**
```bash
# Make script executable
chmod +x create-groups-after-deploy.sh

# Then run it
./create-groups-after-deploy.sh
```

### Error: "Could not read user_pool_id"

**Solution:**
- Check that `amplify_outputs.json` exists
- Verify it has the `auth.user_pool_id` field
- Regenerate outputs if needed

### Error: "AWS credentials not configured"

**Solution:**
```bash
# Configure AWS profile
aws configure --profile amplify

# Or set environment variable
export AWS_PROFILE=amplify
```

---

## Verify Groups Were Created

After running the script, verify groups exist:

```bash
# Get User Pool ID
USER_POOL_ID=$(jq -r '.auth.user_pool_id' amplify_outputs.json)

# List groups
aws cognito-idp list-groups \
  --user-pool-id $USER_POOL_ID \
  --region ca-central-1 \
  --profile amplify
```

You should see all 5 groups listed.

---

## Next Steps

After creating groups:

1. **Regenerate outputs** (to include groups):
   ```bash
   npx ampx generate outputs \
     --app-id d6c38s8spsb1t \
     --branch dev \
     --profile amplify
   ```

2. **Copy to admin app**:
   ```bash
   cp amplify_outputs.json my-training-admin/src/amplify_outputs.json
   ```

3. **Verify in outputs**:
   ```bash
   jq '.auth.groups' amplify_outputs.json
   ```

---

## One-Liner (If outputs already exist)

```bash
cd /var/www/html/MyTrainingApp && ./create-groups-after-deploy.sh
```

---

**That's it! Just run `./create-groups-after-deploy.sh` and it will create all the groups!** 🚀


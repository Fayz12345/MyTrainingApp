# Admin Registration Guide

## The Problem

Currently, when users sign up:
- ✅ They can register via the Authenticator component
- ✅ They are automatically assigned to "Employees" group
- ❌ There's no way for an admin to register themselves as SuperAdmin

---

## Solutions

### Option 1: Create SuperAdmin via Script (Recommended for First Admin)

Use the script to create a new SuperAdmin user:

```bash
# Create a new SuperAdmin user
./create-superadmin.sh admin@company.com
```

**What this does:**
1. Creates a new user in Cognito (if doesn't exist)
2. Generates a temporary password
3. Assigns user to SuperAdmin group
4. Shows you the credentials

**Example:**
```bash
./create-superadmin.sh admin@mycompany.com
```

**Output:**
```
✅ User created successfully
🔑 Temporary Password: xYz123AbC!@#
✅ User added to SuperAdmin group successfully!

User can now:
  1. Log in at: http://localhost:3000
  2. Use email: admin@mycompany.com
  3. Use temporary password: xYz123AbC!@#
  4. Change password on first login
```

### Option 2: Promote Existing User to SuperAdmin

If a user already exists, promote them:

```bash
# Promote existing user to SuperAdmin
./promote-to-admin.sh user@company.com
```

**What this does:**
1. Finds the user in Cognito
2. Removes from Employees group (if applicable)
3. Adds to SuperAdmin group

**Example:**
```bash
./promote-to-admin.sh existing.user@company.com
```

### Option 3: Manual Assignment via AWS CLI

```bash
# Get User Pool ID
USER_POOL_ID=$(jq -r '.auth.user_pool_id' amplify_outputs.json)

# Add user to SuperAdmin group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id $USER_POOL_ID \
  --username "admin@company.com" \
  --group-name "SuperAdmin" \
  --region ca-central-1 \
  --profile amplify
```

### Option 4: Create User via AWS Console

1. Go to: https://ca-central-1.console.aws.amazon.com/cognito/v2/idp/user-pools
2. Select your User Pool
3. Go to **Users** tab
4. Click **Create user**
5. Enter email and temporary password
6. Click **Create user**
7. Go to **User groups** tab
8. Select the user
9. Click **Add to group**
10. Select **SuperAdmin**
11. Click **Add to group**

---

## Step-by-Step: First Admin Setup

### Step 1: Create the First SuperAdmin

```bash
cd /var/www/html/MyTrainingApp

# Create SuperAdmin user
./create-superadmin.sh admin@yourcompany.com
```

### Step 2: Note the Credentials

The script will show you:
- Email address
- Temporary password

**Save these credentials!**

### Step 3: Log In

1. Open your admin app: http://localhost:3000 (or your deployed URL)
2. Enter the email address
3. Enter the temporary password
4. You'll be prompted to change password
5. Set a new secure password

### Step 4: Verify Access

After logging in, you should see:
- ✅ SuperAdmin Dashboard
- ✅ Access to all features
- ✅ Ability to create BusinessUnits, Stores, Managers, etc.

---

## Creating Additional Admins

Once you have your first SuperAdmin, you can:

### Method 1: Use the Script

```bash
# Create another SuperAdmin
./create-superadmin.sh another.admin@company.com
```

### Method 2: Promote Existing User

If someone already registered as Employee:

```bash
# Promote them to SuperAdmin
./promote-to-admin.sh employee@company.com
```

### Method 3: Create via SuperAdmin Dashboard (Future)

You could add a "Create Admin" feature to the SuperAdmin dashboard (would require additional development).

---

## User Registration Flow

### Current Flow:
1. User signs up via Authenticator component
2. User confirms email
3. Post-confirmation trigger assigns to "Employees" group
4. User logs in as Employee

### For Admin:
1. **Option A:** Use script to create SuperAdmin directly
2. **Option B:** Sign up normally, then promote via script
3. **Option C:** Manual assignment via AWS Console

---

## Quick Reference

### Create New SuperAdmin
```bash
./create-superadmin.sh admin@company.com
```

### Promote Existing User
```bash
./promote-to-admin.sh user@company.com
```

### Check User's Groups
```bash
USER_POOL_ID=$(jq -r '.auth.user_pool_id' amplify_outputs.json)
aws cognito-idp admin-list-groups-for-user \
  --user-pool-id $USER_POOL_ID \
  --username "user@company.com" \
  --region ca-central-1 \
  --profile amplify
```

### Remove from Group
```bash
aws cognito-idp admin-remove-user-from-group \
  --user-pool-id $USER_POOL_ID \
  --username "user@company.com" \
  --group-name "Employees" \
  --region ca-central-1 \
  --profile amplify
```

---

## Troubleshooting

### Issue: "User already exists"
**Solution:** Use `./promote-to-admin.sh` instead

### Issue: "Group not found"
**Solution:** Make sure groups are created:
```bash
./create-groups-after-deploy.sh
```

### Issue: "Permission denied"
**Solution:** Check AWS credentials:
```bash
aws sts get-caller-identity --profile amplify
```

### Issue: User can't log in after promotion
**Solution:** User needs to log out and log back in for group changes to take effect

---

## Security Best Practices

1. **First Admin:** Create via script with secure temporary password
2. **Additional Admins:** Only promote trusted users
3. **Password Policy:** Ensure strong passwords (already configured)
4. **Audit:** Regularly check who has SuperAdmin access
5. **Least Privilege:** Only give SuperAdmin to users who need it

---

## Summary

**To create your first SuperAdmin:**

```bash
./create-superadmin.sh your-email@company.com
```

**To promote an existing user:**

```bash
./promote-to-admin.sh existing-user@company.com
```

**That's it!** The user will have SuperAdmin access and can manage the entire system. 🎉


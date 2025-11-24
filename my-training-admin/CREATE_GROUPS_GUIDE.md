# Creating Cognito User Groups Guide

This guide explains how to create all user role groups in AWS Cognito for the MyTrainingApp.

## 📋 Overview

Your application uses 5 user role groups:
- **Employees** (precedence: 0) - Regular employees who can take courses
- **Managers** (precedence: 1) - Managers who can create courses and assign them
- **Store** (precedence: 2) - Store administrators who can manage stores and managers
- **BusinessUnit** (precedence: 3) - Business unit administrators who can manage stores
- **SuperAdmin** (precedence: 4) - Super administrators with full system access

## 🔍 Current Status

From `amplify_outputs.json`, only these groups currently exist:
- ✅ Employees
- ✅ Managers
- ❌ Store (needs to be created)
- ❌ BusinessUnit (needs to be created)
- ❌ SuperAdmin (needs to be created)

## 🚀 Method 1: Using Node.js Script (Recommended)

### Prerequisites
1. Node.js installed
2. AWS SDK installed in the admin directory:
   ```bash
   cd my-training-admin
   npm install @aws-sdk/client-cognito-identity-provider
   ```
3. AWS credentials configured (via AWS CLI or environment variables)

### Steps
1. Navigate to the admin directory:
   ```bash
   cd my-training-admin
   ```

2. Run the script:
   ```bash
   node create-cognito-groups.js
   ```

3. The script will:
   - Read configuration from `src/amplify_outputs.json`
   - Check which groups already exist
   - Create missing groups
   - Show a summary of results

### Expected Output
```
🚀 Starting Cognito Group Creation...

User Pool ID: ca-central-1_HeNIx5x65
Region: ca-central-1

Groups to create:
  - Employees (precedence: 0)
  - Managers (precedence: 1)
  - Store (precedence: 2)
  - BusinessUnit (precedence: 3)
  - SuperAdmin (precedence: 4)

✅ Group "Employees" already exists, skipping...
✅ Group "Managers" already exists, skipping...
✅ Created group "Store" with precedence 2
✅ Created group "BusinessUnit" with precedence 3
✅ Created group "SuperAdmin" with precedence 4

📊 Summary:
──────────────────────────────────────────────────
✅ Created: 3 groups
⏭️  Skipped (already exist): 2 groups
❌ Failed: 0 groups

🎉 All groups created successfully!
```

## 🛠️ Method 2: Using AWS CLI Script

### Prerequisites
1. AWS CLI installed and configured
2. `jq` installed (for JSON parsing):
   ```bash
   # Ubuntu/Debian
   sudo apt-get install jq
   
   # macOS
   brew install jq
   ```

### Steps
1. Navigate to the admin directory:
   ```bash
   cd my-training-admin
   ```

2. Make the script executable:
   ```bash
   chmod +x create-cognito-groups.sh
   ```

3. Run the script:
   ```bash
   ./create-cognito-groups.sh
   ```

## 📝 Method 3: Manual Creation via AWS Console

1. Go to [AWS Cognito Console](https://console.aws.amazon.com/cognito/)
2. Select your User Pool: `ca-central-1_HeNIx5x65`
3. Navigate to **Groups** in the left sidebar
4. Click **Create group** for each missing group:

   **Group 1: Store**
   - Group name: `Store`
   - Precedence: `2`
   - Description: `Store administrators who can manage stores and managers`

   **Group 2: BusinessUnit**
   - Group name: `BusinessUnit`
   - Precedence: `3`
   - Description: `Business unit administrators who can manage stores`

   **Group 3: SuperAdmin**
   - Group name: `SuperAdmin`
   - Precedence: `4`
   - Description: `Super administrators with full system access`

## 📝 Method 4: Using AWS CLI Commands Directly

If you prefer to run commands manually:

```bash
# Set variables
USER_POOL_ID="ca-central-1_HeNIx5x65"
REGION="ca-central-1"

# Create Store group
aws cognito-idp create-group \
  --user-pool-id $USER_POOL_ID \
  --group-name Store \
  --precedence 2 \
  --description "Store administrators who can manage stores and managers" \
  --region $REGION

# Create BusinessUnit group
aws cognito-idp create-group \
  --user-pool-id $USER_POOL_ID \
  --group-name BusinessUnit \
  --precedence 3 \
  --description "Business unit administrators who can manage stores" \
  --region $REGION

# Create SuperAdmin group
aws cognito-idp create-group \
  --user-pool-id $USER_POOL_ID \
  --group-name SuperAdmin \
  --precedence 4 \
  --description "Super administrators with full system access" \
  --region $REGION
```

## ✅ Verification

After creating the groups, verify they exist:

### Using AWS CLI:
```bash
aws cognito-idp list-groups \
  --user-pool-id ca-central-1_HeNIx5x65 \
  --region ca-central-1
```

### Using AWS Console:
1. Go to Cognito → User Pools → `ca-central-1_HeNIx5x65`
2. Click **Groups** in the left sidebar
3. You should see all 5 groups listed

## 🔐 Assigning Users to Groups

After creating groups, you can assign users to them:

### Via AWS Console:
1. Go to Cognito → User Pools → `ca-central-1_HeNIx5x65`
2. Click **Users** → Select a user
3. Click **Add user to group** → Select the group

### Via AWS CLI:
```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id ca-central-1_HeNIx5x65 \
  --username user@example.com \
  --group-name SuperAdmin \
  --region ca-central-1
```

## 🎯 Next Steps

After creating all groups:

1. **Update your Lambda function** (if you have one that creates users) to assign users to the correct groups
2. **Test group assignments** by logging in with users in different groups
3. **Verify authorization** works correctly in your app based on group membership

## 🐛 Troubleshooting

### Error: "Access Denied"
- Ensure your AWS credentials have permissions to create Cognito groups
- Required permission: `cognito-idp:CreateGroup`

### Error: "Group already exists"
- This is normal if the group was already created
- The scripts will skip existing groups automatically

### Error: "User Pool not found"
- Verify the User Pool ID in `amplify_outputs.json`
- Ensure you're using the correct AWS region

## 📚 Additional Resources

- [AWS Cognito Groups Documentation](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-user-groups.html)
- [AWS CLI Cognito Commands](https://docs.aws.amazon.com/cli/latest/reference/cognito-idp/index.html)


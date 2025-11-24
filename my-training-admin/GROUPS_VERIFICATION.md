# Cognito Groups Verification Guide

## ✅ Expected Configuration

Your application requires **5 user groups** with the following configuration:

| Group Name | Precedence | Description | Status |
|------------|-----------|-------------|--------|
| **Employees** | 0 | Regular employees who can take courses | ✅ Should exist |
| **Managers** | 1 | Managers who can create courses and assign them | ✅ Should exist |
| **Store** | 2 | Store administrators who can manage stores and managers | ⚠️ Need to verify |
| **BusinessUnit** | 3 | Business unit administrators who can manage stores | ⚠️ Need to verify |
| **SuperAdmin** | 4 | Super administrators with full system access | ⚠️ Need to verify |

## 🔍 How to Verify Groups Are Configured

### Method 1: AWS Amplify Console (Recommended)

1. Go to **AWS Amplify Console** → Your App → **Authentication** → **User Management** → **Groups** tab
2. You should see all 5 groups listed:
   - Employees
   - Managers
   - Store
   - BusinessUnit
   - SuperAdmin

3. For each group, verify:
   - ✅ Group name matches exactly (case-sensitive)
   - ✅ Precedence value is correct (see table above)
   - ✅ Group is active/enabled

### Method 2: Check amplify_outputs.json

The `amplify_outputs.json` file is generated during deployment. If you just created groups in the Console, it won't update automatically.

**Current status** (as of last check):
```json
"groups": [
  { "Employees": { "precedence": 0 } },
  { "Managers": { "precedence": 1 } }
]
```

**Expected** (after redeploy):
```json
"groups": [
  { "Employees": { "precedence": 0 } },
  { "Managers": { "precedence": 1 } },
  { "Store": { "precedence": 2 } },
  { "BusinessUnit": { "precedence": 3 } },
  { "SuperAdmin": { "precedence": 4 } }
]
```

### Method 3: Run Verification Script

```bash
cd my-training-admin
./verify-groups.sh
```

## 🔄 After Creating Groups in Console

If you created the groups via AWS Console, you have two options:

### Option A: Redeploy Amplify Backend (Recommended)

This will regenerate `amplify_outputs.json` with all groups:

```bash
cd /var/www/html/MyTrainingApp
npx ampx sandbox
```

Or if using a deployed environment:
```bash
npx ampx pipeline-deploy --branch main
```

### Option B: Manual Verification

If groups exist in Cognito but `amplify_outputs.json` doesn't show them:
1. ✅ Groups are created correctly in Cognito
2. ✅ Your app will work (groups are used from Cognito, not from amplify_outputs.json)
3. ⚠️ `amplify_outputs.json` is just a snapshot and will update on next deploy

## ✅ Verification Checklist

- [ ] All 5 groups exist in AWS Console
- [ ] Group names match exactly (case-sensitive):
  - [ ] Employees
  - [ ] Managers
  - [ ] Store
  - [ ] BusinessUnit
  - [ ] SuperAdmin
- [ ] Precedence values are correct:
  - [ ] Employees: 0
  - [ ] Managers: 1
  - [ ] Store: 2
  - [ ] BusinessUnit: 3
  - [ ] SuperAdmin: 4
- [ ] Groups are used in authorization rules (checked in data/resource.ts)

## 📝 Groups Usage in Code

### Auth Resource (`amplify/auth/resource.ts`)
```typescript
groups: ['Employees', 'Managers', 'Store', 'BusinessUnit', 'SuperAdmin']
```

### Data Resource (`amplify/data/resource.ts`)
All 5 groups are used in authorization rules:
- **SuperAdmin**: Full access to BusinessUnit, Store, Manager models
- **BusinessUnit**: Read BusinessUnit, full access to Store
- **Store**: Read BusinessUnit/Store, full access to Manager
- **Managers**: Read BusinessUnit/Store/Manager, full access to Course/Employee/Assignment
- **Employees**: Read access to Course/Assignment/Employee, create Result

## 🎯 Next Steps

1. **Verify in AWS Console** that all 5 groups exist
2. **Test group assignment** by assigning a test user to each group
3. **Verify authorization** works correctly in your app
4. **Redeploy backend** (optional) to update amplify_outputs.json

## 🐛 Troubleshooting

### Groups exist but not showing in amplify_outputs.json
- This is normal if you created them via Console
- Groups will work in your app regardless
- Redeploy to update the file

### Group name doesn't match
- Group names are case-sensitive
- Must match exactly: `Store` not `store`, `SuperAdmin` not `Superadmin`

### Authorization not working
- Check user is assigned to correct group in Cognito
- Verify group name matches exactly in code
- Check precedence values are correct


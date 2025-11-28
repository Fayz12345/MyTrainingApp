# Cognito User Pool Information

## Your User Pool Details

**User Pool ID:** `ca-central-1_aKCLbCdhj`  
**User Pool Name:** `amplifyAuthUserPool4BA7F805-OdeYwP6FdAOJ`  
**Region:** `ca-central-1`  
**Created:** November 28, 2025 at 09:55 GMT+5:30  
**Estimated Users:** 2

**ARN:** `arn:aws:cognito-idp:ca-central-1:216348571084:userpool/ca-central-1_aKCLbCdhj`

---

## Connection to Your AppSync API

Your AppSync GraphQL API uses this Cognito User Pool for authentication:

- **API ID:** `csxrkv7kenai5i4jycdl73t3uy`
- **Auth Type:** `AMAZON_COGNITO_USER_POOLS`
- **User Pool ID:** `ca-central-1_aKCLbCdhj` ✅

This means:
- All GraphQL requests require a valid JWT token from this User Pool
- Authorization is based on Cognito groups (SuperAdmin, BusinessUnit, Store, Managers, Employees)
- Tokens are validated using the JWKS URL

---

## Token Signing Key URL

**JWKS URL:** `https://cognito-idp.ca-central-1.amazonaws.com/ca-central-1_aKCLbCdhj/.well-known/jwks.json`

This URL is used by:
- AppSync API to verify JWT tokens
- Your frontend application to validate tokens
- Any service that needs to verify tokens from this User Pool

---

## App Client Configuration

**App Client ID:** `1kljta9eftlgp8dqa9rv3e0chv`

This is the client ID used by your frontend application to authenticate users.

---

## Cognito Groups

Your User Pool should have these groups defined:

1. **SuperAdmin** (Precedence: 4)
   - Full access to all models
   - Can create, read, update, delete BusinessUnit, Store, Manager

2. **BusinessUnit** (Precedence: 3)
   - Can read BusinessUnit
   - Can create, read, update, delete Store

3. **Store** (Precedence: 2)
   - Can read BusinessUnit, Store
   - Can create, read, update, delete Manager

4. **Managers** (Precedence: 1)
   - Can read BusinessUnit, Store, Manager
   - Can create, read, update, delete Course, Employee, Assignment

5. **Employees** (Precedence: 0)
   - Can read Course, Employee, Assignment
   - Can create, read Result

---

## How to Check Groups in Cognito Console

1. Go to Cognito Console:
   https://ca-central-1.console.aws.amazon.com/cognito/v2/idp/user-pools/ca-central-1_aKCLbCdhj/groups

2. You should see all 5 groups listed

3. To check which users are in which groups:
   - Go to "User management" → "Users"
   - Click on a user
   - Check the "Groups" tab

---

## How to Add User to SuperAdmin Group

### Method 1: Via Cognito Console

1. Go to: https://ca-central-1.console.aws.amazon.com/cognito/v2/idp/user-pools/ca-central-1_aKCLbCdhj/users
2. Click on the user
3. Go to "Groups" tab
4. Click "Add user to group"
5. Select "SuperAdmin"
6. Click "Add"

### Method 2: Via AWS CLI

```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id ca-central-1_aKCLbCdhj \
  --username <user-email> \
  --group-name SuperAdmin \
  --region ca-central-1 \
  --profile amplify
```

### Method 3: Using Script

```bash
./create-superadmin.sh <user-email>
```

---

## Verification Checklist

- [ ] User Pool exists: ✅ `ca-central-1_aKCLbCdhj`
- [ ] AppSync uses this User Pool: ✅ Verified
- [ ] All 5 groups exist in User Pool: ⚠️ Check in Console
- [ ] Users are assigned to correct groups: ⚠️ Check per user
- [ ] App Client configured: ✅ `1kljta9eftlgp8dqa9rv3e0chv`
- [ ] JWKS URL accessible: ✅ Available

---

## Important Notes

1. **After adding user to group:**
   - User must sign out and sign back in
   - JWT token needs to be refreshed to include new group claims
   - Old tokens won't have the new group membership

2. **Token Claims:**
   - Groups are included in `cognito:groups` claim
   - Token must be refreshed to get updated groups
   - Check token in browser console or AuthDebug component

3. **Authorization:**
   - AppSync uses groups from JWT token for authorization
   - If `@auth` directives are missing in AppSync schema, authorization won't work
   - This is the current issue - need to deploy backend to sync `@auth` directives

---

## Quick Links

- **Cognito User Pool:** https://ca-central-1.console.aws.amazon.com/cognito/v2/idp/user-pools/ca-central-1_aKCLbCdhj
- **Users:** https://ca-central-1.console.aws.amazon.com/cognito/v2/idp/user-pools/ca-central-1_aKCLbCdhj/users
- **Groups:** https://ca-central-1.console.aws.amazon.com/cognito/v2/idp/user-pools/ca-central-1_aKCLbCdhj/groups
- **App Clients:** https://ca-central-1.console.aws.amazon.com/cognito/v2/idp/user-pools/ca-central-1_aKCLbCdhj/clients
- **AppSync API:** https://ca-central-1.console.aws.amazon.com/appsync/home?region=ca-central-1#/csxrkv7kenai5i4jycdl73t3uy/schema

---

## Troubleshooting

### If user can't access resources:

1. **Check user is in correct group:**
   ```bash
   aws cognito-idp admin-list-groups-for-user \
     --user-pool-id ca-central-1_aKCLbCdhj \
     --username <user-email> \
     --region ca-central-1 \
     --profile amplify
   ```

2. **Check JWT token has groups:**
   - Use AuthDebug component in frontend
   - Check browser console for token claims
   - Verify `cognito:groups` claim includes expected groups

3. **Check AppSync schema has @auth directives:**
   - This is the current issue
   - Need to deploy backend to sync authorization rules

4. **Sign out and sign back in:**
   - Groups are included in token at sign-in time
   - Must refresh token to get updated groups

---

**Your User Pool is correctly configured! The issue is that AppSync schema needs @auth directives synced.**


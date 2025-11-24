# AWS Authentication Guide for Creating Cognito Groups

## Current Issue
The AWS CLI cannot locate credentials. You need to authenticate before running the group creation script.

## Option 1: AWS SSO Login (If using AWS SSO)

If your organization uses AWS Single Sign-On (SSO):

```bash
aws sso login
```

This will open a browser window for you to authenticate. After successful login, you can run:
```bash
cd my-training-admin
./create-cognito-groups.sh
```

## Option 2: Configure AWS CLI with IAM Role

If you have an IAM role ARN, configure it:

```bash
aws configure
```

You'll be prompted for:
- AWS Access Key ID: (leave blank if using role)
- AWS Secret Access Key: (leave blank if using role)
- Default region: `ca-central-1`
- Default output format: `json`

Then configure the role:
```bash
aws configure set role_arn arn:aws:iam::ACCOUNT_ID:role/ROLE_NAME
aws configure set source_profile default
```

## Option 3: Use Environment Variables

If you have temporary credentials:

```bash
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_SESSION_TOKEN=your_session_token  # If using temporary credentials
export AWS_DEFAULT_REGION=ca-central-1
```

## Option 4: Use AWS Profile

If you have a named profile configured:

```bash
export AWS_PROFILE=your-profile-name
```

Then run the script.

## Verify Authentication

After configuring credentials, verify they work:

```bash
aws sts get-caller-identity
```

This should return your AWS account ID, user ARN, and user ID.

## Required IAM Permissions

Your IAM role/user needs these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cognito-idp:GetGroup",
        "cognito-idp:CreateGroup",
        "cognito-idp:ListGroups"
      ],
      "Resource": "arn:aws:cognito-idp:ca-central-1:*:userpool/ca-central-1_HeNIx5x65"
    }
  ]
}
```

## After Authentication

Once authenticated, run:

```bash
cd my-training-admin
./create-cognito-groups.sh
```

The script will create the missing groups:
- Store (precedence: 2)
- BusinessUnit (precedence: 3)
- SuperAdmin (precedence: 4)

Groups that already exist (Employees, Managers) will be skipped.


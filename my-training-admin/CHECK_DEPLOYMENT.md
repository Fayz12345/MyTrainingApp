# How to Check Which Deployment/Environment You're Using

## Current Deployment Information

Based on your `amplify_outputs.json`, here's what I can tell you:

### Environment Indicators:

1. **S3 Bucket Name**: `amplify-d6c38s8spsb1t-dev-trainingvideosbucket4095-swynaa2gozyc`
   - Contains `-dev-` which indicates a **development** environment

2. **GraphQL Endpoint**: `https://4we2oatxszhtdefub6ylwlywce.appsync-api.ca-central-1.amazonaws.com/graphql`
   - This is your AppSync API endpoint

3. **Region**: `ca-central-1` (Canada Central)

4. **User Pool ID**: `ca-central-1_HeNIx5x65`

## How to Find Your Deployment in AWS Console

### Method 1: Check AWS Amplify Console

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Look for your app (likely named "MyTrainingApp" or similar)
3. Check the **Backend environments** section
4. You'll see:
   - Environment name (e.g., "dev", "main", "staging")
   - Branch name (if connected to Git)
   - Last deployment time

### Method 2: Check AppSync Console

1. Go to [AWS AppSync Console](https://console.aws.amazon.com/appsync/)
2. Find API with endpoint: `4we2oatxszhtdefub6ylwlywce`
3. Check the API name and environment tags

### Method 3: Check DynamoDB Tables

1. Go to [AWS DynamoDB Console](https://console.aws.amazon.com/dynamodb/)
2. Look for tables with prefix matching your app
3. Table names often include environment info (e.g., `BusinessUnit-dev-...`)

### Method 4: Check S3 Bucket

1. Go to [AWS S3 Console](https://console.aws.amazon.com/s3/)
2. Find bucket: `amplify-d6c38s8spsb1t-dev-trainingvideosbucket4095-swynaa2gozyc`
3. Check bucket tags or name for environment info

## Common Environment Names

- **dev** or **development** - Development environment
- **main** or **master** - Production environment
- **staging** - Staging environment
- **sandbox** - Local/sandbox environment

## Quick Check Command

Run this to see key deployment info:

```bash
cd /var/www/html/MyTrainingApp
echo "GraphQL Endpoint:"
jq -r '.data.url' amplify_outputs.json

echo -e "\nS3 Bucket:"
jq -r '.storage.bucket_name' amplify_outputs.json

echo -e "\nUser Pool ID:"
jq -r '.auth.user_pool_id' amplify_outputs.json

echo -e "\nRegion:"
jq -r '.auth.aws_region' amplify_outputs.json
```

## To Deploy to a Specific Environment

If you want to deploy to a specific branch/environment:

```bash
cd /var/www/html/MyTrainingApp
npx ampx pipeline-deploy --branch <branch-name>
```

Common branch names:
- `main` or `master` - Production
- `dev` or `develop` - Development
- `staging` - Staging

## Note

Your current deployment appears to be a **development** environment based on the bucket name containing `-dev-`.


# QA Environment Setup Guide

## Overview
The QA environment provides an isolated testing environment for the MyTrainingApp with separate AWS resources from production.

## Environment Details

### AWS Resources (QA Environment)
- **Cognito User Pool**: `ca-central-1_sm5rsMuaR`
- **AppSync GraphQL API**: `https://ohdehervyzeq5ffklz5ebcighe.appsync-api.ca-central-1.amazonaws.com/graphql`
- **S3 Storage Bucket**: `amplify-mytrainingapp-qa--trainingvideosbucket4095-uudnytrwnqiv`
- **Region**: `ca-central-1`

### Branch Strategy
- **QA Branch**: `qa`
- **Automatic Deployment**: Push to `qa` branch triggers CI/CD pipeline
- **Isolated Resources**: QA has completely separate AWS resources from production

## Access URLs

### Admin Portal
- **URL**: `http://qa-mytrainingapp-admin-portal.s3-website.ca-central-1.amazonaws.com`
- **Deployment**: Automatically deployed via GitHub Actions to S3 static website hosting

### Android APK Download
- **Latest APK**: `https://qa-mytrainingapp-artifacts.s3.ca-central-1.amazonaws.com/MyTrainingApp-qa-latest.apk`
- **Timestamped APKs**: Available with format `MyTrainingApp-qa-YYYYMMDD-HHMMSS.apk`

## Test Credentials

### Manager Accounts
```
Email: qa-manager@testcompany.com
Password: TempQAPass123!
Role: Manager (can create courses, employees, assignments)

Email: qa-supervisor@testcompany.com  
Password: TempQAPass123!
Role: Manager (can create courses, employees, assignments)
```

### Employee Accounts
```
Email: qa-employee1@testcompany.com
Password: TempQAPass123!
Role: Employee (can view courses, take quizzes)

Email: qa-employee2@testcompany.com
Password: TempQAPass123!
Role: Employee (can view courses, take quizzes)

Email: qa-employee3@testcompany.com
Password: TempQAPass123!
Role: Employee (can view courses, take quizzes)
```

## Deployment Process

### Automatic Deployment (Recommended)
1. Push code changes to the `qa` branch
2. GitHub Actions automatically:
   - Deploys backend changes
   - Builds Android APK
   - Deploys admin portal
   - Seeds test users
   - Runs E2E tests

### Manual Deployment
```bash
# Deploy QA backend
npm run deploy:qa

# Seed test users
npm run seed:qa

# Copy outputs to admin portal
cp amplify_outputs.json my-training-admin/src/amplify_outputs.json
```

## Testing Workflows

### Manager Testing Workflow
1. Access QA Admin Portal URL
2. Login with manager credentials
3. Create employee records using Employee Form
4. Create training courses with videos and quizzes
5. Assign courses to employees
6. Monitor completion status

### Employee Testing Workflow
1. Download QA Android APK
2. Install on device
3. Login with employee credentials
4. View assigned courses
5. Watch training videos
6. Complete quizzes
7. Verify completion status updates

### End-to-End Testing
1. Manager creates course → Employee completes → Status updates
2. Video playback functionality
3. Quiz scoring and pass/fail logic
4. Training completion notifications
5. Employee scheduling readiness indicators

## Development Commands

```bash
# Create QA environment
git checkout -b qa
npm run deploy:qa

# Seed test data
npm run seed:qa

# View QA environment status
npx @aws-amplify/backend-cli sandbox --identifier qa

# Delete QA environment (cleanup)
npx @aws-amplify/backend-cli sandbox delete --identifier qa
```

## Troubleshooting

### Common Issues

**APK Installation Fails**
- Enable "Install from Unknown Sources" on Android device
- Check device has sufficient storage space

**Admin Portal Access Denied**
- Verify using manager credentials (not employee)
- Clear browser cache/cookies
- Check network connectivity

**Video Playback Issues**
- Ensure videos are uploaded to QA S3 bucket
- Verify video format compatibility (MP4)
- Check S3 bucket permissions

**GraphQL API Errors**
- Verify user is in correct Cognito group
- Check amplify_outputs.json configuration
- Ensure backend deployment completed successfully

### Support Contacts
- **Backend Issues**: Check CloudWatch logs for Lambda functions
- **Frontend Issues**: Check browser console for errors
- **Mobile Issues**: Check React Native debugger logs

## Security Notes
- QA environment uses test credentials only
- No production data in QA environment
- APK downloads are publicly accessible (test builds only)
- Cognito users are isolated to QA user pool

## Cleanup
When QA testing is complete, environment can be cleaned up:
```bash
npx @aws-amplify/backend-cli sandbox delete --identifier qa
```
This removes all QA AWS resources to avoid ongoing costs.
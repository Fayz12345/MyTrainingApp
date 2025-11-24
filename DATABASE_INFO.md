# Database Architecture & Connection Guide

## 📊 Which Databases Are Used?

Your Flutter app uses **AWS Amplify** which provides multiple database services:

### 1. **User Registration/Authentication Database**
- **Service**: AWS Cognito User Pool
- **Purpose**: Stores user accounts, passwords, email verification
- **User Pool ID**: `ca-central-1_HeNIx5x65`
- **Region**: `ca-central-1`

When users register through the Amplify Authenticator form, their accounts are stored in **AWS Cognito**.

### 2. **Application Data Database**
- **Service**: AWS DynamoDB (NoSQL database)
- **Purpose**: Stores courses, employees, assignments, quiz questions, results
- **Access Method**: AWS AppSync (GraphQL API)
- **GraphQL Endpoint**: `https://4we2oatxszhtdefub6ylwlywce.appsync-api.ca-central-1.amazonaws.com/graphql`
- **Region**: `ca-central-1`

### 3. **File Storage**
- **Service**: AWS S3 (Simple Storage Service)
- **Purpose**: Stores video files for courses
- **Bucket**: `amplify-d6c38s8spsb1t-dev-trainingvideosbucket4095-swynaa2gozyc`

## 🔌 How Connection Works

### Connection Flow:
1. **App Starts** → Reads `amplify_outputs.json` configuration
2. **Amplify Configured** → Connects to AWS services
3. **Registration** → User data goes to **AWS Cognito**
4. **Data Operations** → App data goes to **DynamoDB** via GraphQL API

### Configuration File:
- **Location**: `amplify_outputs.json` (root directory)
- **Contains**: All AWS service endpoints, IDs, and connection info
- **Loaded by**: `lib/services/amplify_service.dart`

## ✅ How to Verify Connection

### Method 1: Using the Profile Screen (Built-in)
1. Open the app and log in
2. Go to **Profile** tab
3. You'll see:
   - Database information
   - Connection status for each service
   - "Test Connection" button to verify connectivity

### Method 2: Check Logs
When the app starts, look for:
```
I/flutter: Amplify configured successfully
```
This confirms the connection is working.

### Method 3: Test Registration
1. Register a new user
2. If registration succeeds → Cognito connection works ✅
3. Check email for verification code → Email service works ✅

### Method 4: AWS Console (Advanced)
1. Go to [AWS Console](https://console.aws.amazon.com/)
2. Navigate to:
   - **Cognito** → User Pools → `ca-central-1_HeNIx5x65` (see registered users)
   - **DynamoDB** → Tables (see application data)
   - **AppSync** → APIs (see GraphQL API)

## 🔍 What Happens During Registration?

1. **User fills registration form** (provided by Amplify Authenticator)
2. **Data sent to AWS Cognito**:
   - Email
   - Password (encrypted)
   - User attributes
3. **Cognito creates user account**
4. **Verification email sent** (if email verification enabled)
5. **User verifies email** with code
6. **Account activated** ✅

## 📝 Database Tables (DynamoDB)

Your app uses these tables (managed by Amplify):
- `Employee` - Employee records
- `Course` - Training courses
- `QuizQuestion` - Quiz questions for courses
- `Assignment` - Course assignments to employees
- `Result` - Quiz results

## 🛠️ Troubleshooting

### Connection Issues?
1. Check `amplify_outputs.json` exists in root directory
2. Verify internet connection
3. Check AWS region is correct (`ca-central-1`)
4. Use "Test Connection" button in Profile screen

### Can't See Registered Users?
- Users are in **AWS Cognito**, not DynamoDB
- Check AWS Console → Cognito → User Pools
- Or use the admin panel to view employees

### Registration Works But Can't Login?
- User might not be in "Employees" group
- User needs to verify email first
- Check user groups in AWS Cognito Console

## 📚 Additional Resources

- **AWS Cognito**: User authentication database
- **AWS DynamoDB**: Application data storage
- **AWS AppSync**: GraphQL API layer
- **AWS S3**: File storage for videos

All connections are configured automatically through `amplify_outputs.json`!


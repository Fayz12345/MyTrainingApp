# MyTrainingApp - Claude Context

## Project Overview
React Native training app with AWS Amplify Gen 2 for course management and employee training.

**Architecture**: React Native mobile app + React admin web portal, AWS Cognito auth, DynamoDB storage, GraphQL API

## Admin Web Portal (`my-training-admin/`)
Located at `/my-training-admin/` - React TypeScript admin dashboard for managers.

**Main Features**:
- **Course Management**: Create/edit courses via `CourseForm.tsx` and `CourseList.tsx`
- **Employee Management**: View/create employees via `EmployeeList.tsx` and `EmployeeForm.tsx`  
- **Course Assignment**: Assign courses to employees via `AssignmentForm.tsx`
- **Manager Dashboard**: Overview via `ManagerDashboard.tsx`

**Key Files**:
- `src/amplify_outputs.json` - Contains GraphQL schema for Employee/Assignment models (copied from parent directory)
- `src/components/` - All React components for admin functionality

## Employee Creation (Automated)
**Problem**: Previously required manual AWS CLI commands
**Solution**: Lambda Function URL at `https://zwkht7afhzzv777hxn6xx56vry0uniix.lambda-url.ca-central-1.on.aws/`

Creates Cognito users + DynamoDB records automatically through admin form.

## Key AWS Resources
- **User Pool**: `ca-central-1_gqbunB8W8` (Groups: Managers, Employees)
- **Employee Table**: `Employee-u6qx457cnnc63grvlgaiwedzgi-NONE`
- **Lambda Function**: `create-employee-function`

## Training Completion Status (Latest Feature)
**Implementation**: Automatic training status updates when employees pass quizzes
- **Mobile App**: `QuizScreen.tsx` updates Assignment status to "completed" and sets `is_training_complete = true` on quiz pass
- **Admin Portal**: `EmployeeList.tsx` displays completion status with "Training Complete ✅" and "READY FOR SCHEDULING" badges
- **Database**: Assignment model includes `is_training_complete` boolean field for scheduling system integration

## Important Notes
- Admin portal requires `amplify_outputs.json` to be copied from parent directory for GraphQL access
- Employee creation uses dual approach: Lambda for Cognito + GraphQL for immediate UI visibility
- Mobile app and admin portal share same Amplify backend resources
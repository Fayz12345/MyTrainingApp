import { defineAuth } from '@aws-amplify/backend';
import { assignEmployeeGroup } from '../functions/assignEmployeeGroup/resource';

/**
 * Define and configure your auth resource
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 * 
 * NOTE: To enable Google OAuth login:
 * 1. Configure Google OAuth in AWS Cognito User Pool (via AWS Console)
 * 2. Add redirect URLs: com.mytrainingapp:// (for Flutter mobile app)
 * 3. The Flutter app will use signInWithWebUI with AuthProvider.google
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
    // Google OAuth must be configured in AWS Cognito User Pool console
    // Go to: Cognito User Pool → App integration → Hosted UI → OAuth 2.0 settings
    // Add Google as an identity provider and configure redirect URLs
  },
  groups: ['Employees', 'Managers', 'Store', 'BusinessUnit', 'SuperAdmin'], // Define user groups for roles
  triggers: {
    postConfirmation: assignEmployeeGroup
  }
});

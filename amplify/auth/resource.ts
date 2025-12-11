import { defineAuth } from '@aws-amplify/backend';
import { assignEmployeeGroup } from '../functions/assignEmployeeGroup/resource';

/**
 * Define and configure your auth resource
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 * 
 * Google OAuth Configuration:
 * 
 * Since externalProviders is not configured here (to avoid sandbox secret permission issues),
 * Google OAuth is configured manually in Cognito. To get OAuth in amplify_outputs.json:
 * 
 * 1. Deploy backend: npx ampx sandbox
 * 2. Configure Google OAuth in Cognito: ./configure-google-oauth.sh
 * 3. Add OAuth to outputs: ./add-oauth-to-outputs.sh
 * 
 * This workflow ensures:
 * - OAuth works in Cognito (configured via AWS CLI)
 * - OAuth appears in amplify_outputs.json (added via script)
 * - No sandbox secret permissions needed
 * 
 * Google Cloud Console Configuration:
 * - Authorized JavaScript Origins: https://mytrainingapp.auth.ca-central-1.amazoncognito.com
 * - Authorized Redirect URIs: https://mytrainingapp.auth.ca-central-1.amazoncognito.com/oauth2/idpresponse
 */

// Get callback and logout URLs from environment or use defaults
const getCallbackUrls = (): string[] => {
  const envUrls = process.env.OAUTH_CALLBACK_URLS;
  if (envUrls) {
    return envUrls.split(',').map(url => url.trim());
  }
  return [
    'http://localhost:3000',
    'https://dev.d6c38s8spsb1t.amplifyapp.com',
    'com.mytrainingapp://',
    'myapp://callback'
  ];
};

const getLogoutUrls = (): string[] => {
  const envUrls = process.env.OAUTH_LOGOUT_URLS;
  if (envUrls) {
    return envUrls.split(',').map(url => url.trim());
  }
  return [
    'http://localhost:3000',
    'https://dev.d6c38s8spsb1t.amplifyapp.com',
    'com.mytrainingapp://'
  ];
};

export const auth = defineAuth({
  loginWith: {
    email: true,
    // Google OAuth is configured manually in Cognito to avoid sandbox secret permission issues
    // Run: ./configure-google-oauth.sh after deployment
    // This will configure Google OAuth and it will appear in amplify_outputs.json
  },
  groups: ['Employees', 'Managers', 'Store', 'BusinessUnit', 'SuperAdmin'], // Define user groups for roles
  triggers: {
    postConfirmation: assignEmployeeGroup
  }
});

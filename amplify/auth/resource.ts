import { defineAuth, secret } from '@aws-amplify/backend';
import { assignEmployeeGroup } from '../functions/assignEmployeeGroup/resource';

/**
 * Define and configure your auth resource
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 * 
 * Google OAuth Configuration:
 * 1. Set up secrets from .env file using: npm run setup-secrets
 *    OR manually: ampx sandbox secret add GOOGLE_CLIENT_ID <your-client-id>
 * 2. Configure Google Cloud Console:
 *    - Authorized JavaScript Origins: https://mytrainingapp.auth.ca-central-1.amazoncognito.com
 *    - Authorized Redirect URIs: https://mytrainingapp.auth.ca-central-1.amazoncognito.com/oauth2/idpresponse
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
    externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
        scopes: ['email', 'profile', 'openid'],
      },
      callbackUrls: getCallbackUrls(),
      logoutUrls: getLogoutUrls(),
    },
  },
  groups: ['Employees', 'Managers', 'Store', 'BusinessUnit', 'SuperAdmin'], // Define user groups for roles
  triggers: {
    postConfirmation: assignEmployeeGroup
  }
});

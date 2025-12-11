import { defineAuth, secret } from '@aws-amplify/backend';
import { assignEmployeeGroup } from '../functions/assignEmployeeGroup/resource';

/**
 * Define and configure your auth resource
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 * 
 * Google OAuth Configuration:
 * 1. Set up secrets using: ampx sandbox secret add GOOGLE_CLIENT_ID <your-client-id>
 * 2. Set up secrets using: ampx sandbox secret add GOOGLE_CLIENT_SECRET <your-client-secret>
 * 3. Configure Google Cloud Console:
 *    - Authorized JavaScript Origins: https://mytrainingapp.auth.ca-central-1.amazoncognito.com
 *    - Authorized Redirect URIs: https://mytrainingapp.auth.ca-central-1.amazoncognito.com/oauth2/idpresponse
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
    externalProviders: {
      google: {
        clientId: secret('64933722244-t2lppekiik9oo1him4jd170tuhomletr.apps.googleusercontent.com'),
        clientSecret: secret('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'),
        scopes: ['email', 'profile', 'openid'],
      },
      callbackUrls: [
        'http://localhost:3000',
        'https://dev.d6c38s8spsb1t.amplifyapp.com',
        'com.mytrainingapp://',
        'myapp://callback'
      ],
      logoutUrls: [
        'http://localhost:3000',
        'https://dev.d6c38s8spsb1t.amplifyapp.com',
        'com.mytrainingapp://', // Flutter mobile app redirect
      ],
    },
  },
  groups: ['Employees', 'Managers', 'Store', 'BusinessUnit', 'SuperAdmin'], // Define user groups for roles
  triggers: {
    postConfirmation: assignEmployeeGroup
  }
});

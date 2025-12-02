import { defineAuth } from '@aws-amplify/backend';
import { assignEmployeeGroup } from '../functions/assignEmployeeGroup/resource';

/**
 * Define and configure your auth resource
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
    oauth: {
      providers: ['Google', 'Apple'],
      scopes: ['email', 'profile', 'openid'],
      redirectSignIn: [
        'com.mytrainingapp://',
        'com.myTrainingApp://',
        'http://localhost:3000/'
      ],
      redirectSignOut: [
        'com.mytrainingapp://',
        'com.myTrainingApp://',
        'http://localhost:3000/'
      ],
    },
  },
  groups: ['Employees', 'Managers', 'Store', 'BusinessUnit', 'SuperAdmin'], // Define user groups for roles
  triggers: {
    postConfirmation: assignEmployeeGroup
  }
});

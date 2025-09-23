import { defineAuth, referenceAuth } from '@aws-amplify/backend';

/**
 * Define and configure your auth resource
 * @see c
 */
export const auth = referenceAuth({
  userPoolId: 'ca-central-1_gqbunB8W8',
  identityPoolId: 'ca-central-1:1591fd5e-28fd-4a40-9bc6-fe092b6ef4e0',
  authRoleArn:
    'arn:aws:iam::216348571084:role/amplify-MyTrainingApp-fay-amplifyAuthauthenticatedU-hPaEMQjurgGi',
  unauthRoleArn:
    'arn:aws:iam::216348571084:role/amplify-MyTrainingApp-fay-amplifyAuthunauthenticate-FczBMKKQDLm4',
  userPoolClientId: '44vfska095jcbkchft96d0ula0',
  groups: {
    Employees:
      'arn:aws:iam::216348571084:role/amplify-MyTrainingApp-fay-amplifyAuthEmployeesGroup-emCoB9LQlkSx',
    Managers:
      'arn:aws:iam::216348571084:role/amplify-MyTrainingApp-fay-amplifyAuthManagersGroupR-vGeGEbb7nvi6',
  },
});

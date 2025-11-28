import { defineFunction } from '@aws-amplify/backend';

/**
 * Lambda function that creates all required Cognito groups on backend deployment
 * This ensures groups exist before users try to use them
 */
export const createCognitoGroups = defineFunction({
  name: 'createCognitoGroups',
  entry: './handler.ts',
  timeoutSeconds: 30
});


import { defineFunction } from '@aws-amplify/backend';

/**
 * Lambda function that adds a user to a Cognito group
 * This function can be called after user creation to assign them to the correct group
 */
export const assignUserToGroup = defineFunction({
  name: 'assignUserToGroup',
  entry: './handler.js',
  runtime: 20
});


import { defineFunction } from '@aws-amplify/backend';

/**
 * Lambda function that automatically assigns new users to the "Employees" group
 * This function is triggered by Cognito's Post Confirmation trigger
 * 
 * It also creates Employee records in DynamoDB for self-signup users
 * 
 * NOTE: AppSync API URL and API key are automatically injected by Amplify Console
 * environment variables for each branch (dev, qa, main).
 * 
 * The handler reads from process.env.APPSYNC_API_URL and process.env.APPSYNC_API_KEY
 * which are automatically set by Amplify during deployment.
 */
export const assignEmployeeGroup = defineFunction({
  name: 'assignEmployeeGroup',
  entry: './handler.js',
  runtime: 20,
  // Environment variables APPSYNC_API_URL and APPSYNC_API_KEY are set automatically
  // by Amplify Console environment variables for each branch
});


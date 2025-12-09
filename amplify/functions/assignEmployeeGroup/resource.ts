import { defineFunction } from '@aws-amplify/backend';

/**
 * Lambda function that automatically assigns new users to the "Employees" group
 * This function is triggered by Cognito's Post Confirmation trigger
 * 
 * It also creates Employee records in DynamoDB for self-signup users
 */
export const assignEmployeeGroup = defineFunction({
  name: 'assignEmployeeGroup',
  // Use the existing JavaScript handler file
  entry: './handler.js',
  environment: {
    // AppSync API configuration for creating Employee records
    APPSYNC_API_URL: 'https://mswo73fsfjh4thfaalt7d63i4a.appsync-api.ca-central-1.amazonaws.com/graphql',
    APPSYNC_API_KEY: 'da2-la7esrklanbehi5v7e574ao7fq'
  }
});


import { defineFunction } from '@aws-amplify/backend';

/**
 * Lambda function to test connectivity to external scheduling system API
 * 
 * This function:
 * 1. Tests API connectivity and authentication
 * 2. Validates endpoint availability
 * 3. Tests POST request to update employee training status
 * 4. Logs results to CloudWatch for analysis
 */
export const schedulingTest = defineFunction({
  name: 'schedulingTest',
  entry: './handler.ts',
  timeoutSeconds: 30,
  environment: {
    SCHEDULING_API_URL: process.env.SCHEDULING_API_URL || 'https://api.example-scheduling.com/v1',
    SCHEDULING_API_TOKEN: process.env.SCHEDULING_API_TOKEN || 'YOUR_TOKEN'
  }
});


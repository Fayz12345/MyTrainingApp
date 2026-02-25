import { defineFunction } from '@aws-amplify/backend';

/**
 * Lambda function to evaluate scheduling eligibility for employees
 * 
 * This function:
 * 1. Checks if all mandatory learning paths are completed
 * 2. Verifies banking information is on file
 * 3. Updates schedulingEligible flag on Employee model
 * 4. Calls Clearview Connect API when employee becomes eligible
 */
export const schedulingEligibility = defineFunction({
  name: 'schedulingEligibility',
  entry: './handler.ts',
  timeoutSeconds: 30,
  environment: {
    SCHEDULING_API_URL: process.env.SCHEDULING_API_URL || 'https://sandbox.clearviewconnect.com/api/v1',
    SCHEDULING_API_TOKEN: process.env.SCHEDULING_API_TOKEN || 'YOUR_TOKEN'
  }
});



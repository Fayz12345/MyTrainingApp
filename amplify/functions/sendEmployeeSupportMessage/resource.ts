import { defineFunction } from '@aws-amplify/backend';

/**
 * Lambda function to send support messages to employees via SES
 * 
 * This function:
 * 1. Receives HTTP POST request with message details
 * 2. Sends support/encouragement email to employee via AWS SES
 * 3. Includes manager's message and course information
 */
export const sendEmployeeSupportMessage = defineFunction({
  name: 'sendEmployeeSupportMessage',
  entry: './handler.ts',
  timeoutSeconds: 10,
  environment: {
    FROM_EMAIL: 'circular360dev@gmail.com' // Verified SES email
  }
});


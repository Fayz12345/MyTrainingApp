import { defineFunction } from '@aws-amplify/backend';

/**
 * Lambda function to send learning path assignment notifications to employees via SES
 * 
 * This function:
 * 1. Receives HTTP POST request with assignment details
 * 2. Sends notification email to employee via AWS SES
 * 3. Includes learning path details, due date, and course count
 */
export const sendLearningPathAssignmentNotification = defineFunction({
  name: 'sendLearningPathAssignmentNotification',
  entry: './handler.ts',
  runtime: 20,
  timeoutSeconds: 15,
  environment: {
    FROM_EMAIL: process.env.FROM_EMAIL || 'circular360dev@gmail.com'
  }
});


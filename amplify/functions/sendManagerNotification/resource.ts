import { defineFunction } from '@aws-amplify/backend';

/**
 * Lambda function to send HTML email notifications to managers via SES
 * 
 * This function:
 * 1. Receives SNS notification from quizCompletion Lambda
 * 2. Extracts manager email and data from MessageAttributes
 * 3. Sends properly formatted HTML email via AWS SES
 * 4. HTML emails render correctly (not raw code) ✅
 */
export const sendManagerNotification = defineFunction({
  name: 'sendManagerNotification',
  entry: './handler.ts',
  runtime: 20,
  timeoutSeconds: 10,
  environment: {
    FROM_EMAIL: 'circular360dev@gmail.com' // Verified SES email
  }
  // Note: After deployment, run ./setup-html-email.sh to:
  // 1. Subscribe Lambda to SNS topic
  // 2. Add SES permissions to Lambda execution role
});


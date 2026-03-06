import { defineFunction } from '@aws-amplify/backend';

/**
 * Lambda function to check certification expiration and send reminders.
 *
 * Runs daily (EventBridge). For each completed learning path assignment with an expiration date:
 * - Sends employee reminder emails at 30, 14, and 7 days before expiration (SES).
 * - At 7 days, notifies manager via SNS.
 * - On expiration, marks assignment as expired and auto re-assigns the learning path.
 *
 * Environment: APPSYNC_API_URL, APPSYNC_API_KEY (set by Amplify or update-lambda-appsync-config.sh),
 * SNS_TOPIC_ARN (manager notifications), FROM_EMAIL (SES sender).
 */
export const certificationExpirationCheck = defineFunction({
  name: 'certificationExpirationCheck',
  entry: './handler.ts',
  timeoutSeconds: 120,
  schedule: 'every day',
  environment: {
    SNS_TOPIC_ARN: process.env.SNS_TOPIC_ARN || '',
    FROM_EMAIL: process.env.FROM_EMAIL || '',
  },
});

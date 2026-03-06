import { defineFunction } from '@aws-amplify/backend';

/**
 * Lambda function to check certification expiration and send reminders.
 *
 * Runs daily (EventBridge). For each completed learning path assignment with an expiration date:
 * - Sends employee reminder emails at 30, 14, and 7 days before expiration (SES).
 * - At 7 days, notifies manager via SNS.
 * - On expiration, marks assignment as expired and auto re-assigns the learning path.
 *
 * Trigger: Add an EventBridge rule to invoke daily (schedule not supported for custom/TS in Gen 2). Cron example: 0 6 * * ? *
 * Environment: APPSYNC_API_URL, APPSYNC_API_KEY (script), SNS_TOPIC_ARN, FROM_EMAIL (defaults below).
 */
export const certificationExpirationCheck = defineFunction({
  name: 'certificationExpirationCheck',
  entry: './handler.ts',
  timeoutSeconds: 120,
  environment: {
    SNS_TOPIC_ARN: process.env.SNS_TOPIC_ARN || 'arn:aws:sns:ca-central-1:216348571084:training-completion-notifications',
    FROM_EMAIL: process.env.FROM_EMAIL || 'circular360dev@gmail.com',
  },
});

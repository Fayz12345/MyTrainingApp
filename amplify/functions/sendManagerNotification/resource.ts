import { defineFunction } from '@aws-amplify/backend';

export const sendManagerNotification = defineFunction({
  name: 'sendManagerNotification',
  entry: './handler.ts',
  timeoutSeconds: 10,
  environment: {
    FROM_EMAIL: 'noreply@yourdomain.com' // Update with your verified SES email
  }
  // Note: SES permissions need to be added to Lambda execution role
  // The Lambda needs: ses:SendEmail, ses:SendRawEmail
});


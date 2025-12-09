import { defineFunction } from "@aws-amplify/backend";

/**
 * Lambda function to send welcome emails to new managers and employees via SES
 * 
 * After deployment, run ./setup-welcome-email.sh to:
 * 1. Create Function URL for HTTP access
 * 2. Add SES send permissions to Lambda execution role
 * 3. Update frontend .env file with Function URL
 */
export const sendWelcomeEmail = defineFunction({
  name: "sendWelcomeEmail", // Lambda name in AWS
  entry: "./handler.ts",    // Your handler file
  timeoutSeconds: 10,
  environment: {
    FROM_EMAIL: "circular360dev@gmail.com", // SES Verified Email (must be verified in SES)
  }
  // Note: After deployment, run ./setup-welcome-email.sh to configure:
  // - Function URL (for frontend HTTP calls)
  // - SES permissions (ses:SendEmail, ses:SendRawEmail)
  // - Frontend .env file update
});

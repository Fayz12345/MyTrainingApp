import { defineFunction } from "@aws-amplify/backend";

export const sendWelcomeEmail = defineFunction({
  name: "sendWelcomeEmail", // Lambda name in AWS
  entry: "./handler.ts",    // Your handler file
  environment: {
    FROM_EMAIL: "circular360dev@gmail.com", // SES Verified Email
  }
  // Note: Add SES send permissions to this Lambda's execution role in AWS Console
  // or via CDK/inline policy after deployment (ses:SendEmail, ses:SendRawEmail).
});

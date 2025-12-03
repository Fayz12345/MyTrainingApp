/**
 * Lambda function to send welcome email to manager via SES
 * 
 * This function is called automatically when a manager is created
 * to send them a welcome email via SES (no confirmation needed).
 * 
 * Note: We use SES instead of SNS email subscriptions because:
 * - SES emails work immediately (no confirmation needed)
 * - SNS email subscriptions require manual confirmation
 * - SES provides better control over email content
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const sesClient = new SESClient({ region: 'ca-central-1' });

// SES Configuration
const FROM_EMAIL = process.env.FROM_EMAIL || 'circular360dev@gmail.com';

interface SubscribeManagerEvent {
  email: string;
  name?: string;
  managerId?: string;
}

interface SubscriptionResult {
  success: boolean;
  sesMessageId?: string;
  message?: string;
  error?: string;
}

export const handler = async (event: any): Promise<SubscriptionResult> => {
  const logPrefix = '[SEND_MANAGER_WELCOME_EMAIL]';
  console.log(`${logPrefix} ========================================`);
  console.log(`${logPrefix} 📧 Sending Welcome Email to Manager via SES`);
  console.log(`${logPrefix} Raw Event:`, JSON.stringify(event, null, 2));
  console.log(`${logPrefix} ========================================`);

  try {
    // Handle Function URL invocation (HTTP event with body)
    let requestData: SubscribeManagerEvent;
    
    if (event.body) {
      // Function URL invocation - body is a JSON string
      console.log(`${logPrefix} [PARSING] Parsing Function URL event body...`);
      requestData = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      console.log(`${logPrefix} [PARSING] Parsed data:`, JSON.stringify(requestData, null, 2));
    } else if (event.email) {
      // Direct invocation (for testing)
      requestData = event as SubscribeManagerEvent;
    } else {
      throw new Error('Invalid event format. Expected email in event.body or event.email');
    }

    // Validate input
    if (!requestData.email) {
      console.error(`${logPrefix} [VALIDATION] Email missing in request data`);
      console.error(`${logPrefix} [VALIDATION] Request data:`, JSON.stringify(requestData, null, 2));
      throw new Error('Email is required');
    }

    const email = requestData.email.toLowerCase().trim();
    const managerName = requestData.name || 'Manager';

    console.log(`${logPrefix} [STEP 1] Validating input...`);
    console.log(`${logPrefix} [STEP 1] Email: ${email}`);
    console.log(`${logPrefix} [STEP 1] Manager Name: ${managerName}`);

    // Skip SNS email subscriptions - we use SES for direct email delivery
    // SNS email subscriptions require manual confirmation, which is not ideal
    // SES emails work immediately without confirmation
    console.log(`${logPrefix} [STEP 2] Skipping SNS email subscription (using SES instead)`);
    console.log(`${logPrefix} [STEP 2] SNS email subscriptions require confirmation - SES does not`);

    // Send welcome email via SES (no confirmation needed)
    console.log(`${logPrefix} [STEP 3] Sending welcome email via SES...`);
    let sesMessageId: string | undefined;
    try {
      const emailSubject = `Welcome to Training Notifications - ${managerName}`;
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Welcome to Training Notifications</h2>
            </div>
            <div class="content">
              <p>Dear ${managerName},</p>
              <p>You have been set up to receive training completion notifications.</p>
              <p>You will receive email notifications automatically when employees under your management complete their training courses and pass quizzes.</p>
              <p>No confirmation is required - you're all set!</p>
              <p>Thank you for using the Training Management System.</p>
            </div>
            <div class="footer">
              <p>This is an automated notification from the Training Management System.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const emailText = `
Welcome to Training Notifications

Dear ${managerName},

You have been set up to receive training completion notifications.

You will receive email notifications automatically when employees under your management complete their training courses and pass quizzes.

No confirmation is required - you're all set!

Thank you for using the Training Management System.
      `.trim();

      const sendEmailCommand = new SendEmailCommand({
        Source: FROM_EMAIL,
        Destination: {
          ToAddresses: [email]
        },
        Message: {
          Subject: {
            Data: emailSubject,
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: emailHtml,
              Charset: 'UTF-8'
            },
            Text: {
              Data: emailText,
              Charset: 'UTF-8'
            }
          }
        }
      });

      const sesResponse = await sesClient.send(sendEmailCommand);
      sesMessageId = sesResponse.MessageId;
      console.log(`${logPrefix} [STEP 3] ✅ Welcome email sent via SES`);
      console.log(`${logPrefix} [STEP 3] SES MessageId: ${sesMessageId}`);
    } catch (sesError: any) {
      // Critical - if SES fails, we should know about it
      console.error(`${logPrefix} [STEP 3] ❌ Failed to send welcome email via SES:`, sesError?.message);
      console.error(`${logPrefix} [STEP 3] SES Error:`, sesError);
      throw new Error(`Failed to send welcome email: ${sesError?.message || 'Unknown error'}`);
    }

    console.log(`${logPrefix} ========================================`);
    console.log(`${logPrefix} ✅ PROCESS COMPLETE`);
    console.log(`${logPrefix} ========================================`);

    return {
      success: true,
      sesMessageId,
      message: 'Welcome email sent successfully via SES. No confirmation required.'
    };
  } catch (error: any) {
    console.error(`${logPrefix} ========================================`);
    console.error(`${logPrefix} ❌ ERROR SENDING WELCOME EMAIL`);
    console.error(`${logPrefix} Error:`, error);
    console.error(`${logPrefix} Error message:`, error?.message);
    console.error(`${logPrefix} Stack:`, error?.stack);
    console.error(`${logPrefix} ========================================`);

    return {
      success: false,
      error: error?.message || 'Unknown error',
      message: `Failed to send welcome email: ${error?.message || 'Unknown error'}`
    };
  }
};

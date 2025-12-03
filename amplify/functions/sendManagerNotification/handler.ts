/**
 * Lambda function to send email notifications to managers via SES
 * This replaces the need for SNS email subscriptions (which require confirmation)
 * 
 * This function:
 * 1. Receives SNS notification from quizCompletion Lambda
 * 2. Extracts manager email from the notification
 * 3. Sends email directly via AWS SES
 * 4. No confirmation required ✅
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const sesClient = new SESClient({ region: 'ca-central-1' });

// Email sender (must be verified in SES)
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@yourdomain.com';

interface SNSEvent {
  Records: Array<{
    Sns: {
      Message: string;
      Subject?: string;
      MessageAttributes?: any;
    };
  }>;
}

interface QuizCompletionMessage {
  employeeName?: string;
  courseTitle?: string;
  score?: number;
  managerEmail?: string;
  managerName?: string;
}

export const handler = async (event: SNSEvent) => {
  const logPrefix = '[SEND_MANAGER_NOTIFICATION]';
  console.log(`${logPrefix} ========================================`);
  console.log(`${logPrefix} 📧 Sending Manager Notification via SES`);
  console.log(`${logPrefix} Event:`, JSON.stringify(event, null, 2));
  console.log(`${logPrefix} ========================================`);

  try {
    // Parse SNS message
    const snsRecord = event.Records[0];
    const message: QuizCompletionMessage = JSON.parse(snsRecord.Sns.Message);
    
    const managerEmail = message.managerEmail || 
      snsRecord.Sns.MessageAttributes?.managerEmail?.Value;
    const employeeName = message.employeeName || 'Employee';
    const courseTitle = message.courseTitle || 'Course';
    const score = message.score || 0;
    const managerName = message.managerName || 'Manager';

    if (!managerEmail) {
      console.error(`${logPrefix} ❌ No manager email found in message`);
      return { status: 'error', message: 'No manager email found' };
    }

    console.log(`${logPrefix} [STEP 1] Preparing email...`);
    console.log(`${logPrefix} [STEP 1] To: ${managerEmail}`);
    console.log(`${logPrefix} [STEP 1] Employee: ${employeeName}`);
    console.log(`${logPrefix} [STEP 1] Course: ${courseTitle}`);
    console.log(`${logPrefix} [STEP 1] Score: ${score}%`);

    // Create email content
    const subject = `Training Completed: ${employeeName} - ${courseTitle}`;
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .info { margin: 10px 0; }
          .score { font-size: 24px; font-weight: bold; color: #4CAF50; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>🎉 Training Completion Notification</h2>
          </div>
          <div class="content">
            <p>Dear ${managerName},</p>
            <p>We're pleased to inform you that an employee has successfully completed their training.</p>
            
            <div class="info">
              <strong>Employee:</strong> ${employeeName}<br>
              <strong>Course:</strong> ${courseTitle}<br>
              <strong>Score:</strong> <span class="score">${score}%</span><br>
              <strong>Status:</strong> ✅ Passed
            </div>
            
            <p>The employee has successfully completed the training course and passed the quiz.</p>
            <p>This completion has been logged in the system for scheduling API validation.</p>
          </div>
          <div class="footer">
            <p>This is an automated notification from the Training Management System.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textBody = `
Training Completion Notification

Employee: ${employeeName}
Course: ${courseTitle}
Score: ${score}%
Status: Passed ✅

The employee has successfully completed the training course and passed the quiz.

This completion has been logged in the system for scheduling API validation.
    `.trim();

    // Send email via SES
    console.log(`${logPrefix} [STEP 2] Sending email via SES...`);
    const sendCommand = new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: [managerEmail]
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8'
          },
          Text: {
            Data: textBody,
            Charset: 'UTF-8'
          }
        }
      }
    });

    const result = await sesClient.send(sendCommand);
    console.log(`${logPrefix} [STEP 2] ✅ Email sent successfully`);
    console.log(`${logPrefix} [STEP 2] MessageId: ${result.MessageId}`);

    console.log(`${logPrefix} ========================================`);
    console.log(`${logPrefix} ✅ PROCESS COMPLETE`);
    console.log(`${logPrefix} ========================================`);

    return {
      status: 'success',
      messageId: result.MessageId,
      managerEmail,
      employeeName,
      courseTitle
    };
  } catch (error: any) {
    console.error(`${logPrefix} ========================================`);
    console.error(`${logPrefix} ❌ ERROR SENDING EMAIL`);
    console.error(`${logPrefix} Error:`, error);
    console.error(`${logPrefix} Error message:`, error?.message);
    console.error(`${logPrefix} Stack:`, error?.stack);
    console.error(`${logPrefix} ========================================`);

    return {
      status: 'error',
      error: error?.message || 'Unknown error'
    };
  }
};


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
    const rawMessage = snsRecord.Sns.Message;
    const messageAttributes = snsRecord.Sns.MessageAttributes || {};
    
    // Try to parse as JSON first (for backward compatibility)
    // If it fails (e.g., HTML message), extract from MessageAttributes
    let message: QuizCompletionMessage = {};
    let useMessageAttributes = false;
    
    try {
      message = JSON.parse(rawMessage);
      console.log(`${logPrefix} [PARSING] Successfully parsed JSON message`);
    } catch (parseError) {
      console.log(`${logPrefix} [PARSING] Message is not JSON (likely HTML), extracting from MessageAttributes`);
      useMessageAttributes = true;
    }
    
    // Extract data from MessageAttributes (always available) or parsed JSON message
    // MessageAttributes structure: { key: { Type: 'String', Value: '...' } }
    const getFromAttributes = (key: string): string | null => {
      const attr = messageAttributes[key];
      return (attr && attr.Value !== undefined) ? attr.Value : null;
    };
    
    // Extract values: MessageAttributes are always populated, use as primary source
    // Fall back to parsed JSON message if available (for backward compatibility)
    const managerEmail = getFromAttributes('managerEmail') || message.managerEmail || null;
    const employeeName = getFromAttributes('employeeName') || message.employeeName || 'Employee';
    const courseTitle = getFromAttributes('courseTitle') || message.courseTitle || 'Course';
    const scoreStr = getFromAttributes('score') || message.score?.toString() || '0';
    const score = parseInt(scoreStr) || 0;
    const managerName = getFromAttributes('managerName') || message.managerName || 'Manager';
    
    console.log(`${logPrefix} [EXTRACTION] Extracted data:`, {
      managerEmail,
      employeeName,
      courseTitle,
      score,
      managerName,
      source: useMessageAttributes ? 'MessageAttributes' : 'JSON Message'
    });

    if (!managerEmail) {
      console.error(`${logPrefix} ❌ No manager email found in message`);
      return { status: 'error', message: 'No manager email found' };
    }

    console.log(`${logPrefix} [STEP 1] Preparing email...`);
    console.log(`${logPrefix} [STEP 1] To: ${managerEmail}`);
    console.log(`${logPrefix} [STEP 1] Employee: ${employeeName}`);
    console.log(`${logPrefix} [STEP 1] Course: ${courseTitle}`);
    console.log(`${logPrefix} [STEP 1] Score: ${score}%`);

    // Create email content with HTML table format
    const subject = `Training Completed: ${employeeName} - ${courseTitle}`;
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      background-color: #4CAF50;
      color: white;
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      padding: 30px 20px;
    }
    .greeting {
      margin-bottom: 20px;
      font-size: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      background-color: #ffffff;
    }
    th {
      background-color: #4CAF50;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: bold;
      border: 1px solid #45a049;
    }
    td {
      padding: 12px;
      border: 1px solid #ddd;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    .score-cell {
      font-size: 18px;
      font-weight: bold;
      color: #4CAF50;
    }
    .status-cell {
      color: #4CAF50;
      font-weight: bold;
    }
    .footer {
      background-color: #f9f9f9;
      padding: 20px;
      text-align: center;
      color: #666;
      font-size: 12px;
      border-top: 1px solid #ddd;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Training Completion Notification</h1>
    </div>
    <div class="content">
      <p class="greeting">Dear ${managerName},</p>
      <p>We're pleased to inform you that an employee has successfully completed their training.</p>
      
      <table>
        <tr>
          <th>Field</th>
          <th>Value</th>
        </tr>
        <tr>
          <td><strong>Employee Name</strong></td>
          <td>${employeeName}</td>
        </tr>
        <tr>
          <td><strong>Course Title</strong></td>
          <td>${courseTitle}</td>
        </tr>
        <tr>
          <td><strong>Score</strong></td>
          <td class="score-cell">${score}%</td>
        </tr>
        <tr>
          <td><strong>Status</strong></td>
          <td class="status-cell">✅ Passed</td>
        </tr>
      </table>
      
      <p>The employee has successfully completed the training course and passed the quiz.</p>
      <p>This completion has been logged in the system for scheduling API validation.</p>
    </div>
    <div class="footer">
      <p>This is an automated notification from the Training Management System.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

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


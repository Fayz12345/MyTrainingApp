/**
 * Lambda function to send support messages to employees via SES
 * 
 * This function:
 * 1. Receives HTTP POST request with message details
 * 2. Sends support/encouragement email to employee via AWS SES
 * 3. Includes manager's message and course information
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const sesClient = new SESClient({ region: 'ca-central-1' });

// Email sender (must be verified in SES)
const FROM_EMAIL = process.env.FROM_EMAIL || 'circular360dev@gmail.com';

interface EmployeeSupportMessageRequest {
  employeeEmail: string;
  employeeName: string;
  managerName?: string;
  courseTitle?: string;
  message: string;
  supportReason?: string;
}

interface LambdaEvent {
  httpMethod?: string;
  body?: string | any;
  requestContext?: {
    http?: {
      method?: string;
      path?: string;
    };
  };
  headers?: Record<string, string>;
  rawPath?: string;
  rawQueryString?: string;
  isBase64Encoded?: boolean;
}

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

export const handler = async (event: LambdaEvent) => {
  const logPrefix = '[SEND_EMPLOYEE_SUPPORT_MESSAGE]';
  console.log(`${logPrefix} ========================================`);
  console.log(`${logPrefix} 📧 Sending Employee Support Message via SES`);
  console.log(`${logPrefix} Event:`, JSON.stringify(event, null, 2));
  console.log(`${logPrefix} ========================================`);

  // Handle CORS preflight OPTIONS request
  const httpMethod = event.httpMethod || event.requestContext?.http?.method;
  if (httpMethod === 'OPTIONS') {
    console.log(`${logPrefix} Handling CORS preflight request`);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'CORS preflight successful' })
    };
  }

  try {
    // Parse request body
    let requestBody: EmployeeSupportMessageRequest;
    
    let bodyData: any = null;
    
    if (event.body) {
      if (typeof event.body === 'string') {
        try {
          bodyData = JSON.parse(event.body);
        } catch (parseError) {
          console.error(`${logPrefix} ❌ Failed to parse request body:`, parseError);
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({
              success: false,
              error: 'Invalid JSON in request body'
            })
          };
        }
      } else {
        bodyData = event.body;
      }
    }
    
    if (!bodyData) {
      console.error(`${logPrefix} ❌ Request body is missing`);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Request body is required'
        })
      };
    }

    requestBody = bodyData as EmployeeSupportMessageRequest;

    // Validate required fields
    if (!requestBody.employeeEmail || !requestBody.employeeName || !requestBody.message) {
      console.error(`${logPrefix} ❌ Missing required fields`);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: employeeEmail, employeeName, and message are required'
        })
      };
    }

    console.log(`${logPrefix} [STEP 1] ✅ Request validated`);
    console.log(`${logPrefix} [STEP 1] Employee: ${requestBody.employeeName} (${requestBody.employeeEmail})`);
    console.log(`${logPrefix} [STEP 1] Course: ${requestBody.courseTitle || 'N/A'}`);
    console.log(`${logPrefix} [STEP 1] Manager: ${requestBody.managerName || 'N/A'}`);

    // Format the email subject
    const subject = requestBody.courseTitle 
      ? `Support Message: ${requestBody.courseTitle}`
      : 'Support Message from Your Manager';

    // Create HTML email body
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f4f4f4;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      background-color: #4CAF50;
      color: white;
      padding: 20px;
      border-radius: 8px 8px 0 0;
      margin: -30px -30px 20px -30px;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      margin: 20px 0;
    }
    .message-box {
      background-color: #f9f9f9;
      border-left: 4px solid #4CAF50;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .message-box p {
      margin: 0;
      white-space: pre-wrap;
    }
    .course-info {
      background-color: #e3f2fd;
      padding: 15px;
      border-radius: 4px;
      margin: 20px 0;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 12px;
      color: #666;
      text-align: center;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #4CAF50;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Support Message from Your Manager</h1>
    </div>
    <div class="content">
      <p>Dear ${requestBody.employeeName},</p>
      
      ${requestBody.courseTitle ? `
      <div class="course-info">
        <strong>Course:</strong> ${requestBody.courseTitle}
        ${requestBody.supportReason ? `<br><strong>Reason:</strong> ${requestBody.supportReason}` : ''}
      </div>
      ` : ''}
      
      <p>Your manager has sent you the following message:</p>
      
      <div class="message-box">
        <p>${requestBody.message.replace(/\n/g, '<br>')}</p>
      </div>
      
      <p>We're here to support you in your learning journey. If you have any questions or need additional assistance, please don't hesitate to reach out.</p>
      
      <a href="#" class="button">Access Training Portal</a>
      
      ${requestBody.managerName ? `
      <p style="margin-top: 30px; font-size: 14px; color: #666;">
        Best regards,<br>
        ${requestBody.managerName}
      </p>
      ` : ''}
    </div>
    <div class="footer">
      <p>This is an automated notification from the Training Management System.</p>
      <p>Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    const textBody = `
Support Message from Your Manager

Dear ${requestBody.employeeName},

${requestBody.courseTitle ? `Course: ${requestBody.courseTitle}\n${requestBody.supportReason ? `Reason: ${requestBody.supportReason}\n` : ''}\n` : ''}
Your manager has sent you the following message:

${requestBody.message}

We're here to support you in your learning journey. If you have any questions or need additional assistance, please don't hesitate to reach out.

Access your training portal to continue your learning.

${requestBody.managerName ? `\nBest regards,\n${requestBody.managerName}` : ''}

---
This is an automated notification from the Training Management System.
Please do not reply to this email.
    `.trim();

    console.log(`${logPrefix} [STEP 2] Sending email via SES...`);
    console.log(`${logPrefix} [STEP 2] From: ${FROM_EMAIL}`);
    console.log(`${logPrefix} [STEP 2] To: ${requestBody.employeeEmail}`);

    const emailCommand = new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: [requestBody.employeeEmail]
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

    const response = await sesClient.send(emailCommand);
    console.log(`${logPrefix} [STEP 3] ✅ Email sent successfully`);
    console.log(`${logPrefix} [STEP 3] MessageId: ${response.MessageId}`);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Support message sent successfully',
        messageId: response.MessageId
      })
    };

  } catch (error: any) {
    console.error(`${logPrefix} ========================================`);
    console.error(`${logPrefix} ❌ ERROR SENDING EMAIL`);
    console.error(`${logPrefix} Error:`, error);
    console.error(`${logPrefix} Error message:`, error?.message);
    console.error(`${logPrefix} Stack:`, error?.stack);
    console.error(`${logPrefix} ========================================`);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: error?.message || 'Unknown error occurred'
      })
    };
  }
};


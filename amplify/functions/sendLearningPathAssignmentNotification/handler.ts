/**
 * Lambda function to send learning path assignment notifications to employees via SES
 * 
 * This function:
 * 1. Receives HTTP POST request with assignment details
 * 2. Sends notification email to employee via AWS SES
 * 3. Includes learning path details, due date, and course count
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const sesClient = new SESClient({ region: 'ca-central-1' });

// Email sender (must be verified in SES)
const FROM_EMAIL = process.env.FROM_EMAIL || 'circular360dev@gmail.com';

interface LearningPathAssignmentRequest {
  employeeEmail: string;
  employeeName: string;
  learningPathTitle: string;
  learningPathDescription?: string;
  courseCount: number;
  dueDate?: string;
  isSequential?: boolean;
  assignmentId?: string;
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
  const logPrefix = '[SEND_LEARNING_PATH_NOTIFICATION]';
  console.log(`${logPrefix} ========================================`);
  console.log(`${logPrefix} 📧 Sending Learning Path Assignment Notification via SES`);
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
    let requestBody: LearningPathAssignmentRequest;
    
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

    requestBody = bodyData as LearningPathAssignmentRequest;

    // Validate required fields
    if (!requestBody.employeeEmail || !requestBody.employeeName || !requestBody.learningPathTitle) {
      console.error(`${logPrefix} ❌ Missing required fields`);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: employeeEmail, employeeName, learningPathTitle'
        })
      };
    }

    console.log(`${logPrefix} [STEP 1] Preparing email...`);
    console.log(`${logPrefix} [STEP 1] To: ${requestBody.employeeEmail}`);
    console.log(`${logPrefix} [STEP 1] Employee: ${requestBody.employeeName}`);
    console.log(`${logPrefix} [STEP 1] Learning Path: ${requestBody.learningPathTitle}`);
    console.log(`${logPrefix} [STEP 1] Courses: ${requestBody.courseCount}`);

    // Format due date if provided
    let formattedDueDate = 'No due date specified';
    if (requestBody.dueDate) {
      try {
        const dueDate = new Date(requestBody.dueDate);
        formattedDueDate = dueDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      } catch (e) {
        formattedDueDate = requestBody.dueDate;
      }
    }

    // Create email content
    const subject = `New Learning Path Assigned: ${requestBody.learningPathTitle}`;
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
      background-color: #2196F3;
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
    .info-box {
      background-color: #f9f9f9;
      border-left: 4px solid #2196F3;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .info-box h2 {
      margin: 0 0 10px 0;
      color: #2196F3;
      font-size: 20px;
    }
    .info-item {
      margin: 10px 0;
      font-size: 14px;
    }
    .info-item strong {
      color: #555;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #2196F3;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      margin: 20px 0;
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
    .note {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📚 New Learning Path Assigned</h1>
    </div>
    <div class="content">
      <p class="greeting">Dear ${requestBody.employeeName},</p>
      
      <p>You have been assigned a new learning path. Please review the details below:</p>
      
      <div class="info-box">
        <h2>${requestBody.learningPathTitle}</h2>
        ${requestBody.learningPathDescription ? `<p style="color: #666; margin-top: 10px;">${requestBody.learningPathDescription}</p>` : ''}
      </div>
      
      <div class="info-item">
        <strong>Number of Courses:</strong> ${requestBody.courseCount} course${requestBody.courseCount !== 1 ? 's' : ''}
      </div>
      
      <div class="info-item">
        <strong>Due Date:</strong> ${formattedDueDate}
      </div>
      
      ${requestBody.isSequential ? `
      <div class="note">
        <strong>📋 Important:</strong> This is a sequential learning path. You must complete courses in order.
      </div>
      ` : ''}
      
      <p>Please log in to your training portal to begin your learning path.</p>
      
      <a href="#" class="button">Access Learning Path</a>
      
      <p style="margin-top: 30px; font-size: 14px; color: #666;">
        If you have any questions, please contact your manager.
      </p>
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
New Learning Path Assigned

Dear ${requestBody.employeeName},

You have been assigned a new learning path: ${requestBody.learningPathTitle}

${requestBody.learningPathDescription ? `Description: ${requestBody.learningPathDescription}\n` : ''}
Number of Courses: ${requestBody.courseCount} course${requestBody.courseCount !== 1 ? 's' : ''}
Due Date: ${formattedDueDate}
${requestBody.isSequential ? '\nImportant: This is a sequential learning path. You must complete courses in order.\n' : ''}

Please log in to your training portal to begin your learning path.

If you have any questions, please contact your manager.

---
This is an automated notification from the Training Management System.
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
        message: 'Notification sent successfully',
        messageId: response.MessageId
      })
    };

  } catch (error: any) {
    console.error(`${logPrefix} ❌ Error sending notification:`, error);
    console.error(`${logPrefix} Error details:`, {
      name: error?.name,
      message: error?.message,
      stack: error?.stack
    });

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: error?.message || 'Failed to send notification',
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      })
    };
  }
};


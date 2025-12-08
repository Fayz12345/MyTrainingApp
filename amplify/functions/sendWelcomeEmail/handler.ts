/**
 * Lambda function to send welcome emails to new managers and employees via SES
 * 
 * This function:
 * 1. Receives HTTP POST request with user details (email, name, password, role)
 * 2. Sends welcome email with login credentials via AWS SES
 * 3. No confirmation required ✅
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const sesClient = new SESClient({ region: 'ca-central-1' });

// Email sender (must be verified in SES)
const FROM_EMAIL = process.env.FROM_EMAIL || 'circular360dev@gmail.com';

interface WelcomeEmailRequest {
  email: string;
  name: string;
  password: string;
  role: 'manager' | 'employee';
  loginUrl?: string;
}

interface LambdaEvent {
  httpMethod?: string;
  body?: string;
  requestContext?: {
    http?: {
      method?: string;
    };
  };
}

export const handler = async (event: LambdaEvent) => {
  const logPrefix = '[SEND_WELCOME_EMAIL]';
  console.log(`${logPrefix} ========================================`);
  console.log(`${logPrefix} 📧 Sending Welcome Email via SES`);
  console.log(`${logPrefix} Event:`, JSON.stringify(event, null, 2));
  console.log(`${logPrefix} ========================================`);

  try {
    // Parse request body
    let requestBody: WelcomeEmailRequest;
    
    // Handle both API Gateway and Function URL formats
    if (event.body) {
      try {
        requestBody = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      } catch (parseError) {
        console.error(`${logPrefix} ❌ Failed to parse request body:`, parseError);
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            success: false,
            error: 'Invalid JSON in request body'
          })
        };
      }
    } else {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Request body is required'
        })
      };
    }

    const { email, name, password, role, loginUrl } = requestBody;

    // Validate required fields
    if (!email || !name || !password || !role) {
      console.error(`${logPrefix} ❌ Missing required fields`);
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: email, name, password, and role are required'
        })
      };
    }

    console.log(`${logPrefix} [STEP 1] Preparing welcome email...`);
    console.log(`${logPrefix} [STEP 1] To: ${email}`);
    console.log(`${logPrefix} [STEP 1] Name: ${name}`);
    console.log(`${logPrefix} [STEP 1] Role: ${role}`);

    // Determine login URL based on role
    const defaultLoginUrl = role === 'manager' 
      ? 'https://admin.yourdomain.com/login' 
      : 'https://app.yourdomain.com/login';
    const finalLoginUrl = loginUrl || defaultLoginUrl;

    // Create email content
    const roleDisplayName = role === 'manager' ? 'Manager' : 'Employee';
    const subject = `Welcome to the Training Management System - ${roleDisplayName} Account Created`;
    
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
      background-color: #1976d2;
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
    .credentials-box {
      background-color: #f5f5f5;
      border: 2px solid #1976d2;
      border-radius: 6px;
      padding: 20px;
      margin: 20px 0;
    }
    .credential-item {
      margin: 10px 0;
      font-size: 14px;
    }
    .credential-label {
      font-weight: bold;
      color: #555;
      display: inline-block;
      width: 100px;
    }
    .credential-value {
      color: #1976d2;
      font-weight: bold;
      font-family: 'Courier New', monospace;
    }
    .password-warning {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 12px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .login-button {
      display: inline-block;
      background-color: #1976d2;
      color: white;
      padding: 12px 30px;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
      font-weight: bold;
      text-align: center;
    }
    .login-button:hover {
      background-color: #1565c0;
    }
    .footer {
      background-color: #f9f9f9;
      padding: 20px;
      text-align: center;
      color: #666;
      font-size: 12px;
      border-top: 1px solid #ddd;
    }
    .instructions {
      margin: 20px 0;
      padding: 15px;
      background-color: #e3f2fd;
      border-radius: 4px;
    }
    .instructions ol {
      margin: 10px 0;
      padding-left: 20px;
    }
    .instructions li {
      margin: 8px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Welcome to the Training Management System!</h1>
    </div>
    <div class="content">
      <p class="greeting">Dear ${name},</p>
      <p>Your ${roleDisplayName} account has been successfully created. You can now access the system using the credentials below:</p>
      
      <div class="credentials-box">
        <div class="credential-item">
          <span class="credential-label">Email:</span>
          <span class="credential-value">${email}</span>
        </div>
        <div class="credential-item">
          <span class="credential-label">Password:</span>
          <span class="credential-value">${password}</span>
        </div>
        <div class="credential-item">
          <span class="credential-label">Role:</span>
          <span class="credential-value">${roleDisplayName}</span>
        </div>
      </div>

      <div class="password-warning">
        <strong>⚠️ Important:</strong> Please change your password after your first login for security purposes.
      </div>

      <div style="text-align: center;">
        <a href="${finalLoginUrl}" class="login-button">Login to System</a>
      </div>

      <div class="instructions">
        <strong>Getting Started:</strong>
        <ol>
          <li>Click the "Login to System" button above or visit: <a href="${finalLoginUrl}">${finalLoginUrl}</a></li>
          <li>Enter your email and temporary password</li>
          <li>You will be prompted to change your password on first login</li>
          <li>Start exploring the training management system!</li>
        </ol>
      </div>

      <p>If you have any questions or need assistance, please contact your system administrator.</p>
      
      <p>Best regards,<br>The Training Management System Team</p>
    </div>
    <div class="footer">
      <p>This is an automated email from the Training Management System.</p>
      <p>Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    const textBody = `
Welcome to the Training Management System!

Dear ${name},

Your ${roleDisplayName} account has been successfully created. You can now access the system using the credentials below:

Email: ${email}
Password: ${password}
Role: ${roleDisplayName}

⚠️ Important: Please change your password after your first login for security purposes.

Login URL: ${finalLoginUrl}

Getting Started:
1. Visit the login URL: ${finalLoginUrl}
2. Enter your email and temporary password
3. You will be prompted to change your password on first login
4. Start exploring the training management system!

If you have any questions or need assistance, please contact your system administrator.

Best regards,
The Training Management System Team

---
This is an automated email from the Training Management System.
Please do not reply to this email.
    `.trim();

    // Send email via SES
    console.log(`${logPrefix} [STEP 2] Sending email via SES...`);
    const sendCommand = new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: [email]
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
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        messageId: result.MessageId,
        email,
        name,
        role
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
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: error?.message || 'Unknown error'
      })
    };
  }
};


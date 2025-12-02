import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import https from 'https';

const snsClient = new SNSClient({ region: 'ca-central-1' });

// Get AppSync API endpoint and API key from environment variables
const APPSYNC_ENDPOINT = process.env.APPSYNC_API_URL || 
  'https://mswo73fsfjh4thfaalt7d63i4a.appsync-api.ca-central-1.amazonaws.com/graphql';
const APPSYNC_API_KEY = process.env.APPSYNC_API_KEY || 'da2-la7esrklanbehi5v7e574ao7fq';

interface QuizCompletionEvent {
  assignmentId: string;
  employeeId: string;
  courseId: string;
  score: number;
  passed: boolean;
}

export const handler = async (event: QuizCompletionEvent) => {
  const logPrefix = '[QUIZ_COMPLETION]';
  console.log(`${logPrefix} ========================================`);
  console.log(`${logPrefix} 🎯 Quiz Completion Event Received`);
  console.log(`${logPrefix} Event:`, JSON.stringify(event, null, 2));
  console.log(`${logPrefix} ========================================`);

  try {
    // Only process if quiz was passed
    if (!event.passed) {
      console.log(`${logPrefix} Quiz not passed (score: ${event.score}). No notification sent.`);
      console.log(`${logPrefix} ✅ Completion logged for future API validation (failed quiz)`);
      return { 
        status: 'success', 
        message: 'Quiz not passed - no notification sent',
        logged: true 
      };
    }

    console.log(`${logPrefix} [STEP 1] Quiz passed! Fetching employee and course details...`);
    
    // Fetch assignment details with employee and course information
    const assignmentQuery = {
      query: `
        query GetAssignmentDetails($assignmentId: ID!) {
          getAssignment(id: $assignmentId) {
            id
            employeeId
            courseId
            status
            employee {
              id
              name
              email
              managerId
              manager {
                id
                name
                email
              }
            }
            course {
              id
              title
            }
          }
        }
      `,
      variables: { assignmentId: event.assignmentId }
    };

    console.log(`${logPrefix} [STEP 1.1] Querying AppSync for assignment details...`);
    const assignmentData = await queryAppSync(assignmentQuery);
    
    if (!assignmentData?.data?.getAssignment) {
      throw new Error('Assignment not found');
    }

    const assignment = assignmentData.data.getAssignment;
    const employeeName = assignment.employee?.name || 'Unknown Employee';
    const courseTitle = assignment.course?.title || 'Unknown Course';
    const managerEmail = assignment.employee?.manager?.email;
    const managerName = assignment.employee?.manager?.name || 'Manager';

    console.log(`${logPrefix} [STEP 1.2] Details retrieved:`, {
      employeeName,
      courseTitle,
      managerEmail,
      managerName
    });

    // Log completion for future scheduling API validation
    console.log(`${logPrefix} [STEP 1.3] ✅ Training completion logged for future API validation`);
    console.log(`${logPrefix} [STEP 1.3] Employee: ${employeeName}, Course: ${courseTitle}, Score: ${event.score}%`);

    if (!managerEmail) {
      console.warn(`${logPrefix} [STEP 1.4] ⚠️ No manager email found. Employee may not have a manager assigned.`);
      return {
        status: 'success',
        message: 'Training completed but no manager email found',
        logged: true,
        employeeName,
        courseTitle,
        score: event.score
      };
    }

    console.log(`${logPrefix} [STEP 2] Preparing SNS notification...`);
    
    // Get SNS Topic ARN from environment variable
    const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
    
    if (!SNS_TOPIC_ARN || SNS_TOPIC_ARN === 'YOUR_SNS_TOPIC_ARN') {
      console.warn(`${logPrefix} [STEP 2.1] ⚠️ SNS_TOPIC_ARN not configured. Logging completion only.`);
      return {
        status: 'success',
        message: 'Training completed but SNS not configured',
        logged: true,
        employeeName,
        courseTitle,
        managerEmail,
        score: event.score
      };
    }

    // Create notification message
    const message = `
Training Completion Notification

Employee: ${employeeName}
Course: ${courseTitle}
Score: ${event.score}%
Status: Passed ✅

The employee has successfully completed the training course and passed the quiz.

This completion has been logged in the system for scheduling API validation.
    `.trim();

    console.log(`${logPrefix} [STEP 2.2] Sending SNS notification to: ${managerEmail}`);
    console.log(`${logPrefix} [STEP 2.3] SNS Topic ARN: ${SNS_TOPIC_ARN}`);

    // Send SNS notification
    const snsParams = {
      TopicArn: SNS_TOPIC_ARN,
      Subject: `Training Completed: ${employeeName} - ${courseTitle}`,
      Message: message,
      MessageAttributes: {
        'employeeName': {
          DataType: 'String',
          StringValue: employeeName
        },
        'courseTitle': {
          DataType: 'String',
          StringValue: courseTitle
        },
        'score': {
          DataType: 'Number',
          StringValue: event.score.toString()
        },
        'assignmentId': {
          DataType: 'String',
          StringValue: event.assignmentId
        }
      }
    };

    await snsClient.send(new PublishCommand(snsParams));
    console.log(`${logPrefix} [STEP 2.4] ✅ SNS notification sent successfully`);

    console.log(`${logPrefix} ========================================`);
    console.log(`${logPrefix} ✅ PROCESS COMPLETE`);
    console.log(`${logPrefix} ========================================`);

    return {
      status: 'success',
      message: 'Notification sent and completion logged',
      employeeName,
      courseTitle,
      managerEmail,
      score: event.score,
      logged: true
    };
  } catch (error: any) {
    console.error(`${logPrefix} ========================================`);
    console.error(`${logPrefix} ❌ ERROR IN QUIZ COMPLETION HANDLER`);
    console.error(`${logPrefix} Error:`, error);
    console.error(`${logPrefix} Error message:`, error?.message);
    console.error(`${logPrefix} Stack:`, error?.stack);
    console.error(`${logPrefix} ========================================`);

    // Log completion even on error for future API validation
    console.log(`${logPrefix} ⚠️ Error occurred but completion logged for future API validation`);

    return {
      status: 'error',
      error: error?.message || 'Unknown error',
      logged: true // Still log for future validation
    };
  }
};

// Helper function to query AppSync
async function queryAppSync(query: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(APPSYNC_ENDPOINT);
    const postData = JSON.stringify(query);

    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': APPSYNC_API_KEY
      },
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`AppSync returned status ${res.statusCode}: ${data}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}
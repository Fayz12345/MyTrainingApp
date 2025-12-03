import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import https from 'https';

const snsClient = new SNSClient({ region: 'ca-central-1' });

// Get AppSync API endpoint and API key from environment variables
const APPSYNC_ENDPOINT = process.env.APPSYNC_API_URL || 
  'https://mswo73fsfjh4thfaalt7d63i4a.appsync-api.ca-central-1.amazonaws.com/graphql';
const APPSYNC_API_KEY = process.env.APPSYNC_API_KEY || 'da2-la7esrklanbehi5v7e574ao7fq';

interface QuizCompletionEvent {
  assignmentId: string;
  employeeId?: string;
  courseId?: string;
  score?: number;
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
      console.log(`${logPrefix} Quiz not passed (score: ${event.score || 'N/A'}). No notification sent.`);
      console.log(`${logPrefix} ✅ Completion logged for future API validation (failed quiz)`);
      return { 
        status: 'success', 
        message: 'Quiz not passed - no notification sent',
        logged: true 
      };
    }

    console.log(`${logPrefix} [STEP 1] Quiz passed! Processing completion...`);
    
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
    console.log(`${logPrefix} [STEP 1.1] Assignment ID: ${event.assignmentId}`);
    const assignmentData = await queryAppSync(assignmentQuery);
    
    // Log full response for debugging
    console.log(`${logPrefix} [STEP 1.1] AppSync Response:`, JSON.stringify(assignmentData, null, 2));
    
    // Check for errors in response
    if (assignmentData?.errors) {
      console.error(`${logPrefix} [STEP 1.1] AppSync Errors:`, JSON.stringify(assignmentData.errors, null, 2));
      throw new Error(`AppSync query failed: ${JSON.stringify(assignmentData.errors)}`);
    }
    
    if (!assignmentData?.data?.getAssignment) {
      console.error(`${logPrefix} [STEP 1.1] Assignment not found in response`);
      console.error(`${logPrefix} [STEP 1.1] Full response data:`, JSON.stringify(assignmentData?.data, null, 2));
      throw new Error(`Assignment not found. Assignment ID: ${event.assignmentId}. This may be an authorization issue - API key may not have permission to read Assignment.`);
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
    console.log(`${logPrefix} [STEP 1.3] Employee: ${employeeName}, Course: ${courseTitle}, Score: ${event.score || 'N/A'}%`);

    // Update assignment to completed status and set is_training_complete = true
    console.log(`${logPrefix} [STEP 2] Updating assignment status to completed...`);
    const updateSuccess = await updateAssignmentToCompleted(event.assignmentId);
    
    if (!updateSuccess) {
      console.warn(`${logPrefix} [STEP 2] ⚠️ Assignment update failed, but continuing with notification`);
    }

    if (!managerEmail) {
      console.warn(`${logPrefix} [STEP 3] ⚠️ No manager email found. Employee may not have a manager assigned.`);
      return {
        status: 'success',
        message: 'Training completed but no manager email found',
        logged: true,
        employeeName,
        courseTitle,
        score: event.score
      };
    }

    console.log(`${logPrefix} [STEP 3] Sending SNS notification...`);
    
    // Get SNS Topic ARN from environment variable
    const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
    
    if (!SNS_TOPIC_ARN || SNS_TOPIC_ARN === 'YOUR_SNS_TOPIC_ARN') {
      console.warn(`${logPrefix} [STEP 3.1] ⚠️ SNS_TOPIC_ARN not configured. Logging completion only.`);
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

    // Create notification message (JSON format for Lambda processing)
    const message = JSON.stringify({
      employeeName,
      courseTitle,
      score: event.score || 0,
      managerEmail,
      managerName,
      assignmentId: event.assignmentId,
      timestamp: new Date().toISOString()
    });

    console.log(`${logPrefix} [STEP 3.2] Sending SNS notification to: ${managerEmail}`);
    console.log(`${logPrefix} [STEP 3.3] SNS Topic ARN: ${SNS_TOPIC_ARN}`);
    console.log(`${logPrefix} [STEP 3.3] SNS Region: ca-central-1`);

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
          StringValue: (event.score || 0).toString()
        },
        'assignmentId': {
          DataType: 'String',
          StringValue: event.assignmentId
        },
        'managerEmail': {
          DataType: 'String',
          StringValue: managerEmail
        },
        'managerName': {
          DataType: 'String',
          StringValue: managerName
        }
      }
    };

    let snsMessageId: string | undefined;
    try {
      console.log(`${logPrefix} [STEP 3.4] Publishing to SNS with params:`, JSON.stringify({
        TopicArn: SNS_TOPIC_ARN,
        Subject: snsParams.Subject,
        MessageLength: message.length,
        MessageAttributes: Object.keys(snsParams.MessageAttributes)
      }, null, 2));

      const snsResponse = await snsClient.send(new PublishCommand(snsParams));
      snsMessageId = snsResponse.MessageId;
      
      console.log(`${logPrefix} [STEP 3.5] ✅ SNS notification sent successfully`);
      console.log(`${logPrefix} [STEP 3.5] SNS MessageId: ${snsMessageId}`);
      console.log(`${logPrefix} [STEP 3.5] SNS Response:`, JSON.stringify(snsResponse, null, 2));
    } catch (snsError: any) {
      console.error(`${logPrefix} [STEP 3.4] ❌ SNS Publish Error:`, snsError);
      console.error(`${logPrefix} [STEP 3.4] Error Name:`, snsError?.name);
      console.error(`${logPrefix} [STEP 3.4] Error Code:`, snsError?.Code || snsError?.code);
      console.error(`${logPrefix} [STEP 3.4] Error Message:`, snsError?.message);
      console.error(`${logPrefix} [STEP 3.4] Error Stack:`, snsError?.stack);
      
      // Check for common SNS errors
      if (snsError?.name === 'NotFound' || snsError?.Code === 'NotFound') {
        console.error(`${logPrefix} [STEP 3.4] ⚠️ SNS Topic not found. Verify the Topic ARN is correct.`);
      } else if (snsError?.name === 'AuthorizationError' || snsError?.Code === 'AuthorizationError') {
        console.error(`${logPrefix} [STEP 3.4] ⚠️ Lambda lacks permission to publish to SNS. Check IAM role permissions.`);
      } else if (snsError?.name === 'InvalidParameter' || snsError?.Code === 'InvalidParameter') {
        console.error(`${logPrefix} [STEP 3.4] ⚠️ Invalid SNS parameters. Check Topic ARN format.`);
      }
      
      // Re-throw to be caught by outer try-catch
      throw new Error(`SNS notification failed: ${snsError?.message || 'Unknown error'}`);
    }

    console.log(`${logPrefix} ========================================`);
    console.log(`${logPrefix} ✅ PROCESS COMPLETE`);
    console.log(`${logPrefix} ========================================`);

    return {
      status: 'success',
      message: 'Notification sent and completion logged',
      employeeName,
      courseTitle,
      managerEmail,
      score: event.score || 0,
      logged: true,
      snsMessageId: snsMessageId,
      snsTopicArn: SNS_TOPIC_ARN
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

// Update assignment to completed status (Lambda has permission to do this)
async function updateAssignmentToCompleted(assignmentId: string) {
  const logPrefix = '[QUIZ_COMPLETION]';
  console.log(`${logPrefix} [UPDATE] Updating assignment ${assignmentId} to completed...`);
  
  try {
    const now = new Date().toISOString();
    const updateMutation = {
      query: `
        mutation UpdateAssignment($input: UpdateAssignmentInput!) {
          updateAssignment(input: $input) {
            id
            status
            isTrainingComplete
            trainingCompletedAt
          }
        }
      `,
      variables: {
        input: {
          id: assignmentId,
          status: 'completed',
          isTrainingComplete: true,
          trainingCompletedAt: now
        }
      }
    };

    const updateResult = await queryAppSync(updateMutation);
    
    if (updateResult?.data?.updateAssignment) {
      console.log(`${logPrefix} [UPDATE] ✅ Assignment updated successfully`);
      console.log(`${logPrefix} [UPDATE] Status: ${updateResult.data.updateAssignment.status}, isTrainingComplete: ${updateResult.data.updateAssignment.isTrainingComplete}`);
      return true;
    } else {
      // Check for errors in the response
      if (updateResult?.errors) {
        console.error(`${logPrefix} [UPDATE] AppSync errors:`, JSON.stringify(updateResult.errors, null, 2));
      }
      console.warn(`${logPrefix} [UPDATE] ⚠️ Assignment update returned null - may need Lambda IAM permissions or API key authorization`);
      return false;
    }
  } catch (error: any) {
    console.error(`${logPrefix} [UPDATE] ❌ Failed to update assignment:`, error);
    console.error(`${logPrefix} [UPDATE] Error details:`, error?.message);
    console.error(`${logPrefix} [UPDATE] Stack trace:`, error?.stack);
    // Don't throw - notification can still be sent even if update fails
    return false;
  }
}

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
          
          // Log response for debugging
          console.log(`[QUIZ_COMPLETION] AppSync HTTP Status: ${res.statusCode}`);
          if (parsed.errors) {
            console.error(`[QUIZ_COMPLETION] AppSync Errors:`, JSON.stringify(parsed.errors, null, 2));
          }
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            // Include full response in error for debugging
            reject(new Error(`AppSync returned status ${res.statusCode}: ${JSON.stringify(parsed, null, 2)}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e}. Raw response: ${data.substring(0, 500)}`));
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

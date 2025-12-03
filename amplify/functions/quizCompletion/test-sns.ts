/**
 * Test script to verify SNS notification functionality
 * 
 * This script can be used to test the SNS notification setup
 * Run this in AWS Lambda console or locally with proper AWS credentials
 */

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const snsClient = new SNSClient({ region: 'ca-central-1' });

// Test SNS notification
export async function testSNSNotification() {
  const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
  
  if (!SNS_TOPIC_ARN || SNS_TOPIC_ARN === 'YOUR_SNS_TOPIC_ARN') {
    console.error('❌ SNS_TOPIC_ARN not configured');
    console.log('Please set SNS_TOPIC_ARN environment variable');
    return { success: false, error: 'SNS_TOPIC_ARN not configured' };
  }

  console.log('🧪 Testing SNS Notification...');
  console.log(`Topic ARN: ${SNS_TOPIC_ARN}`);
  console.log(`Region: ca-central-1`);

  const testMessage = `
Training Completion Notification - TEST

Employee: Test Employee
Course: Test Course
Score: 100%
Status: Passed ✅

This is a test notification to verify SNS setup.
  `.trim();

  const snsParams = {
    TopicArn: SNS_TOPIC_ARN,
    Subject: 'Test: Training Completion Notification',
    Message: testMessage,
    MessageAttributes: {
      'employeeName': {
        DataType: 'String',
        StringValue: 'Test Employee'
      },
      'courseTitle': {
        DataType: 'String',
        StringValue: 'Test Course'
      },
      'score': {
        DataType: 'Number',
        StringValue: '100'
      },
      'assignmentId': {
        DataType: 'String',
        StringValue: 'test-assignment-id'
      }
    }
  };

  try {
    console.log('📤 Publishing test message to SNS...');
    const response = await snsClient.send(new PublishCommand(snsParams));
    
    console.log('✅ SNS notification sent successfully!');
    console.log(`MessageId: ${response.MessageId}`);
    console.log(`Response:`, JSON.stringify(response, null, 2));
    
    return {
      success: true,
      messageId: response.MessageId,
      response
    };
  } catch (error: any) {
    console.error('❌ SNS Publish Error:', error);
    console.error('Error Name:', error?.name);
    console.error('Error Code:', error?.Code || error?.code);
    console.error('Error Message:', error?.message);
    
    // Provide helpful error messages
    if (error?.name === 'NotFound' || error?.Code === 'NotFound') {
      console.error('⚠️  SNS Topic not found. Verify the Topic ARN is correct.');
      console.error('   Check: AWS Console → SNS → Topics → Verify ARN matches');
    } else if (error?.name === 'AuthorizationError' || error?.Code === 'AuthorizationError') {
      console.error('⚠️  Authorization error. Check IAM permissions.');
      console.error('   Required permission: sns:Publish');
      console.error('   Check: Lambda execution role → IAM → Permissions');
    } else if (error?.name === 'InvalidParameter' || error?.Code === 'InvalidParameter') {
      console.error('⚠️  Invalid parameters. Check Topic ARN format.');
      console.error('   Format should be: arn:aws:sns:REGION:ACCOUNT_ID:TOPIC_NAME');
    }
    
    return {
      success: false,
      error: error?.message || 'Unknown error',
      errorCode: error?.Code || error?.code,
      errorName: error?.name
    };
  }
}

// Run test if executed directly
if (require.main === module) {
  testSNSNotification()
    .then(result => {
      console.log('\n📊 Test Result:', JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch(err => {
      console.error('❌ Test failed with error:', err);
      process.exit(1);
    });
}


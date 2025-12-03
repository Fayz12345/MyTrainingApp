/**
 * Test script to verify SNS email notifications are working
 * 
 * Usage:
 *   npx ts-node test-sns-email.ts
 * 
 * This script will:
 * 1. Check SNS topic exists
 * 2. List all email subscriptions
 * 3. Check subscription status (confirmed/pending)
 * 4. Send a test notification
 * 5. Verify notification was published
 */

import { SNSClient, PublishCommand, ListSubscriptionsByTopicCommand, GetTopicAttributesCommand } from '@aws-sdk/client-sns';

const snsClient = new SNSClient({ region: 'ca-central-1' });

// Your SNS Topic ARN
const SNS_TOPIC_ARN = 'arn:aws:sns:ca-central-1:216348571084:training-completion-notifications';

interface TestResult {
  step: string;
  success: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

/**
 * Test 1: Verify SNS topic exists
 */
async function testTopicExists(): Promise<TestResult> {
  try {
    console.log('🔍 Test 1: Checking if SNS topic exists...\n');
    
    const command = new GetTopicAttributesCommand({
      TopicArn: SNS_TOPIC_ARN
    });
    
    const response = await snsClient.send(command);
    
    if (response.Attributes) {
      console.log('✅ Topic exists!');
      console.log(`   Topic ARN: ${SNS_TOPIC_ARN}`);
      console.log(`   Display Name: ${response.Attributes.DisplayName || 'N/A'}`);
      console.log(`   Owner: ${response.Attributes.Owner || 'N/A'}\n`);
      
      return {
        step: 'Topic Exists',
        success: true,
        message: 'SNS topic found and accessible',
        details: response.Attributes
      };
    }
    
    return {
      step: 'Topic Exists',
      success: false,
      message: 'Topic exists but no attributes found'
    };
  } catch (error: any) {
    console.error('❌ Topic not found or inaccessible');
    console.error(`   Error: ${error?.message}\n`);
    
    return {
      step: 'Topic Exists',
      success: false,
      message: error?.message || 'Topic not found',
      details: error
    };
  }
}

/**
 * Test 2: List and check email subscriptions
 */
async function testEmailSubscriptions(): Promise<TestResult> {
  try {
    console.log('📧 Test 2: Checking email subscriptions...\n');
    
    const command = new ListSubscriptionsByTopicCommand({
      TopicArn: SNS_TOPIC_ARN
    });
    
    const response = await snsClient.send(command);
    const subscriptions = response.Subscriptions || [];
    
    const emailSubs = subscriptions.filter(s => s.Protocol === 'email');
    const confirmedSubs = emailSubs.filter(s => 
      s.SubscriptionArn && !s.SubscriptionArn.includes('PendingConfirmation')
    );
    const pendingSubs = emailSubs.filter(s => 
      s.SubscriptionArn && s.SubscriptionArn.includes('PendingConfirmation')
    );
    
    console.log(`Found ${emailSubs.length} email subscription(s):\n`);
    
    if (confirmedSubs.length > 0) {
      console.log('✅ Confirmed subscriptions:');
      confirmedSubs.forEach((sub, index) => {
        console.log(`   ${index + 1}. ${sub.Endpoint} (Confirmed)`);
      });
      console.log('');
    }
    
    if (pendingSubs.length > 0) {
      console.log('⏳ Pending subscriptions (need confirmation):');
      pendingSubs.forEach((sub, index) => {
        console.log(`   ${index + 1}. ${sub.Endpoint} (Pending - check email inbox!)`);
      });
      console.log('');
    }
    
    if (emailSubs.length === 0) {
      console.log('⚠️  No email subscriptions found!');
      console.log('   You need to create email subscriptions for managers.\n');
    }
    
    const otherSubs = subscriptions.filter(s => s.Protocol !== 'email');
    if (otherSubs.length > 0) {
      console.log('📱 Other subscriptions:');
      otherSubs.forEach((sub, index) => {
        console.log(`   ${index + 1}. ${sub.Protocol}: ${sub.Endpoint}`);
      });
      console.log('');
    }
    
    return {
      step: 'Email Subscriptions',
      success: emailSubs.length > 0,
      message: emailSubs.length > 0 
        ? `Found ${emailSubs.length} email subscription(s), ${confirmedSubs.length} confirmed, ${pendingSubs.length} pending`
        : 'No email subscriptions found',
      details: {
        total: emailSubs.length,
        confirmed: confirmedSubs.length,
        pending: pendingSubs.length,
        subscriptions: emailSubs.map(s => ({
          email: s.Endpoint,
          status: s.SubscriptionArn?.includes('PendingConfirmation') ? 'pending' : 'confirmed',
          arn: s.SubscriptionArn
        }))
      }
    };
  } catch (error: any) {
    console.error('❌ Failed to list subscriptions');
    console.error(`   Error: ${error?.message}\n`);
    
    return {
      step: 'Email Subscriptions',
      success: false,
      message: error?.message || 'Failed to list subscriptions',
      details: error
    };
  }
}

/**
 * Test 3: Send test notification
 */
async function testSendNotification(): Promise<TestResult> {
  try {
    console.log('📤 Test 3: Sending test notification...\n');
    
    const testMessage = `
Training Completion Notification - TEST

This is a test notification to verify SNS email setup.

Employee: Test Employee
Course: Test Course
Score: 100%
Status: Passed ✅

If you receive this email, your SNS email notifications are working correctly!

Timestamp: ${new Date().toISOString()}
    `.trim();
    
    const snsParams = {
      TopicArn: SNS_TOPIC_ARN,
      Subject: '🧪 TEST: Training Completion Notification',
      Message: testMessage,
      MessageAttributes: {
        'test': {
          DataType: 'String',
          StringValue: 'true'
        },
        'timestamp': {
          DataType: 'String',
          StringValue: new Date().toISOString()
        }
      }
    };
    
    console.log('Publishing test message to SNS...');
    const response = await snsClient.send(new PublishCommand(snsParams));
    
    console.log('✅ Test notification sent successfully!');
    console.log(`   Message ID: ${response.MessageId}`);
    console.log(`   Timestamp: ${new Date().toISOString()}\n`);
    
    console.log('📬 Next Steps:');
    console.log('   1. Check email inboxes of all subscribed managers');
    console.log('   2. Look for email with subject: "🧪 TEST: Training Completion Notification"');
    console.log('   3. If emails are not received, check:');
    console.log('      - Spam/junk folder');
    console.log('      - Subscription confirmation status');
    console.log('      - CloudWatch logs for delivery errors\n');
    
    return {
      step: 'Send Notification',
      success: true,
      message: 'Test notification published successfully',
      details: {
        messageId: response.MessageId,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error: any) {
    console.error('❌ Failed to send test notification');
    console.error(`   Error: ${error?.message}`);
    
    if (error?.name === 'NotFound' || error?.Code === 'NotFound') {
      console.error('   ⚠️  SNS Topic not found. Verify the Topic ARN is correct.');
    } else if (error?.name === 'AuthorizationError' || error?.Code === 'AuthorizationError') {
      console.error('   ⚠️  Authorization error. Check IAM permissions (sns:Publish).');
    } else if (error?.name === 'InvalidParameter' || error?.Code === 'InvalidParameter') {
      console.error('   ⚠️  Invalid parameters. Check Topic ARN format.');
    }
    console.log('');
    
    return {
      step: 'Send Notification',
      success: false,
      message: error?.message || 'Failed to send notification',
      details: error
    };
  }
}

/**
 * Test 4: Check Lambda environment variable
 */
async function testLambdaConfiguration(): Promise<TestResult> {
  try {
    console.log('⚙️  Test 4: Checking Lambda configuration...\n');
    
    // Check if environment variable is set in the resource file
    const fs = require('fs');
    const path = require('path');
    
    const resourceFile = path.join(__dirname, 'quizCompletion', 'resource.ts');
    
    if (fs.existsSync(resourceFile)) {
      const content = fs.readFileSync(resourceFile, 'utf-8');
      
      if (content.includes(SNS_TOPIC_ARN)) {
        console.log('✅ SNS_TOPIC_ARN is configured in resource.ts');
        console.log(`   Topic ARN: ${SNS_TOPIC_ARN}\n`);
        
        return {
          step: 'Lambda Configuration',
          success: true,
          message: 'SNS_TOPIC_ARN configured in Lambda resource file',
          details: {
            configured: true,
            topicArn: SNS_TOPIC_ARN
          }
        };
      } else {
        console.log('⚠️  SNS_TOPIC_ARN not found in resource.ts');
        console.log('   Make sure to update the Lambda resource file with the Topic ARN\n');
        
        return {
          step: 'Lambda Configuration',
          success: false,
          message: 'SNS_TOPIC_ARN not configured in resource file',
          details: {
            configured: false
          }
        };
      }
    } else {
      console.log('⚠️  Could not find resource.ts file\n');
      
      return {
        step: 'Lambda Configuration',
        success: false,
        message: 'Resource file not found',
        details: {
          fileExists: false
        }
      };
    }
  } catch (error: any) {
    console.error('❌ Failed to check Lambda configuration');
    console.error(`   Error: ${error?.message}\n`);
    
    return {
      step: 'Lambda Configuration',
      success: false,
      message: error?.message || 'Failed to check configuration',
      details: error
    };
  }
}

/**
 * Generate test summary report
 */
function generateSummary() {
  console.log('='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log('');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Passed: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}`);
  console.log('');
  
  results.forEach((result, index) => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${index + 1}. ${result.step}`);
    console.log(`   ${result.message}`);
    if (result.details && !result.success) {
      console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
    }
    console.log('');
  });
  
  if (failed.length === 0) {
    console.log('🎉 All tests passed! SNS email notifications should be working.');
    console.log('');
    console.log('📬 To verify:');
    console.log('   1. Check manager email inboxes for the test notification');
    console.log('   2. Complete a quiz in the application');
    console.log('   3. Verify managers receive completion notifications');
    console.log('');
  } else {
    console.log('⚠️  Some tests failed. Please fix the issues above.');
    console.log('');
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🧪 SNS Email Notification Test Suite\n');
  console.log('='.repeat(60));
  console.log(`Topic ARN: ${SNS_TOPIC_ARN}`);
  console.log(`Region: ca-central-1`);
  console.log('='.repeat(60));
  console.log('');
  
  // Run all tests
  results.push(await testTopicExists());
  results.push(await testEmailSubscriptions());
  results.push(await testLambdaConfiguration());
  results.push(await testSendNotification());
  
  // Generate summary
  generateSummary();
}

// Run if executed directly
if (require.main === module) {
  runTests()
    .then(() => {
      const allPassed = results.every(r => r.success);
      process.exit(allPassed ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Test suite failed:', error);
      process.exit(1);
    });
}

export { runTests, testTopicExists, testEmailSubscriptions, testSendNotification, testLambdaConfiguration };


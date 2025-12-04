/**
 * Test script to verify HTML email rendering
 * 
 * This script:
 * 1. Tests the HTML template generation
 * 2. Simulates SNS event processing
 * 3. Verifies HTML output is correct
 * 4. Can test Lambda function locally
 * 
 * Usage:
 *   npx ts-node test-html-rendering.ts
 */

import { handler } from './sendManagerNotification/handler';

// Mock SNS event with MessageAttributes (as sent by quizCompletion Lambda)
const mockSNSEvent = {
  Records: [
    {
      Sns: {
        Message: '<html>This is HTML message from quizCompletion</html>',
        Subject: 'Training Completed: Test Employee - Test Course',
        MessageAttributes: {
          employeeName: {
            Type: 'String',
            Value: 'Test Employee'
          },
          courseTitle: {
            Type: 'String',
            Value: 'Introduction to Software Testing'
          },
          score: {
            Type: 'Number',
            Value: '100'
          },
          managerEmail: {
            Type: 'String',
            Value: 'circular360dev@gmail.com'
          },
          managerName: {
            Type: 'String',
            Value: 'Test Manager'
          },
          assignmentId: {
            Type: 'String',
            Value: 'test-assignment-id-12345'
          },
          timestamp: {
            Type: 'String',
            Value: new Date().toISOString()
          }
        }
      }
    }
  ]
};

async function testHTMLRendering() {
  console.log('🧪 Testing HTML Email Rendering');
  console.log('================================\n');

  try {
    console.log('📋 Test Data:');
    console.log('   Employee Name:', mockSNSEvent.Records[0].Sns.MessageAttributes.employeeName.Value);
    console.log('   Course Title:', mockSNSEvent.Records[0].Sns.MessageAttributes.courseTitle.Value);
    console.log('   Score:', mockSNSEvent.Records[0].Sns.MessageAttributes.score.Value + '%');
    console.log('   Manager Email:', mockSNSEvent.Records[0].Sns.MessageAttributes.managerEmail.Value);
    console.log('   Manager Name:', mockSNSEvent.Records[0].Sns.MessageAttributes.managerName.Value);
    console.log('');

    console.log('🚀 Invoking sendManagerNotification Lambda handler...\n');
    
    const result = await handler(mockSNSEvent as any);

    console.log('\n✅ Lambda Handler Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');

    // Check if email was sent successfully
    if (result.status === 'success' && result.messageId) {
      console.log('✅ HTML Email Sent Successfully!');
      console.log('   MessageId:', result.messageId);
      console.log('   Manager Email:', result.managerEmail);
      console.log('');
      console.log('📧 Check the manager email inbox for HTML email');
      console.log('   The email should display:');
      console.log('   - Formatted table with all data');
      console.log('   - Green header and styling');
      console.log('   - Professional layout');
      console.log('   - NO raw HTML code visible');
    } else {
      console.log('❌ Email sending failed or returned error');
      console.log('   Result:', result);
    }

    return result;
  } catch (error: any) {
    console.error('❌ Test Failed:');
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testHTMLRendering()
    .then(() => {
      console.log('\n✅ Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

export { testHTMLRendering, mockSNSEvent };


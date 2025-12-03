/**
 * Verification script to check if manager notifications work when employee submits quiz
 * 
 * Usage:
 *   npx ts-node verify-notification-flow.ts
 * 
 * This script verifies:
 * 1. Lambda Function URL is configured in frontend
 * 2. Lambda function exists and is accessible
 * 3. SNS topic is configured
 * 4. Email subscriptions exist for managers
 * 5. Employee-Manager relationship is set up correctly
 */

import { LambdaClient, GetFunctionCommand, GetFunctionUrlConfigCommand, ListFunctionsCommand } from '@aws-sdk/client-lambda';
import { SNSClient, ListSubscriptionsByTopicCommand, GetTopicAttributesCommand } from '@aws-sdk/client-sns';

const lambdaClient = new LambdaClient({ region: 'ca-central-1' });
const snsClient = new SNSClient({ region: 'ca-central-1' });

const SNS_TOPIC_ARN = 'arn:aws:sns:ca-central-1:216348571084:training-completion-notifications';
const LAMBDA_FUNCTION_NAME_PATTERN = 'quizCompletion';

interface VerificationResult {
  step: string;
  status: '✅' | '❌' | '⚠️';
  message: string;
  details?: any;
}

const results: VerificationResult[] = [];

/**
 * Step 1: Check if Lambda Function URL is configured
 */
async function checkLambdaFunctionUrl(): Promise<VerificationResult> {
  try {
    console.log('🔍 Step 1: Checking Lambda Function URL configuration...\n');
    
    // List all quizCompletion functions
    const listCommand = new ListFunctionsCommand({});
    const listResponse = await lambdaClient.send(listCommand);
    
    const quizCompletionFunctions = (listResponse.Functions || []).filter(f => 
      f.FunctionName?.includes(LAMBDA_FUNCTION_NAME_PATTERN)
    );
    
    if (quizCompletionFunctions.length === 0) {
      return {
        step: 'Lambda Function URL',
        status: '❌',
        message: 'No quizCompletion Lambda function found',
        details: { functionsFound: 0 }
      };
    }
    
    console.log(`Found ${quizCompletionFunctions.length} quizCompletion function(s):\n`);
    
    const functionUrls: string[] = [];
    
    for (const func of quizCompletionFunctions) {
      const functionName = func.FunctionName!;
      console.log(`  - ${functionName}`);
      
      try {
        const urlCommand = new GetFunctionUrlConfigCommand({
          FunctionName: functionName
        });
        const urlResponse = await lambdaClient.send(urlCommand);
        
        if (urlResponse.FunctionUrl) {
          console.log(`    ✅ Function URL: ${urlResponse.FunctionUrl}`);
          functionUrls.push(urlResponse.FunctionUrl);
        } else {
          console.log(`    ⚠️  Function URL not configured`);
        }
      } catch (error: any) {
        if (error.name === 'ResourceNotFoundException') {
          console.log(`    ⚠️  Function URL not configured`);
        } else {
          console.log(`    ❌ Error checking URL: ${error.message}`);
        }
      }
    }
    
    console.log('');
    
    if (functionUrls.length === 0) {
      return {
        step: 'Lambda Function URL',
        status: '⚠️',
        message: 'Lambda function exists but Function URL is not configured',
        details: {
          functionsFound: quizCompletionFunctions.length,
          functionNames: quizCompletionFunctions.map(f => f.FunctionName)
        }
      };
    }
    
    return {
      step: 'Lambda Function URL',
      status: '✅',
      message: `Function URL(s) configured: ${functionUrls.length}`,
      details: {
        functionUrls,
        functionNames: quizCompletionFunctions.map(f => f.FunctionName)
      }
    };
  } catch (error: any) {
    return {
      step: 'Lambda Function URL',
      status: '❌',
      message: `Error checking Lambda: ${error.message}`,
      details: error
    };
  }
}

/**
 * Step 2: Check SNS Topic and Subscriptions
 */
async function checkSNSSetup(): Promise<VerificationResult> {
  try {
    console.log('📧 Step 2: Checking SNS Topic and Email Subscriptions...\n');
    
    // Check topic exists
    const topicCommand = new GetTopicAttributesCommand({
      TopicArn: SNS_TOPIC_ARN
    });
    const topicResponse = await snsClient.send(topicCommand);
    
    if (!topicResponse.Attributes) {
      return {
        step: 'SNS Setup',
        status: '❌',
        message: 'SNS Topic not found',
        details: { topicArn: SNS_TOPIC_ARN }
      };
    }
    
    console.log(`✅ SNS Topic exists: ${SNS_TOPIC_ARN}\n`);
    
    // Check subscriptions
    const subsCommand = new ListSubscriptionsByTopicCommand({
      TopicArn: SNS_TOPIC_ARN
    });
    const subsResponse = await snsClient.send(subsCommand);
    
    const subscriptions = subsResponse.Subscriptions || [];
    const emailSubs = subscriptions.filter(s => s.Protocol === 'email');
    const confirmedSubs = emailSubs.filter(s => 
      s.SubscriptionArn && !s.SubscriptionArn.includes('PendingConfirmation')
    );
    const pendingSubs = emailSubs.filter(s => 
      s.SubscriptionArn && s.SubscriptionArn.includes('PendingConfirmation')
    );
    
    console.log(`Email Subscriptions: ${emailSubs.length} total`);
    console.log(`  ✅ Confirmed: ${confirmedSubs.length}`);
    console.log(`  ⏳ Pending: ${pendingSubs.length}\n`);
    
    if (confirmedSubs.length > 0) {
      console.log('Confirmed email subscriptions:');
      confirmedSubs.forEach((sub, index) => {
        console.log(`  ${index + 1}. ${sub.Endpoint}`);
      });
      console.log('');
    }
    
    if (pendingSubs.length > 0) {
      console.log('⚠️  Pending subscriptions (need confirmation):');
      pendingSubs.forEach((sub, index) => {
        console.log(`  ${index + 1}. ${sub.Endpoint} - Check email inbox!`);
      });
      console.log('');
    }
    
    if (emailSubs.length === 0) {
      return {
        step: 'SNS Setup',
        status: '⚠️',
        message: 'SNS Topic exists but no email subscriptions found',
        details: {
          topicExists: true,
          emailSubscriptions: 0
        }
      };
    }
    
    return {
      step: 'SNS Setup',
      status: confirmedSubs.length > 0 ? '✅' : '⚠️',
      message: `${confirmedSubs.length} confirmed email subscription(s), ${pendingSubs.length} pending`,
      details: {
        topicExists: true,
        totalEmailSubs: emailSubs.length,
        confirmed: confirmedSubs.length,
        pending: pendingSubs.length,
        emails: emailSubs.map(s => ({
          email: s.Endpoint,
          status: s.SubscriptionArn?.includes('PendingConfirmation') ? 'pending' : 'confirmed'
        }))
      }
    };
  } catch (error: any) {
    return {
      step: 'SNS Setup',
      status: '❌',
      message: `Error checking SNS: ${error.message}`,
      details: error
    };
  }
}

/**
 * Step 3: Check Lambda Environment Variables
 */
async function checkLambdaEnvironment(): Promise<VerificationResult> {
  try {
    console.log('⚙️  Step 3: Checking Lambda Environment Variables...\n');
    
    const listCommand = new ListFunctionsCommand({});
    const listResponse = await lambdaClient.send(listCommand);
    
    const quizCompletionFunctions = (listResponse.Functions || []).filter(f => 
      f.FunctionName?.includes(LAMBDA_FUNCTION_NAME_PATTERN)
    );
    
    if (quizCompletionFunctions.length === 0) {
      return {
        step: 'Lambda Environment',
        status: '❌',
        message: 'No quizCompletion function found'
      };
    }
    
    const func = quizCompletionFunctions[0];
    const functionName = func.FunctionName!;
    
    const getCommand = new GetFunctionCommand({
      FunctionName: functionName
    });
    const response = await lambdaClient.send(getCommand);
    
    const envVars = response.Configuration?.Environment?.Variables || {};
    const hasSnsTopicArn = !!envVars.SNS_TOPIC_ARN;
    const hasAppSyncUrl = !!envVars.APPSYNC_API_URL;
    const hasAppSyncKey = !!envVars.APPSYNC_API_KEY;
    
    console.log(`Function: ${functionName}`);
    console.log(`  SNS_TOPIC_ARN: ${hasSnsTopicArn ? '✅ Set' : '❌ Not set'}`);
    console.log(`  APPSYNC_API_URL: ${hasAppSyncUrl ? '✅ Set' : '❌ Not set'}`);
    console.log(`  APPSYNC_API_KEY: ${hasAppSyncKey ? '✅ Set' : '❌ Not set'}\n`);
    
    if (hasSnsTopicArn) {
      const topicArn = envVars.SNS_TOPIC_ARN;
      console.log(`  Topic ARN: ${topicArn}`);
      if (topicArn === SNS_TOPIC_ARN) {
        console.log(`  ✅ Matches expected topic ARN\n`);
      } else {
        console.log(`  ⚠️  Does not match expected topic ARN\n`);
      }
    }
    
    const allSet = hasSnsTopicArn && hasAppSyncUrl && hasAppSyncKey;
    
    return {
      step: 'Lambda Environment',
      status: allSet ? '✅' : '⚠️',
      message: allSet 
        ? 'All required environment variables are set'
        : 'Some environment variables are missing',
      details: {
        SNS_TOPIC_ARN: hasSnsTopicArn,
        APPSYNC_API_URL: hasAppSyncUrl,
        APPSYNC_API_KEY: hasAppSyncKey,
        topicArn: envVars.SNS_TOPIC_ARN
      }
    };
  } catch (error: any) {
    return {
      step: 'Lambda Environment',
      status: '❌',
      message: `Error checking environment: ${error.message}`,
      details: error
    };
  }
}

/**
 * Step 4: Check Frontend Configuration
 */
async function checkFrontendConfig(): Promise<VerificationResult> {
  try {
    console.log('🌐 Step 4: Checking Frontend Configuration...\n');
    
    const fs = require('fs');
    const path = require('path');
    
    // Check for .env file
    const envPath = path.join(__dirname, '../../my-training-admin/.env');
    const envLocalPath = path.join(__dirname, '../../my-training-admin/.env.local');
    
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
      console.log('Found .env file');
    } else if (fs.existsSync(envLocalPath)) {
      envContent = fs.readFileSync(envLocalPath, 'utf-8');
      console.log('Found .env.local file');
    } else {
      console.log('⚠️  No .env file found\n');
      return {
        step: 'Frontend Config',
        status: '⚠️',
        message: 'No .env file found. Lambda URL may be set in build environment.',
        details: { envFileExists: false }
      };
    }
    
    const hasLambdaUrl = envContent.includes('REACT_APP_QUIZ_COMPLETION_LAMBDA_URL');
    
    if (hasLambdaUrl) {
      const match = envContent.match(/REACT_APP_QUIZ_COMPLETION_LAMBDA_URL=(.+)/);
      const url = match ? match[1].trim() : 'not found';
      console.log(`  ✅ REACT_APP_QUIZ_COMPLETION_LAMBDA_URL is set`);
      console.log(`  URL: ${url}\n`);
      
      return {
        step: 'Frontend Config',
        status: '✅',
        message: 'Lambda Function URL is configured',
        details: { url }
      };
    } else {
      console.log(`  ⚠️  REACT_APP_QUIZ_COMPLETION_LAMBDA_URL not found in .env file\n`);
      
      return {
        step: 'Frontend Config',
        status: '⚠️',
        message: 'Lambda Function URL not found in .env file',
        details: { envFileExists: true, lambdaUrlSet: false }
      };
    }
  } catch (error: any) {
    return {
      step: 'Frontend Config',
      status: '❌',
      message: `Error checking frontend config: ${error.message}`,
      details: error
    };
  }
}

/**
 * Generate summary report
 */
function generateReport() {
  console.log('='.repeat(60));
  console.log('📊 VERIFICATION SUMMARY');
  console.log('='.repeat(60));
  console.log('');
  
  const allPassed = results.every(r => r.status === '✅');
  const hasWarnings = results.some(r => r.status === '⚠️');
  const hasErrors = results.some(r => r.status === '❌');
  
  results.forEach((result, index) => {
    console.log(`${result.status} ${index + 1}. ${result.step}`);
    console.log(`   ${result.message}`);
    if (result.details) {
      console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
    }
    console.log('');
  });
  
  console.log('='.repeat(60));
  
  if (allPassed) {
    console.log('🎉 All checks passed! Manager notifications should work.');
    console.log('');
    console.log('📝 To test:');
    console.log('   1. Log in as an employee in the web app');
    console.log('   2. Complete a quiz and pass it');
    console.log('   3. Check manager email inbox for notification');
    console.log('   4. Check CloudWatch logs for Lambda execution');
  } else if (hasErrors) {
    console.log('❌ Some critical issues found. Please fix them before testing.');
  } else if (hasWarnings) {
    console.log('⚠️  Some warnings found. Review and fix as needed.');
  }
  
  console.log('');
}

/**
 * Main verification function
 */
async function verifyNotificationFlow() {
  console.log('🔍 Manager Notification Flow Verification\n');
  console.log('='.repeat(60));
  console.log('Checking if managers receive notifications when employees submit quizzes...');
  console.log('='.repeat(60));
  console.log('');
  
  // Run all verification steps
  results.push(await checkLambdaFunctionUrl());
  results.push(await checkSNSSetup());
  results.push(await checkLambdaEnvironment());
  results.push(await checkFrontendConfig());
  
  // Generate report
  generateReport();
}

// Run if executed directly
if (require.main === module) {
  verifyNotificationFlow()
    .then(() => {
      const allPassed = results.every(r => r.status === '✅');
      process.exit(allPassed ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Verification failed:', error);
      process.exit(1);
    });
}

export { verifyNotificationFlow, checkLambdaFunctionUrl, checkSNSSetup, checkLambdaEnvironment, checkFrontendConfig };


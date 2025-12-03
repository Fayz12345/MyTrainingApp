/**
 * Script to add email subscriptions to SNS topic
 * 
 * Usage:
 *   export MANAGER_EMAILS="manager1@example.com,manager2@example.com"
 *   npx ts-node add-email-subscriptions.ts
 */

import { SNSClient, SubscribeCommand, ListSubscriptionsByTopicCommand } from '@aws-sdk/client-sns';

const snsClient = new SNSClient({ region: 'ca-central-1' });

// Your SNS Topic ARN
const SNS_TOPIC_ARN = 'arn:aws:sns:ca-central-1:216348571084:training-completion-notifications';

// Get manager emails from environment variable
const MANAGER_EMAILS = process.env.MANAGER_EMAILS?.split(',').map(e => e.trim()).filter(e => e) || [];

interface SubscriptionResult {
  email: string;
  success: boolean;
  subscriptionArn?: string;
  error?: string;
}

/**
 * Subscribe an email address to the SNS topic
 */
async function subscribeEmail(email: string): Promise<SubscriptionResult> {
  try {
    console.log(`📧 Subscribing ${email}...`);
    
    const command = new SubscribeCommand({
      TopicArn: SNS_TOPIC_ARN,
      Protocol: 'email',
      Endpoint: email
    });
    
    const response = await snsClient.send(command);
    
    console.log(`✅ Subscription created for ${email}`);
    console.log(`   Subscription ARN: ${response.SubscriptionArn}`);
    console.log(`   ⚠️  Check email inbox and confirm subscription!\n`);
    
    return {
      email,
      success: true,
      subscriptionArn: response.SubscriptionArn
    };
  } catch (error: any) {
    console.error(`❌ Failed to subscribe ${email}:`, error?.message);
    
    return {
      email,
      success: false,
      error: error?.message || 'Unknown error'
    };
  }
}

/**
 * List all subscriptions for the topic
 */
async function listSubscriptions() {
  try {
    console.log(`\n📋 Current subscriptions for topic:\n`);
    
    const command = new ListSubscriptionsByTopicCommand({
      TopicArn: SNS_TOPIC_ARN
    });
    
    const response = await snsClient.send(command);
    
    if (response.Subscriptions && response.Subscriptions.length > 0) {
      console.log(`Found ${response.Subscriptions.length} subscription(s):\n`);
      
      const emailSubs = response.Subscriptions.filter(s => s.Protocol === 'email');
      const lambdaSubs = response.Subscriptions.filter(s => s.Protocol === 'lambda');
      const otherSubs = response.Subscriptions.filter(s => s.Protocol !== 'email' && s.Protocol !== 'lambda');
      
      if (emailSubs.length > 0) {
        console.log('📧 Email Subscriptions:');
        emailSubs.forEach((sub, index) => {
          const status = sub.SubscriptionArn?.includes('PendingConfirmation') ? '⏳ Pending Confirmation' : '✅ Confirmed';
          console.log(`  ${index + 1}. ${sub.Endpoint} - ${status}`);
        });
        console.log('');
      }
      
      if (lambdaSubs.length > 0) {
        console.log('🔧 Lambda Subscriptions:');
        lambdaSubs.forEach((sub, index) => {
          console.log(`  ${index + 1}. ${sub.Endpoint}`);
        });
        console.log('');
      }
      
      if (otherSubs.length > 0) {
        console.log('📱 Other Subscriptions:');
        otherSubs.forEach((sub, index) => {
          console.log(`  ${index + 1}. ${sub.Protocol}: ${sub.Endpoint}`);
        });
        console.log('');
      }
    } else {
      console.log('No subscriptions found.\n');
    }
  } catch (error: any) {
    console.error(`❌ Failed to list subscriptions:`, error?.message);
  }
}

/**
 * Main function
 */
async function addEmailSubscriptions() {
  console.log('📧 SNS Email Subscription Manager\n');
  console.log('='.repeat(60));
  console.log(`Topic ARN: ${SNS_TOPIC_ARN}`);
  console.log(`Region: ca-central-1\n`);
  
  // List existing subscriptions
  await listSubscriptions();
  
  if (MANAGER_EMAILS.length === 0) {
    console.log('⚠️  No manager emails provided.');
    console.log('\nUsage:');
    console.log('  export MANAGER_EMAILS="manager1@example.com,manager2@example.com"');
    console.log('  npx ts-node add-email-subscriptions.ts\n');
    return;
  }
  
  console.log(`📧 Creating ${MANAGER_EMAILS.length} email subscription(s)...\n`);
  
  const results: SubscriptionResult[] = [];
  
  // Subscribe all emails
  for (const email of MANAGER_EMAILS) {
    if (!email || !email.includes('@')) {
      console.warn(`⚠️  Skipping invalid email: ${email}`);
      continue;
    }
    
    const result = await subscribeEmail(email);
    results.push(result);
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log('='.repeat(60));
  console.log('📊 Subscription Summary\n');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}\n`);
  
  if (successful.length > 0) {
    console.log('✅ Successful subscriptions:');
    successful.forEach(r => {
      console.log(`  ✓ ${r.email}`);
    });
    console.log('\n📬 Next Steps:');
    console.log('1. Check email inboxes for confirmation messages');
    console.log('2. Click the confirmation links in each email');
    console.log('3. Verify subscriptions are confirmed in AWS Console');
    console.log('4. Test notifications using the quizCompletion Lambda\n');
  }
  
  if (failed.length > 0) {
    console.log('❌ Failed subscriptions:');
    failed.forEach(r => {
      console.log(`  ✗ ${r.email}: ${r.error}`);
    });
    console.log('');
  }
  
  // List updated subscriptions
  console.log('='.repeat(60));
  await listSubscriptions();
}

// Run if executed directly
if (require.main === module) {
  addEmailSubscriptions()
    .then(() => {
      console.log('✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { subscribeEmail, listSubscriptions };


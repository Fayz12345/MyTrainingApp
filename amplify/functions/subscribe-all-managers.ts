/**
 * Script to automatically subscribe all managers to SNS topic
 * 
 * This script:
 * 1. Fetches all managers from the database via AppSync
 * 2. Subscribes each manager's email to the SNS topic
 * 3. Provides confirmation URLs for pending subscriptions
 * 
 * Usage:
 *   npx ts-node subscribe-all-managers.ts
 */

import { SNSClient, SubscribeCommand, ListSubscriptionsByTopicCommand } from '@aws-sdk/client-sns';
import https from 'https';

const snsClient = new SNSClient({ region: 'ca-central-1' });

// AppSync configuration
const APPSYNC_ENDPOINT = process.env.APPSYNC_API_URL || 
  'https://mswo73fsfjh4thfaalt7d63i4a.appsync-api.ca-central-1.amazonaws.com/graphql';
const APPSYNC_API_KEY = process.env.APPSYNC_API_KEY || 'da2-la7esrklanbehi5v7e574ao7fq';

// SNS Topic ARN
const SNS_TOPIC_ARN = 'arn:aws:sns:ca-central-1:216348571084:training-completion-notifications';

interface Manager {
  id: string;
  name: string;
  email: string;
}

interface SubscriptionResult {
  managerName: string;
  email: string;
  success: boolean;
  subscriptionArn?: string;
  confirmationUrl?: string;
  error?: string;
}

/**
 * Query AppSync for all managers
 */
async function getAllManagers(): Promise<Manager[]> {
  return new Promise((resolve, reject) => {
    const query = {
      query: `
        query ListManagers {
          listManagers {
            items {
              id
              name
              email
            }
          }
        }
      `
    };

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
            const managers = parsed?.data?.listManagers?.items || [];
            resolve(managers);
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

/**
 * Subscribe a manager's email to SNS topic
 */
async function subscribeManagerEmail(manager: Manager): Promise<SubscriptionResult> {
  try {
    console.log(`📧 Subscribing ${manager.name} (${manager.email})...`);
    
    const command = new SubscribeCommand({
      TopicArn: SNS_TOPIC_ARN,
      Protocol: 'email',
      Endpoint: manager.email
    });
    
    const response = await snsClient.send(command);
    
    // Extract token from subscription ARN if pending
    let confirmationUrl = '';
    if (response.SubscriptionArn?.includes('PendingConfirmation')) {
      // Extract token from ARN (format: arn:aws:sns:region:account:topic:token)
      const parts = response.SubscriptionArn.split(':');
      const token = parts[parts.length - 1];
      confirmationUrl = `https://sns.${snsClient.config.region}.amazonaws.com/?Action=ConfirmSubscription&TopicArn=${SNS_TOPIC_ARN}&Token=${token}`;
    }
    
    console.log(`✅ Subscription created for ${manager.name}`);
    if (confirmationUrl) {
      console.log(`   ⚠️  Confirmation required: ${confirmationUrl}`);
    }
    console.log('');
    
    return {
      managerName: manager.name,
      email: manager.email,
      success: true,
      subscriptionArn: response.SubscriptionArn,
      confirmationUrl: confirmationUrl || undefined
    };
  } catch (error: any) {
    console.error(`❌ Failed to subscribe ${manager.name}:`, error?.message);
    
    return {
      managerName: manager.name,
      email: manager.email,
      success: false,
      error: error?.message || 'Unknown error'
    };
  }
}

/**
 * Get existing subscriptions
 */
async function getExistingSubscriptions() {
  const command = new ListSubscriptionsByTopicCommand({
    TopicArn: SNS_TOPIC_ARN
  });
  
  const response = await snsClient.send(command);
  return response.Subscriptions || [];
}

/**
 * Main function
 */
async function subscribeAllManagers() {
  console.log('🔔 Subscribing All Managers to SNS Topic\n');
  console.log('='.repeat(60));
  console.log(`Topic ARN: ${SNS_TOPIC_ARN}`);
  console.log(`Region: ca-central-1\n`);
  
  try {
    // Get all managers from database
    console.log('📋 Step 1: Fetching all managers from database...\n');
    const managers = await getAllManagers();
    
    if (managers.length === 0) {
      console.log('⚠️  No managers found in database.\n');
      return;
    }
    
    console.log(`✅ Found ${managers.length} manager(s):\n`);
    managers.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.name} (${m.email})`);
    });
    console.log('');
    
    // Get existing subscriptions
    console.log('📋 Step 2: Checking existing subscriptions...\n');
    const existingSubs = await getExistingSubscriptions();
    const existingEmails = new Set(
      existingSubs
        .filter(s => s.Protocol === 'email')
        .map(s => s.Endpoint?.toLowerCase())
    );
    
    console.log(`Found ${existingSubs.filter(s => s.Protocol === 'email').length} existing email subscription(s)\n`);
    
    // Subscribe all managers
    console.log('📧 Step 3: Subscribing managers...\n');
    const results: SubscriptionResult[] = [];
    
    for (const manager of managers) {
      // Skip if already subscribed
      if (existingEmails.has(manager.email.toLowerCase())) {
        console.log(`⏭️  Skipping ${manager.name} - already subscribed\n`);
        continue;
      }
      
      const result = await subscribeManagerEmail(manager);
      results.push(result);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Summary
    console.log('='.repeat(60));
    console.log('📊 Subscription Summary\n');
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const pending = successful.filter(r => r.subscriptionArn?.includes('PendingConfirmation'));
    const confirmed = successful.filter(r => !r.subscriptionArn?.includes('PendingConfirmation'));
    
    console.log(`✅ Successful: ${successful.length}`);
    console.log(`   - Confirmed: ${confirmed.length}`);
    console.log(`   - Pending Confirmation: ${pending.length}`);
    console.log(`❌ Failed: ${failed.length}\n`);
    
    if (pending.length > 0) {
      console.log('📬 Confirmation Required:\n');
      pending.forEach((r, i) => {
        console.log(`${i + 1}. ${r.managerName} (${r.email})`);
        if (r.confirmationUrl) {
          console.log(`   Confirmation URL: ${r.confirmationUrl}`);
        } else {
          console.log(`   ⚠️  Check email inbox for confirmation link`);
        }
        console.log('');
      });
    }
    
    if (failed.length > 0) {
      console.log('❌ Failed Subscriptions:\n');
      failed.forEach((r, i) => {
        console.log(`${i + 1}. ${r.managerName} (${r.email}): ${r.error}\n`);
      });
    }
    
    console.log('='.repeat(60));
    console.log('\n📝 Next Steps:');
    console.log('1. For pending subscriptions, click confirmation URLs above');
    console.log('2. Or check email inboxes for confirmation links');
    console.log('3. Once confirmed, managers will receive notifications automatically');
    console.log('4. New managers added to database will need to be subscribed (run this script again)\n');
    
  } catch (error: any) {
    console.error('❌ Error:', error?.message);
    console.error(error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  subscribeAllManagers()
    .then(() => {
      console.log('✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { subscribeAllManagers, getAllManagers, subscribeManagerEmail };


/**
 * Lambda function to subscribe a manager's email to SNS topic
 * 
 * This function is called automatically when a manager is created
 * to subscribe them to training completion notifications via SNS.
 */

import { SNSClient, SubscribeCommand, ListSubscriptionsByTopicCommand } from '@aws-sdk/client-sns';

const snsClient = new SNSClient({ region: 'ca-central-1' });

// SNS Topic ARN
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN || 
  'arn:aws:sns:ca-central-1:216348571084:training-completion-notifications';

interface SubscribeManagerEvent {
  email: string;
  name?: string;
  managerId?: string;
}

interface SubscriptionResult {
  success: boolean;
  subscriptionArn?: string;
  confirmationUrl?: string;
  message?: string;
  error?: string;
}

export const handler = async (event: any): Promise<SubscriptionResult> => {
  const logPrefix = '[SUBSCRIBE_MANAGER_SNS]';
  console.log(`${logPrefix} ========================================`);
  console.log(`${logPrefix} 📧 Subscribing Manager to SNS Topic`);
  console.log(`${logPrefix} Raw Event:`, JSON.stringify(event, null, 2));
  console.log(`${logPrefix} ========================================`);

  try {
    // Handle Function URL invocation (HTTP event with body)
    let requestData: SubscribeManagerEvent;
    
    if (event.body) {
      // Function URL invocation - body is a JSON string
      console.log(`${logPrefix} [PARSING] Parsing Function URL event body...`);
      requestData = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      console.log(`${logPrefix} [PARSING] Parsed data:`, JSON.stringify(requestData, null, 2));
    } else if (event.email) {
      // Direct invocation (for testing)
      requestData = event as SubscribeManagerEvent;
    } else {
      throw new Error('Invalid event format. Expected email in event.body or event.email');
    }

    // Validate input
    if (!requestData.email) {
      console.error(`${logPrefix} [VALIDATION] Email missing in request data`);
      console.error(`${logPrefix} [VALIDATION] Request data:`, JSON.stringify(requestData, null, 2));
      throw new Error('Email is required');
    }

    const email = requestData.email.toLowerCase().trim();
    const managerName = requestData.name || 'Manager';

    console.log(`${logPrefix} [STEP 1] Validating input...`);
    console.log(`${logPrefix} [STEP 1] Email: ${email}`);
    console.log(`${logPrefix} [STEP 1] Manager Name: ${managerName}`);

    // Check if already subscribed
    console.log(`${logPrefix} [STEP 2] Checking existing subscriptions...`);
    const listCommand = new ListSubscriptionsByTopicCommand({
      TopicArn: SNS_TOPIC_ARN
    });
    
    const existingSubs = await snsClient.send(listCommand);
    const existingSubscription = existingSubs.Subscriptions?.find(
      sub => sub.Protocol === 'email' && sub.Endpoint?.toLowerCase() === email
    );

    if (existingSubscription) {
      const isConfirmed = !existingSubscription.SubscriptionArn?.includes('PendingConfirmation');
      
      if (isConfirmed) {
        console.log(`${logPrefix} [STEP 2] ✅ Manager already subscribed and confirmed`);
        return {
          success: true,
          subscriptionArn: existingSubscription.SubscriptionArn,
          message: 'Manager already subscribed and confirmed'
        };
      } else {
        console.log(`${logPrefix} [STEP 2] ⚠️ Manager subscription pending confirmation`);
        // Extract token from ARN if possible
        const token = existingSubscription.SubscriptionArn?.split(':').pop();
        const confirmationUrl = token 
          ? `https://sns.ca-central-1.amazonaws.com/?Action=ConfirmSubscription&TopicArn=${SNS_TOPIC_ARN}&Token=${token}`
          : undefined;
        
        return {
          success: true,
          subscriptionArn: existingSubscription.SubscriptionArn,
          confirmationUrl,
          message: 'Subscription created but pending confirmation. Check email inbox for confirmation link.'
        };
      }
    }

    // Subscribe manager to SNS topic
    console.log(`${logPrefix} [STEP 3] Subscribing ${managerName} (${email}) to SNS topic...`);
    console.log(`${logPrefix} [STEP 3] Topic ARN: ${SNS_TOPIC_ARN}`);
    
    const subscribeCommand = new SubscribeCommand({
      TopicArn: SNS_TOPIC_ARN,
      Protocol: 'email',
      Endpoint: email
    });

    const response = await snsClient.send(subscribeCommand);
    const subscriptionArn = response.SubscriptionArn;

    console.log(`${logPrefix} [STEP 3] ✅ Subscription created`);
    console.log(`${logPrefix} [STEP 3] Subscription ARN: ${subscriptionArn}`);

    // Check if subscription is pending confirmation
    const isPending = subscriptionArn?.includes('PendingConfirmation');
    
    let confirmationUrl: string | undefined;
    if (isPending && subscriptionArn) {
      // Extract token from ARN (format: arn:aws:sns:region:account:topic:token)
      const parts = subscriptionArn.split(':');
      const token = parts[parts.length - 1];
      confirmationUrl = `https://sns.ca-central-1.amazonaws.com/?Action=ConfirmSubscription&TopicArn=${SNS_TOPIC_ARN}&Token=${token}`;
      console.log(`${logPrefix} [STEP 3] ⚠️ Subscription pending confirmation`);
      console.log(`${logPrefix} [STEP 3] Confirmation URL: ${confirmationUrl}`);
    } else {
      console.log(`${logPrefix} [STEP 3] ✅ Subscription confirmed automatically`);
    }

    console.log(`${logPrefix} ========================================`);
    console.log(`${logPrefix} ✅ PROCESS COMPLETE`);
    console.log(`${logPrefix} ========================================`);

    return {
      success: true,
      subscriptionArn,
      confirmationUrl,
      message: isPending 
        ? 'Subscription created. Manager will receive confirmation email.'
        : 'Subscription created and confirmed successfully.'
    };
  } catch (error: any) {
    console.error(`${logPrefix} ========================================`);
    console.error(`${logPrefix} ❌ ERROR IN SUBSCRIBE MANAGER SNS`);
    console.error(`${logPrefix} Error:`, error);
    console.error(`${logPrefix} Error message:`, error?.message);
    console.error(`${logPrefix} Stack:`, error?.stack);
    console.error(`${logPrefix} ========================================`);

    return {
      success: false,
      error: error?.message || 'Unknown error',
      message: `Failed to subscribe manager: ${error?.message || 'Unknown error'}`
    };
  }
};

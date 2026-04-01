import { defineFunction } from '@aws-amplify/backend';

/**
 * Lambda function triggered when a quiz is completed
 * Updates assignment status and sends notifications via SNS
 * 
 * NOTE: AppSync API URL and API key are automatically injected by Amplify Console
 * environment variables for each branch (dev, qa, main).
 * 
 * The handler reads from process.env.APPSYNC_API_URL and process.env.APPSYNC_API_KEY
 * which are automatically set by Amplify during deployment.
 */
export const quizCompletion = defineFunction({
  name: 'quizCompletion',
  entry: './handler.ts',
  runtime: 20,
  timeoutSeconds: 15, // Increased from 3 to handle AppSync queries + SNS publish
  environment: {
    // SNS Topic ARN for publishing notifications
    SNS_TOPIC_ARN: 'arn:aws:sns:ca-central-1:216348571084:training-completion-notifications'
    // APPSYNC_API_URL and APPSYNC_API_KEY are set automatically by Amplify Console
    // environment variables for each branch
  }
  // Note: IAM permissions for SNS publish need to be added manually in AWS Console
  // Go to Lambda → Configuration → Permissions → Execution role → Add inline policy
  // Policy: Allow sns:Publish on arn:aws:sns:ca-central-1:216348571084:training-completion-notifications
});
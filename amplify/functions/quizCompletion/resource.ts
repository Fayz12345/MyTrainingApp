import { defineFunction } from '@aws-amplify/backend';

export const quizCompletion = defineFunction({
  name: 'quizCompletion',
  entry: './handler.ts',
  timeoutSeconds: 15, // Increased from 3 to handle AppSync queries + SNS publish
  environment: {
    APPSYNC_API_URL: 'https://mswo73fsfjh4thfaalt7d63i4a.appsync-api.ca-central-1.amazonaws.com/graphql',
    APPSYNC_API_KEY: 'da2-la7esrklanbehi5v7e574ao7fq',
    // SNS Topic ARN for publishing notifications
    SNS_TOPIC_ARN: 'arn:aws:sns:ca-central-1:216348571084:training-completion-notifications'
  }
  // Note: IAM permissions for SNS publish need to be added manually in AWS Console
  // Go to Lambda → Configuration → Permissions → Execution role → Add inline policy
  // Policy: Allow sns:Publish on arn:aws:sns:ca-central-1:216348571084:training-completion-notifications
});
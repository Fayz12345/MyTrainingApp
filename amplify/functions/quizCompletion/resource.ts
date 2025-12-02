import { defineFunction } from '@aws-amplify/backend';

export const quizCompletion = defineFunction({
  name: 'quizCompletion',
  entry: './handler.ts',
  environment: {
    APPSYNC_API_URL: 'https://mswo73fsfjh4thfaalt7d63i4a.appsync-api.ca-central-1.amazonaws.com/graphql',
    APPSYNC_API_KEY: 'da2-la7esrklanbehi5v7e574ao7fq',
    // SNS_TOPIC_ARN will be set after creating SNS topic in AWS Console
    // Update this in Lambda environment variables after deployment
    // SNS_TOPIC_ARN: 'arn:aws:sns:ca-central-1:ACCOUNT_ID:training-completion-notifications'
  }
});
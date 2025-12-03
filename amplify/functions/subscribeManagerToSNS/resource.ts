import { defineFunction } from '@aws-amplify/backend';

export const subscribeManagerToSNS = defineFunction({
  name: 'subscribeManagerToSNS',
  entry: './handler.ts',
  timeoutSeconds: 10,
  environment: {
    SNS_TOPIC_ARN: 'arn:aws:sns:ca-central-1:216348571084:training-completion-notifications'
  }
  // Note: IAM permissions for SNS subscribe need to be added manually
  // The Lambda execution role needs: sns:Subscribe, sns:ListSubscriptionsByTopic
});

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const snsClient = new SNSClient({ region: 'us-east-1' });

export const handler = async (event: any) => {
  try {
    if (event.passed) {
      const params = {
        Message: `Employee ${event.employeeId} completed course ${event.courseId} with score ${event.score}`,
        TopicArn: 'YOUR_SNS_TOPIC_ARN' // Replace with actual ARN after creating SNS topic
      };
      await snsClient.send(new PublishCommand(params));
    }
    return { status: 'success' };
  } catch (error) {
    console.error('Error publishing SNS message:', error);
    throw error;
  }
};
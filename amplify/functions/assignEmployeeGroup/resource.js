import { defineFunction } from '@aws-amplify/backend';
/**
 * Lambda function that automatically assigns new users to the "Employees" group
 * This function is triggered by Cognito's Post Confirmation trigger
 */
export const assignEmployeeGroup = defineFunction({
    name: 'assignEmployeeGroup',
    entry: './handler.ts'
});

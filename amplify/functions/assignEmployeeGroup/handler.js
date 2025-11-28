import { CognitoIdentityProviderClient, AdminAddUserToGroupCommand } from '@aws-sdk/client-cognito-identity-provider';
const cognitoClient = new CognitoIdentityProviderClient({});
/**
 * Lambda function to automatically assign new users to the "Employees" group
 * This is triggered after a user confirms their email during signup
 */
export const handler = async (event) => {
    console.log('Post-confirmation trigger event:', JSON.stringify(event, null, 2));
    const userPoolId = event.userPoolId;
    const username = event.userName;
    // Only process if user pool ID and username are present
    if (!userPoolId || !username) {
        console.error('Missing userPoolId or userName in event');
        return event;
    }
    try {
        // Add user to Employees group
        const command = new AdminAddUserToGroupCommand({
            UserPoolId: userPoolId,
            Username: username,
            GroupName: 'Employees'
        });
        await cognitoClient.send(command);
        console.log(`✅ Successfully added user ${username} to Employees group`);
        return event;
    }
    catch (error) {
        console.error('❌ Error adding user to Employees group:', error);
        // If group doesn't exist, log warning but don't fail
        if (error.name === 'ResourceNotFoundException') {
            console.warn('⚠️ Employees group not found. Please ensure the group exists in Cognito.');
        }
        // Return event anyway to allow signup to complete
        // The user can be manually added to the group later if needed
        return event;
    }
};

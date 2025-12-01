import { CognitoIdentityProviderClient, AdminAddUserToGroupCommand, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
const cognitoClient = new CognitoIdentityProviderClient({});
/**
 * Lambda function to automatically assign new users to the correct group based on their role
 * This is triggered after a user confirms their email during signup or is created via AdminCreateUser
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
        // Get user attributes to determine their role
        let userRole = 'employee'; // default
        let userEmail = '';
        
        // Check if user attributes are in the event (from signup)
        if (event.request && event.request.userAttributes) {
            userEmail = event.request.userAttributes.email || '';
            // Check for custom attribute 'custom:role' if set by external Lambda
            userRole = event.request.userAttributes['custom:role'] || 
                      event.request.userAttributes['role'] || 
                      'employee';
        } else {
            // If not in event, try to get user from Cognito
            try {
                const getUserCommand = new AdminGetUserCommand({
                    UserPoolId: userPoolId,
                    Username: username
                });
                const userData = await cognitoClient.send(getUserCommand);
                userEmail = userData.UserAttributes?.find(attr => attr.Name === 'email')?.Value || '';
                userRole = userData.UserAttributes?.find(attr => attr.Name === 'custom:role')?.Value ||
                          userData.UserAttributes?.find(attr => attr.Name === 'role')?.Value ||
                          'employee';
            } catch (getUserError) {
                console.warn('Could not fetch user attributes, defaulting to employee:', getUserError);
            }
        }
        
        // Determine group based on role
        let groupName = 'Employees'; // default
        if (userRole === 'manager' || userRole === 'Managers') {
            groupName = 'Managers';
        } else if (userRole === 'store' || userRole === 'Store') {
            groupName = 'Store';
        } else if (userRole === 'businessunit' || userRole === 'BusinessUnit') {
            groupName = 'BusinessUnit';
        } else if (userRole === 'superadmin' || userRole === 'SuperAdmin') {
            groupName = 'SuperAdmin';
        }
        
        console.log(`Assigning user ${username} (${userEmail}) to ${groupName} group based on role: ${userRole}`);
        
        // Add user to the appropriate group
        const command = new AdminAddUserToGroupCommand({
            UserPoolId: userPoolId,
            Username: username,
            GroupName: groupName
        });
        await cognitoClient.send(command);
        console.log(`✅ Successfully added user ${username} to ${groupName} group`);
        
        return event;
    }
    catch (error) {
        console.error(`❌ Error adding user ${username} to group:`, error);
        // If group doesn't exist, log warning but don't fail
        if (error.name === 'ResourceNotFoundException') {
            console.warn('⚠️ Group not found. Please ensure the group exists in Cognito.');
        }
        // Return event anyway to allow signup to complete
        // The user can be manually added to the group later if needed
        return event;
    }
};

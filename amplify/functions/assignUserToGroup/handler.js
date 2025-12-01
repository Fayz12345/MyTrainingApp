import { CognitoIdentityProviderClient, AdminAddUserToGroupCommand } from '@aws-sdk/client-cognito-identity-provider';

const cognitoClient = new CognitoIdentityProviderClient({});

/**
 * Lambda function to add a user to a Cognito group
 * This can be called after user creation to assign them to the correct group
 */
export const handler = async (event) => {
    console.log('Assign user to group event:', JSON.stringify(event, null, 2));
    
    const { userPoolId, username, groupName } = event;
    
    if (!userPoolId || !username || !groupName) {
        console.error('Missing required parameters: userPoolId, username, or groupName');
        return {
            statusCode: 400,
            body: JSON.stringify({ 
                success: false, 
                error: 'Missing required parameters: userPoolId, username, and groupName are required' 
            })
        };
    }
    
    try {
        const command = new AdminAddUserToGroupCommand({
            UserPoolId: userPoolId,
            Username: username,
            GroupName: groupName
        });
        
        await cognitoClient.send(command);
        console.log(`✅ Successfully added user ${username} to ${groupName} group`);
        
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                success: true, 
                message: `User ${username} added to ${groupName} group` 
            })
        };
    } catch (error) {
        console.error(`❌ Error adding user ${username} to ${groupName} group:`, error);
        
        // If user is already in the group, that's okay
        if (error.name === 'InvalidParameterException' && error.message?.includes('already exists')) {
            console.log(`ℹ️ User ${username} is already in ${groupName} group`);
            return {
                statusCode: 200,
                body: JSON.stringify({ 
                    success: true, 
                    message: `User ${username} is already in ${groupName} group` 
                })
            };
        }
        
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                success: false, 
                error: error.message || 'Failed to add user to group' 
            })
        };
    }
};


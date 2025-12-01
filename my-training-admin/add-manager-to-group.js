/**
 * Script to add a manager user to the Managers Cognito group
 * 
 * This script can be used to manually add managers to the Managers group
 * if they were created but not automatically added.
 * 
 * Usage:
 *   node add-manager-to-group.js <email>
 * 
 * Example:
 *   node add-manager-to-group.js manager@example.com
 * 
 * Prerequisites:
 *   - AWS CLI configured with appropriate credentials
 *   - AWS SDK for JavaScript v3 installed
 *   - amplify_outputs.json file in src/ directory
 */

const { CognitoIdentityProviderClient, AdminAddUserToGroupCommand } = require('@aws-sdk/client-cognito-identity-provider');
const amplifyConfig = require('./src/amplify_outputs.json');

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.error('❌ Error: Email address is required');
  console.log('\nUsage: node add-manager-to-group.js <email>');
  console.log('Example: node add-manager-to-group.js manager@example.com');
  process.exit(1);
}

// Configuration from amplify_outputs.json
const USER_POOL_ID = amplifyConfig.auth.user_pool_id;
const AWS_REGION = amplifyConfig.auth.aws_region;

if (!USER_POOL_ID || USER_POOL_ID === 'null') {
  console.error('❌ Error: Could not read user_pool_id from amplify_outputs.json');
  process.exit(1);
}

const client = new CognitoIdentityProviderClient({ region: AWS_REGION });

async function addManagerToGroup() {
  try {
    console.log(`\n🔧 Adding user ${email} to Managers group...\n`);
    console.log(`User Pool ID: ${USER_POOL_ID}`);
    console.log(`Region: ${AWS_REGION}\n`);
    
    const command = new AdminAddUserToGroupCommand({
      UserPoolId: USER_POOL_ID,
      Username: email, // Cognito uses email as username
      GroupName: 'Managers'
    });
    
    await client.send(command);
    
    console.log(`✅ Successfully added ${email} to Managers group!`);
    console.log(`\nThe user should now appear in the Managers group in the Cognito console.`);
    
  } catch (error) {
    if (error.name === 'UserNotFoundException') {
      console.error(`❌ Error: User "${email}" not found in Cognito User Pool`);
      console.log('\n💡 Make sure the user exists and the email is correct.');
    } else if (error.name === 'ResourceNotFoundException') {
      console.error(`❌ Error: Managers group not found`);
      console.log('\n💡 Please run create-cognito-groups.js to create the group.');
    } else if (error.name === 'InvalidParameterException' && error.message?.includes('already exists')) {
      console.log(`ℹ️  User ${email} is already in the Managers group.`);
    } else {
      console.error(`❌ Error: ${error.message}`);
      console.error(error);
    }
    process.exit(1);
  }
}

addManagerToGroup();


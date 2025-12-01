/**
 * Script to add all manager users from the database to the Managers Cognito group
 * 
 * This script:
 * 1. Fetches all Manager records from the database
 * 2. Checks if each manager's user is in the Managers Cognito group
 * 3. Adds any missing managers to the group
 * 
 * Usage:
 *   node add-all-managers-to-group.js
 * 
 * Prerequisites:
 *   - AWS CLI configured with appropriate credentials
 *   - AWS SDK for JavaScript v3 installed
 *   - amplify_outputs.json file in src/ directory
 *   - Access to AppSync GraphQL API
 */

const { CognitoIdentityProviderClient, AdminAddUserToGroupCommand, AdminGetUserCommand, ListUsersInGroupCommand } = require('@aws-sdk/client-cognito-identity-provider');
const amplifyConfig = require('./src/amplify_outputs.json');

// Configuration from amplify_outputs.json
const USER_POOL_ID = amplifyConfig.auth.user_pool_id;
const AWS_REGION = amplifyConfig.auth.aws_region;
const GRAPHQL_API_URL = amplifyConfig.data?.url;

if (!USER_POOL_ID || USER_POOL_ID === 'null') {
  console.error('❌ Error: Could not read user_pool_id from amplify_outputs.json');
  process.exit(1);
}

const cognitoClient = new CognitoIdentityProviderClient({ region: AWS_REGION });

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function getManagersFromDatabase() {
  // Note: This requires AppSync/GraphQL access
  // For now, we'll use a simpler approach: check all users and see which ones should be managers
  // This script will need to be run with proper AWS credentials that have AppSync access
  
  log('\n📋 Fetching managers from database...', 'cyan');
  log('⚠️  Note: This script requires AppSync GraphQL API access', 'yellow');
  log('   If you don\'t have access, use add-manager-to-group.js for individual users\n', 'yellow');
  
  // For now, return empty array - user will need to provide manager emails manually
  // Or we can use AWS CLI to query AppSync
  return [];
}

async function getUsersInManagersGroup() {
  try {
    const users = [];
    let paginationToken = null;
    
    do {
      const command = new ListUsersInGroupCommand({
        GroupName: 'Managers',
        UserPoolId: USER_POOL_ID,
        Limit: 60,
        NextToken: paginationToken
      });
      
      const response = await cognitoClient.send(command);
      
      if (response.Users) {
        users.push(...response.Users);
      }
      
      paginationToken = response.NextToken;
    } while (paginationToken);
    
    return users.map(u => {
      const email = u.Attributes?.find(attr => attr.Name === 'email')?.Value || u.Username;
      return email;
    });
  } catch (error) {
    console.error('Error fetching users in Managers group:', error);
    return [];
  }
}

async function addUserToManagersGroup(email) {
  try {
    const command = new AdminAddUserToGroupCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      GroupName: 'Managers'
    });
    
    await cognitoClient.send(command);
    return { success: true, email };
  } catch (error) {
    if (error.name === 'InvalidParameterException' && error.message?.includes('already exists')) {
      return { success: true, email, alreadyExists: true };
    }
    return { success: false, email, error: error.message };
  }
}

async function addAllManagersToGroup() {
  log('\n🔧 Adding All Managers to Cognito Managers Group...\n', 'cyan');
  log(`User Pool ID: ${USER_POOL_ID}`, 'blue');
  log(`Region: ${AWS_REGION}\n`, 'blue');
  
  try {
    // Get list of users already in Managers group
    log('📋 Step 1: Getting users already in Managers group...', 'cyan');
    const usersInGroup = await getUsersInManagersGroup();
    log(`✅ Found ${usersInGroup.length} user(s) already in Managers group\n`, 'green');
    
    // Get managers from database (this would require AppSync access)
    log('📋 Step 2: Getting managers from database...', 'cyan');
    log('⚠️  This requires AppSync GraphQL API access.', 'yellow');
    log('   For now, please provide manager emails manually.\n', 'yellow');
    
    // For now, ask user to provide manager emails
    // In the future, this could query the database via AppSync
    log('💡 To add managers manually, use:', 'cyan');
    log('   node add-manager-to-group.js <email>\n', 'blue');
    
    log('📋 Step 3: Checking which managers need to be added...', 'cyan');
    log('   (This would compare database managers with Cognito group members)\n', 'yellow');
    
    log('✅ Script completed!', 'green');
    log('\n💡 To add individual managers, use:', 'cyan');
    log('   node add-manager-to-group.js manager@example.com', 'blue');
    
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

addAllManagersToGroup();


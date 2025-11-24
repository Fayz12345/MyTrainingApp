/**
 * Script to create all Cognito User Groups for the MyTrainingApp
 * 
 * This script creates the following groups:
 * - Employees (precedence: 0)
 * - Managers (precedence: 1)
 * - Store (precedence: 2)
 * - BusinessUnit (precedence: 3)
 * - SuperAdmin (precedence: 4)
 * 
 * Usage:
 *   node create-cognito-groups.js
 * 
 * Prerequisites:
 *   - AWS CLI configured with appropriate credentials
 *   - AWS SDK for JavaScript v3 installed (npm install @aws-sdk/client-cognito-identity-provider)
 */

const { CognitoIdentityProviderClient, CreateGroupCommand, GetGroupCommand } = require('@aws-sdk/client-cognito-identity-provider');
const amplifyConfig = require('./src/amplify_outputs.json');

// Configuration from amplify_outputs.json
const USER_POOL_ID = amplifyConfig.auth.user_pool_id;
const AWS_REGION = amplifyConfig.auth.aws_region;

// Define all groups with their precedence (lower number = higher priority)
const GROUPS = [
  { name: 'Employees', precedence: 0, description: 'Regular employees who can take courses' },
  { name: 'Managers', precedence: 1, description: 'Managers who can create courses and assign them to employees' },
  { name: 'Store', precedence: 2, description: 'Store administrators who can manage stores and managers' },
  { name: 'BusinessUnit', precedence: 3, description: 'Business unit administrators who can manage stores' },
  { name: 'SuperAdmin', precedence: 4, description: 'Super administrators with full system access' }
];

const client = new CognitoIdentityProviderClient({ region: AWS_REGION });

async function checkGroupExists(groupName) {
  try {
    const command = new GetGroupCommand({
      GroupName: groupName,
      UserPoolId: USER_POOL_ID
    });
    await client.send(command);
    return true;
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      return false;
    }
    throw error;
  }
}

async function createGroup(group) {
  try {
    // Check if group already exists
    const exists = await checkGroupExists(group.name);
    
    if (exists) {
      console.log(`✅ Group "${group.name}" already exists, skipping...`);
      return { success: true, skipped: true, group: group.name };
    }

    // Create the group
    const command = new CreateGroupCommand({
      GroupName: group.name,
      UserPoolId: USER_POOL_ID,
      Precedence: group.precedence,
      Description: group.description
    });

    const response = await client.send(command);
    console.log(`✅ Created group "${group.name}" with precedence ${group.precedence}`);
    return { success: true, skipped: false, group: group.name, response };
  } catch (error) {
    console.error(`❌ Error creating group "${group.name}":`, error.message);
    return { success: false, group: group.name, error: error.message };
  }
}

async function createAllGroups() {
  console.log('🚀 Starting Cognito Group Creation...\n');
  console.log(`User Pool ID: ${USER_POOL_ID}`);
  console.log(`Region: ${AWS_REGION}\n`);
  console.log('Groups to create:');
  GROUPS.forEach(group => {
    console.log(`  - ${group.name} (precedence: ${group.precedence})`);
  });
  console.log('\n');

  const results = [];

  for (const group of GROUPS) {
    const result = await createGroup(group);
    results.push(result);
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n📊 Summary:');
  console.log('─'.repeat(50));
  
  const created = results.filter(r => r.success && !r.skipped).length;
  const skipped = results.filter(r => r.success && r.skipped).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`✅ Created: ${created} groups`);
  console.log(`⏭️  Skipped (already exist): ${skipped} groups`);
  console.log(`❌ Failed: ${failed} groups`);

  if (failed > 0) {
    console.log('\n❌ Failed groups:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.group}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 All groups created successfully!');
    process.exit(0);
  }
}

// Run the script
createAllGroups().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


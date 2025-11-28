import {
  CognitoIdentityProviderClient,
  CreateGroupCommand,
  GetGroupCommand,
  ListGroupsCommand
} from '@aws-sdk/client-cognito-identity-provider';

const cognitoClient = new CognitoIdentityProviderClient({});

// Define all groups with their precedence (lower number = higher priority)
const GROUPS = [
  { name: 'Employees', precedence: 0, description: 'Regular employees who can take courses' },
  { name: 'Managers', precedence: 1, description: 'Managers who can create courses and assign them to employees' },
  { name: 'Store', precedence: 2, description: 'Store administrators who can manage stores and managers' },
  { name: 'BusinessUnit', precedence: 3, description: 'Business unit administrators who can manage stores' },
  { name: 'SuperAdmin', precedence: 4, description: 'Super administrators with full system access' }
];

/**
 * Lambda handler to create Cognito groups
 * This can be triggered manually or via CloudFormation custom resource
 */
export const handler = async (event: any) => {
  console.log('Creating Cognito groups event:', JSON.stringify(event, null, 2));

  // Get User Pool ID from environment or event
  const userPoolId = event.userPoolId;

  if (!userPoolId) {
    const error = 'User Pool ID not found in environment or event';
    console.error(`❌ ${error}`);
    throw new Error(error);
  }

  console.log(`📋 User Pool ID: ${userPoolId}`);
  console.log(`📦 Groups to create: ${GROUPS.map(g => g.name).join(', ')}`);

  const results = {
    created: [] as string[],
    existing: [] as string[],
    failed: [] as { group: string; error: string }[]
  };

  // Check existing groups first
  let existingGroups: string[] = [];
  try {
    const listCommand = new ListGroupsCommand({
      UserPoolId: userPoolId,
      Limit: 60 // Cognito default limit
    });
    const listResponse = await cognitoClient.send(listCommand);
    existingGroups = listResponse.Groups?.map(g => g.GroupName || '') || [];
    console.log(`✅ Found ${existingGroups.length} existing groups: ${existingGroups.join(', ')}`);
  } catch (error: any) {
    console.warn(`⚠️ Could not list existing groups: ${error.message}`);
  }

  // Create each group
  for (const group of GROUPS) {
    try {
      // Check if group already exists
      if (existingGroups.includes(group.name)) {
        console.log(`⏭️  Group "${group.name}" already exists, skipping...`);
        results.existing.push(group.name);
        continue;
      }

      // Try to get group to check if it exists
      try {
        const getCommand = new GetGroupCommand({
          GroupName: group.name,
          UserPoolId: userPoolId
        });
        await cognitoClient.send(getCommand);
        console.log(`⏭️  Group "${group.name}" already exists, skipping...`);
        results.existing.push(group.name);
        continue;
      } catch (getError: any) {
        if (getError.name !== 'ResourceNotFoundException') {
          throw getError;
        }
        // Group doesn't exist, continue to create it
      }

      // Create the group
      const createCommand = new CreateGroupCommand({
        GroupName: group.name,
        UserPoolId: userPoolId,
        Precedence: group.precedence,
        Description: group.description
      });

      await cognitoClient.send(createCommand);
      console.log(`✅ Created group "${group.name}" with precedence ${group.precedence}`);
      results.created.push(group.name);

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error: any) {
      console.error(`❌ Error processing group "${group.name}":`, error.message);
      results.failed.push({ group: group.name, error: error.message });
    }
  }

  // Summary
  console.log('\n📊 Summary:');
  console.log(`✅ Created: ${results.created.length} groups`);
  console.log(`⏭️  Existing: ${results.existing.length} groups`);
  console.log(`❌ Failed: ${results.failed.length} groups`);

  if (results.failed.length > 0) {
    console.log('\n❌ Failed groups:');
    results.failed.forEach(f => {
      console.log(`  - ${f.group}: ${f.error}`);
    });
  }

  // Return results
  return {
    statusCode: results.failed.length > 0 ? 500 : 200,
    body: JSON.stringify({
      message: 'Cognito groups creation completed',
      results: {
        created: results.created,
        existing: results.existing,
        failed: results.failed
      }
    }, null, 2)
  };
};


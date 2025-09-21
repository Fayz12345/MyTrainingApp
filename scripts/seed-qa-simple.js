#!/usr/bin/env node

/**
 * Simple QA Test Data Seeding Script
 * Creates Cognito users for testing - GraphQL data can be added via Admin Portal
 */

const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminSetUserPasswordCommand, AdminAddUserToGroupCommand } = require('@aws-sdk/client-cognito-identity-provider');
const fs = require('fs');
const path = require('path');

// Load Amplify configuration
const amplifyConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../amplify_outputs.json'), 'utf8'));
const cognitoClient = new CognitoIdentityProviderClient({ region: amplifyConfig.auth.aws_region });

// Test user data
const TEST_USERS = {
  managers: [
    {
      email: 'qa-manager@testcompany.com',
      name: 'QA Manager',
      password: 'TempQAPass123!'
    },
    {
      email: 'qa-supervisor@testcompany.com', 
      name: 'QA Supervisor',
      password: 'TempQAPass123!'
    }
  ],
  employees: [
    {
      email: 'qa-employee1@testcompany.com',
      name: 'QA Employee One',
      password: 'TempQAPass123!'
    },
    {
      email: 'qa-employee2@testcompany.com',
      name: 'QA Employee Two', 
      password: 'TempQAPass123!'
    },
    {
      email: 'qa-employee3@testcompany.com',
      name: 'QA Employee Three',
      password: 'TempQAPass123!'
    }
  ]
};

async function createCognitoUser(userData, group) {
  try {
    console.log(`Creating Cognito user: ${userData.email}`);
    
    // Create user
    const createUserCommand = new AdminCreateUserCommand({
      UserPoolId: amplifyConfig.auth.user_pool_id,
      Username: userData.email,
      UserAttributes: [
        { Name: 'email', Value: userData.email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'name', Value: userData.name }
      ],
      MessageAction: 'SUPPRESS',
      TemporaryPassword: userData.password
    });
    
    const createUserResult = await cognitoClient.send(createUserCommand);
    
    // Set permanent password
    const setPasswordCommand = new AdminSetUserPasswordCommand({
      UserPoolId: amplifyConfig.auth.user_pool_id,
      Username: userData.email,
      Password: userData.password,
      Permanent: true
    });
    await cognitoClient.send(setPasswordCommand);
    
    // Add to group
    const addToGroupCommand = new AdminAddUserToGroupCommand({
      UserPoolId: amplifyConfig.auth.user_pool_id,
      Username: userData.email,
      GroupName: group
    });
    await cognitoClient.send(addToGroupCommand);
    
    console.log(`✅ Created ${group} user: ${userData.email}`);
    return createUserResult.User.Username;
    
  } catch (error) {
    if (error.name === 'UsernameExistsException') {
      console.log(`⚠️  User ${userData.email} already exists, skipping...`);
      return userData.email;
    }
    console.error(`❌ Failed to create user ${userData.email}:`, error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Starting QA test user creation...');
    console.log(`Environment: ${amplifyConfig.auth.user_pool_id}`);
    
    // Create managers
    console.log('\n📋 Creating managers...');
    for (const managerData of TEST_USERS.managers) {
      await createCognitoUser(managerData, 'Managers');
    }
    
    // Create employees  
    console.log('\n👥 Creating employees...');
    for (const employeeData of TEST_USERS.employees) {
      await createCognitoUser(employeeData, 'Employees');
    }
    
    console.log('\n✅ QA test user creation completed successfully!');
    console.log('\n🔑 Test Credentials:');
    console.log('Password for all users: TempQAPass123!');
    console.log('\n📋 Managers:');
    TEST_USERS.managers.forEach(m => console.log(`  - ${m.email} (${m.name})`));
    console.log('\n👥 Employees:');
    TEST_USERS.employees.forEach(e => console.log(`  - ${e.email} (${e.name})`));
    
    console.log('\n📝 Next Steps:');
    console.log('1. Login to QA Admin Portal with manager credentials');
    console.log('2. Create employees using the Employee Form');
    console.log('3. Create training courses');
    console.log('4. Assign courses to employees');
    console.log('5. Test mobile app with employee credentials');
    
  } catch (error) {
    console.error('❌ User creation failed:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main, TEST_USERS };
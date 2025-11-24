const { Amplify } = require('aws-amplify');
const { generateClient } = require('aws-amplify/data');

// Import the amplify outputs
const amplifyConfig = require('./src/amplify_outputs.json');

Amplify.configure(amplifyConfig);

const client = generateClient();

async function addTestEmployee() {
  try {
    console.log('Creating test employee...');
    
    const result = await client.models.Employee.create({
      userId: 'bced7578-50d1-7076-683e-2710e14a8706', // Test user's Cognito ID
      email: 'testemployee@example.com',
      name: 'Test Employee',
      department: 'Testing',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    console.log('Test employee created successfully:', result);
    
    if (result.errors) {
      console.error('GraphQL errors:', result.errors);
    }
    
    if (result.data) {
      console.log('Employee data:', result.data);
    }
  } catch (error) {
    console.error('Error creating test employee:', error);
    console.error('Error details:', error.message);
  }
}

addTestEmployee();
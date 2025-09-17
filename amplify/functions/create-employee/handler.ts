import type { APIGatewayProxyHandler } from 'aws-lambda';
import AWS from 'aws-sdk';

const cognitoClient = new AWS.CognitoIdentityServiceProvider({ region: process.env.AWS_REGION });
const dynamoClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });

interface CreateEmployeeRequest {
  email: string;
  name: string;
  department?: string;
  temporaryPassword: string;
  role: 'employee' | 'manager';
}

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Create Employee Lambda invoked:', event);

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'OPTIONS,POST'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Request body is required' })
      };
    }

    const requestData: CreateEmployeeRequest = JSON.parse(event.body);
    const { email, name, department, temporaryPassword, role } = requestData;

    console.log('Creating employee:', { email, name, department, role });

    // Validate required fields
    if (!email || !name || !temporaryPassword || !role) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Email, name, temporaryPassword, and role are required' })
      };
    }

    const userPoolId = process.env.USER_POOL_ID;
    if (!userPoolId) {
      throw new Error('USER_POOL_ID environment variable not set');
    }

    // Step 1: Create Cognito user
    console.log('Creating Cognito user...');
    const createUserResult = await cognitoClient.adminCreateUser({
      UserPoolId: userPoolId,
      Username: email,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' }
      ],
      TemporaryPassword: temporaryPassword,
      MessageAction: 'SUPPRESS' // Don't send welcome email
    }).promise();

    const cognitoUserId = createUserResult.User?.Username;
    if (!cognitoUserId) {
      throw new Error('Failed to get Cognito user ID');
    }

    console.log('Cognito user created with ID:', cognitoUserId);

    // Step 2: Add user to appropriate group
    const groupName = role === 'manager' ? 'Managers' : 'Employees';
    console.log('Adding user to group:', groupName);
    
    await cognitoClient.adminAddUserToGroup({
      UserPoolId: userPoolId,
      Username: cognitoUserId,
      GroupName: groupName
    }).promise();

    // Step 3: Set permanent password
    console.log('Setting permanent password...');
    await cognitoClient.adminSetUserPassword({
      UserPoolId: userPoolId,
      Username: cognitoUserId,
      Password: temporaryPassword,
      Permanent: true
    }).promise();

    // Step 4: Create Employee record in DynamoDB
    console.log('Creating Employee record in database...');
    const employeeTableName = process.env.EMPLOYEE_TABLE_NAME;
    if (!employeeTableName) {
      throw new Error('EMPLOYEE_TABLE_NAME environment variable not set');
    }

    const employeeId = `emp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    await dynamoClient.put({
      TableName: employeeTableName,
      Item: {
        id: employeeId,
        userId: cognitoUserId,
        email: email,
        name: name,
        department: department || null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        __typename: 'Employee'
      }
    }).promise();

    console.log('Employee created successfully:', employeeId);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Employee created successfully',
        employee: {
          id: employeeId,
          userId: cognitoUserId,
          email,
          name,
          department: department || null,
          role,
          isActive: true
        }
      })
    };

  } catch (error) {
    console.error('Error creating employee:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      })
    };
  }
};
#!/usr/bin/env node

/**
 * QA Test Data Seeding Script
 * Seeds the QA environment with test data for comprehensive testing
 */

const { Amplify } = require('aws-amplify');
const { generateClient } = require('aws-amplify/api');
const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminSetUserPasswordCommand, AdminAddUserToGroupCommand } = require('@aws-sdk/client-cognito-identity-provider');
const fs = require('fs');
const path = require('path');

// Load Amplify configuration
const amplifyConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../amplify_outputs.json'), 'utf8'));

// Configure Amplify with IAM auth for admin operations
Amplify.configure({
  ...amplifyConfig,
  API: {
    GraphQL: {
      endpoint: amplifyConfig.data.url,
      region: amplifyConfig.data.aws_region,
      defaultAuthMode: 'iam'
    }
  }
});

const client = generateClient();
const cognitoClient = new CognitoIdentityProviderClient({ region: amplifyConfig.auth.aws_region });

// Test data configuration
const TEST_DATA = {
  managers: [
    {
      email: 'qa-manager@testcompany.com',
      name: 'QA Manager',
      department: 'Testing',
      password: 'TempQAPass123!'
    },
    {
      email: 'qa-supervisor@testcompany.com', 
      name: 'QA Supervisor',
      department: 'Quality Assurance',
      password: 'TempQAPass123!'
    }
  ],
  employees: [
    {
      email: 'qa-employee1@testcompany.com',
      name: 'QA Employee One',
      department: 'Manufacturing',
      password: 'TempQAPass123!'
    },
    {
      email: 'qa-employee2@testcompany.com',
      name: 'QA Employee Two', 
      department: 'Warehouse',
      password: 'TempQAPass123!'
    },
    {
      email: 'qa-employee3@testcompany.com',
      name: 'QA Employee Three',
      department: 'Shipping',
      password: 'TempQAPass123!'
    }
  ],
  courses: [
    {
      title: 'QA Safety Training Fundamentals',
      passingScore: 80,
      videoKey: 'courses/videos/qa-safety-basics.mp4',
      quiz: [
        {
          question: 'What is the first step in workplace safety?',
          options: ['Wear PPE', 'Identify hazards', 'Report incidents', 'Read procedures'],
          correctAnswer: 1
        },
        {
          question: 'How often should safety equipment be inspected?',
          options: ['Weekly', 'Monthly', 'Before each use', 'Annually'],
          correctAnswer: 2
        },
        {
          question: 'What should you do if you witness an unsafe act?',
          options: ['Ignore it', 'Report immediately', 'Document later', 'Tell a friend'],
          correctAnswer: 1
        }
      ]
    },
    {
      title: 'Emergency Response Procedures',
      passingScore: 85,
      videoKey: 'courses/videos/qa-emergency-response.mp4',
      quiz: [
        {
          question: 'What is the first action during a fire emergency?',
          options: ['Call 911', 'Use extinguisher', 'Evacuate area', 'Find fire warden'],
          correctAnswer: 2
        },
        {
          question: 'Where do you meet during evacuation?',
          options: ['Parking lot', 'Designated assembly point', 'Main entrance', 'Break room'],
          correctAnswer: 1
        }
      ]
    },
    {
      title: 'Equipment Operation Training',
      passingScore: 90,
      videoKey: 'courses/videos/qa-equipment-operation.mp4',
      quiz: [
        {
          question: 'Before operating machinery, you must:',
          options: ['Check safety guards', 'Verify training certificate', 'Inspect equipment', 'All of the above'],
          correctAnswer: 3
        }
      ]
    }
  ]
};

// GraphQL mutations
const createEmployee = `
  mutation CreateEmployee($input: CreateEmployeeInput!) {
    createEmployee(input: $input) {
      id
      userId
      email
      name
      department
      isActive
    }
  }
`;

const createCourse = `
  mutation CreateCourse($input: CreateCourseInput!) {
    createCourse(input: $input) {
      id
      title
      videoKey
      passingScore
    }
  }
`;

const createQuizQuestion = `
  mutation CreateQuizQuestion($input: CreateQuizQuestionInput!) {
    createQuizQuestion(input: $input) {
      id
      courseId
      question
      options
      correctAnswer
    }
  }
`;

const createAssignment = `
  mutation CreateAssignment($input: CreateAssignmentInput!) {
    createAssignment(input: $input) {
      id
      employeeId
      courseId
      status
      is_training_complete
    }
  }
`;

// Helper functions
async function createCognitoUser(userData, group) {
  try {
    console.log(`Creating Cognito user: ${userData.email}`);
    
    // Create user
    const createUserCommand = new AdminCreateUserCommand({
      UserPoolId: amplifyConfig.auth.user_pool_id,
      Username: userData.email,
      UserAttributes: [
        { Name: 'email', Value: userData.email },
        { Name: 'email_verified', Value: 'true' }
      ],
      MessageAction: 'SUPPRESS',
      TemporaryPassword: userData.password
    });
    
    const createUserResult = await cognitoClient.send(createUserCommand);
    const userId = createUserResult.User.Username;
    
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
    return userId;
    
  } catch (error) {
    if (error.name === 'UsernameExistsException') {
      console.log(`⚠️  User ${userData.email} already exists, skipping...`);
      return userData.email; // Return email as userId fallback
    }
    throw error;
  }
}

async function createEmployeeRecord(userData, userId) {
  try {
    const result = await client.graphql({
      query: createEmployee,
      variables: {
        input: {
          userId: userId,
          email: userData.email,
          name: userData.name,
          department: userData.department,
          isActive: true
        }
      }
    });
    
    console.log(`✅ Created employee record for: ${userData.name}`);
    return result.data.createEmployee;
  } catch (error) {
    console.error(`❌ Failed to create employee record for ${userData.name}:`, error);
    throw error;
  }
}

async function createCourseWithQuiz(courseData) {
  try {
    // Create course
    const courseResult = await client.graphql({
      query: createCourse,
      variables: {
        input: {
          title: courseData.title,
          videoKey: courseData.videoKey,
          passingScore: courseData.passingScore
        }
      }
    });
    
    const course = courseResult.data.createCourse;
    console.log(`✅ Created course: ${course.title}`);
    
    // Create quiz questions
    const quizQuestions = [];
    for (const quizData of courseData.quiz) {
      const questionResult = await client.graphql({
        query: createQuizQuestion,
        variables: {
          input: {
            courseId: course.id,
            question: quizData.question,
            options: quizData.options,
            correctAnswer: quizData.correctAnswer
          }
        }
      });
      
      quizQuestions.push(questionResult.data.createQuizQuestion);
    }
    
    console.log(`✅ Created ${quizQuestions.length} quiz questions for: ${course.title}`);
    return { course, quizQuestions };
    
  } catch (error) {
    console.error(`❌ Failed to create course ${courseData.title}:`, error);
    throw error;
  }
}

async function createTestAssignments(employees, courses) {
  try {
    const assignments = [];
    
    // Assign first course to all employees (completed)
    for (const employee of employees) {
      const assignment = await client.graphql({
        query: createAssignment,
        variables: {
          input: {
            employeeId: employee.id,
            courseId: courses[0].course.id,
            status: 'completed',
            is_training_complete: true
          }
        }
      });
      assignments.push(assignment.data.createAssignment);
    }
    
    // Assign second course to first two employees (assigned)
    for (let i = 0; i < Math.min(2, employees.length); i++) {
      const assignment = await client.graphql({
        query: createAssignment,
        variables: {
          input: {
            employeeId: employees[i].id,
            courseId: courses[1].course.id,
            status: 'assigned',
            is_training_complete: false
          }
        }
      });
      assignments.push(assignment.data.createAssignment);
    }
    
    // Assign third course to one employee (assigned)
    if (employees.length > 0) {
      const assignment = await client.graphql({
        query: createAssignment,
        variables: {
          input: {
            employeeId: employees[0].id,
            courseId: courses[2].course.id,
            status: 'assigned',
            is_training_complete: false
          }
        }
      });
      assignments.push(assignment.data.createAssignment);
    }
    
    console.log(`✅ Created ${assignments.length} test assignments`);
    return assignments;
    
  } catch (error) {
    console.error(`❌ Failed to create assignments:`, error);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Starting QA test data seeding...');
    console.log(`Environment: ${amplifyConfig.auth.user_pool_id}`);
    
    // Create managers
    console.log('\n📋 Creating managers...');
    const managers = [];
    for (const managerData of TEST_DATA.managers) {
      const userId = await createCognitoUser(managerData, 'Managers');
      const manager = await createEmployeeRecord(managerData, userId);
      managers.push(manager);
    }
    
    // Create employees  
    console.log('\n👥 Creating employees...');
    const employees = [];
    for (const employeeData of TEST_DATA.employees) {
      const userId = await createCognitoUser(employeeData, 'Employees');
      const employee = await createEmployeeRecord(employeeData, userId);
      employees.push(employee);
    }
    
    // Create courses with quizzes
    console.log('\n📚 Creating courses and quizzes...');
    const courses = [];
    for (const courseData of TEST_DATA.courses) {
      const courseWithQuiz = await createCourseWithQuiz(courseData);
      courses.push(courseWithQuiz);
    }
    
    // Create test assignments
    console.log('\n📝 Creating test assignments...');
    const assignments = await createTestAssignments(employees, courses);
    
    console.log('\n✅ QA test data seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`- Managers: ${managers.length}`);
    console.log(`- Employees: ${employees.length}`);
    console.log(`- Courses: ${courses.length}`);
    console.log(`- Assignments: ${assignments.length}`);
    console.log('\n🔑 Test Credentials:');
    console.log('All users password: TempQAPass123!');
    console.log('\nManagers:');
    TEST_DATA.managers.forEach(m => console.log(`  - ${m.email}`));
    console.log('\nEmployees:');
    TEST_DATA.employees.forEach(e => console.log(`  - ${e.email}`));
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run the seeding script
if (require.main === module) {
  main();
}

module.exports = { main, TEST_DATA };
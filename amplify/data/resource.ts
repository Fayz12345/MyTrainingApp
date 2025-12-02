import { a, defineData, type ClientSchema } from '@aws-amplify/backend';

// Schema includes all 8 models: BusinessUnit, Store, Manager, Course, QuizQuestion, Employee, Assignment, Result
// CRITICAL FIX: Reordered models to ensure BusinessUnit, Store, Manager are recognized by AppSync
// These models must be defined first to ensure proper schema generation
// FORCE SYNC: Updated to ensure AppSync authorization rules are synced (2025-11-28 - v3)
// CRITICAL: Authorization rules must be synced to AppSync for group-based access to work
// DEPLOYMENT TRIGGER: Force update dev API with all 8 models (2025-11-28 - v4)
// CRITICAL: Deploy to add BusinessUnit, Store, Manager to dev API (2025-11-28 - v5)
const schema = a.schema({
  // Hierarchy models - defined first to ensure AppSync includes them
  BusinessUnit: a
    .model({
      id: a.id(),
      name: a.string().required(),
      description: a.string(),
      createdBy: a.string(), // userId of the SuperAdmin who created it
      stores: a.hasMany('Store', 'businessUnitId'),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required()
    })
    .authorization(allow => [
      allow.group('SuperAdmin').to(['create', 'read', 'update', 'delete']),
      allow.group('BusinessUnit').to(['read']),
      allow.group('Store').to(['read']),
      allow.group('Managers').to(['read'])
    ]),
  Store: a
    .model({
      id: a.id(),
      name: a.string().required(),
      description: a.string(),
      businessUnitId: a.id().required(),
      businessUnit: a.belongsTo('BusinessUnit', 'businessUnitId'),
      createdBy: a.string(), // userId of the BusinessUnit or Store person who created it
      managers: a.hasMany('Manager', 'storeId'),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required()
    })
    .authorization(allow => [
      allow.group('SuperAdmin').to(['create', 'read', 'update', 'delete']),
      allow.group('BusinessUnit').to(['create', 'read', 'update', 'delete']),
      allow.group('Store').to(['create', 'read', 'update', 'delete']),
      allow.group('Managers').to(['read'])
    ]),
  Manager: a
    .model({
      id: a.id(),
      userId: a.string().required(), // Cognito user ID
      email: a.string().required(),
      name: a.string().required(),
      storeId: a.id().required(),
      store: a.belongsTo('Store', 'storeId'),
      createdBy: a.string(), // userId of the Store person who created it
      employees: a.hasMany('Employee', 'managerId'),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required()
    })
    .authorization(allow => [
      allow.group('SuperAdmin').to(['create', 'read', 'update', 'delete']),
      allow.group('BusinessUnit').to(['read']),
      allow.group('Store').to(['create', 'read', 'update', 'delete']),
      allow.group('Managers').to(['read'])
    ]),
  Course: a
    .model({
      id: a.id(),
      title: a.string().required(),
      description: a.string(), // Course description
      videoKey: a.string(), // S3 key for video
      imageKey: a.string(), // S3 key for course image/thumbnail
      quiz: a.hasMany('QuizQuestion', 'courseId'), // Links to QuizQuestion via courseId
      assignments: a.hasMany('Assignment', 'courseId'), // Links to Assignment via courseId
      passingScore: a.integer(),
      duration: a.string(), // Course duration (e.g., "45 min", "1 hr 30 min", "2 hr")
      category: a.string(), // Course category (e.g., "Leadership", "Marketing", "IT")
      tag: a.string(), // Course Tag
      status: a.string(), // Course status
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required()
    })
    .authorization(allow => [
      allow.group('Managers').to(['create', 'read', 'update', 'delete']),
      allow.group('Employees').to(['read'])
    ]),
  QuizQuestion: a
    .model({
      id: a.id(),
      courseId: a.id(), // Foreign key linking to Course
      course: a.belongsTo('Course', 'courseId'), // Added: Reciprocal relationship
      question: a.string().required(),
      options: a.string().array().required(),
      correctAnswer: a.integer().required(),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required()
    })
    .authorization(allow => [
      allow.group('Managers').to(['create', 'read', 'update', 'delete']),
      allow.group('Employees').to(['read'])
    ]),
  Employee: a
    .model({
      id: a.id(),
      userId: a.string().required(), // Cognito user ID
      email: a.string().required(),
      name: a.string().required(),
      department: a.string(),
      managerId: a.id(), // Manager who created this employee
      manager: a.belongsTo('Manager', 'managerId'),
      createdBy: a.string(), // userId of the Manager who created it
      isActive: a.boolean().default(true),
      assignments: a.hasMany('Assignment', 'employeeId'), // Links to Assignment via employeeId
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required()
    })
    .authorization(allow => [
      allow.group('SuperAdmin').to(['create', 'read', 'update', 'delete']),
      allow.group('Managers').to(['create', 'read', 'update', 'delete']),
      allow.group('Employees').to(['read'])
    ]),
  Assignment: a
    .model({
      id: a.id(),
      employeeId: a.id().required(),
      courseId: a.id().required(),
      employee: a.belongsTo('Employee', 'employeeId'),
      course: a.belongsTo('Course', 'courseId'),
      status: a.enum(['assigned', 'completed']),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required()
    })
    .authorization(allow => [
      allow.group('Managers').to(['create', 'update', 'delete', 'read']),
      allow.group('Employees').to(['read'])
    ]),
  Result: a
    .model({
      id: a.id(),
      assignmentId: a.id().required(),
      score: a.integer().required(),
      passed: a.boolean().required(),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required()
    })
    .authorization(allow => [
      allow.group('Managers').to(['read', 'update']),
      allow.group('Employees').to(['create', 'read'])
    ])
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool', // Use Cognito for auth
    // Explicitly configure authorization to ensure @auth directives are synced
    apiKeyAuthorizationMode: {
      expiresInDays: 30
    }
  }
});
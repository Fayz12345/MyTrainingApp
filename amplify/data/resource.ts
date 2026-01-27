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
      managerStores: a.hasMany('ManagerStore', 'storeId'),
      employees: a.hasMany('Employee', 'storeId'), // Employees belonging to this store
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
      phoneNumber: a.string(), // Phone number for the manager
      storeId: a.id(), // primary store (legacy / optional)
      store: a.belongsTo('Store', 'storeId'),
      managerStores: a.hasMany('ManagerStore', 'managerId'),
      createdBy: a.string(), // userId of the Store person who created it
      employees: a.hasMany('Employee', 'managerId'),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required()
    })
    .authorization(allow => [
      allow.group('SuperAdmin').to(['create', 'read', 'update', 'delete']),
      allow.group('BusinessUnit').to(['read']),
      allow.group('Store').to(['create', 'read', 'update', 'delete']),
      allow.group('Managers').to(['read']),
      allow.publicApiKey().to(['read']) // Allow Lambda (using API key) to read manager details for notifications
    ]),
  Course: a
    .model({
      id: a.id(),
      title: a.string().required(),
      description: a.string(), // Course description
      videoKey: a.string(), // S3 key for video
      imageKey: a.string(), // S3 key for course image/thumbnail
      pdfKey: a.string(), // S3 key for PDF document
      pdfTitle: a.string(), // Display name for PDF document
      contentType: a.string(), // 'video', 'pdf', or 'both' - indicates course content type
      quiz: a.hasMany('QuizQuestion', 'courseId'), // Links to QuizQuestion via courseId
      assignments: a.hasMany('Assignment', 'courseId'), // Links to Assignment via courseId
      learningPathCourses: a.hasMany('LearningPathCourse', 'courseId'), // Links to LearningPathCourse via courseId
      supportRecords: a.hasMany('EmployeeSupport', 'courseId'), // Links to EmployeeSupport via courseId
      passingScore: a.integer(),
      duration: a.string(), // Course duration (e.g., "45 min", "1 hr 30 min", "2 hr")
      category: a.string(), // Course category (e.g., "Leadership", "Marketing", "IT")
      tag: a.string(), // Course Tag
      status: a.string(), // Course status
      randomizeQuestions: a.boolean().default(false), // Whether to randomize quiz question order for each attempt
      randomizeOptions: a.boolean().default(false), // Whether to randomize answer option order for multiple-choice questions
      useQuestionPool: a.boolean().default(false), // Whether to use question pool mode (randomly select subset of questions)
      poolSize: a.integer(), // Total number of questions in the pool (only used if useQuestionPool is true)
      questionsToDisplay: a.integer(), // Number of questions to randomly select and display per quiz attempt (only used if useQuestionPool is true)
      createdBy: a.string(), // managerId (userId from Cognito) - for filtering courses by manager
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required()
    })
    .authorization(allow => [
      allow.group('Managers').to(['create', 'read', 'update', 'delete']),
      allow.group('Employees').to(['read']),
      allow.publicApiKey().to(['read']) // Allow Lambda (using API key) to read course details for notifications
    ]),
  QuizQuestion: a
    .model({
      id: a.id(),
      courseId: a.id(), // Foreign key linking to Course
      course: a.belongsTo('Course', 'courseId'), // Added: Reciprocal relationship
      question: a.string().required(),
      questionType: a.string().default('multiple_choice'), // 'multiple_choice', 'true_false', 'fill_blank'
      options: a.string().array().required(),
      correctAnswer: a.integer(), // For multiple_choice and true_false (index or 0/1)
      correctAnswerText: a.string(), // For fill_blank (comma-separated accepted answers)
      caseSensitive: a.boolean().default(false), // For fill_blank: whether answer matching is case-sensitive
      fuzzyMatching: a.boolean().default(false), // For fill_blank: enable Levenshtein distance matching (≤2 chars)
      isActive: a.boolean().default(true), // Whether question is active and can be selected for question pools
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
      storeId: a.id(), // Store this employee belongs to (for multi-store managers)
      store: a.belongsTo('Store', 'storeId'),
      createdBy: a.string(), // userId of the Manager who created it
      isActive: a.boolean().default(true),
      assignments: a.hasMany('Assignment', 'employeeId'), // Links to Assignment via employeeId
      learningPathAssignments: a.hasMany('LearningPathAssignment', 'employeeId'), // Links to LearningPathAssignment via employeeId
      supportRecords: a.hasMany('EmployeeSupport', 'employeeId'), // Links to EmployeeSupport via employeeId
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required()
    })
    .authorization(allow => [
      allow.group('SuperAdmin').to(['create', 'read', 'update', 'delete']),
      allow.group('Managers').to(['create', 'read', 'update', 'delete']),
      allow.group('Employees').to(['read']),
      allow.publicApiKey().to(['create', 'read']) // Allow Lambda (using API key) to create/read employee for notifications/self-signup
    ]),
  ManagerStore: a
    .model({
      id: a.id(),
      managerId: a.id().required(),
      storeId: a.id().required(),
      manager: a.belongsTo('Manager', 'managerId'),
      store: a.belongsTo('Store', 'storeId'),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required()
    })
    .authorization(allow => [
      allow.group('SuperAdmin').to(['create', 'read', 'update', 'delete']),
      allow.group('Store').to(['read']),
      allow.group('BusinessUnit').to(['read']),
      allow.group('Managers').to(['read'])
    ]),
  Assignment: a
    .model({
      id: a.id(),
      employeeId: a.id().required(),
      courseId: a.id().required(),
      employee: a.belongsTo('Employee', 'employeeId'),
      course: a.belongsTo('Course', 'courseId'),
      status: a.enum(['assigned', 'completed']),
      isTrainingComplete: a.boolean().default(false),
      trainingCompletedAt: a.datetime(), // Date when training was completed (for recertification tracking)
      hasViewedPdf: a.boolean().default(false), // Track if employee has viewed the PDF document
      assignmentSource: a.string(), // 'individual' or 'learning_path' - indicates if assignment comes from individual course assignment or learning path
      learningPathId: a.id(), // ID of the learning path if assignmentSource is 'learning_path' (optional)
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required()
    })
    .authorization(allow => [
      allow.group('Managers').to(['create', 'update', 'delete', 'read']),
      allow.group('Employees').to(['read', 'update']), // Allow employees to update their own assignments (for quiz completion)
      allow.publicApiKey().to(['read']) // Allow Lambda (using API key) to read assignments for notifications
    ]),
  Result: a
    .model({
      id: a.id(),
      assignmentId: a.id().required(),
      score: a.integer().required(),
      passed: a.boolean().required(),
      answers: a.integer().array(), // Array of answer indices (0-based) for each question in order
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required()
    })
    .authorization(allow => [
      allow.group('Managers').to(['read', 'update']),
      allow.group('Employees').to(['create', 'read'])
    ]),
  LearningPath: a
    .model({
      id: a.id(),
      title: a.string().required(),
      description: a.string(),
      createdBy: a.string().required(), // managerId (userId from Cognito)
      isSequential: a.boolean().default(true), // true = must complete in order, false = flexible
      status: a.string(), // 'draft' or 'published' - default handled in application code
      version: a.integer().default(1), // Version number (1, 2, 3, etc.)
      parentPathId: a.id(), // ID of the original learning path (for version tracking)
      isArchived: a.boolean().default(false), // Archived paths cannot be assigned but remain viewable
      courses: a.hasMany('LearningPathCourse', 'learningPathId'),
      assignments: a.hasMany('LearningPathAssignment', 'learningPathId'),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required()
    })
    .authorization(allow => [
      allow.group('Managers').to(['create', 'read', 'update', 'delete']),
      allow.group('Employees').to(['read'])
    ]),
  LearningPathCourse: a
    .model({
      id: a.id(),
      learningPathId: a.id().required(),
      courseId: a.id().required(),
      learningPath: a.belongsTo('LearningPath', 'learningPathId'),
      course: a.belongsTo('Course', 'courseId'),
      order: a.integer().required(), // Order/sequence in the learning path
      isRequired: a.boolean().default(true), // true = required, false = optional
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required()
    })
    .authorization(allow => [
      allow.group('Managers').to(['create', 'read', 'update', 'delete']),
      allow.group('Employees').to(['read'])
    ]),
  LearningPathAssignment: a
    .model({
      id: a.id(),
      learningPathId: a.id().required(), // Which version of the learning path
      employeeId: a.id().required(),
      learningPath: a.belongsTo('LearningPath', 'learningPathId'),
      employee: a.belongsTo('Employee', 'employeeId'),
      status: a.string(), // 'not_started', 'in_progress', 'completed'
      assignedDate: a.datetime(), // Date when the path was assigned
      dueDate: a.datetime(), // Optional due date for completion
      completedDate: a.datetime(), // Date when the path was completed
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required()
    })
    .authorization(allow => [
      allow.group('Managers').to(['create', 'read', 'update', 'delete']),
      allow.group('Employees').to(['read', 'update'])
    ]),
  EmployeeSupport: a
    .model({
      id: a.id(),
      employeeId: a.id().required(),
      courseId: a.id().required(),
      assignmentId: a.id(), // Optional: link to the assignment
      employee: a.belongsTo('Employee', 'employeeId'),
      course: a.belongsTo('Course', 'courseId'),
      flagType: a.string(), // 'failed_quizzes', 'low_score', 'no_progress', 'video_no_quiz', 'excessive_time'
      supportAction: a.string().required(), // The action taken to provide support
      notes: a.string(), // Additional notes about the support provided
      providedBy: a.string(), // userId of the manager who provided support
      providedAt: a.datetime().required(), // When support was provided
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required()
    })
    .authorization(allow => [
      allow.group('Managers').to(['create', 'read', 'update', 'delete']),
      allow.group('Employees').to(['read'])
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
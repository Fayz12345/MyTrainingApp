import { a, defineData, type ClientSchema } from '@aws-amplify/backend';

const schema = a.schema({
  Course: a
    .model({
      id: a.id(),
      title: a.string().required(),
      videoKey: a.string(), // S3 key for video
      quiz: a.hasMany('QuizQuestion', 'courseId'), // Links to QuizQuestion via courseId
      passingScore: a.integer().required(),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required(),
      assignedTo: a.hasMany('Assignment', 'courseId'), // Links to Assignment via courseId
    })
    .authorization(allow => [
      allow.group('Managers').to(['create', 'update', 'delete']),
      allow.group('Employees').to(['read']),
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
      updatedAt: a.datetime().required(),
    })
    .authorization(allow => [
      allow.group('Managers').to(['create', 'update', 'delete']),
      allow.group('Employees').to(['read']),
    ]),
  Assignment: a
    .model({
      id: a.id(),
      employeeId: a.string().required(),
      courseId: a.id().required(),
      course: a.belongsTo('Course', 'courseId'),
      userId: a.string().required(),
      status: a.enum(['assigned', 'completed']),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required(),
    })
    .authorization(allow => [
      allow.group('Managers').to(['create', 'update', 'delete', 'read']),
      allow.group('Employees').to(['read']),
    ]),
  Result: a
    .model({
      id: a.id(),
      assignmentId: a.id().required(),
      score: a.integer().required(),
      passed: a.boolean().required(),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required(),
    })
    .authorization(allow => [
      allow.group('Managers').to(['read', 'update']),
      allow.group('Employees').to(['create', 'read']),
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool', // Use Cognito for auth
  },
});

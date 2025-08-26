import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/* This is the schema for our Training App */
const schema = a.schema({
  // Course Model: The main training course
  Course: a
    .model({
      title: a.string().required(),
      videoPath: a.string(),
      questions: a.hasMany('Question', 'courseId'),
    })
    // THIS IS THE CORRECT, SIMPLIFIED RULE
    .authorization((allow) => [
      allow.publicApiKey() // This one line grants all permissions (create, read, update, delete)
    ]),

  // Question Model: A question within a course
  Question: a
    .model({
      courseId: a.id().required(),
      course: a.belongsTo('Course', 'courseId'),
      questionText: a.string().required(),
      choices: a.hasMany('Choice', 'questionId'),
    })
    .authorization((allow) => [allow.publicApiKey()]), // Using the same simple rule

  // Choice Model: An answer choice for a question
  Choice: a
    .model({
      questionId: a.id().required(),
      question: a.belongsTo('Question', 'questionId'),
      choiceText: a.string().required(),
      isCorrect: a.boolean().required(),
    })
    .authorization((allow) => [allow.publicApiKey()]), // And here
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});
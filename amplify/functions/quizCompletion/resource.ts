import { defineFunction } from '@aws-amplify/backend';

export const quizCompletion = defineFunction({
  name: 'quizCompletion',
  entry: './handler.ts'
});
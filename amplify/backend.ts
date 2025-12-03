import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { quizCompletion } from './functions/quizCompletion/resource';
import { assignEmployeeGroup } from './functions/assignEmployeeGroup/resource';
import { createCognitoGroups } from './functions/createCognitoGroups/resource';
import { assignUserToGroup } from './functions/assignUserToGroup/resource';
import { subscribeManagerToSNS } from './functions/subscribeManagerToSNS/resource';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
defineBackend({
  auth,
  data,
  storage,
  quizCompletion,
  assignEmployeeGroup,
  createCognitoGroups,
  assignUserToGroup,
  subscribeManagerToSNS
});


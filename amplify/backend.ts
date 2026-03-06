import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { quizCompletion } from './functions/quizCompletion/resource';
import { assignEmployeeGroup } from './functions/assignEmployeeGroup/resource';
import { createCognitoGroups } from './functions/createCognitoGroups/resource';
import { assignUserToGroup } from './functions/assignUserToGroup/resource';
import { subscribeManagerToSNS } from './functions/subscribeManagerToSNS/resource';
import { sendManagerNotification } from './functions/sendManagerNotification/resource';
import { sendWelcomeEmail } from './functions/sendWelcomeEmail/resource';
import { sendLearningPathAssignmentNotification } from './functions/sendLearningPathAssignmentNotification/resource';
import { sendEmployeeSupportMessage } from './functions/sendEmployeeSupportMessage/resource';
import { schedulingTest } from './functions/schedulingTest/resource';
import { schedulingEligibility } from './functions/schedulingEligibility/resource';
import { certificationExpirationCheck } from './functions/certificationExpirationCheck/resource';

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
  subscribeManagerToSNS,
  sendManagerNotification,
  sendWelcomeEmail,
  sendLearningPathAssignmentNotification,
  sendEmployeeSupportMessage,
  schedulingTest,
  schedulingEligibility,
  certificationExpirationCheck,
});


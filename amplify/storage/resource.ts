import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'trainingVideosBucket',
  access: (allow) => ({
    'videos/{entity_id}/*': [
      allow.groups(['Managers']).to(['read', 'write', 'delete']),
      allow.groups(['Employees']).to(['read'])
    ]
  })
});
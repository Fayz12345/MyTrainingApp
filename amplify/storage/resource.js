import { defineStorage } from '@aws-amplify/backend';
export const storage = defineStorage({
    name: 'trainingVideosBucket',
    access: (allow) => ({
        'videos/{entity_id}/*': [
            allow.groups(['Managers']).to(['read', 'write', 'delete']),
            allow.groups(['Employees']).to(['read'])
        ],
        'courses/videos/*': [
            allow.groups(['Managers']).to(['read', 'write', 'delete']),
            allow.groups(['Employees']).to(['read'])
        ],
        'courses/images/*': [
            allow.groups(['Managers']).to(['read', 'write', 'delete']),
            allow.groups(['Employees']).to(['read'])
        ],
        'courses/pdfs/*': [
            allow.groups(['Managers']).to(['read', 'write', 'delete']),
            allow.groups(['Employees']).to(['read'])
        ],
        'log/*': [
            allow.groups(['Managers']).to(['read', 'write', 'delete']),
            allow.groups(['Employees']).to(['read', 'write'])
        ],
        'banking/{entity_id}/*': [
            allow.groups(['Managers']).to(['read']), // Managers can read for payroll processing
            allow.groups(['Employees']).to(['read', 'write', 'delete']) // Employees can upload and manage their own banking documents
        ]
    })
});

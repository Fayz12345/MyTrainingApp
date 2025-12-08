import { type AmplifyFunctionResource } from '@aws-amplify/backend-function';

/**
 * Add AppSync IAM permissions so the post-confirmation trigger can create Employee records.
 */
export default function override(resource: AmplifyFunctionResource) {
  resource.addToRolePolicy({
    Effect: 'Allow',
    Action: ['appsync:GraphQL'],
    Resource: 'arn:aws:appsync:ca-central-1:216348571084:apis/mswo73fsfjh4thfaalt7d63i4a/*'
  });
}


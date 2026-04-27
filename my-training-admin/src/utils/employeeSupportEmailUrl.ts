import outputs from '../amplify_outputs.json';

type OutputsWithCustom = typeof outputs & {
  custom?: { sendEmployeeSupportMessageFunctionUrl?: string };
};

/** Function URL for sendEmployeeSupportMessage: env first, then deploy output. */
export function getEmployeeSupportMessageLambdaUrl(): string {
  const fromEnv = (process.env.REACT_APP_EMPLOYEE_SUPPORT_MESSAGE_LAMBDA_URL || '').trim();
  if (fromEnv) return fromEnv;
  const fromOutputs = (
    (outputs as OutputsWithCustom).custom?.sendEmployeeSupportMessageFunctionUrl || ''
  ).trim();
  if (fromOutputs.startsWith('http')) return fromOutputs;
  return '';
}

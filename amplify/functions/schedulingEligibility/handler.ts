/**
 * Lambda function to evaluate scheduling eligibility for employees
 * 
 * This function:
 * 1. Checks if all mandatory learning paths are completed
 * 2. Verifies banking information is on file
 * 3. Updates schedulingEligible flag on Employee model
 * 4. Calls Clearview Connect API when employee becomes eligible
 * 
 * Trigger: Should be invoked when a learning path assignment is completed
 */

import * as https from 'https';

interface LambdaEvent {
  employeeId: string;
  learningPathId?: string;
  trigger?: 'learning_path_completed' | 'banking_info_updated' | 'manual_check';
}

interface SchedulingEligibilityResult {
  eligible: boolean;
  reason?: string;
  mandatoryPathsCompleted: string[];
  bankingInfoOnFile: boolean;
}

// Get AppSync endpoint and API key from environment
const APPSYNC_ENDPOINT = process.env.APPSYNC_ENDPOINT || '';
const APPSYNC_API_KEY = process.env.APPSYNC_API_KEY || '';

export const handler = async (event: LambdaEvent): Promise<any> => {
  const logPrefix = '[SCHEDULING_ELIGIBILITY]';
  const timestamp = new Date().toISOString();
  
  console.log(`${logPrefix} ========================================`);
  console.log(`${logPrefix} 🔍 Evaluating Scheduling Eligibility`);
  console.log(`${logPrefix} Timestamp: ${timestamp}`);
  console.log(`${logPrefix} ========================================`);

  try {
    const employeeId = event.employeeId;
    if (!employeeId) {
      throw new Error('employeeId is required');
    }

    console.log(`${logPrefix} [STEP 1] Fetching employee data for: ${employeeId}`);

    // Fetch employee via AppSync
    const employeeQuery = {
      query: `
        query GetEmployee($id: ID!) {
          getEmployee(id: $id) {
            id
            name
            email
            transitNumber
            institutionNumber
            accountNumber
            schedulingEligible
            storeId
          }
        }
      `,
      variables: { id: employeeId }
    };

    const employeeResponse = await queryAppSync(employeeQuery);
    const employee = employeeResponse?.data?.getEmployee;

    if (!employee) {
      throw new Error(`Employee not found: ${employeeId}`);
    }

    console.log(`${logPrefix} [STEP 1] Employee: ${employee.name} (${employee.email})`);

    // Check banking information
    const bankingInfoOnFile = !!(
      employee.transitNumber && 
      employee.institutionNumber && 
      employee.accountNumber
    );

    console.log(`${logPrefix} [STEP 2] Banking Info Check:`);
    console.log(`${logPrefix} [STEP 2] - Transit Number: ${employee.transitNumber ? '✓' : '✗'}`);
    console.log(`${logPrefix} [STEP 2] - Institution Number: ${employee.institutionNumber ? '✓' : '✗'}`);
    console.log(`${logPrefix} [STEP 2] - Account Number: ${employee.accountNumber ? '✓' : '✗'}`);
    console.log(`${logPrefix} [STEP 2] - Banking Info On File: ${bankingInfoOnFile}`);

    // Fetch all mandatory learning paths
    console.log(`${logPrefix} [STEP 3] Fetching mandatory learning paths...`);
    const pathsQuery = {
      query: `
        query ListLearningPaths($filter: ModelLearningPathFilterInput) {
          listLearningPaths(filter: $filter) {
            items {
              id
              title
            }
          }
        }
      `,
      variables: {
        filter: { mandatoryForScheduling: { eq: true } }
      }
    };

    const pathsResponse = await queryAppSync(pathsQuery);
    const mandatoryPaths = pathsResponse?.data?.listLearningPaths?.items || [];
    console.log(`${logPrefix} [STEP 3] Found ${mandatoryPaths.length} mandatory learning path(s)`);

    if (mandatoryPaths.length === 0) {
      console.log(`${logPrefix} [STEP 3] ⚠️ No mandatory learning paths configured`);
    }

    // Check completion status for each mandatory path
    const mandatoryPathsCompleted: string[] = [];
    
    for (const path of mandatoryPaths) {
      console.log(`${logPrefix} [STEP 4] Checking completion for path: ${path.title} (${path.id})`);
      
      // Get learning path assignment for this employee
      const assignmentQuery = {
        query: `
          query ListLearningPathAssignments($filter: ModelLearningPathAssignmentFilterInput) {
            listLearningPathAssignments(filter: $filter) {
              items {
                id
                status
              }
            }
          }
        `,
        variables: {
          filter: {
            employeeId: { eq: employeeId },
            learningPathId: { eq: path.id }
          }
        }
      };

      const assignmentResponse = await queryAppSync(assignmentQuery);
      const assignments = assignmentResponse?.data?.listLearningPathAssignments?.items || [];
      const completedAssignment = assignments.find((a: any) => a.status === 'completed');

      if (completedAssignment) {
        mandatoryPathsCompleted.push(path.id);
        console.log(`${logPrefix} [STEP 4] ✅ Path "${path.title}" is completed`);
      } else {
        console.log(`${logPrefix} [STEP 4] ❌ Path "${path.title}" is not completed`);
      }
    }

    // Determine eligibility
    const allMandatoryPathsCompleted = mandatoryPaths.length > 0 && 
      mandatoryPathsCompleted.length === mandatoryPaths.length;
    
    const eligible = bankingInfoOnFile && allMandatoryPathsCompleted;
    const wasEligible = employee.schedulingEligible || false;
    const justBecameEligible = eligible && !wasEligible;

    console.log(`${logPrefix} [STEP 5] Eligibility Evaluation:`);
    console.log(`${logPrefix} [STEP 5] - Banking Info: ${bankingInfoOnFile ? '✓' : '✗'}`);
    console.log(`${logPrefix} [STEP 5] - Mandatory Paths Completed: ${allMandatoryPathsCompleted ? '✓' : '✗'} (${mandatoryPathsCompleted.length}/${mandatoryPaths.length})`);
    console.log(`${logPrefix} [STEP 5] - Current Status: ${wasEligible ? 'Eligible' : 'Not Eligible'}`);
    console.log(`${logPrefix} [STEP 5] - New Status: ${eligible ? 'Eligible' : 'Not Eligible'}`);
    console.log(`${logPrefix} [STEP 5] - Just Became Eligible: ${justBecameEligible ? 'YES' : 'NO'}`);

    // Update employee schedulingEligible flag
    console.log(`${logPrefix} [STEP 6] Updating employee schedulingEligible flag...`);
    const updateMutation = {
      query: `
        mutation UpdateEmployee($input: UpdateEmployeeInput!) {
          updateEmployee(input: $input) {
            id
            schedulingEligible
          }
        }
      `,
      variables: {
        input: {
          id: employeeId,
          schedulingEligible: eligible,
          updatedAt: timestamp
        }
      }
    };

    await queryAppSync(updateMutation);
    console.log(`${logPrefix} [STEP 6] ✅ Employee flag updated to: ${eligible}`);

    // If employee just became eligible, call Clearview Connect API
    if (justBecameEligible) {
      console.log(`${logPrefix} [STEP 7] 🎉 Employee just became eligible! Calling Clearview Connect API...`);
      
      try {
        await callClearviewConnectAPI({
          employeeId: employee.id,
          employeeName: employee.name,
          employeeEmail: employee.email,
          storeId: employee.storeId || null,
          eligibleDate: timestamp,
          completedLearningPaths: mandatoryPathsCompleted,
          bankingInfoOnFile: true
        });
        
        console.log(`${logPrefix} [STEP 7] ✅ Clearview Connect API called successfully`);
      } catch (apiError: any) {
        console.error(`${logPrefix} [STEP 7] ❌ Failed to call Clearview Connect API:`, apiError.message);
        // Don't throw - eligibility flag is already updated
        // Log error for manual retry
      }
    } else if (eligible) {
      console.log(`${logPrefix} [STEP 7] Employee already eligible - skipping API call`);
    }

    const result: SchedulingEligibilityResult = {
      eligible,
      reason: eligible 
        ? 'All requirements met' 
        : !bankingInfoOnFile 
          ? 'Banking information not on file'
          : !allMandatoryPathsCompleted
            ? `Missing ${mandatoryPaths.length - mandatoryPathsCompleted.length} mandatory learning path(s)`
            : 'Unknown reason',
      mandatoryPathsCompleted,
      bankingInfoOnFile
    };

    console.log(`${logPrefix} ========================================`);
    console.log(`${logPrefix} ✅ Evaluation Complete`);
    console.log(`${logPrefix} Result:`, JSON.stringify(result, null, 2));
    console.log(`${logPrefix} ========================================`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        timestamp,
        employeeId,
        result
      })
    };

  } catch (error: any) {
    console.error(`${logPrefix} ❌ Error:`, error);
    console.error(`${logPrefix} Error details:`, {
      name: error?.name,
      message: error?.message,
      stack: error?.stack
    });

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error?.message || 'Unexpected error occurred',
        timestamp
      })
    };
  }
};

// Helper function to query AppSync
async function queryAppSync(query: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(APPSYNC_ENDPOINT);
    const postData = JSON.stringify(query);

    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': APPSYNC_API_KEY
      },
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          
          if (parsed.errors) {
            console.error(`[SCHEDULING_ELIGIBILITY] AppSync Errors:`, JSON.stringify(parsed.errors, null, 2));
          }
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`AppSync returned status ${res.statusCode}: ${JSON.stringify(parsed, null, 2)}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e}. Raw response: ${data.substring(0, 500)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Call Clearview Connect API to notify about employee eligibility
 */
async function callClearviewConnectAPI(payload: {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  storeId: string | null;
  eligibleDate: string;
  completedLearningPaths: string[];
  bankingInfoOnFile: boolean;
}): Promise<void> {
  const logPrefix = '[CLEARVIEW_CONNECT]';
  const SCHEDULING_API_URL = process.env.SCHEDULING_API_URL || 'https://sandbox.clearviewconnect.com/api/v1';
  const SCHEDULING_API_TOKEN = process.env.SCHEDULING_API_TOKEN || 'YOUR_TOKEN';

  const apiEndpoint = `${SCHEDULING_API_URL}/employees/eligibility`;
  
  console.log(`${logPrefix} Calling Clearview Connect API: ${apiEndpoint}`);
  console.log(`${logPrefix} Payload:`, JSON.stringify(payload, null, 2));

  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SCHEDULING_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000) // 15 second timeout
  });

  const statusCode = response.status;
  let responseData: any = null;

  try {
    const responseText = await response.text();
    if (responseText) {
      responseData = JSON.parse(responseText);
    }
  } catch (parseError) {
    responseData = { raw: responseText };
  }

  if (statusCode >= 200 && statusCode < 300) {
    console.log(`${logPrefix} ✅ API call successful (${statusCode})`);
    console.log(`${logPrefix} Response:`, JSON.stringify(responseData, null, 2));
  } else {
    throw new Error(`API call failed with status ${statusCode}: ${JSON.stringify(responseData)}`);
  }
}


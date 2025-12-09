import { CognitoIdentityProviderClient, AdminAddUserToGroupCommand, AdminGetUserCommand, AdminListGroupsForUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import https from 'https';

const cognitoClient = new CognitoIdentityProviderClient({});
/**
 * Lambda function to automatically assign new users to the correct group based on their role
 * This is triggered after a user confirms their email during signup or is created via AdminCreateUser
 */
export const handler = async (event) => {
    const logPrefix = '[POST_CONFIRMATION_TRIGGER]';
    const timestamp = new Date().toISOString();
    
    console.log(`${logPrefix} ========================================`);
    console.log(`${logPrefix} 🚀 POST-CONFIRMATION TRIGGER FIRED`);
    console.log(`${logPrefix} Timestamp: ${timestamp}`);
    console.log(`${logPrefix} ========================================`);
    console.log(`${logPrefix} [STEP 0] Event received:`, JSON.stringify(event, null, 2));
    
    const userPoolId = event.userPoolId;
    const username = event.userName;
    const triggerSource = event.triggerSource || 'unknown';
    
    console.log(`${logPrefix} [STEP 0.1] Event details:`, {
        userPoolId: userPoolId,
        username: username,
        triggerSource: triggerSource
    });
    
    // Only process if user pool ID and username are present
    if (!userPoolId || !username) {
        console.error(`${logPrefix} ❌ Missing userPoolId or userName in event`);
        console.error(`${logPrefix} userPoolId: ${userPoolId}`);
        console.error(`${logPrefix} username: ${username}`);
        return event;
    }
    
    console.log(`${logPrefix} [STEP 0.2] ✅ Event validation passed`);
    
    try {
        console.log(`${logPrefix} [STEP 1] Extracting user attributes to determine role...`);
        
        // Get user attributes to determine their role
        let userRole = 'employee'; // default
        let userEmail = '';
        
        // Check if user attributes are in the event (from signup)
        if (event.request && event.request.userAttributes) {
            console.log(`${logPrefix} [STEP 1.1] User attributes found in event`);
            userEmail = event.request.userAttributes.email || '';
            // Check for custom attribute 'custom:role' if set by external Lambda
            userRole = event.request.userAttributes['custom:role'] || 
                      event.request.userAttributes['role'] || 
                      'employee';
            
            console.log(`${logPrefix} [STEP 1.1] Attributes from event:`, {
                email: userEmail,
                role: userRole,
                customRole: event.request.userAttributes['custom:role'],
                roleAttr: event.request.userAttributes['role']
            });
        } else {
            console.log(`${logPrefix} [STEP 1.1] User attributes not in event, fetching from Cognito...`);
            // If not in event, try to get user from Cognito
            try {
                const getUserCommand = new AdminGetUserCommand({
                    UserPoolId: userPoolId,
                    Username: username
                });
                console.log(`${logPrefix} [STEP 1.2] Calling AdminGetUserCommand...`);
                const userData = await cognitoClient.send(getUserCommand);
                userEmail = userData.UserAttributes?.find(attr => attr.Name === 'email')?.Value || '';
                
                // Check multiple possible attribute names for role
                const roleAttr = userData.UserAttributes?.find(attr => 
                    attr.Name === 'custom:role' || 
                    attr.Name === 'role' ||
                    attr.Name === 'custom:userRole'
                );
                userRole = roleAttr?.Value || 'employee';
                
                console.log(`${logPrefix} [STEP 1.2] User attributes from Cognito:`, {
                    email: userEmail,
                    role: userRole,
                    roleAttributeFound: !!roleAttr,
                    roleAttributeName: roleAttr?.Name,
                    allAttributes: userData.UserAttributes?.map(a => ({ name: a.Name, value: a.Value }))
                });
            } catch (getUserError) {
                console.warn(`${logPrefix} [STEP 1.2] ⚠️ Could not fetch user attributes, defaulting to employee:`, getUserError);
                // Try to use username as email to check if it's a manager email pattern
                // This is a fallback if we can't get attributes
                if (username && username.includes('@')) {
                    userEmail = username;
                    console.log(`${logPrefix} [STEP 1.2] Using username as email: ${userEmail}`);
                }
            }
        }
        
        console.log(`${logPrefix} [STEP 1.3] Initial role determination:`, {
            userRole: userRole,
            userEmail: userEmail,
            username: username
        });
        
        // IMPORTANT: If the external Lambda doesn't set custom:role, we need another way to determine role
        // Check if this is a post-confirmation for a user created via AdminCreateUser
        // In that case, the trigger might not have role info, so we'll default to Employees
        // and rely on manual assignment or the external Lambda to set it correctly
        
        console.log(`${logPrefix} [STEP 2] Determining group assignment based on role...`);
        
        // Determine group based on role
        let groupName = 'Employees'; // default
        let shouldCheckDatabase = false; // Flag to determine if we need to check database
        
        // If this came from end-user sign-up (not admin create), force Employees unless role explicitly set
        const isSelfSignUp = (triggerSource || '').toLowerCase().includes('confirmsignup');
        const normalizedRole = (userRole || '').toLowerCase();
        if (isSelfSignUp && (!normalizedRole || normalizedRole === 'employee' || normalizedRole === 'employees')) {
            groupName = 'Employees';
            shouldCheckDatabase = false;
            console.log(`${logPrefix} [STEP 2.0] Self-signup detected -> forcing 'Employees' group (no DB check)`);
            
            // For self-signup, also ensure an Employee record exists in the database
            try {
                const userIdFromEvent = event.request?.userAttributes?.sub || username;
                const emailFromEvent = event.request?.userAttributes?.email || userEmail || username;
                const nameFromEvent = event.request?.userAttributes?.name || event.request?.userAttributes?.given_name || emailFromEvent;
                const nowIso = new Date().toISOString();
                
                if (!userIdFromEvent || !emailFromEvent) {
                    console.warn(`${logPrefix} [STEP 2.0] ⚠️ Missing userId or email for self-signup employee creation`, {
                        userIdFromEvent,
                        emailFromEvent
                    });
                } else {
                    const appsyncEndpoint = process.env.APPSYNC_API_URL || 'https://mswo73fsfjh4thfaalt7d63i4a.appsync-api.ca-central-1.amazonaws.com/graphql';
                    const apiKey = process.env.APPSYNC_API_KEY || 'da2-la7esrklanbehi5v7e574ao7fq';
                    const url = new URL(appsyncEndpoint);

                    // Check if employee already exists
                    const checkEmployeeQuery = {
                        query: `query GetEmployeeByUserId($userId: String!) {
                            listEmployees(filter: { userId: { eq: $userId } }) {
                                items { id userId email }
                            }
                        }`,
                        variables: { userId: userIdFromEvent }
                    };

                    const executeGraphql = async (payload) => {
                        return await new Promise((resolve, reject) => {
                            const req = https.request({
                                hostname: url.hostname,
                                port: 443,
                                path: url.pathname,
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'x-api-key': apiKey
                                },
                                timeout: 10000
                            }, (res) => {
                                let data = '';
                                res.on('data', (chunk) => { data += chunk; });
                                res.on('end', () => {
                                    try {
                                        const parsed = JSON.parse(data);
                                        if (res.statusCode >= 200 && res.statusCode < 300) {
                                            resolve(parsed);
                                        } else {
                                            reject(new Error(`AppSync returned status ${res.statusCode}: ${data}`));
                                        }
                                    } catch (e) {
                                        reject(new Error(`Failed to parse response: ${e.message}`));
                                    }
                                });
                            });
                            req.on('error', reject);
                            req.on('timeout', () => {
                                req.destroy();
                                reject(new Error('Request timeout'));
                            });
                            req.write(JSON.stringify(payload));
                            req.end();
                        });
                    };

                    const existing = await executeGraphql(checkEmployeeQuery);
                    const alreadyExists = existing?.data?.listEmployees?.items?.length > 0;
                    if (alreadyExists) {
                        console.log(`${logPrefix} [STEP 2.0] Employee already exists for userId ${userIdFromEvent}`);
                    } else {
                        console.log(`${logPrefix} [STEP 2.0] Creating Employee record for self-signup userId ${userIdFromEvent}`);
                        const createEmployeeMutation = {
                            query: `mutation CreateEmployee($input: CreateEmployeeInput!) {
                                createEmployee(input: $input) { id userId email name }
                            }`,
                            variables: {
                                input: {
                                    // Don't set id - let AppSync auto-generate it
                                    userId: userIdFromEvent,
                                    email: emailFromEvent,
                                    name: nameFromEvent,
                                    department: null,
                                    managerId: null,
                                    createdBy: null,
                                    isActive: true,
                                    createdAt: nowIso,
                                    updatedAt: nowIso
                                }
                            }
                        };
                        const createResult = await executeGraphql(createEmployeeMutation);
                        console.log(`${logPrefix} [STEP 2.0] ✅ Employee record created for ${emailFromEvent}`);
                        console.log(`${logPrefix} [STEP 2.0] Created Employee ID:`, createResult?.data?.createEmployee?.id);
                        if (createResult?.errors && createResult.errors.length > 0) {
                            console.error(`${logPrefix} [STEP 2.0] ❌ GraphQL errors:`, JSON.stringify(createResult.errors, null, 2));
                        }
                    }
                }
            } catch (selfSignupDbError) {
                console.warn(`${logPrefix} [STEP 2.0] ⚠️ Could not ensure Employee record for self-signup:`, selfSignupDbError.message || selfSignupDbError);
            }
        } else if (userRole === 'manager' || userRole === 'Managers') {
            groupName = 'Managers';
            console.log(`${logPrefix} [STEP 2.1] ✅ Role is 'manager' → Assigning to 'Managers' group`);
        } else if (userRole === 'store' || userRole === 'Store') {
            groupName = 'Store';
            console.log(`${logPrefix} [STEP 2.1] ✅ Role is 'store' → Assigning to 'Store' group`);
        } else if (userRole === 'businessunit' || userRole === 'BusinessUnit') {
            groupName = 'BusinessUnit';
            console.log(`${logPrefix} [STEP 2.1] ✅ Role is 'businessunit' → Assigning to 'BusinessUnit' group`);
        } else if (userRole === 'superadmin' || userRole === 'SuperAdmin') {
            groupName = 'SuperAdmin';
            console.log(`${logPrefix} [STEP 2.1] ✅ Role is 'superadmin' → Assigning to 'SuperAdmin' group`);
        } else {
            // If role is 'employee' or not set, check database to verify
            // This ensures Managers created without proper role attribute are still assigned correctly
            shouldCheckDatabase = true;
            console.log(`${logPrefix} [STEP 2.1] Role is '${userRole}' (default or employee), will check database to verify user type`);
        }
        
        // If we need to check database (role not explicitly set or is employee/default)
        if (shouldCheckDatabase) {
            console.log(`${logPrefix} [STEP 2.2] Database check required - verifying user type in database...`);
            // Check the database to see if this user is a Manager or Employee
            // This is a fallback for when external Lambda doesn't set custom:role correctly
            console.log(`${logPrefix} [STEP 2.2] Trigger source: ${triggerSource}`);
            
            // Check if user was just created (within last 2 minutes) and check database
            try {
                const userData = await cognitoClient.send(new AdminGetUserCommand({
                    UserPoolId: userPoolId,
                    Username: username
                }));
                
                const userId = userData.UserAttributes?.find(attr => attr.Name === 'sub')?.Value;
                const userCreatedDate = userData.UserCreateDate;
                const now = new Date();
                const createdTime = new Date(userCreatedDate);
                const timeDiff = (now - createdTime) / 1000; // seconds
                
                // If user was created within last 2 minutes, check database for Manager record
                if (timeDiff < 120 && userId) {
                    console.log(`${logPrefix} [STEP 2.3] User ${username} was created ${timeDiff} seconds ago`);
                    console.log(`${logPrefix} [STEP 2.3] User ID (sub): ${userId}`);
                    console.log(`${logPrefix} [STEP 2.3] Checking database for Manager or Employee record...`);
                    
                    // Wait for Manager or Employee record to be created in database
                    // CRITICAL: The Manager record is created by the frontend AFTER the Lambda completes
                    // The post-confirmation trigger runs IMMEDIATELY when user is created (before Lambda finishes)
                    // So we need to wait longer and retry multiple times to find the Manager record
                    console.log(`${logPrefix} [STEP 2.3] Waiting for Manager/Employee record to be created in database...`);
                    console.log(`${logPrefix} [STEP 2.3] ⚠️ TIMING ISSUE: Manager record is created by frontend AFTER Lambda completes`);
                    console.log(`${logPrefix} [STEP 2.3] Post-confirmation runs immediately, but Manager record comes later`);
                    console.log(`${logPrefix} [STEP 2.3] Will retry up to 4 times with 5-second delays (total ~20 seconds)...`);
                    
                    let managerFound = false;
                    let employeeFound = false;
                    const maxRetries = 4;
                    const waitTimePerRetry = 5000; // 5 seconds per retry
                    
                    // Get AppSync API endpoint and API key for database checks
                    const appsyncEndpoint = process.env.APPSYNC_API_URL || 
                                           'https://mswo73fsfjh4thfaalt7d63i4a.appsync-api.ca-central-1.amazonaws.com/graphql';
                    const apiKey = process.env.APPSYNC_API_KEY || 'da2-la7esrklanbehi5v7e574ao7fq';
                    
                    // First, check user attributes (might have been set by Lambda)
                    let userDataRetry = await cognitoClient.send(new AdminGetUserCommand({
                        UserPoolId: userPoolId,
                        Username: username
                    }));
                    
                    let roleAttrRetry = userDataRetry.UserAttributes?.find(attr => 
                        attr.Name === 'custom:role' || 
                        attr.Name === 'role' ||
                        attr.Name === 'custom:userRole'
                    );
                    
                    if (roleAttrRetry?.Value) {
                        userRole = roleAttrRetry.Value;
                        console.log(`${logPrefix} [STEP 2.3] ✅ Found role attribute: ${userRole}`);
                        if (userRole === 'manager' || userRole === 'Managers') {
                            groupName = 'Managers';
                            managerFound = true;
                            console.log(`${logPrefix} [STEP 2.3] ✅ Role attribute indicates Manager - will assign to Managers group`);
                        }
                    }
                    
                    // If role attribute not found, check database with retries
                    if (!managerFound) {
                        for (let retry = 1; retry <= maxRetries; retry++) {
                            console.log(`${logPrefix} [STEP 2.3] Retry ${retry}/${maxRetries}: Waiting ${waitTimePerRetry}ms before checking database...`);
                            const waitStartTime = Date.now();
                            await new Promise(resolve => setTimeout(resolve, waitTimePerRetry));
                            const waitEndTime = Date.now();
                            console.log(`${logPrefix} [STEP 2.3] Retry ${retry} wait completed (${waitEndTime - waitStartTime}ms)`);
                            
                            // Check database for Manager record
                            try {
                                console.log(`${logPrefix} [STEP 2.3] Checking database for Manager record (retry ${retry})...`);
                                
                                const managerGraphqlQuery = {
                                    query: `query GetManagerByUserId($userId: String!) {
                                        listManagers(filter: { userId: { eq: $userId } }) {
                                            items {
                                                id
                                                userId
                                                email
                                            }
                                        }
                                    }`,
                                    variables: { userId: userId }
                                };
                                
                                const managerPostData = JSON.stringify(managerGraphqlQuery);
                                const url = new URL(appsyncEndpoint);
                                
                                const managerResponse = await new Promise((resolve, reject) => {
                                    const req = https.request({
                                        hostname: url.hostname,
                                        port: 443,
                                        path: url.pathname,
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'x-api-key': apiKey
                                        },
                                        timeout: 10000
                                    }, (res) => {
                                        let data = '';
                                        res.on('data', (chunk) => { data += chunk; });
                                        res.on('end', () => {
                                            try {
                                                const parsed = JSON.parse(data);
                                                if (res.statusCode >= 200 && res.statusCode < 300) {
                                                    resolve(parsed);
                                                } else {
                                                    reject(new Error(`AppSync returned status ${res.statusCode}: ${data}`));
                                                }
                                            } catch (e) {
                                                reject(new Error(`Failed to parse response: ${e.message}`));
                                            }
                                        });
                                    });
                                    
                                    req.on('error', reject);
                                    req.on('timeout', () => {
                                        req.destroy();
                                        reject(new Error('Request timeout'));
                                    });
                                    req.write(managerPostData);
                                    req.end();
                                });
                                
                                if (managerResponse.data && managerResponse.data.listManagers && managerResponse.data.listManagers.items && managerResponse.data.listManagers.items.length > 0) {
                                    const managerRecord = managerResponse.data.listManagers.items[0];
                                    console.log(`${logPrefix} [STEP 2.3] ✅✅✅ FOUND MANAGER RECORD (retry ${retry}):`, managerRecord);
                                    userRole = 'manager';
                                    groupName = 'Managers';
                                    managerFound = true;
                                    break; // Exit retry loop
                                } else {
                                    console.log(`${logPrefix} [STEP 2.3] No Manager record found yet (retry ${retry})`);
                                }
                            } catch (dbCheckError) {
                                console.warn(`${logPrefix} [STEP 2.3] Error checking Manager table (retry ${retry}):`, dbCheckError.message);
                            }
                        }
                    }
                    
                    // If Manager not found, check for Employee record
                    if (!managerFound) {
                        console.log(`${logPrefix} [STEP 2.4] No Manager record found after ${maxRetries} retries`);
                        console.log(`${logPrefix} [STEP 2.4] Checking for Employee record...`);
                        try {
                            console.log(`${logPrefix} [STEP 2.4] 🔍 Checking database for Employee record with userId: ${userId}`);
                            
                            const employeeGraphqlQuery = {
                                query: `query GetEmployeeByUserId($userId: String!) {
                                    listEmployees(filter: { userId: { eq: $userId } }) {
                                        items {
                                            id
                                            userId
                                            email
                                        }
                                    }
                                }`,
                                variables: { userId: userId }
                            };
                            
                            const employeePostData = JSON.stringify(employeeGraphqlQuery);
                            
                            const employeeResponse = await new Promise((resolve, reject) => {
                                const req = https.request({
                                    hostname: url.hostname,
                                    port: 443,
                                    path: url.pathname,
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'x-api-key': apiKey
                                    },
                                    timeout: 5000
                                }, (res) => {
                                    let data = '';
                                    res.on('data', (chunk) => { data += chunk; });
                                    res.on('end', () => {
                                        try {
                                            const parsed = JSON.parse(data);
                                            if (res.statusCode >= 200 && res.statusCode < 300) {
                                                resolve(parsed);
                                            } else {
                                                reject(new Error(`AppSync returned status ${res.statusCode}: ${data}`));
                                            }
                                        } catch (e) {
                                            reject(new Error(`Failed to parse response: ${e.message}`));
                                        }
                                    });
                                });
                                
                                req.on('error', reject);
                                req.on('timeout', () => {
                                    req.destroy();
                                    reject(new Error('Request timeout'));
                                });
                                req.write(employeePostData);
                                req.end();
                            });
                            
                            // Check if Employee record was found
                            if (employeeResponse.data && employeeResponse.data.listEmployees && employeeResponse.data.listEmployees.items && employeeResponse.data.listEmployees.items.length > 0) {
                                const employeeRecord = employeeResponse.data.listEmployees.items[0];
                                console.log(`${logPrefix} [STEP 2.4] ✅ Found Employee record in database:`, employeeRecord);
                                userRole = 'employee';
                                groupName = 'Employees';
                                employeeFound = true;
                                console.log(`${logPrefix} [STEP 2.4] ✅ User ${username} will be assigned to Employees group based on database record`);
                            } else {
                                console.log(`${logPrefix} [STEP 2.4] ℹ️ No Employee record found in database for userId: ${userId}`);
                                console.log(`${logPrefix} [STEP 2.4]    User will be assigned to Employees group (default)`);
                            }
                        } catch (employeeDbCheckError) {
                            console.warn(`${logPrefix} [STEP 2.4] ⚠️ Could not check database for Employee record:`, employeeDbCheckError.message);
                            console.warn(`${logPrefix} [STEP 2.4]    User will be assigned to Employees group (default)`);
                        }
                    }
                } else {
                    console.warn(`${logPrefix} [STEP 2.3] ⚠️ User was created more than 2 minutes ago (${timeDiff} seconds)`);
                    console.warn(`${logPrefix} [STEP 2.3]    Skipping database check, defaulting to Employees group`);
                }
            } catch (checkError) {
                console.warn(`${logPrefix} [STEP 2.3] ⚠️ Could not check user details for role determination:`, checkError);
            }
        }
        
        console.log(`${logPrefix} [STEP 3] Final group assignment decision:`, {
            username: username,
            email: userEmail,
            role: userRole,
            groupName: groupName,
            reason: shouldCheckDatabase ? 'Database check' : 'Role attribute'
        });
        
        // CRITICAL: Check if user is already in a group (Lambda might have added them)
        console.log(`${logPrefix} [STEP 3.1] Checking if user is already in a group...`);
        let userAlreadyInGroup = false;
        let existingGroups = [];
        let shouldSkipAssignment = false;
        
        try {
            const listGroupsCommand = new AdminListGroupsForUserCommand({
                UserPoolId: userPoolId,
                Username: username
            });
            const groupsResponse = await cognitoClient.send(listGroupsCommand);
            existingGroups = groupsResponse.Groups?.map(g => g.GroupName) || [];
            console.log(`${logPrefix} [STEP 3.1] User is currently in groups:`, existingGroups);
            
            // CRITICAL: If user is already in Managers group, NEVER remove them or reassign
            if (existingGroups.includes('Managers')) {
                console.log(`${logPrefix} [STEP 3.1] ✅✅✅ USER IS ALREADY IN MANAGERS GROUP`);
                console.log(`${logPrefix} [STEP 3.1] ✅ This was likely added by the external Lambda`);
                console.log(`${logPrefix} [STEP 3.1] ✅ Keeping user in Managers group - NOT reassigning`);
                
                // If we determined Employees but user is in Managers, keep Managers
                if (groupName === 'Employees') {
                    console.log(`${logPrefix} [STEP 3.1] ⚠️ Database check suggested Employees, but user is in Managers`);
                    console.log(`${logPrefix} [STEP 3.1] ⚠️ This is likely a timing issue - Manager record not found yet`);
                    console.log(`${logPrefix} [STEP 3.1] ✅ Keeping Managers group assignment (correct)`);
                    groupName = 'Managers';
                }
                
                userAlreadyInGroup = true;
                shouldSkipAssignment = true; // Don't try to add again
            } else if (existingGroups.includes('Managers') && groupName === 'Managers') {
                console.log(`${logPrefix} [STEP 3.1] ✅ User is already in Managers group (likely added by Lambda)`);
                console.log(`${logPrefix} [STEP 3.1] ✅ No need to reassign - keeping Managers group`);
                userAlreadyInGroup = true;
                shouldSkipAssignment = true;
            } else if (existingGroups.length > 0) {
                console.log(`${logPrefix} [STEP 3.1] User is in groups: ${existingGroups.join(', ')}`);
                console.log(`${logPrefix} [STEP 3.1] Will add to ${groupName} group (user can be in multiple groups)`);
            } else {
                console.log(`${logPrefix} [STEP 3.1] User is not in any groups yet`);
            }
        } catch (groupsError) {
            console.warn(`${logPrefix} [STEP 3.1] ⚠️ Could not check user's existing groups:`, groupsError.message);
            console.warn(`${logPrefix} [STEP 3.1] Proceeding with group assignment...`);
        }
        
        console.log(`${logPrefix} [STEP 4] Assigning user ${username} (${userEmail}) to ${groupName} group...`);
        
        // CRITICAL: If user is already in Managers group, NEVER reassign
        if (shouldSkipAssignment) {
            console.log(`${logPrefix} [STEP 4] ⚠️ SKIPPING GROUP ASSIGNMENT`);
            console.log(`${logPrefix} [STEP 4] ⚠️ User is already in Managers group (added by Lambda)`);
            console.log(`${logPrefix} [STEP 4] ⚠️ Keeping existing group assignment to avoid conflicts`);
            console.log(`${logPrefix} [STEP 4] ✅ User will remain in Managers group`);
        } else if (!userAlreadyInGroup || !existingGroups.includes(groupName)) {
            // Add user to the appropriate group
            const command = new AdminAddUserToGroupCommand({
                UserPoolId: userPoolId,
                Username: username,
                GroupName: groupName
            });
            
            const assignStartTime = Date.now();
            try {
                await cognitoClient.send(command);
                const assignEndTime = Date.now();
                console.log(`${logPrefix} [STEP 4] ✅ Successfully added user ${username} to ${groupName} group (took ${assignEndTime - assignStartTime}ms)`);
            } catch (addError) {
                // If user is already in the group, that's okay
                if (addError.name === 'InvalidParameterException' && addError.message?.includes('already exists')) {
                    console.log(`${logPrefix} [STEP 4] ℹ️ User ${username} is already in ${groupName} group`);
                } else {
                    throw addError;
                }
            }
        } else {
            console.log(`${logPrefix} [STEP 4] ℹ️ User ${username} is already in ${groupName} group - skipping assignment`);
        }
        console.log(`${logPrefix} ========================================`);
        console.log(`${logPrefix} ✅ PROCESS COMPLETE`);
        console.log(`${logPrefix} Summary:`, {
            username: username,
            email: userEmail,
            role: userRole,
            group: groupName,
            timestamp: new Date().toISOString()
        });
        console.log(`${logPrefix} ========================================`);
        
        return event;
    }
    catch (error) {
        console.error(`${logPrefix} ========================================`);
        console.error(`${logPrefix} ❌ ERROR IN POST-CONFIRMATION TRIGGER`);
        console.error(`${logPrefix} Error adding user ${username} to group:`, error);
        console.error(`${logPrefix} Error type:`, error.name || error.constructor?.name || typeof error);
        console.error(`${logPrefix} Error message:`, error.message || String(error));
        if (error.stack) {
            console.error(`${logPrefix} Stack trace:`, error.stack);
        }
        
        // If group doesn't exist, log warning but don't fail
        if (error.name === 'ResourceNotFoundException') {
            console.warn(`${logPrefix} ⚠️ Group not found. Please ensure the group exists in Cognito.`);
        }
        
        console.error(`${logPrefix} ========================================`);
        // Return event anyway to allow signup to complete
        // The user can be manually added to the group later if needed
        return event;
    }
};

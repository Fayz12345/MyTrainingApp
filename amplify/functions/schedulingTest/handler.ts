/**
 * Lambda function to test connectivity to external scheduling system API
 * 
 * This function validates:
 * 1. API endpoint connectivity
 * 2. Authentication method
 * 3. POST request capability
 * 4. Response handling
 * 
 * Usage:
 * - Invoke via Function URL or API Gateway
 * - Pass employeeId in request body
 * - Check CloudWatch logs for detailed results
 */

interface LambdaEvent {
  httpMethod?: string;
  body?: string | any;
  requestContext?: {
    http?: {
      method?: string;
      path?: string;
    };
  };
  headers?: Record<string, string>;
  rawPath?: string;
  rawQueryString?: string;
  isBase64Encoded?: boolean;
}

interface SchedulingTestRequest {
  employeeId?: string;
  testType?: 'connectivity' | 'auth' | 'post' | 'all';
  endpoint?: string;
}

interface SchedulingTestResponse {
  success: boolean;
  testType: string;
  timestamp: string;
  results: {
    connectivity?: {
      success: boolean;
      statusCode?: number;
      responseTime?: number;
      error?: string;
    };
    authentication?: {
      success: boolean;
      method?: string;
      error?: string;
    };
    postRequest?: {
      success: boolean;
      statusCode?: number;
      response?: any;
      error?: string;
    };
  };
  recommendations?: string[];
}

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

export const handler = async (event: LambdaEvent): Promise<any> => {
  const logPrefix = '[SCHEDULING_TEST]';
  const timestamp = new Date().toISOString();
  
  console.log(`${logPrefix} ========================================`);
  console.log(`${logPrefix} 🧪 Scheduling System API Test`);
  console.log(`${logPrefix} Timestamp: ${timestamp}`);
  console.log(`${logPrefix} ========================================`);

  // Handle CORS preflight OPTIONS request
  const httpMethod = event.httpMethod || event.requestContext?.http?.method;
  if (httpMethod === 'OPTIONS') {
    console.log(`${logPrefix} Handling CORS preflight request`);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'CORS preflight successful' })
    };
  }

  try {
    // Get configuration from environment variables - Default to Clearview Connect sandbox
    const SCHEDULING_API_URL = process.env.SCHEDULING_API_URL || 'https://sandbox.clearviewconnect.com/api/v1';
    const SCHEDULING_API_TOKEN = process.env.SCHEDULING_API_TOKEN || 'YOUR_TOKEN';
    
    console.log(`${logPrefix} [CONFIG] API URL: ${SCHEDULING_API_URL}`);
    console.log(`${logPrefix} [CONFIG] Token configured: ${SCHEDULING_API_TOKEN !== 'YOUR_TOKEN' ? 'Yes' : 'No (using placeholder)'}`);

    // Parse request body
    let requestBody: SchedulingTestRequest = {};
    
    if (event.body) {
      if (typeof event.body === 'string') {
        try {
          requestBody = JSON.parse(event.body);
        } catch (parseError) {
          console.error(`${logPrefix} ❌ Failed to parse request body:`, parseError);
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({
              success: false,
              error: 'Invalid JSON in request body'
            })
          };
        }
      } else {
        requestBody = event.body;
      }
    }

    const testType = requestBody.testType || 'all';
    const employeeId = requestBody.employeeId || 'test-employee-123';
    const customEndpoint = requestBody.endpoint;

    console.log(`${logPrefix} [TEST] Test Type: ${testType}`);
    console.log(`${logPrefix} [TEST] Employee ID: ${employeeId}`);

    const response: SchedulingTestResponse = {
      success: false,
      testType,
      timestamp,
      results: {},
      recommendations: []
    };

    // Test 1: Connectivity Test (GET request to base endpoint)
    if (testType === 'connectivity' || testType === 'all') {
      console.log(`${logPrefix} [TEST 1] Testing connectivity...`);
      const connectivityStart = Date.now();
      
      try {
        const testUrl = customEndpoint || `${SCHEDULING_API_URL}/health` || `${SCHEDULING_API_URL}`;
        console.log(`${logPrefix} [TEST 1] Testing URL: ${testUrl}`);
        
        const fetchResponse = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${SCHEDULING_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });

        const responseTime = Date.now() - connectivityStart;
        const statusCode = fetchResponse.status;

        response.results.connectivity = {
          success: statusCode >= 200 && statusCode < 400,
          statusCode,
          responseTime
        };

        console.log(`${logPrefix} [TEST 1] ✅ Connectivity test completed`);
        console.log(`${logPrefix} [TEST 1] Status: ${statusCode}, Time: ${responseTime}ms`);

        if (statusCode === 401 || statusCode === 403) {
          response.recommendations?.push('Authentication failed - check API token');
        } else if (statusCode >= 500) {
          response.recommendations?.push('Server error - scheduling API may be down');
        }
      } catch (error: any) {
        const responseTime = Date.now() - connectivityStart;
        response.results.connectivity = {
          success: false,
          responseTime,
          error: error.message || 'Connection failed'
        };
        console.error(`${logPrefix} [TEST 1] ❌ Connectivity test failed:`, error.message);
        response.recommendations?.push('Check network connectivity and API URL');
      }
    }

    // Test 2: Authentication Test
    if (testType === 'auth' || testType === 'all') {
      console.log(`${logPrefix} [TEST 2] Testing authentication...`);
      
      try {
        const authUrl = customEndpoint || `${SCHEDULING_API_URL}/auth/verify` || `${SCHEDULING_API_URL}/employees`;
        console.log(`${logPrefix} [TEST 2] Testing auth URL: ${authUrl}`);
        
        const authResponse = await fetch(authUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${SCHEDULING_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(10000)
        });

        const authStatus = authResponse.status;
        const isAuthenticated = authStatus !== 401 && authStatus !== 403;

        response.results.authentication = {
          success: isAuthenticated,
          method: 'Bearer Token',
          error: isAuthenticated ? undefined : `Authentication failed with status ${authStatus}`
        };

        console.log(`${logPrefix} [TEST 2] ${isAuthenticated ? '✅' : '❌'} Authentication test: ${authStatus}`);

        if (!isAuthenticated) {
          response.recommendations?.push('Update SCHEDULING_API_TOKEN environment variable with valid token');
          response.recommendations?.push('Verify token format matches API requirements (Bearer, Basic, etc.)');
        }
      } catch (error: any) {
        response.results.authentication = {
          success: false,
          method: 'Bearer Token',
          error: error.message || 'Authentication test failed'
        };
        console.error(`${logPrefix} [TEST 2] ❌ Authentication test failed:`, error.message);
      }
    }

    // Test 3: POST Request Test (Update employee training status)
    if (testType === 'post' || testType === 'all') {
      console.log(`${logPrefix} [TEST 3] Testing POST request...`);
      const postStart = Date.now();
      
      try {
        const postUrl = customEndpoint || `${SCHEDULING_API_URL}/employees/${employeeId}/training`;
        console.log(`${logPrefix} [TEST 3] POST URL: ${postUrl}`);
        
        // Clearview Connect API payload format
        const postBody = {
          employeeId,
          employeeName: 'Test Employee',
          employeeEmail: 'test@example.com',
          storeId: 'test-store-123',
          eligibleDate: new Date().toISOString(),
          completedLearningPaths: ['test-path-1'],
          bankingInfoOnFile: true
        };

        console.log(`${logPrefix} [TEST 3] Request body:`, JSON.stringify(postBody, null, 2));

        const postResponse = await fetch(postUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SCHEDULING_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(postBody),
          signal: AbortSignal.timeout(15000) // 15 second timeout for POST
        });

        const postStatus = postResponse.status;
        let postResponseData: any = null;

        try {
          const responseText = await postResponse.text();
          if (responseText) {
            postResponseData = JSON.parse(responseText);
          }
        } catch (parseError) {
          // Response might not be JSON
          postResponseData = { raw: await postResponse.text() };
        }

        const responseTime = Date.now() - postStart;
        const isSuccess = postStatus >= 200 && postStatus < 300;

        response.results.postRequest = {
          success: isSuccess,
          statusCode: postStatus,
          response: postResponseData,
          error: isSuccess ? undefined : `POST request failed with status ${postStatus}`
        };

        console.log(`${logPrefix} [TEST 3] ${isSuccess ? '✅' : '❌'} POST test: ${postStatus}`);
        console.log(`${logPrefix} [TEST 3] Response time: ${responseTime}ms`);
        console.log(`${logPrefix} [TEST 3] Response:`, JSON.stringify(postResponseData, null, 2));

        if (!isSuccess) {
          if (postStatus === 404) {
            response.recommendations?.push('Endpoint not found - verify API endpoint path');
          } else if (postStatus === 400) {
            response.recommendations?.push('Bad request - check request body format');
          } else if (postStatus === 401 || postStatus === 403) {
            response.recommendations?.push('Authentication failed - verify API token');
          }
        }
      } catch (error: any) {
        const responseTime = Date.now() - postStart;
        response.results.postRequest = {
          success: false,
          error: error.message || 'POST request failed',
          statusCode: undefined
        };
        console.error(`${logPrefix} [TEST 3] ❌ POST test failed:`, error.message);
        response.recommendations?.push('Check network connectivity and API endpoint');
      }
    }

    // Determine overall success
    const allTests = [
      response.results.connectivity,
      response.results.authentication,
      response.results.postRequest
    ].filter(Boolean);

    response.success = allTests.length > 0 && allTests.every(test => test?.success === true);

    // Add general recommendations
    if (!response.success) {
      response.recommendations?.push('Review CloudWatch logs for detailed error information');
      response.recommendations?.push('Verify SCHEDULING_API_URL and SCHEDULING_API_TOKEN environment variables');
      response.recommendations?.push('Check scheduling system API documentation for correct endpoints');
    } else {
      response.recommendations?.push('✅ All tests passed - API integration is feasible');
      response.recommendations?.push('Proceed with full integration implementation');
    }

    console.log(`${logPrefix} ========================================`);
    console.log(`${logPrefix} 📊 Test Summary:`);
    console.log(`${logPrefix} Overall Success: ${response.success ? '✅' : '❌'}`);
    console.log(`${logPrefix} Connectivity: ${response.results.connectivity?.success ? '✅' : '❌'}`);
    console.log(`${logPrefix} Authentication: ${response.results.authentication?.success ? '✅' : '❌'}`);
    console.log(`${logPrefix} POST Request: ${response.results.postRequest?.success ? '✅' : '❌'}`);
    console.log(`${logPrefix} ========================================`);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response, null, 2)
    };

  } catch (error: any) {
    console.error(`${logPrefix} ❌ Unexpected error:`, error);
    console.error(`${logPrefix} Error details:`, {
      name: error?.name,
      message: error?.message,
      stack: error?.stack
    });

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: error?.message || 'Unexpected error occurred',
        timestamp,
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      })
    };
  }
};


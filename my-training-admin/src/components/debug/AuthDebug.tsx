import React, { useState, useEffect } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';

/**
 * Debug component to check authentication and authorization
 * Add this temporarily to diagnose 401 errors
 */
const AuthDebug: React.FC = () => {
  const [authInfo, setAuthInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setLoading(true);
      const session = await fetchAuthSession({ forceRefresh: true });
      const token = session.tokens?.idToken?.payload;
      
      // Extract groups from token (handle string, array, or undefined)
      let groups: string[] = [];
      const groupsClaim = token?.['cognito:groups'];
      if (typeof groupsClaim === 'string') {
        groups = [groupsClaim];
      } else if (Array.isArray(groupsClaim)) {
        groups = groupsClaim.filter((g): g is string => typeof g === 'string');
      }
      
      const info = {
        hasToken: !!session.tokens?.idToken,
        userId: token?.['sub'],
        email: token?.['email'],
        groups: groups,
        tokenExp: token?.['exp'] ? new Date(token['exp'] * 1000).toLocaleString() : 'N/A',
        tokenIat: token?.['iat'] ? new Date(token['iat'] * 1000).toLocaleString() : 'N/A',
        isSuperAdmin: groups.includes('SuperAdmin'),
        fullToken: token
      };
      
      setAuthInfo(info);
    } catch (error) {
      console.error('Error checking auth:', error);
      setAuthInfo({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  const testBusinessUnitQuery = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      
      const client = generateClient<Schema>({
        authMode: 'userPool'
      });
      const result = await client.models.BusinessUnit.list();
      
      setTestResult({
        success: true,
        data: result.data,
        errors: result.errors,
        message: 'Query successful!'
      });
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Query failed'
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div>Loading auth info...</div>;
  }

  return (
    <div style={{ 
      padding: '1rem', 
      backgroundColor: '#f5f5f5', 
      border: '1px solid #ccc',
      borderRadius: '4px',
      margin: '1rem 0',
      fontFamily: 'monospace',
      fontSize: '0.9rem'
    }}>
      <h3>🔍 Authentication Debug Info</h3>
      
      {authInfo?.error ? (
        <div style={{ color: 'red' }}>
          <strong>Error:</strong> {authInfo.error}
        </div>
      ) : (
        <>
          <div style={{ marginTop: '0.5rem' }}>
            <strong>Has Token:</strong> {authInfo?.hasToken ? '✅ Yes' : '❌ No'}
          </div>
          <div>
            <strong>User ID:</strong> {authInfo?.userId || 'N/A'}
          </div>
          <div>
            <strong>Email:</strong> {authInfo?.email || 'N/A'}
          </div>
          <div>
            <strong>Groups:</strong> {Array.isArray(authInfo?.groups) ? authInfo.groups.join(', ') : (authInfo?.groups || 'None')}
          </div>
          <div>
            <strong>Is SuperAdmin:</strong> {authInfo?.isSuperAdmin ? '✅ Yes' : '❌ No'}
          </div>
          <div>
            <strong>Token Issued:</strong> {authInfo?.tokenIat}
          </div>
          <div>
            <strong>Token Expires:</strong> {authInfo?.tokenExp}
          </div>
          
          {!authInfo?.isSuperAdmin && (
            <div style={{ 
              marginTop: '1rem', 
              padding: '0.5rem', 
              backgroundColor: '#ffebee', 
              color: '#c62828',
              borderRadius: '4px'
            }}>
              ⚠️ <strong>Warning:</strong> User is NOT in SuperAdmin group!
              <br />
              Token groups: {JSON.stringify(authInfo?.groups)}
            </div>
          )}
        </>
      )}
      
      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
        <button 
          onClick={checkAuth}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          🔄 Refresh Auth Info
        </button>
        <button 
          onClick={testBusinessUnitQuery}
          disabled={testing}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: testing ? '#ccc' : '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: testing ? 'not-allowed' : 'pointer'
          }}
        >
          {testing ? 'Testing...' : '🧪 Test BusinessUnit Query'}
        </button>
      </div>
      
      {testResult && (
        <div style={{ 
          marginTop: '1rem', 
          padding: '0.5rem', 
          backgroundColor: testResult.success ? '#e8f5e9' : '#ffebee',
          color: testResult.success ? '#2e7d32' : '#c62828',
          borderRadius: '4px'
        }}>
          <strong>Test Result:</strong> {testResult.message}
          {testResult.error && (
            <div style={{ marginTop: '0.5rem' }}>
              <strong>Error:</strong> {testResult.error}
            </div>
          )}
          {testResult.errors && testResult.errors.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <strong>GraphQL Errors:</strong>
              <pre style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                {JSON.stringify(testResult.errors, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AuthDebug;


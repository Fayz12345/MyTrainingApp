import React, { useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';

/**
 * Test component to diagnose GraphQL authorization issues
 * Add this temporarily to your dashboard to test
 */
const TestGraphQL: React.FC = () => {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testQuery = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Step 1: Check authentication
      console.log('=== STEP 1: Check Auth ===');
      const session = await fetchAuthSession({ forceRefresh: true });
      console.log('Session:', {
        hasToken: !!session.tokens?.idToken,
        tokenExp: session.tokens?.idToken?.payload?.exp,
        groups: session.tokens?.idToken?.payload?.['cognito:groups']
      });

      if (!session.tokens?.idToken) {
        throw new Error('No token found');
      }

      // Step 2: Get token string
      const tokenString = session.tokens.idToken.toString();
      console.log('=== STEP 2: Token String ===');
      console.log('Token length:', tokenString.length);
      console.log('Token preview:', tokenString.substring(0, 50) + '...');

      // Step 3: Generate client
      console.log('=== STEP 3: Generate Client ===');
      const client = generateClient<Schema>({
        authMode: 'userPool'
      });
      console.log('Client generated:', !!client);

      // Step 4: Try query
      console.log('=== STEP 4: Execute Query ===');
      const queryResult = await client.models.BusinessUnit.list();
      console.log('Query result:', queryResult);

      setResult({
        success: true,
        data: queryResult.data,
        errors: queryResult.errors,
        message: 'Query successful!'
      });
    } catch (err: any) {
      console.error('=== ERROR ===');
      console.error('Error type:', err.constructor.name);
      console.error('Error message:', err.message);
      console.error('Full error:', err);
      
      setError(err.message || 'Unknown error');
      setResult({
        success: false,
        error: err.message,
        stack: err.stack
      });
    } finally {
      setLoading(false);
    }
  };

  const testDirectFetch = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const session = await fetchAuthSession({ forceRefresh: true });
      const token = session.tokens?.idToken?.toString();
      
      if (!token) {
        throw new Error('No token available');
      }

      const API_URL = 'https://nf2ayvu4ebgm3f2bomzsr5wxmq.appsync-api.ca-central-1.amazonaws.com/graphql';
      
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query: `
            query {
              listBusinessUnits {
                items {
                  id
                  name
                  description
                }
              }
            }
          `
        })
      });

      const data = await response.json();
      
      setResult({
        success: response.ok,
        status: response.status,
        data: data,
        message: response.ok ? 'Direct fetch successful!' : 'Direct fetch failed'
      });
    } catch (err: any) {
      setError(err.message);
      setResult({
        success: false,
        error: err.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      padding: '1rem', 
      backgroundColor: '#f5f5f5', 
      border: '1px solid #ccc',
      borderRadius: '4px',
      margin: '1rem 0'
    }}>
      <h3>🧪 GraphQL Test Component</h3>
      
      <div style={{ marginBottom: '1rem' }}>
        <button 
          onClick={testQuery}
          disabled={loading}
          style={{ 
            padding: '0.5rem 1rem', 
            marginRight: '0.5rem',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          Test with generateClient
        </button>
        
        <button 
          onClick={testDirectFetch}
          disabled={loading}
          style={{ 
            padding: '0.5rem 1rem',
            backgroundColor: '#388e3c',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          Test Direct Fetch (with token)
        </button>
      </div>

      {loading && <p>Testing...</p>}
      
      {error && (
        <div style={{ color: 'red', marginTop: '1rem' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: '1rem' }}>
          <strong>Result:</strong>
          <pre style={{ 
            backgroundColor: '#fff', 
            padding: '1rem', 
            borderRadius: '4px',
            overflow: 'auto',
            maxHeight: '400px'
          }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
        <p><strong>Instructions:</strong></p>
        <ol>
          <li>Click "Test with generateClient" - tests the Amplify client</li>
          <li>Click "Test Direct Fetch" - tests with manual token passing</li>
          <li>Check browser console for detailed logs</li>
          <li>Compare results to see where it fails</li>
        </ol>
      </div>
    </div>
  );
};

export default TestGraphQL;


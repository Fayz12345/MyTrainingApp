import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';
import BusinessUnitForm from './BusinessUnitForm';

type BusinessUnit = {
  readonly id: string;
  readonly name: string;
  readonly description?: string | null;
  readonly createdBy?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

interface BusinessUnitListProps {
  refreshTrigger?: number;
}

const BusinessUnitList: React.FC<BusinessUnitListProps> = ({ refreshTrigger }) => {
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingBusinessUnit, setEditingBusinessUnit] = useState<BusinessUnit | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Import auth functions
      const { fetchAuthSession, getCurrentUser } = await import('aws-amplify/auth');
      
      // First verify user is authenticated
      try {
        await getCurrentUser();
      } catch (error) {
        throw new Error('User is not authenticated. Please sign in again.');
      }

      // Get fresh auth session with token
      const session = await fetchAuthSession({ forceRefresh: true });
      
      if (!session.tokens || !session.tokens.idToken) {
        throw new Error('No authentication token found. Please sign in again.');
      }

      // Verify token is not expired
      const tokenExp = session.tokens.idToken.payload?.exp;
      if (tokenExp && Date.now() > tokenExp * 1000) {
        throw new Error('Authentication token has expired. Please sign in again.');
      }

      // Debug: Log token to verify it exists BEFORE generating client
      console.log('Auth session:', {
        hasToken: !!session.tokens?.idToken,
        tokenExp: tokenExp ? new Date(tokenExp * 1000).toISOString() : 'N/A',
        tokenExpired: tokenExp ? Date.now() > tokenExp * 1000 : 'N/A',
        groups: session.tokens?.idToken?.payload?.['cognito:groups'],
        userId: session.tokens?.idToken?.payload?.sub,
        tokenString: session.tokens?.idToken?.toString() ? 'Token exists (string)' : 'No token string'
      });

      // Generate client - Amplify should automatically use the current auth session
      // The authMode tells it to use Cognito User Pool authentication
      // IMPORTANT: Client must be generated AFTER we have confirmed the session exists
      const client = generateClient<Schema>({
        authMode: 'userPool'
      });
      
      // Additional debug: Check if client has auth configured
      console.log('Client generated:', {
        hasClient: !!client,
        hasModels: !!client?.models,
        hasBusinessUnit: !!client?.models?.BusinessUnit
      });

      // Check if client and models are available
      if (!client) {
        throw new Error('Client not initialized. Please refresh the page.');
      }

      if (!client.models) {
        console.error('Client models are undefined. Available client properties:', Object.keys(client));
        throw new Error('Client models not available. Please check your Amplify configuration.');
      }

      if (!client.models.BusinessUnit) {
        console.error('Available models:', Object.keys(client.models));
        throw new Error('BusinessUnit model not found. Available models: ' + Object.keys(client.models).join(', ') + '. Please push your schema changes and wait for deployment to complete.');
      }

      // TEMPORARY: Check if API has BusinessUnit model
      // This error occurs when the dev API hasn't been updated with BusinessUnit yet
      // The model exists in amplify_outputs.json but not in the actual AppSync API
      // Solution: Push schema changes (git push origin dev) and wait for deployment
      const result = await client.models.BusinessUnit.list();

      if (result.errors && result.errors.length > 0) {
        const errorMessages = result.errors.map((e: any) => e.message).join(', ');
        
        // Check if this is the "listBusinessUnits is undefined" error
        if (errorMessages.includes('listBusinessUnits') || errorMessages.includes('Unknown type ModelBusinessUnitFilterInput')) {
          throw new Error(
            'BusinessUnit model is not available in the API yet. ' +
            'This happens when schema changes are not deployed. ' +
            'Please push your changes (git push origin dev) and wait for deployment to complete (5-10 minutes). ' +
            'Original error: ' + errorMessages
          );
        }
        
        throw new Error('Failed to fetch business units: ' + errorMessages);
      }

      setBusinessUnits(result.data as BusinessUnit[]);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const deleteBusinessUnit = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete business unit "${name}"? This will also delete all associated stores.`)) {
      return;
    }

    try {
      // Verify user is authenticated
      const { fetchAuthSession } = await import('aws-amplify/auth');
      const session = await fetchAuthSession({ forceRefresh: true });
      
      if (!session.tokens || !session.tokens.idToken) {
        throw new Error('User is not authenticated. Please sign in again.');
      }

      const client = generateClient<Schema>({
        authMode: 'userPool'
      });
      await client.models.BusinessUnit.delete({ 
        id 
      });
      alert('Business Unit deleted successfully');
      fetchData();
    } catch (err) {
      console.error('Error deleting business unit:', err);
      alert('Failed to delete business unit');
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p>Loading business units...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'red' }}>
        <p>{error}</p>
        <button 
          onClick={fetchData}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (showCreateForm || editingBusinessUnit) {
    return (
      <BusinessUnitForm 
        onCancel={() => {
          setShowCreateForm(false);
          setEditingBusinessUnit(null);
        }}
        onBusinessUnitCreated={() => {
          setShowCreateForm(false);
          setEditingBusinessUnit(null);
          fetchData();
        }}
        businessUnit={editingBusinessUnit}
      />
    );
  }

  if (businessUnits.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p>No business units found. Create your first business unit to get started.</p>
        <button 
          onClick={() => setShowCreateForm(true)}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginTop: '1rem'
          }}
        >
          Create New Business Unit
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3>Business Units ({businessUnits.length})</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={() => setShowCreateForm(true)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            + Create Business Unit
          </button>
          <button 
            onClick={fetchData}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#f5f5f5',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '1rem' }}>
        {businessUnits.map((businessUnit) => (
          <div 
            key={businessUnit.id} 
            style={{
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              padding: '1.5rem',
              backgroundColor: 'white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0, color: '#1976d2', marginBottom: '0.5rem' }}>
                  {businessUnit.name}
                </h4>
                {businessUnit.description && (
                  <p style={{ margin: '0.5rem 0', color: '#666' }}>
                    {businessUnit.description}
                  </p>
                )}
                <p style={{ margin: '0.5rem 0', color: '#999', fontSize: '0.9rem' }}>
                  Created: {new Date(businessUnit.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                <button
                  onClick={() => setEditingBusinessUnit(businessUnit)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#1976d2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => deleteBusinessUnit(businessUnit.id, businessUnit.name)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#d32f2f',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BusinessUnitList;


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

      // Verify user is authenticated before making request
      const { fetchAuthSession } = await import('aws-amplify/auth');
      const session = await fetchAuthSession({ forceRefresh: true });
      
      if (!session.tokens || !session.tokens.idToken) {
        throw new Error('User is not authenticated. Please sign in again.');
      }

      // Generate client inside function to ensure Amplify is configured
      // Set authMode to 'userPool' at client level
      const client = generateClient<Schema>({
        authMode: 'userPool'
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
        throw new Error('BusinessUnit model not found. Available models: ' + Object.keys(client.models).join(', '));
      }

      const result = await client.models.BusinessUnit.list();

      if (result.errors && result.errors.length > 0) {
        throw new Error('Failed to fetch business units: ' + result.errors.map((e: any) => e.message).join(', '));
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


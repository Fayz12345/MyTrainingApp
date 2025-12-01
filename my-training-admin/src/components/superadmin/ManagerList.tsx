import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';
import ManagerForm from '../store/ManagerForm';

const client = generateClient<Schema>();

type Manager = {
  readonly id: string;
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly storeId: string;
  readonly createdBy?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

type Store = {
  readonly id: string;
  readonly name: string;
};

interface ManagerListProps {
  refreshTrigger?: number;
}

const ManagerList: React.FC<ManagerListProps> = ({ refreshTrigger }) => {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [stores, setStores] = useState<Record<string, Store>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('SuperAdmin ManagerList - Starting to fetch managers...');

      // SuperAdmin can see ALL managers (no filtering by createdBy)
      const [managersResult, storesResult] = await Promise.all([
        client.models.Manager.list({}),
        client.models.Store.list({})
      ]);

      console.log('SuperAdmin ManagerList - Managers result:', {
        hasData: !!managersResult.data,
        dataLength: managersResult.data?.length,
        hasErrors: !!managersResult.errors,
        errors: managersResult.errors
      });

      if (managersResult.errors && managersResult.errors.length > 0) {
        console.error('SuperAdmin ManagerList - Errors fetching managers:', managersResult.errors);
        throw new Error('Failed to fetch managers: ' + managersResult.errors.map((e: any) => e.message).join(', '));
      }

      if (storesResult.errors && storesResult.errors.length > 0) {
        console.warn('Warning fetching stores:', storesResult.errors);
      }

      // SuperAdmin sees all managers (no filtering)
      const managersData = (managersResult.data as Manager[]) || [];
      console.log('SuperAdmin ManagerList - Total managers fetched:', managersData.length);
      if (managersData.length > 0) {
        console.log('SuperAdmin ManagerList - Sample manager:', managersData[0]);
      } else {
        console.log('SuperAdmin ManagerList - No managers found. Checking if data is null/undefined:', {
          dataIsNull: managersResult.data === null,
          dataIsUndefined: managersResult.data === undefined,
          dataType: typeof managersResult.data,
          rawData: managersResult.data
        });
      }
      setManagers(managersData);
      
      // Create a map of stores for easy lookup
      const storeMap: Record<string, Store> = {};
      if (storesResult.data) {
        (storesResult.data as Store[]).forEach(store => {
          storeMap[store.id] = store;
        });
      }
      setStores(storeMap);
    } catch (err) {
      console.error('SuperAdmin ManagerList - Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const deleteManager = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete manager "${name}"? This will also remove all their employee assignments.`)) {
      return;
    }

    try {
      await client.models.Manager.delete({ id });
      alert('Manager deleted successfully');
      fetchData();
    } catch (err) {
      console.error('Error deleting manager:', err);
      alert('Failed to delete manager');
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p>Loading managers...</p>
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

  if (showCreateForm) {
    return (
      <ManagerForm 
        onCancel={() => setShowCreateForm(false)}
        onManagerCreated={() => {
          setShowCreateForm(false);
          // Force refresh after a short delay to ensure data is available
          setTimeout(() => {
            fetchData();
          }, 500);
        }}
      />
    );
  }

  if (managers.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p>No managers found. Create your first manager to get started.</p>
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
          Create New Manager
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3>Managers ({managers.length})</h3>
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
            + Create Manager
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
        {managers.map((manager) => {
          const store = stores[manager.storeId];
          return (
            <div 
              key={manager.id} 
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
                    {manager.name}
                  </h4>
                  <p style={{ margin: '0.5rem 0', color: '#666' }}>
                    <strong>Email:</strong> {manager.email}
                  </p>
                  {store && (
                    <p style={{ margin: '0.5rem 0', color: '#666' }}>
                      <strong>Store:</strong> {store.name}
                    </p>
                  )}
                  <p style={{ margin: '0.5rem 0', color: '#999', fontSize: '0.9rem' }}>
                    Created: {new Date(manager.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                  <button
                    onClick={() => deleteManager(manager.id, manager.name)}
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
          );
        })}
      </div>
    </div>
  );
};

export default ManagerList;


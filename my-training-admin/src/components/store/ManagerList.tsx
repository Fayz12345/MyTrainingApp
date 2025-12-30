import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';
import ManagerForm from './ManagerForm';

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
  const [managerStores, setManagerStores] = useState<Record<string, string[]>>({}); // managerId -> storeIds[]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user ID to filter managers for Store users
      const { fetchAuthSession } = await import('aws-amplify/auth');
      const session = await fetchAuthSession();
      const userId = session.userSub || session.tokens?.idToken?.payload?.sub as string;

      const [managersResult, storesResult, managerStoresResult] = await Promise.all([
        client.models.Manager.list({}),
        client.models.Store.list({}),
        client.models.ManagerStore.list({})
      ]);

      if (managersResult.errors && managersResult.errors.length > 0) {
        throw new Error('Failed to fetch managers: ' + managersResult.errors.map((e: any) => e.message).join(', '));
      }

      if (storesResult.errors && storesResult.errors.length > 0) {
        console.warn('Warning fetching stores:', storesResult.errors);
      }

      // Filter managers: Store users only see managers they created
      let filteredManagers = managersResult.data as Manager[];
      if (userId) {
        filteredManagers = filteredManagers.filter(manager => manager.createdBy === userId);
      }

      setManagers(filteredManagers);
      
      // Create a map of stores for easy lookup
      const storeMap: Record<string, Store> = {};
      (storesResult.data as Store[]).forEach(store => {
        storeMap[store.id] = store;
      });
      setStores(storeMap);

      // Build manager -> stores mapping from ManagerStore relationships
      const managerStoreMap: Record<string, string[]> = {};
      if (managerStoresResult.data) {
        (managerStoresResult.data as any[]).forEach(ms => {
          if (ms.managerId && ms.storeId) {
            if (!managerStoreMap[ms.managerId]) {
              managerStoreMap[ms.managerId] = [];
            }
            if (!managerStoreMap[ms.managerId].includes(ms.storeId)) {
              managerStoreMap[ms.managerId].push(ms.storeId);
            }
          }
        });
      }

      // Also include primary storeId for managers that have one
      filteredManagers.forEach(manager => {
        if (manager.storeId) {
          if (!managerStoreMap[manager.id]) {
            managerStoreMap[manager.id] = [];
          }
          if (!managerStoreMap[manager.id].includes(manager.storeId)) {
            managerStoreMap[manager.id].push(manager.storeId);
          }
        }
      });

      setManagerStores(managerStoreMap);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const deleteManager = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete manager "${name}"? This will also delete all associated employees.`)) {
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
          fetchData();
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
      <div className="list-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: 'clamp(1.1rem, 3vw, 1.5rem)' }}>Managers ({managers.length})</h3>
        <div className="list-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
          const managerStoreIds = managerStores[manager.id] || [];
          const managerStoresList = managerStoreIds
            .map(storeId => stores[storeId])
            .filter((store): store is Store => store !== undefined);
          
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
              <div className="card-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <h4 style={{ margin: 0, color: '#1976d2', marginBottom: '0.5rem', fontSize: 'clamp(1rem, 2.5vw, 1.25rem)' }}>
                    {manager.name}
                  </h4>
                  <div style={{ display: 'flex', gap: '2rem', marginBottom: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <p style={{ margin: 0, color: '#666', fontSize: 'clamp(0.875rem, 2vw, 1rem)' }}>
                      <strong>Email:</strong> {manager.email}
                    </p>
                    {managerStoresList.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <strong style={{ color: '#666', fontSize: 'clamp(0.875rem, 2vw, 1rem)' }}>Store{managerStoresList.length > 1 ? 's' : ''}:</strong>
                        {managerStoresList.map((store, index) => (
                          <span key={store.id} style={{ color: '#666', fontSize: 'clamp(0.875rem, 2vw, 1rem)' }}>
                            {store.name}{index < managerStoresList.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <p style={{ margin: '0.5rem 0', color: '#999', fontSize: 'clamp(0.8rem, 1.8vw, 0.9rem)' }}>
                    Created: {new Date(manager.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="card-actions" style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => deleteManager(manager.id, manager.name)}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#d32f2f',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: 'clamp(0.875rem, 2vw, 0.9rem)',
                      minHeight: '44px',
                      whiteSpace: 'nowrap'
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


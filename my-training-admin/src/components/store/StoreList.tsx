import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';
import StoreForm from '../businessunit/StoreForm';

const client = generateClient<Schema>();

type Store = {
  readonly id: string;
  readonly name: string;
  readonly description?: string | null;
  readonly businessUnitId: string;
  readonly createdBy?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

type BusinessUnit = {
  readonly id: string;
  readonly name: string;
};

interface StoreListProps {
  refreshTrigger?: number;
}

const StoreList: React.FC<StoreListProps> = ({ refreshTrigger }) => {
  const [stores, setStores] = useState<Store[]>([]);
  const [businessUnits, setBusinessUnits] = useState<Record<string, BusinessUnit>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Store users can see all stores (they have read access to all)
      const [storesResult, businessUnitsResult] = await Promise.all([
        client.models.Store.list({}),
        client.models.BusinessUnit.list({})
      ]);

      if (storesResult.errors && storesResult.errors.length > 0) {
        throw new Error('Failed to fetch stores: ' + storesResult.errors.map((e: any) => e.message).join(', '));
      }

      if (businessUnitsResult.errors && businessUnitsResult.errors.length > 0) {
        console.warn('Warning fetching business units:', businessUnitsResult.errors);
      }

      setStores(storesResult.data as Store[]);
      
      // Create a map of business units for easy lookup
      const buMap: Record<string, BusinessUnit> = {};
      (businessUnitsResult.data as BusinessUnit[]).forEach(bu => {
        buMap[bu.id] = bu;
      });
      setBusinessUnits(buMap);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const deleteStore = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete store "${name}"? This will also delete all associated managers.`)) {
      return;
    }

    try {
      await client.models.Store.delete({ id });
      alert('Store deleted successfully');
      fetchData();
    } catch (err) {
      console.error('Error deleting store:', err);
      alert('Failed to delete store');
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p>Loading stores...</p>
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
      <StoreForm 
        onCancel={() => setShowCreateForm(false)}
        onStoreCreated={() => {
          setShowCreateForm(false);
          fetchData();
        }}
      />
    );
  }

  if (stores.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p>No stores found. Create your first store to get started.</p>
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
          Create New Store
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3>Stores ({stores.length})</h3>
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
            + Create Store
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
        {stores.map((store) => {
          const businessUnit = businessUnits[store.businessUnitId];
          return (
            <div 
              key={store.id} 
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
                    {store.name}
                  </h4>
                  {businessUnit && (
                    <p style={{ margin: '0.5rem 0', color: '#666' }}>
                      <strong>Business Unit:</strong> {businessUnit.name}
                    </p>
                  )}
                  {store.description && (
                    <p style={{ margin: '0.5rem 0', color: '#666' }}>
                      {store.description}
                    </p>
                  )}
                  <p style={{ margin: '0.5rem 0', color: '#999', fontSize: '0.9rem' }}>
                    Created: {new Date(store.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                  <button
                    onClick={() => deleteStore(store.id, store.name)}
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

export default StoreList;


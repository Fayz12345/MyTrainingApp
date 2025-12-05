import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';
import Loader from '../common/Loader';

const client = generateClient<Schema>();

type BusinessUnit = {
  readonly id: string;
  readonly name: string;
  readonly description?: string | null;
};

type Store = {
  readonly id: string;
  readonly name: string;
  readonly description?: string | null;
  readonly businessUnitId: string;
};

type Manager = {
  readonly id: string;
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly storeId: string;
  readonly createdBy?: string | null;
};

type Employee = {
  readonly id: string;
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly department?: string | null;
  readonly managerId?: string | null;
  readonly createdBy?: string | null;
  readonly isActive?: boolean | null;
};

interface OrganizationHierarchyProps {
  refreshTrigger?: number;
}

const OrganizationHierarchy: React.FC<OrganizationHierarchyProps> = ({ refreshTrigger }) => {
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if client and models are available
      if (!client) {
        throw new Error('Client not initialized. Please refresh the page.');
      }

      if (!client.models) {
        console.error('Client models are undefined. Available client properties:', Object.keys(client));
        throw new Error('Client models not available. Please check your Amplify configuration.');
      }

      // Check each model individually
      if (!client.models.BusinessUnit) {
        console.error('Available models:', Object.keys(client.models));
        throw new Error('BusinessUnit model not found. Available models: ' + Object.keys(client.models).join(', '));
      }

      if (!client.models.Store) {
        throw new Error('Store model not found.');
      }

      if (!client.models.Manager) {
        throw new Error('Manager model not found.');
      }

      if (!client.models.Employee) {
        throw new Error('Employee model not found.');
      }

      // Fetch all data in parallel
      const [businessUnitsResult, storesResult, managersResult, employeesResult] = await Promise.all([
        client.models.BusinessUnit.list({}),
        client.models.Store.list({}),
        client.models.Manager.list({}),
        client.models.Employee.list({})
      ]);

      if (businessUnitsResult.errors && businessUnitsResult.errors.length > 0) {
        throw new Error('Failed to fetch business units: ' + businessUnitsResult.errors.map((e: any) => e.message).join(', '));
      }

      if (storesResult.errors && storesResult.errors.length > 0) {
        console.warn('Warning fetching stores:', storesResult.errors);
      }

      if (managersResult.errors && managersResult.errors.length > 0) {
        console.warn('Warning fetching managers:', managersResult.errors);
      }

      if (employeesResult.errors && employeesResult.errors.length > 0) {
        console.warn('Warning fetching employees:', employeesResult.errors);
      }

      setBusinessUnits(businessUnitsResult.data as BusinessUnit[]);
      setStores(storesResult.data as Store[]);
      setManagers(managersResult.data as Manager[]);
      setEmployees(employeesResult.data as Employee[]);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const getStoresForBusinessUnit = (businessUnitId: string) => {
    return stores.filter(store => store.businessUnitId === businessUnitId);
  };

  const getManagersForStore = (storeId: string) => {
    return managers.filter(manager => manager.storeId === storeId);
  };

  const getEmployeesForManager = (managerId: string) => {
    if (!managerId) {
      return [];
    }
    
    // Normalize the managerId for comparison
    // Extract just the ID part if it's in a composite format (e.g., "userId-id")
    const extractId = (id: string): string => {
      const str = String(id).trim();
      // If it contains a dash and looks like a composite (userId-id format), extract the ID part
      // Check if it ends with a pattern like "-emp_..." or similar
      const lastDashIndex = str.lastIndexOf('-');
      if (lastDashIndex > 0 && lastDashIndex < str.length - 1) {
        const afterLastDash = str.substring(lastDashIndex + 1);
        // If the part after last dash looks like an ID (starts with common ID prefixes)
        if (afterLastDash.startsWith('emp_') || afterLastDash.match(/^[a-zA-Z0-9_-]+$/)) {
          return afterLastDash;
        }
      }
      return str;
    };
    
    const normalizedManagerId = extractId(managerId);
    
    return employees.filter(employee => {
      // Handle null/undefined/empty managerId
      if (!employee.managerId) {
        return false;
      }
      
      // Extract and normalize employee's managerId
      const normalizedEmployeeManagerId = extractId(String(employee.managerId).trim());
      
      // Try exact match first
      if (normalizedEmployeeManagerId === normalizedManagerId) {
        return true;
      }
      
      // Also try matching the original values (in case extraction changed something)
      const originalEmployeeManagerId = String(employee.managerId).trim();
      const originalManagerId = String(managerId).trim();
      if (originalEmployeeManagerId === originalManagerId) {
        return true;
      }
      
      // Try matching if one contains the other (for partial matches)
      if (originalEmployeeManagerId.includes(originalManagerId) || 
          originalManagerId.includes(originalEmployeeManagerId)) {
        return true;
      }
      
      return false;
    });
  };

  useEffect(() => {
    fetchData();
  }, [refreshTrigger]);

  if (loading) {
    return <Loader message="Loading organization hierarchy..." />;
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

  if (businessUnits.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p>No business units found. Create your first business unit to get started.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3>Organization Hierarchy</h3>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {businessUnits.map((businessUnit) => {
          const businessUnitStores = getStoresForBusinessUnit(businessUnit.id);
          const isBusinessUnitExpanded = expandedItems.has(`bu-${businessUnit.id}`);

          return (
            <div 
              key={businessUnit.id}
              style={{
                border: '2px solid #1976d2',
                borderRadius: '8px',
                backgroundColor: 'white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              {/* Business Unit Header */}
              <div
                onClick={() => toggleExpand(`bu-${businessUnit.id}`)}
                style={{
                  padding: '1.5rem',
                  cursor: 'pointer',
                  backgroundColor: '#e3f2fd',
                  borderTopLeftRadius: '8px',
                  borderTopRightRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, color: '#1976d2', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{isBusinessUnitExpanded ? '▼' : '▶'}</span>
                    <span>🏢 {businessUnit.name}</span>
                  </h3>
                  {businessUnit.description && (
                    <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.9rem' }}>
                      {businessUnit.description}
                    </p>
                  )}
                  <p style={{ margin: '0.5rem 0 0 0', color: '#999', fontSize: '0.85rem' }}>
                    {businessUnitStores.length} Store{businessUnitStores.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Stores under Business Unit */}
              {isBusinessUnitExpanded && (
                <div style={{ padding: '1rem', backgroundColor: '#fafafa' }}>
                  {businessUnitStores.length === 0 ? (
                    <p style={{ color: '#999', fontStyle: 'italic', padding: '1rem' }}>
                      No stores in this business unit
                    </p>
                  ) : (
                    businessUnitStores.map((store) => {
                      const storeManagers = getManagersForStore(store.id);
                      const isStoreExpanded = expandedItems.has(`store-${store.id}`);

                      return (
                        <div
                          key={store.id}
                          style={{
                            marginBottom: '1rem',
                            border: '1px solid #4caf50',
                            borderRadius: '6px',
                            backgroundColor: 'white',
                            overflow: 'hidden'
                          }}
                        >
                          {/* Store Header */}
                          <div
                            onClick={() => toggleExpand(`store-${store.id}`)}
                            style={{
                              padding: '1rem',
                              cursor: 'pointer',
                              backgroundColor: '#e8f5e9',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <div style={{ flex: 1, marginLeft: '1.5rem' }}>
                              <h4 style={{ margin: 0, color: '#2e7d32', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>{isStoreExpanded ? '▼' : '▶'}</span>
                                <span>🏪 {store.name}</span>
                              </h4>
                              {store.description && (
                                <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.85rem' }}>
                                  {store.description}
                                </p>
                              )}
                              <p style={{ margin: '0.5rem 0 0 0', color: '#999', fontSize: '0.8rem' }}>
                                {storeManagers.length} Manager{storeManagers.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>

                          {/* Managers under Store */}
                          {isStoreExpanded && (
                            <div style={{ padding: '0.75rem', backgroundColor: '#f9f9f9' }}>
                              {storeManagers.length === 0 ? (
                                <p style={{ color: '#999', fontStyle: 'italic', padding: '1rem', marginLeft: '1.5rem' }}>
                                  No managers in this store
                                </p>
                              ) : (
                                storeManagers.map((manager) => {
                                  const managerEmployees = getEmployeesForManager(manager.id);
                                  const isManagerExpanded = expandedItems.has(`manager-${manager.id}`);

                                  return (
                                    <div
                                      key={manager.id}
                                      style={{
                                        marginBottom: '0.75rem',
                                        border: '1px solid #ff9800',
                                        borderRadius: '4px',
                                        backgroundColor: 'white',
                                        overflow: 'hidden'
                                      }}
                                    >
                                      {/* Manager Header */}
                                      <div
                                        onClick={() => toggleExpand(`manager-${manager.id}`)}
                                        style={{
                                          padding: '0.75rem',
                                          cursor: 'pointer',
                                          backgroundColor: '#fff3e0',
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center'
                                        }}
                                      >
                                        <div style={{ flex: 1, marginLeft: '1.5rem' }}>
                                          <h5 style={{ margin: 0, color: '#e65100', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span>{isManagerExpanded ? '▼' : '▶'}</span>
                                            <span>👤 {manager.name}</span>
                                          </h5>
                                          <p style={{ margin: '0.25rem 0 0 0', color: '#666', fontSize: '0.8rem' }}>
                                            {manager.email}
                                          </p>
                                          <p style={{ margin: '0.25rem 0 0 0', color: '#999', fontSize: '0.75rem' }}>
                                            {managerEmployees.length} Employee{managerEmployees.length !== 1 ? 's' : ''}
                                          </p>
                                        </div>
                                      </div>

                                      {/* Employees under Manager */}
                                      {isManagerExpanded && (
                                        <div style={{ padding: '0.5rem', backgroundColor: '#fafafa' }}>
                                          {managerEmployees.length === 0 ? (
                                            <p style={{ color: '#999', fontStyle: 'italic', padding: '0.5rem', marginLeft: '1.5rem', fontSize: '0.85rem' }}>
                                              No employees under this manager
                                            </p>
                                          ) : (
                                            managerEmployees.map((employee) => (
                                              <div
                                                key={employee.id}
                                                style={{
                                                  marginBottom: '0.5rem',
                                                  marginLeft: '1.5rem',
                                                  padding: '0.75rem',
                                                  border: '1px solid #9e9e9e',
                                                  borderRadius: '4px',
                                                  backgroundColor: 'white'
                                                }}
                                              >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                  <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                      <span style={{ color: '#424242', fontWeight: 'bold' }}>
                                                        👷 {employee.name}
                                                      </span>
                                                      {employee.isActive === false && (
                                                        <span style={{ 
                                                          padding: '0.15rem 0.4rem', 
                                                          backgroundColor: '#d32f2f', 
                                                          color: 'white', 
                                                          borderRadius: '3px', 
                                                          fontSize: '0.7rem' 
                                                        }}>
                                                          INACTIVE
                                                        </span>
                                                      )}
                                                    </div>
                                                    <p style={{ margin: '0.25rem 0 0 0', color: '#666', fontSize: '0.8rem' }}>
                                                      {employee.email}
                                                    </p>
                                                    {employee.department && (
                                                      <p style={{ margin: '0.25rem 0 0 0', color: '#999', fontSize: '0.75rem' }}>
                                                        Department: {employee.department}
                                                      </p>
                                                    )}
                                                    {employee.createdBy && (
                                                      <p style={{ margin: '0.25rem 0 0 0', color: '#999', fontSize: '0.7rem' }}>
                                                        Created by: {employee.createdBy.substring(0, 8)}...
                                                      </p>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OrganizationHierarchy;


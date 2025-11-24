import React, { useState } from 'react';
import { AuthUser } from 'aws-amplify/auth';
import BusinessUnitList from './BusinessUnitList';
import OrganizationHierarchy from './OrganizationHierarchy';

interface SuperAdminDashboardProps {
  signOut: (() => void) | undefined;
  user: AuthUser;
}

type ViewMode = 'dashboard' | 'business-units' | 'organization';

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ signOut, user }) => {
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const renderContent = () => {
    switch (currentView) {
      case 'business-units':
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2>Business Unit Management</h2>
            </div>
            <BusinessUnitList refreshTrigger={refreshTrigger} />
          </div>
        );

      case 'organization':
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2>Organization Hierarchy</h2>
            </div>
            <OrganizationHierarchy refreshTrigger={refreshTrigger} />
          </div>
        );

      default:
        return (
          <div>
            <div style={{ 
              backgroundColor: '#f5f5f5',
              padding: '1.5rem',
              borderRadius: '8px',
              marginBottom: '2rem'
            }}>
              <h2>Welcome, Super Admin!</h2>
              <p>You have full administrative access to manage business units and the entire organization structure.</p>
            </div>

            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '1.5rem'
            }}>
              <div style={{ 
                backgroundColor: 'white',
                padding: '1.5rem',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <h3>Business Units</h3>
                <p>Create and manage business units in your organization.</p>
                <button 
                  onClick={() => setCurrentView('business-units')}
                  style={{ 
                    padding: '8px 16px',
                    backgroundColor: '#1976d2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    marginTop: '0.5rem'
                  }}
                >
                  Manage Business Units
                </button>
              </div>
              <div style={{ 
                backgroundColor: 'white',
                padding: '1.5rem',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <h3>Organization Hierarchy</h3>
                <p>View the complete organizational structure: Business Units → Stores → Managers → Employees.</p>
                <button 
                  onClick={() => setCurrentView('organization')}
                  style={{ 
                    padding: '8px 16px',
                    backgroundColor: '#1976d2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    marginTop: '0.5rem'
                  }}
                >
                  View Hierarchy
                </button>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '2rem' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1 
            onClick={() => setCurrentView('dashboard')}
            style={{ 
              margin: 0, 
              cursor: 'pointer',
              color: currentView === 'dashboard' ? '#1976d2' : '#333'
            }}
          >
            Super Admin Portal
          </h1>
          {currentView !== 'dashboard' && (
            <nav style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setCurrentView('dashboard')}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#f5f5f5',
                  color: '#333',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Dashboard
              </button>
              <button
                onClick={() => setCurrentView('business-units')}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: currentView === 'business-units' ? '#1976d2' : '#f5f5f5',
                  color: currentView === 'business-units' ? 'white' : '#333',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Business Units
              </button>
              <button
                onClick={() => setCurrentView('organization')}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: currentView === 'organization' ? '#1976d2' : '#f5f5f5',
                  color: currentView === 'organization' ? 'white' : '#333',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Organization
              </button>
            </nav>
          )}
        </div>
        <button onClick={() => signOut?.()} style={{ 
          padding: '10px 20px',
          backgroundColor: '#1976d2',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}>
          Sign Out
        </button>
      </div>

      {renderContent()}
    </div>
  );
};

export default SuperAdminDashboard;


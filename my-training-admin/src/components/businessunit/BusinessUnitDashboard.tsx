import React, { useState } from 'react';
import { AuthUser } from 'aws-amplify/auth';
import StoreList from './StoreList';

interface BusinessUnitDashboardProps {
  signOut: (() => void) | undefined;
  user: AuthUser;
}

type ViewMode = 'dashboard' | 'stores';

const BusinessUnitDashboard: React.FC<BusinessUnitDashboardProps> = ({ signOut, user }) => {
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const renderContent = () => {
    switch (currentView) {
      case 'stores':
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2>Store Management</h2>
            </div>
            <StoreList refreshTrigger={refreshTrigger} />
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
              <h2>Welcome, Business Unit Administrator!</h2>
              <p>You can create and manage stores within your business unit.</p>
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
                <h3>Stores</h3>
                <p>Create and manage stores in your business unit.</p>
                <button 
                  onClick={() => setCurrentView('stores')}
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
                  Manage Stores
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
            Business Unit Portal
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
                onClick={() => setCurrentView('stores')}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: currentView === 'stores' ? '#1976d2' : '#f5f5f5',
                  color: currentView === 'stores' ? 'white' : '#333',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Stores
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

export default BusinessUnitDashboard;


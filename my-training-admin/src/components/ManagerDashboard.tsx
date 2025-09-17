import React from 'react';
import { AuthUser } from 'aws-amplify/auth';

interface ManagerDashboardProps {
  signOut: (() => void) | undefined;
  user: AuthUser;
}

const ManagerDashboard: React.FC<ManagerDashboardProps> = ({ signOut, user }) => {
  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '2rem' 
      }}>
        <h1>Manager Portal</h1>
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

      <div style={{ 
        backgroundColor: '#f5f5f5',
        padding: '1.5rem',
        borderRadius: '8px',
        marginBottom: '2rem'
      }}>
        <h2>Welcome, {user.signInDetails?.loginId || user.username}!</h2>
        <p>You have successfully logged in to the admin portal with manager privileges.</p>
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
          <h3>User Management</h3>
          <p>Manage employee accounts, roles, and permissions.</p>
          <button disabled style={{ 
            padding: '8px 16px',
            backgroundColor: '#ccc',
            color: '#666',
            border: 'none',
            borderRadius: '4px'
          }}>
            Coming Soon
          </button>
        </div>

        <div style={{ 
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3>Training Analytics</h3>
          <p>View training completion rates and progress reports.</p>
          <button disabled style={{ 
            padding: '8px 16px',
            backgroundColor: '#ccc',
            color: '#666',
            border: 'none',
            borderRadius: '4px'
          }}>
            Coming Soon
          </button>
        </div>

        <div style={{ 
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3>Course Management</h3>
          <p>Create, edit, and manage training courses.</p>
          <button disabled style={{ 
            padding: '8px 16px',
            backgroundColor: '#ccc',
            color: '#666',
            border: 'none',
            borderRadius: '4px'
          }}>
            Coming Soon
          </button>
        </div>

        <div style={{ 
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3>Reports</h3>
          <p>Generate and export training reports.</p>
          <button disabled style={{ 
            padding: '8px 16px',
            backgroundColor: '#ccc',
            color: '#666',
            border: 'none',
            borderRadius: '4px'
          }}>
            Coming Soon
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
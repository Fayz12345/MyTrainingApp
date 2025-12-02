import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import { fetchAuthSession } from 'aws-amplify/auth';
import '@aws-amplify/ui-react/styles.css';
import './index.css';
import outputs from './amplify_outputs.json';
import SuperAdminDashboard from './components/superadmin/SuperAdminDashboard';
import BusinessUnitDashboard from './components/businessunit/BusinessUnitDashboard';
import StoreDashboard from './components/store/StoreDashboard';
import ManagerDashboard from './components/manager/ManagerDashboard';
import EmployeeDashboard from './components/employee/EmployeeDashboard';

Amplify.configure(outputs);

type UserRole = 'SuperAdmin' | 'BusinessUnit' | 'Store' | 'Manager' | 'Employee' | null;

const AuthWrapper = ({ signOut, user }: { signOut: (() => void) | undefined; user: any }) => {
  const [userRole, setUserRole] = useState<UserRole>(null);

  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const session = await fetchAuthSession({ forceRefresh: true });
        let groups = session.tokens?.idToken?.payload['cognito:groups'];
        if (typeof groups === 'string') {
          groups = [groups];
        } else if (!Array.isArray(groups)) {
          groups = [];
        }
        
        const groupArray = groups as string[];
        
        // Determine role based on hierarchy (highest to lowest)
        if (groupArray.includes('SuperAdmin')) {
          setUserRole('SuperAdmin');
        } else if (groupArray.includes('BusinessUnit')) {
          setUserRole('BusinessUnit');
        } else if (groupArray.includes('Store')) {
          setUserRole('Store');
        } else if (groupArray.includes('Managers')) {
          setUserRole('Manager');
        } else if (groupArray.includes('Employees')) {
          setUserRole('Employee');
        } else {
          setUserRole(null);
        }
      } catch (error) {
        console.error('Error checking user groups:', error);
        setUserRole(null);
      }
    };

    if (user) {
      checkUserRole();
    }
  }, [user]);

  if (userRole === null) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh'
      }}>
        <p>Loading...</p>
      </div>
    );
  }
  
  // Employees can now access the web portal

  // No valid role
  if (user && !userRole) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <h2>Access Denied</h2>
        <p>You do not have permission to access this portal.</p>
        <button onClick={() => signOut?.()} style={{ padding: '10px 20px' }}>
          Sign Out
        </button>
      </div>
    );
  }

  // Render appropriate dashboard based on role
  if (!user) return null;

  switch (userRole) {
    case 'SuperAdmin':
      return <SuperAdminDashboard signOut={signOut} user={user} />;
    case 'BusinessUnit':
      return <BusinessUnitDashboard signOut={signOut} user={user} />;
    case 'Store':
      return <StoreDashboard signOut={signOut} user={user} />;
    case 'Manager':
      return <ManagerDashboard signOut={signOut} user={user} />;
    case 'Employee':
      return <EmployeeDashboard signOut={signOut} user={user} />;
    default:
      return null;
  }
};

const App = () => (
  <Authenticator.Provider>
    <Authenticator>
      {({ signOut, user }) => (
        <AuthWrapper signOut={signOut} user={user} />
      )}
    </Authenticator>
  </Authenticator.Provider>
);

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


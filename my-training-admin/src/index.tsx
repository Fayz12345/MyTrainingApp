import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import { fetchAuthSession } from 'aws-amplify/auth';
import '@aws-amplify/ui-react/styles.css';
import './index.css';
import outputs from './amplify_outputs.json';
import ManagerDashboard from './components/ManagerDashboard';

Amplify.configure(outputs);

const AuthWrapper = ({ signOut, user }: { signOut: (() => void) | undefined; user: any }) => {
  const [isManager, setIsManager] = useState<boolean | null>(null);

  useEffect(() => {
    const checkManagerRole = async () => {
      try {
        const session = await fetchAuthSession({ forceRefresh: true });
        let groups = session.tokens?.idToken?.payload['cognito:groups'];
        if (typeof groups === 'string') {
          groups = [groups];
        } else if (!Array.isArray(groups)) {
          groups = [];
        }
        setIsManager((groups as string[]).includes('Managers'));
      } catch (error) {
        console.error('Error checking user groups:', error);
        setIsManager(false);
      }
    };

    if (user) {
      checkManagerRole();
    }
  }, [user]);

  if (isManager === null) {
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
  
  if (user && !isManager) {
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
        <p>This portal is only accessible to managers.</p>
        <button onClick={() => signOut?.()} style={{ padding: '10px 20px' }}>
          Sign Out
        </button>
      </div>
    );
  }
  return user ? <ManagerDashboard signOut={signOut} user={user} /> : null;
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


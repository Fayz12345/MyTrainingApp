import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { ThemeProvider, createTheme, CssBaseline, Box, Container, Paper, Typography, Button } from '@mui/material';
import '@aws-amplify/ui-react/styles.css';
import './index.css';
import outputs from './amplify_outputs.json';
import SuperAdminDashboard from './components/superadmin/SuperAdminDashboard';
import BusinessUnitDashboard from './components/businessunit/BusinessUnitDashboard';
import StoreDashboard from './components/store/StoreDashboard';
import ManagerDashboard from './components/manager/ManagerDashboard';
import EmployeeDashboard from './components/employee/EmployeeDashboard';

Amplify.configure(outputs);

// Material UI Theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
    h1: {
      fontWeight: 600,
    },
    h2: {
      fontWeight: 600,
    },
    h3: {
      fontWeight: 600,
    },
    h4: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
          padding: '8px 16px',
          minHeight: '44px',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          borderRadius: 8,
        },
      },
    },
  },
});

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
          setUserRole('Employee'); // Employee role detected - web access is disabled
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
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        bgcolor: 'background.default'
      }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">Loading...</Typography>
        </Box>
      </Box>
    );
  }
  
  // Employee web access is disabled - show access denied
  if (userRole === 'Employee') {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        bgcolor: 'background.default',
        flexDirection: 'column',
        gap: 2
      }}>
        <Paper sx={{ p: 4, textAlign: 'center', maxWidth: 400 }}>
          <Typography variant="h4" gutterBottom color="error">
            Access Denied
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            Employee web access is currently disabled.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Please use the mobile app to access your training courses.
          </Typography>
          <Button variant="contained" onClick={() => signOut?.()}>
            Sign Out
          </Button>
        </Paper>
      </Box>
    );
  }

  // No valid role
  if (user && !userRole) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        bgcolor: 'background.default',
        flexDirection: 'column',
        gap: 2
      }}>
        <Paper sx={{ p: 4, textAlign: 'center', maxWidth: 400 }}>
          <Typography variant="h4" gutterBottom color="error">
            Access Denied
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            You do not have permission to access this portal.
          </Typography>
          <Button variant="contained" onClick={() => signOut?.()}>
            Sign Out
          </Button>
        </Paper>
      </Box>
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
    // Employee case is handled above with access denied message
    default:
      return null;
  }
};

const App = () => (
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <Authenticator.Provider>
      <Authenticator>
        {({ signOut, user }) => (
          <AuthWrapper signOut={signOut} user={user} />
        )}
      </Authenticator>
    </Authenticator.Provider>
  </ThemeProvider>
);

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


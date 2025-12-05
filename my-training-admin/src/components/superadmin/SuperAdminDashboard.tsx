import React, { useState } from 'react';
import { AuthUser } from 'aws-amplify/auth';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Container,
  Card,
  CardContent,
  CardActions,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  useTheme,
  useMediaQuery,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import BusinessUnitList from './BusinessUnitList';
import StoreList from './StoreList';
import ManagerList from './ManagerList';
import OrganizationHierarchy from './OrganizationHierarchy';

// Icons - using simple text for now, can be replaced with @mui/icons-material later
const MenuIcon = () => <span>☰</span>;
const DashboardIcon = () => <span>📊</span>;
const BusinessIcon = () => <span>🏢</span>;
const StoreIcon = () => <span>🏪</span>;
const PeopleIcon = () => <span>👥</span>;
const AccountTreeIcon = () => <span>🌳</span>;

interface SuperAdminDashboardProps {
  signOut: (() => void) | undefined;
  user: AuthUser;
}

type ViewMode = 'dashboard' | 'business-units' | 'stores' | 'managers' | 'organization';

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ signOut, user }) => {
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const menuItems = [
    { key: 'dashboard', label: 'Dashboard', icon: '📊' },
    { key: 'business-units', label: 'Business Units', icon: '🏢' },
    { key: 'stores', label: 'Stores', icon: '🏪' },
    { key: 'managers', label: 'Managers', icon: '👥' },
    { key: 'organization', label: 'Organization', icon: '🌳' }
  ];

  const handleMenuClick = (view: ViewMode) => {
    setCurrentView(view);
    setMobileMenuOpen(false);
  };

  const renderContent = () => {
    switch (currentView) {
      case 'business-units':
        return (
          <Box>
            <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
              Business Unit Management
            </Typography>
            <BusinessUnitList refreshTrigger={refreshTrigger} />
          </Box>
        );

      case 'stores':
        return (
          <Box>
            <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
              Store Management
            </Typography>
            <StoreList refreshTrigger={refreshTrigger} />
          </Box>
        );

      case 'managers':
        return (
          <Box>
            <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
              Manager Management
            </Typography>
            <ManagerList refreshTrigger={refreshTrigger} />
          </Box>
        );

      case 'organization':
        return (
          <Box>
            <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
              Organization Hierarchy
            </Typography>
            <OrganizationHierarchy refreshTrigger={refreshTrigger} />
          </Box>
        );

      default:
        return (
          <Box>
            <Card sx={{ mb: 4, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
              <CardContent>
                <Typography variant="h4" gutterBottom>
                  Welcome, Super Admin!
                </Typography>
                <Typography variant="body1">
                  You have full administrative access to manage business units and the entire organization structure.
                </Typography>
              </CardContent>
            </Card>

            <Grid container spacing={3}>
              {[
                { key: 'business-units', title: 'Business Units', description: 'Create and manage business units in your organization.', icon: '🏢' },
                { key: 'stores', title: 'Stores', description: 'Create and manage stores across all business units.', icon: '🏪' },
                { key: 'managers', title: 'Managers', description: 'Create and manage managers and assign them to any store.', icon: '👥' },
                { key: 'organization', title: 'Organization Hierarchy', description: 'View the complete organizational structure: Business Units → Stores → Managers → Employees.', icon: '🌳' }
              ].map((item) => (
                <Grid item xs={12} sm={6} md={3} key={item.key}>
                  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
                    <CardContent sx={{ flexGrow: 1, textAlign: 'center', pt: 3 }}>
                      <Box sx={{ color: 'primary.main', mb: 2, fontSize: '3rem' }}>
                        {item.icon}
                      </Box>
                      <Typography variant="h6" gutterBottom>
                        {item.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {item.description}
                      </Typography>
                    </CardContent>
                    <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
                      <Button
                        variant="contained"
                        onClick={() => handleMenuClick(item.key as ViewMode)}
                        fullWidth
                      >
                        Manage {item.title}
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        );
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" elevation={2}>
        <Toolbar>
          {isMobile && (
            <IconButton
              edge="start"
              color="inherit"
              aria-label="menu"
              onClick={() => setMobileMenuOpen(true)}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography
            variant="h6"
            component="div"
            onClick={() => handleMenuClick('dashboard')}
            sx={{ flexGrow: 1, cursor: 'pointer', fontWeight: 600 }}
          >
            Super Admin Portal
          </Typography>
          {!isMobile && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              {menuItems.map((item) => (
                <Button
                  key={item.key}
                  color="inherit"
                  onClick={() => handleMenuClick(item.key as ViewMode)}
                  variant={currentView === item.key ? 'outlined' : 'text'}
                  sx={{
                    borderColor: currentView === item.key ? 'inherit' : 'transparent',
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </Box>
          )}
          <Button
            color="inherit"
            startIcon={<LogoutIcon />}
            onClick={() => signOut?.()}
            sx={{ ml: 2 }}
          >
            Sign Out
          </Button>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        anchor="left"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      >
        <Box sx={{ width: 250 }}>
          <Toolbar>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Menu
            </Typography>
          </Toolbar>
          <Divider />
          <List>
            {menuItems.map((item) => (
              <ListItem key={item.key} disablePadding>
                <ListItemButton
                  selected={currentView === item.key}
                  onClick={() => handleMenuClick(item.key as ViewMode)}
                >
                  <Box sx={{ mr: 2, display: 'flex', alignItems: 'center' }}>
                    {item.icon}
                  </Box>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      <Container maxWidth="lg" sx={{ py: 4, flexGrow: 1 }}>
        {renderContent()}
      </Container>
    </Box>
  );
};

export default SuperAdminDashboard;

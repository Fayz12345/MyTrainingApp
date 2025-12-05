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
  useTheme,
  useMediaQuery,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import StoreList from './StoreList';

interface BusinessUnitDashboardProps {
  signOut: (() => void) | undefined;
  user: AuthUser;
}

type ViewMode = 'dashboard' | 'stores';

const BusinessUnitDashboard: React.FC<BusinessUnitDashboardProps> = ({ signOut, user }) => {
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const menuItems = [
    { key: 'dashboard', label: 'Dashboard', icon: '📊' },
    { key: 'stores', label: 'Stores', icon: '🏪' }
  ];

  const handleMenuClick = (view: ViewMode) => {
    setCurrentView(view);
    setMobileMenuOpen(false);
  };

  const renderContent = () => {
    switch (currentView) {
      case 'stores':
        return (
          <Box>
            <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
              Store Management
            </Typography>
            <StoreList refreshTrigger={refreshTrigger} />
          </Box>
        );

      default:
        return (
          <Box>
            <Card sx={{ mb: 4, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
              <CardContent>
                <Typography variant="h4" gutterBottom>
                  Welcome, Business Unit Administrator!
                </Typography>
                <Typography variant="body1">
                  You can create and manage stores within your business unit.
                </Typography>
              </CardContent>
            </Card>

            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={4}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
                  <CardContent sx={{ flexGrow: 1, textAlign: 'center', pt: 3 }}>
                    <Box sx={{ color: 'primary.main', mb: 2, fontSize: '3rem' }}>
                      🏪
                    </Box>
                    <Typography variant="h6" gutterBottom>
                      Stores
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Create and manage stores in your business unit.
                    </Typography>
                  </CardContent>
                  <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
                    <Button
                      variant="contained"
                      onClick={() => handleMenuClick('stores')}
                      fullWidth
                    >
                      Manage Stores
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
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
            Business Unit Portal
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

export default BusinessUnitDashboard;

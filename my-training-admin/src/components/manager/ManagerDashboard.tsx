import React, { useState, useEffect } from 'react';
import { AuthUser } from 'aws-amplify/auth';
import { fetchAuthSession } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';
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
  Paper,
  CircularProgress,
  Alert,
  Menu,
  MenuItem,
  Collapse,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StoreIcon from '@mui/icons-material/Store';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ArrowDropDown from '@mui/icons-material/ArrowDropDown';
import CourseForm from './CourseForm';
import CourseList from './CourseList';
import AssignmentForm from './AssignmentForm';
import EmployeeList from './EmployeeList';
import TrainingAnalytics from './TrainingAnalytics';
import CreateLearningPath from './CreateLearningPath';
import LearningPathList from './LearningPathList';
import EditLearningPath from './EditLearningPath';
import AssignLearningPath from './AssignLearningPath';
import LearningPathProgress from './LearningPathProgress';
import TrainingStatusDashboard from './TrainingStatusDashboard';
import EmployeesNeedingSupport from './EmployeesNeedingSupport';
import TrainingReports from './TrainingReports';
import TrainingLeaderboard from './TrainingLeaderboard';
import QuizAnalytics from './QuizAnalytics';

const client = generateClient<Schema>();

interface ManagerDashboardProps {
  signOut: (() => void) | undefined;
  user: AuthUser;
}

type ViewMode =
  | 'store-selection'
  | 'dashboard'
  | 'courses'
  | 'create-course'
  | 'edit-course'
  | 'employees'
  | 'assignments'
  | 'analytics'
  | 'create-learning-path'
  | 'learning-paths'
  | 'edit-learning-path'
  | 'assign-learning-path'
  | 'learning-path-progress'
  | 'training-status'
  | 'employees-needing-support'
  | 'training-reports'
  | 'training-leaderboard'
  | 'quiz-analytics';

type CourseSummary = {
  readonly id: string;
  readonly title: string;
  readonly description?: string | null;
  readonly videoKey?: string | null;
  readonly imageKey?: string | null;
  readonly passingScore?: number | null;
  readonly duration?: string | null;
  readonly category?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

type Store = {
  id: string;
  name: string;
  description?: string | null;
};

const ManagerDashboard: React.FC<ManagerDashboardProps> = ({ signOut, user }) => {
  const [currentView, setCurrentView] = useState<ViewMode>('store-selection');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedCourse, setSelectedCourse] = useState<CourseSummary | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true); // Desktop sidebar open by default
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedStoreName, setSelectedStoreName] = useState<string | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [loadingStores, setLoadingStores] = useState(true);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [selectedLearningPath, setSelectedLearningPath] = useState<any | null>(null);
  const [learningPathMenuAnchor, setLearningPathMenuAnchor] = useState<null | HTMLElement>(null);
  const [mobileLearningPathMenuOpen, setMobileLearningPathMenuOpen] = useState(false);
  const [desktopLearningPathMenuOpen, setDesktopLearningPathMenuOpen] = useState(false);
  const [logoImageError, setLogoImageError] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Fetch manager's stores on mount
  useEffect(() => {
    const fetchManagerStores = async () => {
      try {
        setLoadingStores(true);
        setStoreError(null);

        // Get current user's manager record
        const session = await fetchAuthSession();
        const userId = session.userSub || session.tokens?.idToken?.payload?.sub as string;

        if (!userId) {
          throw new Error('User not authenticated');
        }

        // Get manager record
        const managersResult = await client.models.Manager.list({
          filter: { userId: { eq: userId } }
        });

        if (managersResult.errors && managersResult.errors.length > 0) {
          throw new Error('Failed to fetch manager: ' + managersResult.errors.map((e: any) => e.message).join(', '));
        }

        const managers = managersResult.data as any[];
        if (!managers || managers.length === 0) {
          throw new Error('Manager record not found');
        }

        const manager = managers[0];

        // Get manager's stores via ManagerStore relationship
        const managerStoresResult = await client.models.ManagerStore.list({
          filter: { managerId: { eq: manager.id } }
        });

        if (managerStoresResult.errors && managerStoresResult.errors.length > 0) {
          throw new Error('Failed to fetch stores: ' + managerStoresResult.errors.map((e: any) => e.message).join(', '));
        }

        const managerStores = managerStoresResult.data as any[];
        const storeIds = managerStores.map(ms => ms.storeId).filter(Boolean);

        if (storeIds.length === 0) {
          // If no stores via ManagerStore, check primary storeId
          if (manager.storeId) {
            storeIds.push(manager.storeId);
          }
        }

        if (storeIds.length === 0) {
          setStoreError('No stores assigned to this manager. Please contact your administrator.');
          setLoadingStores(false);
          return;
        }

        // Fetch store details
        const storesData: Store[] = [];
        for (const storeId of storeIds) {
          try {
            const storeResult = await client.models.Store.get({ id: storeId });
            if (storeResult.data && storeResult.data.id) {
              storesData.push({
                id: storeResult.data.id,
                name: storeResult.data.name || 'Unnamed Store',
                description: storeResult.data.description || null
              });
            }
          } catch (err) {
            console.warn(`Failed to fetch store ${storeId}:`, err);
          }
        }

        setStores(storesData);

        // Auto-select and proceed if only one store
        if (storesData.length === 1) {
          setSelectedStoreId(storesData[0].id);
          setSelectedStoreName(storesData[0].name);
          setCurrentView('dashboard');
        }
        // If multiple stores, stay on store-selection view
      } catch (err) {
        console.error('Error fetching stores:', err);
        setStoreError(err instanceof Error ? err.message : 'Failed to load stores');
      } finally {
        setLoadingStores(false);
      }
    };

    fetchManagerStores();
  }, []);

  const handleStoreSelect = (storeId: string, storeName: string) => {
    setSelectedStoreId(storeId);
    setSelectedStoreName(storeName);
    setCurrentView('dashboard');
    // Refresh data when store changes
    setRefreshTrigger((prev) => prev + 1);
  };

  const menuItems = [
    { key: 'dashboard', label: 'Dashboard', icon: '📊' },
    { key: 'courses', label: 'Courses', icon: '📚' },
    { key: 'employees', label: 'Employees', icon: '👥' },
    { key: 'assignments', label: 'Assignments', icon: '📋' },
    { key: 'analytics', label: 'Analytics', icon: '📈' }
  ];

  const learningPathSubmenuItems = [
    { key: 'learning-paths', label: 'Learning Paths', icon: '🛤️' },
    { key: 'assign-learning-path', label: 'Assign Learning Path', icon: '🎯' },
    { key: 'learning-path-progress', label: 'Learning Path Progress', icon: '📊' }
  ];

  const handleMenuClick = (view: ViewMode) => {
    setCurrentView(view);
    setMobileMenuOpen(false);
    setLearningPathMenuAnchor(null);
    setMobileLearningPathMenuOpen(false);
    if (view === 'courses') {
      setSelectedCourse(null);
    }
  };

  const handleLearningPathMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setLearningPathMenuAnchor(event.currentTarget);
  };

  const handleLearningPathMenuClose = () => {
    setLearningPathMenuAnchor(null);
  };

  const navigateToCourses = () => {
    setCurrentView('courses');
    setSelectedCourse(null);
    setRefreshTrigger((prev) => prev + 1);
  };

  const isCoursesView = currentView === 'courses' || currentView === 'create-course' || currentView === 'edit-course';

  // Show store selection screen if no store selected
  if (currentView === 'store-selection') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppBar position="static" elevation={2}>
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
              Manager Portal
            </Typography>
            <Button
              color="inherit"
              startIcon={<LogoutIcon />}
              onClick={() => signOut?.()}
            >
              Sign Out
            </Button>
          </Toolbar>
        </AppBar>
        <Container maxWidth="sm" sx={{ py: 8, flexGrow: 1, display: 'flex', alignItems: 'center' }}>
          <Paper sx={{ p: 4, width: '100%' }}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <StoreIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
              <Typography variant="h4" gutterBottom>
                Select Store
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Please select which store you want to manage.
              </Typography>
            </Box>

            {loadingStores ? (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                <CircularProgress />
              </Box>
            ) : storeError ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {storeError}
              </Alert>
            ) : stores.length === 0 ? (
              <Alert severity="warning">
                No stores assigned to this manager. Please contact your administrator.
              </Alert>
            ) : (
              <List>
                {stores.map((store, index) => (
                  <React.Fragment key={store.id}>
                    <ListItem disablePadding>
                      <ListItemButton
                        onClick={() => handleStoreSelect(store.id, store.name)}
                        sx={{
                          borderRadius: 1,
                          py: 2,
                          '&:hover': {
                            bgcolor: 'primary.light',
                            color: 'white',
                          },
                        }}
                      >
                        <StoreIcon sx={{ mr: 2 }} />
                        <ListItemText
                          primary={store.name}
                          secondary={store.description || null}
                          primaryTypographyProps={{ variant: 'h6' }}
                        />
                      </ListItemButton>
                    </ListItem>
                    {index < stores.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        </Container>
      </Box>
    );
  }

  const renderContent = () => {
    switch (currentView) {
      case 'courses':
        return (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h4">
                Course Management
              </Typography>
              <Button
                variant="contained"
                onClick={() => setCurrentView('create-course')}
              >
                + Create New Course
              </Button>
            </Box>
            <CourseList 
              refreshTrigger={refreshTrigger}
              onEditCourse={async (course) => {
                console.log('[ManagerDashboard] Course received for editing:', {
                  id: course.id,
                  title: course.title,
                  description: course.description,
                  imageKey: course.imageKey,
                  videoKey: course.videoKey,
                  duration: course.duration,
                  category: course.category,
                  fullCourse: course
                });
                
                try {
                  const fullCourse = await client.models.Course.get({ id: course.id });
                  if (fullCourse.data) {
                    console.log('[ManagerDashboard] Full course data fetched:', fullCourse.data);
                    setSelectedCourse(fullCourse.data as CourseSummary);
                  } else {
                    console.warn('[ManagerDashboard] Could not fetch full course, using list data');
                    setSelectedCourse(course);
                  }
                } catch (error) {
                  console.error('[ManagerDashboard] Error fetching full course:', error);
                  setSelectedCourse(course);
                }
                
                setCurrentView('edit-course');
              }}
            />
          </Box>
        );
      
      case 'create-course':
        return (
          <Box>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigateToCourses()}
              sx={{ mb: 2 }}
            >
              Back to Courses
            </Button>
            <CourseForm
              onSuccess={() => {
                navigateToCourses();
              }}
              onCancel={() => {
                setCurrentView('courses');
              }}
            />
          </Box>
        );

      case 'edit-course':
        if (!selectedCourse) {
          return (
            <Box>
              <Typography sx={{ mb: 2 }}>No course selected. Please go back to the course list.</Typography>
              <Button
                startIcon={<ArrowBackIcon />}
                onClick={() => setCurrentView('courses')}
              >
                Back to Courses
              </Button>
            </Box>
          );
        }

        return (
          <Box>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => {
                setCurrentView('courses');
                setSelectedCourse(null);
              }}
              sx={{ mb: 2 }}
            >
              Back to Courses
            </Button>
            <CourseForm
              course={selectedCourse}
              onSuccess={() => {
                navigateToCourses();
              }}
              onCancel={() => {
                setCurrentView('courses');
                setSelectedCourse(null);
              }}
            />
          </Box>
        );

      case 'employees':
        return (
          <Box>
            <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
              Employee Management
              {selectedStoreName && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Store: {selectedStoreName}
                </Typography>
              )}
            </Typography>
            {selectedStoreId ? (
              <EmployeeList refreshTrigger={refreshTrigger} selectedStoreId={selectedStoreId} />
            ) : (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  Please select a store to view employees.
                </Typography>
              </Box>
            )}
          </Box>
        );

      case 'assignments':
        return (
          <Box>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => setCurrentView('dashboard')}
              sx={{ mb: 2 }}
            >
              Back to Dashboard
            </Button>
            <AssignmentForm selectedStoreId={selectedStoreId} />
          </Box>
        );

      case 'analytics':
        return (
          <Box>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => setCurrentView('dashboard')}
              sx={{ mb: 2 }}
            >
              Back to Dashboard
            </Button>
            <TrainingAnalytics selectedStoreId={selectedStoreId} />
          </Box>
        );

      case 'create-learning-path':
        return (
          <Box>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => setCurrentView('learning-paths')}
              sx={{ mb: 2 }}
            >
              Back to Learning Paths
            </Button>
            <CreateLearningPath
              onSuccess={() => {
                setCurrentView('learning-paths');
                setRefreshTrigger((prev) => prev + 1);
              }}
              onCancel={() => {
                setCurrentView('learning-paths');
              }}
            />
          </Box>
        );

      case 'learning-paths':
        return (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h4">
                Learning Path Management
              </Typography>
              <Button
                variant="contained"
                onClick={() => setCurrentView('create-learning-path')}
              >
                + Create New Learning Path
              </Button>
            </Box>
            <LearningPathList
              refreshTrigger={refreshTrigger}
              onEdit={(learningPath) => {
                setSelectedLearningPath(learningPath);
                setCurrentView('edit-learning-path');
              }}
            />
          </Box>
        );

      case 'edit-learning-path':
        if (!selectedLearningPath) {
          return (
            <Box>
              <Typography sx={{ mb: 2 }}>No learning path selected. Please go back to the learning paths list.</Typography>
              <Button
                startIcon={<ArrowBackIcon />}
                onClick={() => setCurrentView('learning-paths')}
              >
                Back to Learning Paths
              </Button>
            </Box>
          );
        }

        return (
          <Box>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => {
                setCurrentView('learning-paths');
                setSelectedLearningPath(null);
              }}
              sx={{ mb: 2 }}
            >
              Back to Learning Paths
            </Button>
            <EditLearningPath
              learningPath={selectedLearningPath}
              onSuccess={() => {
                setCurrentView('learning-paths');
                setSelectedLearningPath(null);
                setRefreshTrigger((prev) => prev + 1);
              }}
              onCancel={() => {
                setCurrentView('learning-paths');
                setSelectedLearningPath(null);
              }}
            />
          </Box>
        );

      case 'assign-learning-path':
        return (
          <Box>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => setCurrentView('dashboard')}
              sx={{ mb: 2 }}
            >
              Back to Dashboard
            </Button>
            <AssignLearningPath selectedStoreId={selectedStoreId} />
          </Box>
        );

      case 'learning-path-progress':
        return (
          <Box>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => setCurrentView('dashboard')}
              sx={{ mb: 2 }}
            >
              Back to Dashboard
            </Button>
            <LearningPathProgress selectedStoreId={selectedStoreId} />
          </Box>
        );

      case 'training-status':
        return (
          <Box>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => setCurrentView('dashboard')}
              sx={{ mb: 2 }}
            >
              Back to Dashboard
            </Button>
            <TrainingStatusDashboard />
          </Box>
        );

      case 'employees-needing-support':
        return (
          <Box>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => setCurrentView('dashboard')}
              sx={{ mb: 2 }}
            >
              Back to Dashboard
            </Button>
            <EmployeesNeedingSupport selectedStoreId={selectedStoreId} />
          </Box>
        );

      case 'training-reports':
        return (
          <Box>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => setCurrentView('dashboard')}
              sx={{ mb: 2 }}
            >
              Back to Dashboard
            </Button>
            <TrainingReports selectedStoreId={selectedStoreId} />
          </Box>
        );

      case 'training-leaderboard':
        return (
          <Box>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => setCurrentView('dashboard')}
              sx={{ mb: 2 }}
            >
              Back to Dashboard
            </Button>
            <TrainingLeaderboard selectedStoreId={selectedStoreId} />
          </Box>
        );

      case 'quiz-analytics':
        return (
          <Box>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => setCurrentView('dashboard')}
              sx={{ mb: 2 }}
            >
              Back to Dashboard
            </Button>
            <QuizAnalytics selectedStoreId={selectedStoreId} />
          </Box>
        );

      default:
        return (
          <Box>
            <Card sx={{ mb: 4, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
              <CardContent>
                <Typography variant="h4" gutterBottom>
                  Welcome, {user.signInDetails?.loginId || user.username}!
                </Typography>
                <Typography variant="body1">
                  You have successfully logged in to the admin portal with manager privileges.
                </Typography>
              </CardContent>
            </Card>

            <Grid container spacing={3}>
              {[
                { key: 'employees', title: 'Employee Management', description: 'View and manage employee information and assignments.', icon: '👥' },
                { key: 'analytics', title: 'Training Analytics', description: 'View training completion rates and progress reports.', icon: '📈' },
                { key: 'courses', title: 'Course Management', description: 'Create, edit, and manage training courses.', icon: '📚' },
                { key: 'learning-paths', title: 'Learning Paths', description: 'Create and manage structured learning paths with multiple courses.', icon: '🛤️' },
                { key: 'assign-learning-path', title: 'Assign Learning Path', description: 'Assign learning paths to employees for structured training.', icon: '🎯' },
                { key: 'learning-path-progress', title: 'Track Learning Path Completion', description: 'Monitor and track employee progress on assigned learning paths.', icon: '📊' },
                { key: 'assignments', title: 'Course Assignments', description: 'Assign courses to employees for training.', icon: '📋' }
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
                        {item.key === 'employees' ? 'Manage Employees' : item.key === 'analytics' ? 'View Analytics' : item.key === 'courses' ? 'Manage Courses' : item.key === 'learning-paths' ? 'Manage Learning Paths' : item.key === 'assign-learning-path' ? 'Assign Learning Path' : item.key === 'learning-path-progress' ? 'Track Progress' : item.key === 'assignments' ? 'Assign Courses' : item.key === 'training-status' ? 'View Status' : item.key === 'employees-needing-support' ? 'View Support' : item.key === 'training-reports' ? 'View Reports' : item.key === 'training-leaderboard' ? 'View Leaderboard' : item.key === 'quiz-analytics' ? 'View Analytics' : 'Open'}
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
      <AppBar 
        position="fixed" 
        elevation={2}
        sx={{ 
          zIndex: (theme) => theme.zIndex.drawer + 1,
          ...(isMobile ? {} : { 
            left: desktopSidebarOpen ? '250px' : 0, 
            width: desktopSidebarOpen ? 'calc(100% - 250px)' : '100%', 
            transition: 'all 0.3s' 
          })
        }}
      >
        <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              aria-label="menu"
            onClick={() => isMobile ? setMobileMenuOpen(true) : setDesktopSidebarOpen(!desktopSidebarOpen)}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          <Typography
            variant="h6"
            component="div"
            onClick={() => handleMenuClick('dashboard')}
            sx={{ flexGrow: 1, cursor: 'pointer', fontWeight: 600 }}
          >
            Manager Portal
          </Typography>
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

      {/* Desktop Persistent Sidebar */}
      {!isMobile && (
        <Drawer
          variant="persistent"
          anchor="left"
          open={desktopSidebarOpen}
          sx={{
            width: desktopSidebarOpen ? 250 : 0,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: 250,
              boxSizing: 'border-box',
              height: '100vh',
              top: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            },
          }}
        >
          <Box 
            sx={{ 
              width: '100%', 
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Logo Section */}
            <Box
              sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderBottom: '1px solid',
                borderColor: 'divider',
                flexShrink: 0,
                minHeight: 64,
              }}
            >
              {!logoImageError ? (
                <Box
                  component="img"
                  src="/logo.png"
                  alt="Logo"
                  onError={() => setLogoImageError(true)}
                  sx={{
                    maxWidth: '100%',
                    maxHeight: 40,
                    objectFit: 'contain',
                  }}
                />
              ) : (
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    color: 'primary.main',
                  }}
                >
                  MyTraining
                </Typography>
              )}
            </Box>
            <List 
              sx={{ 
                flexGrow: 1,
                overflow: 'hidden',
                py: 0,
                '& .MuiListItem-root': {
                  py: 0,
                  minHeight: 'auto',
                },
                '& .MuiListItemButton-root': {
                  minHeight: 40,
                  py: 0.25,
                  px: 2,
                },
              }}
            >
              {menuItems.map((item) => (
                <ListItem key={item.key} disablePadding>
                  <ListItemButton
                    selected={currentView === item.key || (item.key === 'courses' && isCoursesView)}
                  onClick={() => handleMenuClick(item.key as ViewMode)}
                  sx={{
                      '&.Mui-selected': {
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        '&:hover': {
                          bgcolor: 'primary.dark',
                        },
                      },
                    }}
                  >
                    <Box sx={{ mr: 2, display: 'flex', alignItems: 'center', fontSize: '1.2rem' }}>
                      {item.icon}
                    </Box>
                    <ListItemText 
                      primary={item.label} 
                      primaryTypographyProps={{
                        fontSize: '0.875rem',
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => setDesktopLearningPathMenuOpen(!desktopLearningPathMenuOpen)}
                  selected={
                    currentView === 'learning-paths' || 
                   currentView === 'assign-learning-path' || 
                   currentView === 'learning-path-progress' ||
                   currentView === 'create-learning-path' ||
                    currentView === 'edit-learning-path'
                }
                sx={{
                    '&.Mui-selected': {
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      '&:hover': {
                        bgcolor: 'primary.dark',
                      },
                    },
                  }}
                >
                  <Box sx={{ mr: 2, display: 'flex', alignItems: 'center', fontSize: '1.2rem' }}>
                    🛤️
                  </Box>
                  <ListItemText 
                    primary="Learning Paths" 
                    primaryTypographyProps={{
                      fontSize: '0.875rem',
                    }}
                  />
                  {desktopLearningPathMenuOpen ? <ExpandLess /> : <ExpandMore />}
                </ListItemButton>
              </ListItem>
              <Collapse in={desktopLearningPathMenuOpen} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                {learningPathSubmenuItems.map((item) => (
                    <ListItem key={item.key} disablePadding>
                      <ListItemButton
                        sx={{ pl: 4, minHeight: 40, py: 0.5 }}
                    selected={currentView === item.key}
                        onClick={() => handleMenuClick(item.key as ViewMode)}
                  >
                        <Box sx={{ mr: 2, display: 'flex', alignItems: 'center', fontSize: '1rem' }}>
                          {item.icon}
                    </Box>
                        <ListItemText 
                          primary={item.label} 
                          primaryTypographyProps={{
                            fontSize: '0.8125rem',
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                ))}
                </List>
              </Collapse>
            </List>
            </Box>
        </Drawer>
      )}

      {/* Mobile Temporary Drawer */}
      <Drawer
        anchor="left"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        variant="temporary"
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
                  selected={currentView === item.key || (item.key === 'courses' && isCoursesView)}
                  onClick={() => handleMenuClick(item.key as ViewMode)}
                >
                  <Box sx={{ mr: 2, display: 'flex', alignItems: 'center' }}>
                    {item.icon}
                  </Box>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => setMobileLearningPathMenuOpen(!mobileLearningPathMenuOpen)}
                selected={
                  currentView === 'learning-paths' || 
                  currentView === 'assign-learning-path' || 
                  currentView === 'learning-path-progress' ||
                  currentView === 'create-learning-path' ||
                  currentView === 'edit-learning-path'
                }
              >
                <Box sx={{ mr: 2, display: 'flex', alignItems: 'center' }}>
                  🛤️
                </Box>
                <ListItemText primary="Learning Paths" />
                {mobileLearningPathMenuOpen ? <ExpandLess /> : <ExpandMore />}
              </ListItemButton>
            </ListItem>
            <Collapse in={mobileLearningPathMenuOpen} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {learningPathSubmenuItems.map((item) => (
                  <ListItem key={item.key} disablePadding>
                    <ListItemButton
                      sx={{ pl: 4 }}
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
            </Collapse>
          </List>
        </Box>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          mt: '64px', // AppBar height
          marginLeft: !isMobile && desktopSidebarOpen ? '250px' : 0,
          transition: 'margin-left 0.3s',
          width: !isMobile && desktopSidebarOpen ? 'calc(100% - 250px)' : '100%',
          height: 'calc(100vh - 64px)',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Show selected store info at top */}
        {selectedStoreName && (
          <Box sx={{ p: 2, bgcolor: 'primary.light', color: 'white', display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
            <StoreIcon />
            <Typography variant="h6">Store: {selectedStoreName}</Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setCurrentView('store-selection')}
              sx={{ ml: 'auto', color: 'white', borderColor: 'white', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}
            >
              Change Store
            </Button>
          </Box>
        )}
        <Container maxWidth="lg" sx={{ pt: 2, pb: 2, px: 3, flexGrow: 1 }}>
        {renderContent()}
      </Container>
      </Box>
    </Box>
  );
};

export default ManagerDashboard;

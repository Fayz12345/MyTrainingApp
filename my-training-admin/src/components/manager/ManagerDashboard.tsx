import React, { useState } from 'react';
import { AuthUser } from 'aws-amplify/auth';
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
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CourseForm from './CourseForm';
import CourseList from './CourseList';
import AssignmentForm from './AssignmentForm';
import EmployeeList from './EmployeeList';
import TrainingAnalytics from './TrainingAnalytics';

const client = generateClient<Schema>();

interface ManagerDashboardProps {
  signOut: (() => void) | undefined;
  user: AuthUser;
}

type ViewMode =
  | 'dashboard'
  | 'courses'
  | 'create-course'
  | 'edit-course'
  | 'employees'
  | 'assignments'
  | 'analytics';

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

const ManagerDashboard: React.FC<ManagerDashboardProps> = ({ signOut, user }) => {
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedCourse, setSelectedCourse] = useState<CourseSummary | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const menuItems = [
    { key: 'dashboard', label: 'Dashboard', icon: '📊' },
    { key: 'courses', label: 'Courses', icon: '📚' },
    { key: 'employees', label: 'Employees', icon: '👥' },
    { key: 'assignments', label: 'Assignments', icon: '📋' },
    { key: 'analytics', label: 'Analytics', icon: '📈' }
  ];

  const handleMenuClick = (view: ViewMode) => {
    setCurrentView(view);
    setMobileMenuOpen(false);
    if (view === 'courses') {
      setSelectedCourse(null);
    }
  };

  const navigateToCourses = () => {
    setCurrentView('courses');
    setSelectedCourse(null);
    setRefreshTrigger((prev) => prev + 1);
  };

  const isCoursesView = currentView === 'courses' || currentView === 'create-course' || currentView === 'edit-course';

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
            </Typography>
            <EmployeeList refreshTrigger={refreshTrigger} />
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
            <AssignmentForm />
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
            <TrainingAnalytics />
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
                        {item.key === 'employees' ? 'Manage Employees' : item.key === 'analytics' ? 'View Analytics' : item.key === 'courses' ? 'Manage Courses' : 'Assign Courses'}
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
            Manager Portal
          </Typography>
          {!isMobile && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              {menuItems.map((item) => (
                <Button
                  key={item.key}
                  color="inherit"
                  onClick={() => handleMenuClick(item.key as ViewMode)}
                  variant={
                    (currentView === item.key || (item.key === 'courses' && isCoursesView))
                      ? 'outlined'
                      : 'text'
                  }
                  sx={{
                    borderColor: (currentView === item.key || (item.key === 'courses' && isCoursesView))
                      ? 'inherit'
                      : 'transparent',
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
          </List>
        </Box>
      </Drawer>

      <Container maxWidth="lg" sx={{ py: 4, flexGrow: 1 }}>
        {renderContent()}
      </Container>
    </Box>
  );
};

export default ManagerDashboard;

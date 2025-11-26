import React, { useState } from 'react';
import { AuthUser } from 'aws-amplify/auth';
import CourseForm from './CourseForm';
import CourseList from './CourseList';
import AssignmentForm from './AssignmentForm';
import EmployeeList from './EmployeeList';
import TrainingAnalytics from './TrainingAnalytics';

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
  readonly videoKey?: string | null;
  readonly passingScore?: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

const ManagerDashboard: React.FC<ManagerDashboardProps> = ({ signOut, user }) => {
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedCourse, setSelectedCourse] = useState<CourseSummary | null>(null);

  const navigateToCourses = () => {
    setCurrentView('courses');
    setSelectedCourse(null);
    setRefreshTrigger((prev) => prev + 1);
  };

  const renderContent = () => {
    switch (currentView) {
      case 'courses':
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2>Course Management</h2>
              <button
                onClick={() => setCurrentView('create-course')}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#1976d2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                + Create New Course
              </button>
            </div>
            <CourseList 
              refreshTrigger={refreshTrigger}
              onEditCourse={(course) => {
                setSelectedCourse(course);
                setCurrentView('edit-course');
              }}
            />
          </div>
        );
      
      case 'create-course':
        return (
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <button
                onClick={() => {
                  navigateToCourses();
                }}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                ← Back to Courses
              </button>
            </div>
            <CourseForm
              onSuccess={() => {
                navigateToCourses();
              }}
              onCancel={() => {
                setCurrentView('courses');
              }}
            />
          </div>
        );

      case 'edit-course':
        if (!selectedCourse) {
          return (
            <div>
              <p>No course selected. Please go back to the course list.</p>
              <button
                onClick={() => setCurrentView('courses')}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                ← Back to Courses
              </button>
            </div>
          );
        }

        return (
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <button
                onClick={() => {
                  setCurrentView('courses');
                  setSelectedCourse(null);
                }}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                ← Back to Courses
              </button>
            </div>
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
          </div>
        );

      case 'employees':
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2>Employee Management</h2>
            </div>
            <EmployeeList refreshTrigger={refreshTrigger} />
          </div>
        );

      case 'assignments':
        return (
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <button
                onClick={() => setCurrentView('dashboard')}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                ← Back to Dashboard
              </button>
            </div>
            <AssignmentForm />
          </div>
        );

      case 'analytics':
        return (
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <button
                onClick={() => setCurrentView('dashboard')}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                ← Back to Dashboard
              </button>
            </div>
            <TrainingAnalytics />
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
                <h3>Employee Management</h3>
                <p>View and manage employee information and assignments.</p>
                <button 
                  onClick={() => setCurrentView('employees')}
                  style={{ 
                    padding: '8px 16px',
                    backgroundColor: '#1976d2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Manage Employees
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
                <button 
                  onClick={() => setCurrentView('analytics')}
                  style={{ 
                    padding: '8px 16px',
                    backgroundColor: '#1976d2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  View Analytics
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
                <button 
                  onClick={() => setCurrentView('courses')}
                  style={{ 
                    padding: '8px 16px',
                    backgroundColor: '#1976d2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Manage Courses
                </button>
              </div>

              <div style={{ 
                backgroundColor: 'white',
                padding: '1.5rem',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <h3>Course Assignments</h3>
                <p>Assign courses to employees for training.</p>
                <button 
                  onClick={() => setCurrentView('assignments')}
                  style={{ 
                    padding: '8px 16px',
                    backgroundColor: '#1976d2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Assign Courses
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
            Manager Portal
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
                onClick={() => setCurrentView('courses')}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor:
                    currentView === 'courses' ||
                    currentView === 'create-course' ||
                    currentView === 'edit-course'
                      ? '#1976d2'
                      : '#f5f5f5',
                  color:
                    currentView === 'courses' ||
                    currentView === 'create-course' ||
                    currentView === 'edit-course'
                      ? 'white'
                      : '#333',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Courses
              </button>
              <button
                onClick={() => setCurrentView('employees')}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: currentView === 'employees' ? '#1976d2' : '#f5f5f5',
                  color: currentView === 'employees' ? 'white' : '#333',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Employees
              </button>
              <button
                onClick={() => setCurrentView('assignments')}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: currentView === 'assignments' ? '#1976d2' : '#f5f5f5',
                  color: currentView === 'assignments' ? 'white' : '#333',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Assignments
              </button>
              <button
                onClick={() => setCurrentView('analytics')}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: currentView === 'analytics' ? '#1976d2' : '#f5f5f5',
                  color: currentView === 'analytics' ? 'white' : '#333',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Analytics
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

export default ManagerDashboard;
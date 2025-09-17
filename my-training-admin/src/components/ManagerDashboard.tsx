import React, { useState } from 'react';
import { AuthUser } from 'aws-amplify/auth';
import CourseForm from './CourseForm';
import CourseList from './CourseList';

interface ManagerDashboardProps {
  signOut: (() => void) | undefined;
  user: AuthUser;
}

type ViewMode = 'dashboard' | 'courses' | 'create-course';

const ManagerDashboard: React.FC<ManagerDashboardProps> = ({ signOut, user }) => {
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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
              onEditCourse={(_course) => {
                // TODO: Implement course editing
                alert('Course editing will be implemented in the next version');
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
                  setCurrentView('courses');
                  setRefreshTrigger(prev => prev + 1); // Trigger course list refresh
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
            <CourseForm />
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
                  backgroundColor: currentView === 'courses' ? '#1976d2' : '#f5f5f5',
                  color: currentView === 'courses' ? 'white' : '#333',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Courses
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
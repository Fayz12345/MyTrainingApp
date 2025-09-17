import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import EmployeeForm from './EmployeeForm';

const client = generateClient<Schema>();

type Employee = {
  readonly id: string;
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly department?: string | null;
  readonly isActive?: boolean | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

type Assignment = {
  readonly id: string;
  readonly employeeId: string;
  readonly courseId: string;
  readonly status?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

type Course = {
  readonly id: string;
  readonly title: string;
};

interface EmployeeListProps {
  refreshTrigger?: number;
}

const EmployeeList: React.FC<EmployeeListProps> = ({ refreshTrigger }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch employees, assignments, and courses in parallel
      const [employeesResult, assignmentsResult, coursesResult] = await Promise.all([
        client.models.Employee.list(),
        client.models.Assignment.list(),
        client.models.Course.list()
      ]);

      if (employeesResult.errors && employeesResult.errors.length > 0) {
        throw new Error('Failed to fetch employees: ' + employeesResult.errors.map((e: any) => e.message).join(', '));
      }

      if (assignmentsResult.errors && assignmentsResult.errors.length > 0) {
        console.warn('Warning fetching assignments:', assignmentsResult.errors);
      }

      if (coursesResult.errors && coursesResult.errors.length > 0) {
        console.warn('Warning fetching courses:', coursesResult.errors);
      }

      setEmployees(employeesResult.data as Employee[]);
      setAssignments(assignmentsResult.data as Assignment[] || []);
      setCourses(coursesResult.data as Course[] || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const toggleEmployeeExpansion = (employeeId: string) => {
    setExpandedEmployee(expandedEmployee === employeeId ? null : employeeId);
  };

  const getEmployeeAssignments = (employeeId: string) => {
    return assignments.filter(assignment => assignment.employeeId === employeeId);
  };

  const getCourseTitle = (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    return course?.title || 'Unknown Course';
  };

  const deleteEmployee = async (employeeId: string, employeeName: string) => {
    if (!window.confirm(`Are you sure you want to delete employee "${employeeName}"? This will also remove all their course assignments.`)) {
      return;
    }

    try {
      // First delete all assignments for this employee
      const employeeAssignments = getEmployeeAssignments(employeeId);
      for (const assignment of employeeAssignments) {
        await client.models.Assignment.delete({ id: assignment.id });
      }

      // Then delete the employee
      await client.models.Employee.delete({ id: employeeId });

      alert('Employee deleted successfully');
      fetchData(); // Refresh the list
    } catch (err) {
      console.error('Error deleting employee:', err);
      alert('Failed to delete employee');
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p>Loading employees...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'red' }}>
        <p>{error}</p>
        <button 
          onClick={fetchData}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const createTestEmployee = async () => {
    try {
      const result = await client.models.Employee.create({
        userId: 'bced7578-50d1-7076-683e-2710e14a8706', // Test user's Cognito ID
        email: 'testemployee@example.com',
        name: 'Test Employee',
        department: 'Testing',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      console.log('Test employee created:', result);
      alert('Test employee created successfully!');
      fetchData(); // Refresh the list
    } catch (err) {
      console.error('Error creating test employee:', err);
      alert('Failed to create test employee');
    }
  };

  if (showCreateForm) {
    return (
      <EmployeeForm 
        onCancel={() => setShowCreateForm(false)}
        onEmployeeCreated={() => {
          setShowCreateForm(false);
          fetchData(); // Refresh the employee list
        }}
      />
    );
  }

  if (employees.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p>No employees found. Employees will appear here once they are added to the system.</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
          <button 
            onClick={() => setShowCreateForm(true)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Create New Employee
          </button>
          <button 
            onClick={createTestEmployee}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#f5f5f5',
              color: '#333',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Add Test Employee (Demo)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3>Employees ({employees.length})</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={() => setShowCreateForm(true)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            + Create Employee
          </button>
          <button 
            onClick={fetchData}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#f5f5f5',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '1rem' }}>
        {employees.map((employee) => {
          const employeeAssignments = getEmployeeAssignments(employee.id);
          const isExpanded = expandedEmployee === employee.id;
          
          return (
            <div 
              key={employee.id} 
              style={{
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                padding: '1.5rem',
                backgroundColor: 'white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h4 style={{ margin: 0, color: '#1976d2' }}>
                      {employee.name}
                    </h4>
                    {employee.isActive === false && (
                      <span style={{ 
                        marginLeft: '0.5rem', 
                        padding: '0.25rem 0.5rem', 
                        backgroundColor: '#d32f2f', 
                        color: 'white', 
                        borderRadius: '4px', 
                        fontSize: '0.75rem' 
                      }}>
                        INACTIVE
                      </span>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <p style={{ margin: 0, color: '#666' }}>
                      <strong>Email:</strong> {employee.email}
                    </p>
                    {employee.department && (
                      <p style={{ margin: 0, color: '#666' }}>
                        <strong>Department:</strong> {employee.department}
                      </p>
                    )}
                    <p style={{ margin: 0, color: '#666' }}>
                      <strong>Assignments:</strong> {employeeAssignments.length}
                    </p>
                  </div>

                  {employeeAssignments.length > 0 && (
                    <button
                      onClick={() => toggleEmployeeExpansion(employee.id)}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#f5f5f5',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.9rem'
                      }}
                    >
                      {isExpanded ? '▼ Hide' : '▶ Show'} Course Assignments
                    </button>
                  )}

                  {isExpanded && employeeAssignments.length > 0 && (
                    <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                      <h5 style={{ margin: '0 0 0.75rem 0' }}>Assigned Courses:</h5>
                      <div style={{ display: 'grid', gap: '0.5rem' }}>
                        {employeeAssignments.map((assignment) => (
                          <div 
                            key={assignment.id}
                            style={{ 
                              padding: '0.75rem', 
                              backgroundColor: 'white', 
                              borderRadius: '4px',
                              border: '1px solid #e0e0e0',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 'bold' }}>
                                {getCourseTitle(assignment.courseId)}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#666' }}>
                                Status: {assignment.status || 'assigned'} • 
                                Assigned: {new Date(assignment.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                            <span style={{
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              backgroundColor: assignment.status === 'completed' ? '#4caf50' : '#ff9800',
                              color: 'white'
                            }}>
                              {assignment.status === 'completed' ? 'COMPLETED' : 'ASSIGNED'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                  <button
                    onClick={() => deleteEmployee(employee.id, employee.name)}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#d32f2f',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EmployeeList;
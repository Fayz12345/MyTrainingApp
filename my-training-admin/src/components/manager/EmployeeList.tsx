import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';
import { fetchAuthSession } from 'aws-amplify/auth';
import { getUrl } from 'aws-amplify/storage';
import EmployeeForm from './EmployeeForm';
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import Loader from '../common/Loader';
const MySwal = withReactContent(Swal);

const client = generateClient<Schema>();

type Employee = {
  readonly id: string;
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly department?: string | null;
  readonly managerId?: string | null;
  readonly createdBy?: string | null;
  readonly isActive?: boolean | null;
  readonly transitNumber?: string | null;
  readonly institutionNumber?: string | null;
  readonly accountNumber?: string | null;
  readonly bankingDocumentKey?: string | null;
  readonly schedulingEligible?: boolean | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

type Assignment = {
  readonly id: string;
  readonly employeeId: string;
  readonly courseId: string;
  readonly status?: string | null;
  readonly isTrainingComplete?: boolean | null;
  readonly trainingCompletedAt?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

type Course = {
  readonly id: string;
  readonly title: string;
};

type LearningPathAssignment = {
  readonly id: string;
  readonly employeeId: string;
  readonly learningPathId: string;
  readonly status?: string | null;
  readonly assignedDate?: string | null;
  readonly dueDate?: string | null;
  readonly completedDate?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

type LearningPath = {
  readonly id: string;
  readonly title: string;
};

interface EmployeeListProps {
  refreshTrigger?: number;
  selectedStoreId?: string | null;
}

const EmployeeList: React.FC<EmployeeListProps> = ({ refreshTrigger, selectedStoreId }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [pathAssignments, setPathAssignments] = useState<LearningPathAssignment[]>([]);
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user ID to filter employees
      const session = await fetchAuthSession();
      const userId = session.userSub || session.tokens?.idToken?.payload?.sub as string;

      console.log('Fetching employees for userId:', userId);

      // Helper function to fetch all pages with pagination
      const fetchAllPages = async <T,>(
        fetchFn: (nextToken?: string) => Promise<{ data: T[] | null; nextToken?: string | null }>,
        processFn?: (item: T) => any
      ): Promise<any[]> => {
        const allData: any[] = [];
        let nextToken: string | undefined = undefined;
        do {
          const response: any = await fetchFn(nextToken);
          const batch = (response.data || [])
            .filter((item: any) => item.id !== null)
            .map((item: any) => processFn ? processFn(item) : item);
          allData.push(...batch);
          nextToken = response.nextToken || undefined;
        } while (nextToken);
        return allData;
      };

      // Fetch employees, assignments, courses, learning path assignments, and learning paths in parallel
      // Fetch all assignments and filter in memory to include individual assignments (not from learning paths)
      const [employeesResult, allAssignmentsData, coursesResult, pathAssignmentsResult, learningPathsResult] = await Promise.all([
        client.models.Employee.list({}),
        fetchAllPages(
          (nextToken) => client.models.Assignment.list({ nextToken }),
          (a: any) => ({
            id: a.id!,
            employeeId: a.employeeId,
            courseId: a.courseId,
            status: a.status,
            isTrainingComplete: a.isTrainingComplete ?? false,
            trainingCompletedAt: a.trainingCompletedAt,
            assignmentSource: a.assignmentSource || null,
            learningPathId: a.learningPathId || null,
            createdAt: a.createdAt,
            updatedAt: a.updatedAt,
          })
        ),
        client.models.Course.list({}),
        client.models.LearningPathAssignment.list({}),
        client.models.LearningPath.list({})
      ]);

      // Filter assignments to only get individual course assignments (not learning path assignments)
      // Include assignments where assignmentSource is 'individual' OR null/undefined (for older assignments)
      const assignmentsData = allAssignmentsData.filter(
        (assignment: any) => 
          assignment.assignmentSource === 'individual' || 
          (assignment.assignmentSource === null || assignment.assignmentSource === undefined)
      );

      if (employeesResult.errors && employeesResult.errors.length > 0) {
        throw new Error('Failed to fetch employees: ' + employeesResult.errors.map((e: any) => e.message).join(', '));
      }

      // No need to check for errors in assignmentsResult since we're using fetchAllPages

      if (coursesResult.errors && coursesResult.errors.length > 0) {
        console.warn('Warning fetching courses:', coursesResult.errors);
      }

      if (pathAssignmentsResult.errors && pathAssignmentsResult.errors.length > 0) {
        console.warn('Warning fetching learning path assignments:', pathAssignmentsResult.errors);
      }

      if (learningPathsResult.errors && learningPathsResult.errors.length > 0) {
        console.warn('Warning fetching learning paths:', learningPathsResult.errors);
      }

      // Filter employees by createdBy - managers should only see employees they created
      let filteredEmployees = employeesResult.data as Employee[];
      console.log('Total employees fetched:', filteredEmployees.length);
      if (userId) {
        console.log('Filtering employees by createdBy:', userId);
        filteredEmployees = filteredEmployees.filter(emp => emp.createdBy === userId);
        console.log('Filtered employees by createdBy count:', filteredEmployees.length);
      } else {
        console.warn('No userId found, showing all employees');
      }

      // Filter employees by selected store (if store is selected)
      if (selectedStoreId) {
        console.log('Filtering employees by storeId:', selectedStoreId);
        const beforeStoreFilter = filteredEmployees.length;
        // Type assertion needed until schema is deployed and types are regenerated
        filteredEmployees = filteredEmployees.filter(emp => (emp as any).storeId === selectedStoreId);
        console.log(`Filtered employees by store: ${beforeStoreFilter} -> ${filteredEmployees.length}`);
      }

      setEmployees(filteredEmployees);
      setAssignments(assignmentsData as Assignment[]);
      setCourses(coursesResult.data as Course[] || []);
      setPathAssignments(pathAssignmentsResult.data as LearningPathAssignment[] || []);
      setLearningPaths(learningPathsResult.data as LearningPath[] || []);
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

  const handleViewBankingDocument = async (documentKey: string) => {
    try {
      const { url } = await getUrl({
        path: documentKey,
        options: {
          expiresIn: 3600, // 1 hour
        }
      });
      window.open(url.toString(), '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error getting banking document URL:', error);
      MySwal.fire({
        title: 'Error',
        text: 'Failed to retrieve banking document. Please try again later.',
        icon: 'error',
      });
    }
  };

  const getEmployeeAssignments = (employeeId: string) => {
    return assignments.filter(assignment => assignment.employeeId === employeeId);
  };

  const getCompletedTrainingAssignments = (employeeId: string) => {
    return assignments.filter(assignment => 
      assignment.employeeId === employeeId &&
      assignment.status === 'completed' &&
      assignment.isTrainingComplete === true
    );
  };

  // Check if recertification is needed (1 year has passed since training completion)
  const isRecertificationNeeded = (assignment: Assignment): boolean => {
    if (!assignment.isTrainingComplete || !assignment.trainingCompletedAt) {
      return false;
    }
    
    const completedDate = new Date(assignment.trainingCompletedAt);
    const now = new Date();
    const oneYearInMs = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
    const timeSinceCompletion = now.getTime() - completedDate.getTime();
    
    return timeSinceCompletion >= oneYearInMs;
  };

  // Get assignments that need recertification
  const getRecertificationNeededAssignments = (employeeId: string) => {
    return assignments.filter(assignment => 
      assignment.employeeId === employeeId &&
      assignment.status === 'completed' &&
      assignment.isTrainingComplete === true &&
      isRecertificationNeeded(assignment)
    );
  };

  const getCourseTitle = (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    return course?.title || 'Unknown Course';
  };

  const getEmployeePathAssignments = (employeeId: string) => {
    return pathAssignments.filter(pathAssignment => pathAssignment.employeeId === employeeId);
  };

  const getLearningPathTitle = (learningPathId: string) => {
    const learningPath = learningPaths.find(lp => lp.id === learningPathId);
    return learningPath?.title || 'Unknown Learning Path';
  };

  const deleteEmployee = async (employeeId: string, employeeName: string) => {
    const result = await MySwal.fire({
      title: "Are you sure?",
      text: `Do you want to delete employee "${employeeName}"? This will also remove all their course assignments and learning path assignments.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete!",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    try {
      // First delete all assignments for this employee
      const employeeAssignments = getEmployeeAssignments(employeeId);
      for (const assignment of employeeAssignments) {
        await client.models.Assignment.delete({ id: assignment.id });
      }

      // Delete all learning path assignments for this employee
      const employeePathAssignments = getEmployeePathAssignments(employeeId);
      for (const pathAssignment of employeePathAssignments) {
        await client.models.LearningPathAssignment.delete({ id: pathAssignment.id });
      }

      // Then delete the employee
      await client.models.Employee.delete({ id: employeeId });

      await MySwal.fire({
        title: "Deleted!",
        text: "Employee deleted successfully",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
      fetchData(); // Refresh the list
    } catch (err) {
      console.error('Error deleting employee:', err);
      await MySwal.fire({
        title: "Error!",
        text: "Failed to delete employee",
        icon: "error",
      });
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshTrigger, selectedStoreId]);

  if (loading) {
    return <Loader message="Loading employees..." />;
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
        selectedStoreId={selectedStoreId}
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
          const employeePathAssignments = getEmployeePathAssignments(employee.id);
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
              <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h4 style={{ margin: 0, color: '#1976d2' }}>
                      {employee.name}
                    </h4>
                    {employee.isActive === false && (
                      <span style={{ 
                        padding: '0.25rem 0.5rem', 
                        backgroundColor: '#d32f2f', 
                        color: 'white', 
                        borderRadius: '4px', 
                        fontSize: '0.75rem' 
                      }}>
                        INACTIVE
                      </span>
                    )}
                    {employee.schedulingEligible ? (
                      <span style={{ 
                        padding: '0.25rem 0.5rem', 
                        backgroundColor: '#4caf50', 
                        color: 'white', 
                        borderRadius: '4px', 
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                      }}>
                        ✓ SCHEDULING ELIGIBLE
                      </span>
                    ) : (
                      <span style={{ 
                        padding: '0.25rem 0.5rem', 
                        backgroundColor: '#ff9800', 
                        color: 'white', 
                        borderRadius: '4px', 
                        fontSize: '0.75rem'
                      }}>
                        ⚠ NOT ELIGIBLE FOR SCHEDULING
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
                      <strong>Course Assignments:</strong> {employeeAssignments.length}
                    </p>
                    <p style={{ margin: 0, color: '#666' }}>
                      <strong>Learning Paths:</strong> {employeePathAssignments.length}
                    </p>
                  </div>

                  {/* Banking Information Section */}
                  <div style={{ marginTop: '1rem', marginBottom: '1rem', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px', border: '1px solid #ddd' }}>
                    <h5 style={{ margin: '0 0 0.75rem 0', color: '#1976d2', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      💳 Banking Information
                      {(!employee.transitNumber && !employee.institutionNumber && !employee.accountNumber && !employee.bankingDocumentKey) && (
                        <span style={{ 
                          fontSize: '0.75rem', 
                          color: '#d32f2f', 
                          fontWeight: 'normal',
                          marginLeft: '0.5rem'
                        }}>
                          (Not Provided)
                        </span>
                      )}
                    </h5>
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                      {employee.transitNumber ? (
                        <p style={{ margin: 0, color: '#666' }}>
                          <strong>Transit Number:</strong> {employee.transitNumber}
                        </p>
                      ) : (
                        <p style={{ margin: 0, color: '#999', fontStyle: 'italic' }}>
                          <strong>Transit Number:</strong> Not provided
                        </p>
                      )}
                      {employee.institutionNumber ? (
                        <p style={{ margin: 0, color: '#666' }}>
                          <strong>Institution Number:</strong> {employee.institutionNumber}
                        </p>
                      ) : (
                        <p style={{ margin: 0, color: '#999', fontStyle: 'italic' }}>
                          <strong>Institution Number:</strong> Not provided
                        </p>
                      )}
                      {employee.accountNumber ? (
                        <p style={{ margin: 0, color: '#666' }}>
                          <strong>Account Number:</strong> {employee.accountNumber}
                        </p>
                      ) : (
                        <p style={{ margin: 0, color: '#999', fontStyle: 'italic' }}>
                          <strong>Account Number:</strong> Not provided
                        </p>
                      )}
                      {employee.bankingDocumentKey ? (
                        <p style={{ margin: 0, color: '#666' }}>
                          <strong>Banking Document:</strong> 
                          <button
                            onClick={() => handleViewBankingDocument(employee.bankingDocumentKey!)}
                            style={{ 
                              marginLeft: '0.5rem', 
                              color: '#1976d2', 
                              background: 'none',
                              border: 'none',
                              textDecoration: 'underline',
                              cursor: 'pointer',
                              padding: 0,
                              fontSize: 'inherit'
                            }}
                          >
                            View Document
                          </button>
                        </p>
                      ) : (
                        <p style={{ margin: 0, color: '#999', fontStyle: 'italic' }}>
                          <strong>Banking Document:</strong> Not uploaded
                        </p>
                      )}
                    </div>
                  </div>

                  {(employeeAssignments.length > 0 || employeePathAssignments.length > 0) && (
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
                      {isExpanded ? '▼ Hide' : '▶ Show'} Assignments & Learning Paths
                    </button>
                  )}

                  {isExpanded && employeePathAssignments.length > 0 && (
                    <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#e3f2fd', borderRadius: '4px', border: '2px solid #1976d2', marginBottom: '1rem' }}>
                      <h5 style={{ margin: '0 0 0.75rem 0', color: '#1565c0' }}>
                        🛤️ Learning Path Assignments ({employeePathAssignments.length}):
                      </h5>
                      <div style={{ display: 'grid', gap: '0.5rem' }}>
                        {employeePathAssignments.map((pathAssignment) => (
                          <div 
                            key={pathAssignment.id}
                            style={{ 
                              padding: '0.75rem', 
                              backgroundColor: 'white', 
                              borderRadius: '4px',
                              border: '1px solid #1976d2',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 'bold', color: '#1565c0' }}>
                                {getLearningPathTitle(pathAssignment.learningPathId)}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#666' }}>
                                Status: {pathAssignment.status || 'not_started'}
                                {pathAssignment.assignedDate && (
                                  <>
                                    <br />
                                    Assigned: {new Date(pathAssignment.assignedDate).toLocaleDateString()}
                                  </>
                                )}
                                {pathAssignment.dueDate && (
                                  <>
                                    <br />
                                    Due: {new Date(pathAssignment.dueDate).toLocaleDateString()}
                                    {new Date(pathAssignment.dueDate) < new Date() && pathAssignment.status !== 'completed' && (
                                      <span style={{ color: '#d32f2f', fontWeight: 'bold', marginLeft: '0.5rem' }}>
                                        (OVERDUE)
                                      </span>
                                    )}
                                  </>
                                )}
                                {pathAssignment.completedDate && (
                                  <>
                                    <br />
                                    Completed: {new Date(pathAssignment.completedDate).toLocaleDateString()}
                                  </>
                                )}
                              </div>
                            </div>
                            <span style={{
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              backgroundColor: pathAssignment.status === 'completed' ? '#4caf50' :
                                             pathAssignment.status === 'in_progress' ? '#ff9800' : 
                                             '#9e9e9e',
                              color: 'white'
                            }}>
                              {pathAssignment.status === 'completed' ? 'COMPLETED' :
                               pathAssignment.status === 'in_progress' ? 'IN PROGRESS' : 
                               'NOT STARTED'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isExpanded && employeeAssignments.length > 0 && (
                    <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                      <h5 style={{ margin: '0 0 0.75rem 0' }}>📚 Course Assignments ({employeeAssignments.length}):</h5>
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
                                {assignment.isTrainingComplete && !isRecertificationNeeded(assignment) && (
                                  <span style={{ color: '#4caf50', fontWeight: 'bold', marginLeft: '0.5rem' }}>
                                    ✅ Training Complete
                                  </span>
                                )}
                                {assignment.isTrainingComplete && isRecertificationNeeded(assignment) && (
                                  <span style={{ color: '#ff9800', fontWeight: 'bold', marginLeft: '0.5rem' }}>
                                    🔄 Recertification Required
                                  </span>
                                )}
                                {!assignment.isTrainingComplete && assignment.status === 'completed' && (
                                  <span style={{ color: '#ff9800', marginLeft: '0.5rem' }}>
                                    ⚠️ Completed (Training not marked complete)
                                  </span>
                                )}
                                <br />
                                {assignment.trainingCompletedAt && (
                                  <>
                                    Completed: {new Date(assignment.trainingCompletedAt).toLocaleDateString()}
                                    {isRecertificationNeeded(assignment) && (
                                      <span style={{ color: '#ff9800', marginLeft: '0.5rem' }}>
                                        (Expired - Over 1 year)
                                      </span>
                                    )}
                                    <br />
                                  </>
                                )}
                                Assigned: {new Date(assignment.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                            <span style={{
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              backgroundColor: assignment.status === 'completed' && assignment.isTrainingComplete && isRecertificationNeeded(assignment) ? '#ff9800' :
                                             assignment.status === 'completed' && assignment.isTrainingComplete ? '#4caf50' : 
                                             assignment.status === 'completed' ? '#ff9800' : '#9e9e9e',
                              color: 'white'
                            }}>
                              {assignment.status === 'completed' && assignment.isTrainingComplete && isRecertificationNeeded(assignment) ? 'RECERTIFICATION NEEDED' :
                               assignment.status === 'completed' && assignment.isTrainingComplete ? 'TRAINING COMPLETE' : 
                               assignment.status === 'completed' ? 'COMPLETED' : 'ASSIGNED'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isExpanded && (() => {
                    const recertificationNeeded = getRecertificationNeededAssignments(employee.id);
                    return recertificationNeeded.length > 0 && (
                      <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#fff3e0', borderRadius: '4px', border: '2px solid #ff9800' }}>
                        <h5 style={{ margin: '0 0 0.75rem 0', color: '#e65100' }}>
                          🔄 Recertification Required ({recertificationNeeded.length}):
                        </h5>
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                          {recertificationNeeded.map((assignment) => (
                            <div 
                              key={assignment.id}
                              style={{ 
                                padding: '0.75rem', 
                                backgroundColor: 'white', 
                                borderRadius: '4px',
                                border: '1px solid #ff9800',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 'bold', color: '#e65100' }}>
                                  {getCourseTitle(assignment.courseId)}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#666' }}>
                                  {assignment.trainingCompletedAt && (
                                    <>
                                      Original completion: {new Date(assignment.trainingCompletedAt).toLocaleDateString()}
                                      <br />
                                      <span style={{ color: '#ff9800', fontWeight: 'bold' }}>
                                        Expired - Employee needs to retake quiz
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <span style={{
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                backgroundColor: '#ff9800',
                                color: 'white',
                                fontWeight: 'bold'
                              }}>
                                🔄 RECERTIFY
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {isExpanded && (() => {
                    const completedTraining = getCompletedTrainingAssignments(employee.id);
                    return completedTraining.length > 0 && (
                      <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#e8f5e9', borderRadius: '4px', border: '2px solid #4caf50' }}>
                        <h5 style={{ margin: '0 0 0.75rem 0', color: '#2e7d32' }}>
                          ✅ Completed Training ({completedTraining.length}):
                        </h5>
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                          {completedTraining.filter(a => !isRecertificationNeeded(a)).map((assignment) => (
                            <div 
                              key={assignment.id}
                              style={{ 
                                padding: '0.75rem', 
                                backgroundColor: 'white', 
                                borderRadius: '4px',
                                border: '1px solid #4caf50',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 'bold', color: '#2e7d32' }}>
                                  {getCourseTitle(assignment.courseId)}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#666' }}>
                                  {assignment.trainingCompletedAt ? (
                                    <>
                                      Completed: {new Date(assignment.trainingCompletedAt).toLocaleDateString()}
                                      {(() => {
                                        const completedDate = new Date(assignment.trainingCompletedAt);
                                        const now = new Date();
                                        const oneYearInMs = 365 * 24 * 60 * 60 * 1000;
                                        const timeSinceCompletion = now.getTime() - completedDate.getTime();
                                        const daysUntilRecert = Math.ceil((oneYearInMs - timeSinceCompletion) / (24 * 60 * 60 * 1000));
                                        if (daysUntilRecert > 0 && daysUntilRecert <= 365) {
                                          return ` • Recertification due in ${daysUntilRecert} days`;
                                        }
                                        return '';
                                      })()}
                                    </>
                                  ) : (
                                    <>Completed: {new Date(assignment.updatedAt).toLocaleDateString()}</>
                                  )}
                                </div>
                              </div>
                              <span style={{
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                backgroundColor: '#4caf50',
                                color: 'white',
                                fontWeight: 'bold'
                              }}>
                                ✅ COMPLETE
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
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


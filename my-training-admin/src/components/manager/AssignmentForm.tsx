import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import Loader from '../common/Loader';
import { activityLogger, getCurrentUserInfo } from '../../utils/activityLogger';
const MySwal = withReactContent(Swal);

const client = generateClient<Schema>();

type Course = {
  readonly id: string;
  readonly title: string;
  readonly videoKey?: string | null;
  readonly passingScore?: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

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

interface AssignmentFormProps {
  selectedStoreId?: string | null;
}

const AssignmentForm: React.FC<AssignmentFormProps> = ({ selectedStoreId }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch courses and employees in parallel
      const [coursesResult, employeesResult] = await Promise.all([
        client.models.Course.list({}),
        client.models.Employee.list({})
      ]);

      if (coursesResult.errors && coursesResult.errors.length > 0) {
        throw new Error('Failed to fetch courses: ' + coursesResult.errors.map((e: any) => e.message).join(', '));
      }

      if (employeesResult.errors && employeesResult.errors.length > 0) {
        throw new Error('Failed to fetch employees: ' + employeesResult.errors.map((e: any) => e.message).join(', '));
      }

      // Filter employees by selected store (if store is selected)
      let filteredEmployees = employeesResult.data as Employee[];
      if (selectedStoreId) {
        console.log('[AssignmentForm] Filtering employees by storeId:', selectedStoreId);
        const beforeStoreFilter = filteredEmployees.length;
        // Type assertion needed until schema is deployed and types are regenerated
        filteredEmployees = filteredEmployees.filter(emp => (emp as any).storeId === selectedStoreId);
        console.log(`[AssignmentForm] Filtered employees by store: ${beforeStoreFilter} -> ${filteredEmployees.length}`);
      }

      setCourses(coursesResult.data as Course[]);
      setEmployees(filteredEmployees);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedStoreId]); // Refetch when storeId changes

  const handleCourseSelection = (courseId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedCourseIds([...selectedCourseIds, courseId]);
    } else {
      setSelectedCourseIds(selectedCourseIds.filter(id => id !== courseId));
    }
    // Clear course error when user selects a course
    if (fieldErrors.courses) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.courses;
        return newErrors;
      });
    }
  };

  const handleEmployeeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedEmployeeId(e.target.value);
    // Clear error when user selects an employee
    if (fieldErrors.employeeId) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.employeeId;
        return newErrors;
      });
    }
  };

  const handleEmployeeBlur = () => {
    setTouchedFields(prev => ({ ...prev, employeeId: true }));
    if (!selectedEmployeeId) {
      setFieldErrors(prev => ({ ...prev, employeeId: 'Please select an employee' }));
    } else {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.employeeId;
        return newErrors;
      });
    }
  };

  const handleCoursesBlur = () => {
    setTouchedFields(prev => ({ ...prev, courses: true }));
    if (selectedCourseIds.length === 0) {
      setFieldErrors(prev => ({ ...prev, courses: 'Please select at least one course' }));
    } else {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.courses;
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields
    const errors: Record<string, string> = {};
    const touched: Record<string, boolean> = {};
    
    if (!selectedEmployeeId) {
      errors.employeeId = 'Please select an employee';
      touched.employeeId = true;
    }
    
    if (selectedCourseIds.length === 0) {
      errors.courses = 'Please select at least one course';
      touched.courses = true;
    }
    
    setFieldErrors(errors);
    setTouchedFields(touched);
    
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      // Create assignments for each selected course
      const assignmentPromises = selectedCourseIds.map(courseId =>
        client.models.Assignment.create({
          employeeId: selectedEmployeeId,
          courseId: courseId,
          status: 'assigned',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
      );

      const results = await Promise.all(assignmentPromises);

      // Check for any errors
      const errors = results.filter(result => result.errors && result.errors.length > 0);
      if (errors.length > 0) {
        throw new Error('Some assignments failed: ' + errors.map(e => e.errors?.map((err: any) => err.message).join(', ')).join('; '));
      }

      const selectedEmployee = employees.find(emp => emp.id === selectedEmployeeId);
      const selectedCourses = courses.filter(course => selectedCourseIds.includes(course.id));
      
      await MySwal.fire({
        title: "Success!",
        text: `Successfully assigned ${selectedCourses.length} course(s) to ${selectedEmployee?.name}`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });

      // Log activity for each course assignment
      try {
        const userInfo = await getCurrentUserInfo();
        for (const course of selectedCourses) {
          await activityLogger.logActivity(
            'COURSE_ASSIGNED',
            userInfo.userId,
            userInfo.userName,
            userInfo.userEmail,
            `Assigned course "${course.title}" to employee "${selectedEmployee?.name}"`,
            {
              employeeId: selectedEmployeeId,
              employeeName: selectedEmployee?.name || 'Unknown',
              employeeEmail: selectedEmployee?.email || 'Unknown',
              courseId: course.id,
              courseTitle: course.title,
              storeId: selectedStoreId || undefined,
            },
            selectedStoreId || undefined
          );
        }
      } catch (logError) {
        console.error('[AssignmentForm] Error logging activity:', logError);
      }
      
      // Reset form
      setSelectedEmployeeId('');
      setSelectedCourseIds([]);
      setFieldErrors({});
      setTouchedFields({});
    } catch (err) {
      console.error('Error creating assignments:', err);
      await MySwal.fire({
        title: "Error!",
        text: 'Failed to create assignments: ' + (err instanceof Error ? err.message : 'Unknown error'),
        icon: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Loader message="Loading courses and employees..." />;
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

  // Show message if no store is selected
  if (!selectedStoreId) {
    return (
      <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
        <h2>Assign Courses to Employee</h2>
        <p style={{ color: '#666', marginTop: '1rem', fontStyle: 'italic' }}>
          Please select a store from the dashboard to assign courses to employees.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h2>Assign Courses to Employee</h2>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Employee Selection */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Select Employee *
          </label>
          {employees.length === 0 ? (
            <p style={{ color: '#d32f2f', fontStyle: 'italic' }}>
              No employees found for the selected store. You'll need to add employees to this store first.
            </p>
          ) : (
            <>
              <select
                value={selectedEmployeeId}
                onChange={handleEmployeeChange}
                onBlur={handleEmployeeBlur}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: fieldErrors.employeeId ? '2px solid #d32f2f' : '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  outline: 'none'
                }}
                required
              >
                <option value="">Choose an employee...</option>
                {employees
                  .filter(emp => emp.isActive !== false)
                  .map(employee => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} ({employee.email})
                      {employee.department && ` - ${employee.department}`}
                    </option>
                  ))
                }
              </select>
              {touchedFields.employeeId && fieldErrors.employeeId && (
                <div style={{ color: '#d32f2f', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  {fieldErrors.employeeId}
                </div>
              )}
            </>
          )}
        </div>

        {/* Course Selection */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Select Courses * (Select one or more)
          </label>
          {courses.length === 0 ? (
            <p style={{ color: '#d32f2f', fontStyle: 'italic' }}>
              No courses found. Create courses first before assigning them.
            </p>
          ) : (
            <>
              <div 
                style={{ 
                  border: fieldErrors.courses ? '2px solid #d32f2f' : '1px solid #ccc', 
                  borderRadius: '4px', 
                  maxHeight: '300px', 
                  overflowY: 'auto',
                  padding: '1rem'
                }}
                onBlur={handleCoursesBlur}
                tabIndex={0}
              >
              {courses.map(course => (
                <div key={course.id} style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  marginBottom: '1rem',
                  padding: '0.75rem',
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px',
                  backgroundColor: selectedCourseIds.includes(course.id) ? '#f0f8ff' : 'white'
                }}>
                  <input
                    type="checkbox"
                    id={`course-${course.id}`}
                    checked={selectedCourseIds.includes(course.id)}
                    onChange={(e) => handleCourseSelection(course.id, e.target.checked)}
                    style={{ marginRight: '0.75rem', marginTop: '0.25rem' }}
                  />
                  <label htmlFor={`course-${course.id}`} style={{ flex: 1, cursor: 'pointer' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                      {course.title}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#666' }}>
                      Passing Score: {course.passingScore ?? 'Not set'}%
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#999' }}>
                      Created: {new Date(course.createdAt).toLocaleDateString()}
                    </div>
                  </label>
                </div>
              ))}
              </div>
              {touchedFields.courses && fieldErrors.courses && (
                <div style={{ color: '#d32f2f', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  {fieldErrors.courses}
                </div>
              )}
              {selectedCourseIds.length > 0 && !fieldErrors.courses && (
                <p style={{ marginTop: '0.5rem', color: '#1976d2', fontSize: '0.9rem' }}>
                  {selectedCourseIds.length} course(s) selected
                </p>
              )}
            </>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting || employees.length === 0 || courses.length === 0}
          style={{
            padding: '1rem 2rem',
            backgroundColor: submitting || employees.length === 0 || courses.length === 0 ? '#ccc' : '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1.1rem',
            cursor: submitting || employees.length === 0 || courses.length === 0 ? 'not-allowed' : 'pointer',
            marginTop: '1rem'
          }}
        >
          {submitting ? 'Creating Assignments...' : 'Assign Courses'}
        </button>
      </form>

      {/* Selected Summary */}
      {selectedEmployeeId && selectedCourseIds.length > 0 && (
        <div style={{ 
          marginTop: '2rem', 
          padding: '1rem', 
          backgroundColor: '#f0f8ff', 
          borderRadius: '4px',
          border: '1px solid #1976d2'
        }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#1976d2' }}>Assignment Summary</h4>
          <p style={{ margin: '0.25rem 0' }}>
            <strong>Employee:</strong> {employees.find(emp => emp.id === selectedEmployeeId)?.name}
          </p>
          <p style={{ margin: '0.25rem 0' }}>
            <strong>Courses:</strong> {selectedCourseIds.length} selected
          </p>
          <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
            {selectedCourseIds.map(courseId => {
              const course = courses.find(c => c.id === courseId);
              return (
                <li key={courseId} style={{ margin: '0.25rem 0' }}>
                  {course?.title}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AssignmentForm;
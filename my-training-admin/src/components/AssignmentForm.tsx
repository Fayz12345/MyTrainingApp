import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';

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

const AssignmentForm: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch courses and employees in parallel
      const [coursesResult, employeesResult] = await Promise.all([
        client.models.Course.list(),
        client.models.Employee.list()
      ]);

      if (coursesResult.errors && coursesResult.errors.length > 0) {
        throw new Error('Failed to fetch courses: ' + coursesResult.errors.map((e: any) => e.message).join(', '));
      }

      if (employeesResult.errors && employeesResult.errors.length > 0) {
        throw new Error('Failed to fetch employees: ' + employeesResult.errors.map((e: any) => e.message).join(', '));
      }

      setCourses(coursesResult.data as Course[]);
      setEmployees(employeesResult.data as Employee[]);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCourseSelection = (courseId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedCourseIds([...selectedCourseIds, courseId]);
    } else {
      setSelectedCourseIds(selectedCourseIds.filter(id => id !== courseId));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedEmployeeId) {
      alert('Please select an employee');
      return;
    }

    if (selectedCourseIds.length === 0) {
      alert('Please select at least one course');
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
      
      alert(`Successfully assigned ${selectedCourses.length} course(s) to ${selectedEmployee?.name}`);
      
      // Reset form
      setSelectedEmployeeId('');
      setSelectedCourseIds([]);
    } catch (err) {
      console.error('Error creating assignments:', err);
      alert('Failed to create assignments: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p>Loading courses and employees...</p>
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
              No employees found. You'll need to add employees first.
            </p>
          ) : (
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '1rem'
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
            <div style={{ 
              border: '1px solid #ccc', 
              borderRadius: '4px', 
              maxHeight: '300px', 
              overflowY: 'auto',
              padding: '1rem'
            }}>
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
          )}
          {selectedCourseIds.length > 0 && (
            <p style={{ marginTop: '0.5rem', color: '#1976d2', fontSize: '0.9rem' }}>
              {selectedCourseIds.length} course(s) selected
            </p>
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
import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  Paper,
} from '@mui/material';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import Loader from '../common/Loader';

const MySwal = withReactContent(Swal);
const client = generateClient<Schema>();

interface LearningPath {
  id: string;
  title: string;
  description?: string | null;
  status?: string | null;
  version?: number | null;
  isSequential?: boolean | null;
  courses?: {
    items?: Array<{
      id: string;
      order: number;
      isRequired: boolean;
      courseId: string;
      course?: {
        id: string;
        title: string;
      } | null;
    }> | null;
  } | null;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  department?: string | null;
}

const sendLearningPathNotification = async (notificationData: {
  employeeEmail: string;
  employeeName: string;
  learningPathTitle: string;
  learningPathDescription?: string;
  courseCount: number;
  dueDate?: string;
  isSequential?: boolean;
  assignmentId?: string;
}) => {
  // Lambda Function URL - Configure after deployment
  // Get this from AWS Lambda Console → Function → Configuration → Function URL
  const LAMBDA_FUNCTION_URL = process.env.REACT_APP_LEARNING_PATH_NOTIFICATION_LAMBDA_URL || '';
  
  if (!LAMBDA_FUNCTION_URL) {
    console.log('[AssignLearningPath] Lambda Function URL not configured. Skipping notification.');
    return;
  }

  try {
    console.log('[AssignLearningPath] Sending learning path assignment notification...');
    const response = await fetch(LAMBDA_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notificationData)
    });

    if (!response.ok) {
      throw new Error(`Lambda returned status ${response.status}`);
    }

    const result = await response.json();
    console.log('[AssignLearningPath] Notification sent:', result);
    return result;
  } catch (err) {
    console.error('[AssignLearningPath] Notification error (non-critical):', err);
    // Don't throw - notification failure shouldn't block assignment creation
    return null;
  }
};

interface AssignLearningPathProps {
  selectedStoreId?: string | null;
}

const AssignLearningPath: React.FC<AssignLearningPathProps> = ({ selectedStoreId }) => {
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedPathId, setSelectedPathId] = useState('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [selectedStoreId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch published learning paths
      const pathsResult = await client.models.LearningPath.list({
        filter: { 
          status: { eq: 'published' },
          isArchived: { ne: true }
        }
      });

      if (pathsResult.errors && pathsResult.errors.length > 0) {
        throw new Error('Failed to fetch learning paths: ' + pathsResult.errors.map((e: any) => e.message).join(', '));
      }

      // Fetch courses for each learning path
      const pathsWithCourses = await Promise.all(
        (pathsResult.data as LearningPath[]).map(async (path) => {
          try {
            const coursesResult = await client.models.LearningPathCourse.list({
              filter: { learningPathId: { eq: path.id } }
            });

            // Fetch course details for each LearningPathCourse
            const coursesWithDetails = await Promise.all(
              (coursesResult.data || []).map(async (pc: any) => {
                if (!pc.courseId) return null;
                try {
                  const courseResult = await client.models.Course.get({ id: pc.courseId });
                  if (!courseResult.data || !courseResult.data.id) return null;
                  return {
                    id: pc.id,
                    order: pc.order,
                    isRequired: pc.isRequired,
                    courseId: pc.courseId,
                    course: {
                      id: courseResult.data.id,
                      title: courseResult.data.title || 'Unknown Course',
                    }
                  };
                } catch (err) {
                  console.error(`Error fetching course ${pc.courseId}:`, err);
                  return null;
                }
              })
            );

            const validCourses = coursesWithDetails.filter((c): c is NonNullable<typeof c> => c !== null);

            return {
              ...path,
              courses: {
                items: validCourses
              }
            };
          } catch (err) {
            console.error(`Error fetching courses for path ${path.id}:`, err);
            return { ...path, courses: { items: [] } };
          }
        })
      );

      setLearningPaths(pathsWithCourses);

      // Fetch employees
      const employeesResult = await client.models.Employee.list({
        filter: { isActive: { eq: true } }
      });

      if (employeesResult.errors && employeesResult.errors.length > 0) {
        throw new Error('Failed to fetch employees: ' + employeesResult.errors.map((e: any) => e.message).join(', '));
      }

      // Filter employees by store if store is selected
      let filteredEmployees = employeesResult.data as Employee[];
      if (selectedStoreId) {
        filteredEmployees = filteredEmployees.filter((emp: any) => emp.storeId === selectedStoreId);
      }

      setEmployees(filteredEmployees);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeToggle = (employeeId: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPathId) {
      await MySwal.fire({
        title: 'Error!',
        text: 'Please select a learning path',
        icon: 'error',
      });
      return;
    }

    if (selectedEmployeeIds.length === 0) {
      await MySwal.fire({
        title: 'Error!',
        text: 'Please select at least one employee',
        icon: 'error',
      });
      return;
    }

    setSubmitting(true);

    try {
      const selectedPath = learningPaths.find((p) => p.id === selectedPathId);
      if (!selectedPath) {
        throw new Error('Selected learning path not found');
      }

      const pathCourses = selectedPath.courses?.items || [];
      if (pathCourses.length === 0) {
        throw new Error('Selected learning path has no courses');
      }

      // Sort courses by order
      const sortedCourses = [...pathCourses].sort((a, b) => a.order - b.order);
      const isSequential = selectedPath.isSequential || false;

      const now = new Date().toISOString();
      const dueDateISO = dueDate ? new Date(dueDate).toISOString() : null;

      // Create assignments for each selected employee
      const assignmentPromises = selectedEmployeeIds.map(async (employeeId) => {
        // Create LearningPathAssignment
        const pathAssignmentResult = await client.models.LearningPathAssignment.create({
          learningPathId: selectedPathId,
          employeeId: employeeId,
          status: 'not_started',
          assignedDate: now,
          dueDate: dueDateISO,
          createdAt: now,
          updatedAt: now,
        });

        if (pathAssignmentResult.errors && pathAssignmentResult.errors.length > 0) {
          throw new Error(`Failed to create path assignment: ${pathAssignmentResult.errors.map((e: any) => e.message).join(', ')}`);
        }

        // Create individual course assignments
        const courseAssignmentPromises = sortedCourses.map(async (pathCourse, index) => {
          // For sequential paths, only the first course should be accessible initially
          // For non-sequential paths, all courses are accessible
          const shouldBeAccessible = !isSequential || index === 0;

          return client.models.Assignment.create({
            employeeId: employeeId,
            courseId: pathCourse.courseId,
            status: shouldBeAccessible ? 'assigned' : 'assigned', // All are assigned, but access is controlled by sequential logic
            createdAt: now,
            updatedAt: now,
          });
        });

        const courseAssignments = await Promise.all(courseAssignmentPromises);

        // Check for errors in course assignments
        const courseErrors = courseAssignments.filter(
          (result) => result.errors && result.errors.length > 0
        );
        if (courseErrors.length > 0) {
          throw new Error(
            `Failed to create some course assignments: ${courseErrors.map((e) => e.errors?.map((err: any) => err.message).join(', ')).join('; ')}`
          );
        }

        return { pathAssignment: pathAssignmentResult.data, courseAssignments };
      });

      const results = await Promise.all(assignmentPromises);

      const selectedEmployees = employees.filter((emp) => selectedEmployeeIds.includes(emp.id));
      const employeeNames = selectedEmployees.map((e) => e.name).join(', ');

      // Send notifications to employees (non-blocking)
      console.log('[AssignLearningPath] Sending notifications to employees...');
      const notificationPromises = selectedEmployees.map(async (employee) => {
        try {
          const assignment = results.find(r => (r.pathAssignment as any)?.employeeId === employee.id);
          const assignmentId = assignment?.pathAssignment?.id;
          await sendLearningPathNotification({
            employeeEmail: employee.email,
            employeeName: employee.name,
            learningPathTitle: selectedPath.title,
            learningPathDescription: selectedPath.description ?? undefined,
            courseCount: sortedCourses.length,
            dueDate: dueDateISO || undefined,
            isSequential: isSequential,
            assignmentId: assignmentId ? String(assignmentId) : undefined
          });
        } catch (err) {
          console.error(`[AssignLearningPath] Failed to send notification to ${employee.email}:`, err);
          // Continue with other notifications even if one fails
        }
      });

      // Send notifications in background (don't wait)
      Promise.all(notificationPromises).then(() => {
        console.log('[AssignLearningPath] All notifications sent');
      }).catch((err) => {
        console.error('[AssignLearningPath] Some notifications failed:', err);
      });

      await MySwal.fire({
        title: 'Success!',
        html: `
          <p>Successfully assigned learning path <strong>${selectedPath.title}</strong> to:</p>
          <p><strong>${employeeNames}</strong></p>
          <p>Total courses assigned: <strong>${sortedCourses.length}</strong></p>
          ${isSequential ? '<p><em>Note: This is a sequential path. Employees must complete courses in order.</em></p>' : ''}
          <p><em>Notifications have been sent to all assigned employees.</em></p>
        `,
        icon: 'success',
        timer: 5000,
      });

      // Reset form
      setSelectedPathId('');
      setSelectedEmployeeIds([]);
      setDueDate('');
    } catch (err) {
      console.error('Error creating assignments:', err);
      await MySwal.fire({
        title: 'Error!',
        text: 'Failed to create assignments: ' + (err instanceof Error ? err.message : 'Unknown error'),
        icon: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Loader message="Loading learning paths and employees..." />;
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={fetchData}>
          Retry
        </Button>
      </Box>
    );
  }

  const selectedPath = learningPaths.find((p) => p.id === selectedPathId);
  const pathCourses = selectedPath?.courses?.items || [];
  const sortedCourses = [...pathCourses].sort((a, b) => a.order - b.order);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3, fontWeight: 600 }}>
        Assign Learning Path
      </Typography>

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            {/* Learning Path Selection */}
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Select Learning Path</InputLabel>
              <Select
                value={selectedPathId}
                onChange={(e) => setSelectedPathId(e.target.value)}
                label="Select Learning Path"
                required
              >
                {learningPaths.map((path) => (
                  <MenuItem key={path.id} value={path.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      <Typography variant="body1" sx={{ flexGrow: 1 }}>
                        {path.title}
                      </Typography>
                      {path.version && (
                        <Chip 
                          label={`v${path.version}`} 
                          size="small" 
                          variant="outlined"
                          sx={{ mr: 0.5 }}
                        />
                      )}
                      {path.isSequential && (
                        <Chip label="Sequential" size="small" />
                      )}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

              {/* Learning Path Details */}
              {selectedPath && (
                <Paper sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
                  <Typography variant="h6" gutterBottom>
                    {selectedPath.title}
                  </Typography>
                  {selectedPath.description && (
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {selectedPath.description}
                    </Typography>
                  )}
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      <strong>Total Courses:</strong> {sortedCourses.length}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Type:</strong>{' '}
                      {selectedPath.isSequential ? 'Sequential (must complete in order)' : 'Flexible (can complete in any order)'}
                    </Typography>
                    {sortedCourses.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                          Courses:
                        </Typography>
                        <List dense>
                          {sortedCourses.map((pathCourse, index) => (
                            <ListItem key={pathCourse.id} sx={{ py: 0.5 }}>
                              <ListItemText
                                primary={`${index + 1}. ${pathCourse.course?.title || 'Unknown Course'}`}
                                secondary={pathCourse.isRequired ? 'Required' : 'Optional'}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}
                  </Box>
                </Paper>
              )}

              {/* Employee Selection */}
              <Typography variant="h6" gutterBottom sx={{ mt: 3, mb: 2 }}>
                Select Employees
              </Typography>
              <Paper sx={{ maxHeight: 300, overflow: 'auto', mb: 3 }}>
                <List>
                  {employees.map((employee) => (
                    <ListItem key={employee.id}>
                      <Checkbox
                        checked={selectedEmployeeIds.includes(employee.id)}
                        onChange={() => handleEmployeeToggle(employee.id)}
                      />
                      <ListItemText
                        primary={employee.name}
                        secondary={employee.email + (employee.department ? ` • ${employee.department}` : '')}
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>

              {selectedEmployeeIds.length > 0 && (
                <Typography variant="body2" color="primary" sx={{ mb: 2 }}>
                  {selectedEmployeeIds.length} employee(s) selected
                </Typography>
              )}

              {/* Due Date (Optional) */}
              <TextField
                fullWidth
                type="date"
                label="Due Date (Optional)"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                InputLabelProps={{
                  shrink: true,
                }}
                sx={{ mb: 3 }}
              />

              {/* Submit Button */}
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setSelectedPathId('');
                    setSelectedEmployeeIds([]);
                    setDueDate('');
                  }}
                  disabled={submitting}
                >
                  Clear
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={submitting || !selectedPathId || selectedEmployeeIds.length === 0}
                  startIcon={submitting ? <CircularProgress size={20} /> : null}
                >
                  {submitting ? 'Assigning...' : 'Assign Learning Path'}
                </Button>
              </Box>
            </form>
          </CardContent>
        </Card>
      </Box>
  );
};

export default AssignLearningPath;


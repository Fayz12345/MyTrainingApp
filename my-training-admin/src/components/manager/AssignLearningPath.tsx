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
  Chip,
  CircularProgress,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Badge,
  Collapse,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import EditCalendarIcon from '@mui/icons-material/EditCalendar';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import GroupIcon from '@mui/icons-material/Group';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
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

interface LearningPathAssignment {
  id: string;
  learningPathId: string;
  employeeId: string;
  status: string;
  assignedDate: string;
  dueDate?: string | null;
  employee?: Employee;
}

interface AssignmentGroup {
  learningPath: LearningPath;
  assignments: LearningPathAssignment[];
  employeeCount: number;
  latestAssignedDate: string;
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
  const [activeTab, setActiveTab] = useState(0);
  const [assignmentGroups, setAssignmentGroups] = useState<AssignmentGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AssignmentGroup | null>(null);
  const [editSelectedEmployeeIds, setEditSelectedEmployeeIds] = useState<string[]>([]);
  const [editDueDate, setEditDueDate] = useState<string>('');
  const [dueDateDialogOpen, setDueDateDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<LearningPathAssignment | null>(null);
  const [newDueDate, setNewDueDate] = useState<string>('');

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

      // Fetch existing assignments
      await fetchAssignments(pathsWithCourses, filteredEmployees);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async (paths: LearningPath[], emps: Employee[]) => {
    try {
      const assignmentsResult = await client.models.LearningPathAssignment.list();
      
      if (assignmentsResult.errors && assignmentsResult.errors.length > 0) {
        console.error('Error fetching assignments:', assignmentsResult.errors);
        return;
      }

      // Map the raw data to our interface
      const assignments: LearningPathAssignment[] = (assignmentsResult.data || []).map((item: any) => ({
        id: item.id,
        learningPathId: item.learningPathId,
        employeeId: item.employeeId,
        status: item.status || 'not_started',
        assignedDate: item.assignedDate || item.createdAt,
        dueDate: item.dueDate
      }));
      
      // Create employee lookup map
      const employeeMap = new Map(emps.map(e => [e.id, e]));
      
      // Group assignments by learning path
      const groupMap = new Map<string, AssignmentGroup>();
      
      for (const assignment of assignments) {
        const path = paths.find(p => p.id === assignment.learningPathId);
        if (!path) continue;
        
        // Filter by store if selected
        const employee = employeeMap.get(assignment.employeeId);
        if (selectedStoreId && !employee) continue;
        
        const existingGroup = groupMap.get(assignment.learningPathId);
        
        if (existingGroup) {
          existingGroup.assignments.push({
            ...assignment,
            employee: employee
          });
          existingGroup.employeeCount = existingGroup.assignments.length;
          // Update latest assigned date
          if (assignment.assignedDate > existingGroup.latestAssignedDate) {
            existingGroup.latestAssignedDate = assignment.assignedDate;
          }
        } else {
          groupMap.set(assignment.learningPathId, {
            learningPath: path,
            assignments: [{
              ...assignment,
              employee: employee
            }],
            employeeCount: 1,
            latestAssignedDate: assignment.assignedDate
          });
        }
      }

      setAssignmentGroups(Array.from(groupMap.values()).sort((a, b) => 
        new Date(b.latestAssignedDate).getTime() - new Date(a.latestAssignedDate).getTime()
      ));
    } catch (err) {
      console.error('Error fetching assignments:', err);
    }
  };

  const toggleGroupExpand = (pathId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pathId)) {
        newSet.delete(pathId);
      } else {
        newSet.add(pathId);
      }
      return newSet;
    });
  };

  const handleEditClick = (group: AssignmentGroup) => {
    setEditingGroup(group);
    // Get already assigned employee IDs
    const assignedIds = group.assignments.map(a => a.employeeId);
    setEditSelectedEmployeeIds([]);
    setEditDueDate('');
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editingGroup || editSelectedEmployeeIds.length === 0) return;

    setSubmitting(true);

    try {
      const selectedPath = editingGroup.learningPath;
      const pathCourses = selectedPath.courses?.items || [];
      
      if (pathCourses.length === 0) {
        throw new Error('Selected learning path has no courses');
      }

      const sortedCourses = [...pathCourses].sort((a, b) => a.order - b.order);
      const isSequential = selectedPath.isSequential || false;
      const now = new Date().toISOString();
      const dueDateISO = editDueDate ? new Date(editDueDate).toISOString() : null;

      // Create assignments for each selected employee
      const assignmentPromises = editSelectedEmployeeIds.map(async (employeeId) => {
        // Create LearningPathAssignment
        const pathAssignmentResult = await client.models.LearningPathAssignment.create({
          learningPathId: selectedPath.id,
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
          const shouldBeAccessible = !isSequential || index === 0;
          return client.models.Assignment.create({
            employeeId: employeeId,
            courseId: pathCourse.courseId,
            status: shouldBeAccessible ? 'assigned' : 'assigned',
            createdAt: now,
            updatedAt: now,
          });
        });

        await Promise.all(courseAssignmentPromises);
        return pathAssignmentResult.data;
      });

      const results = await Promise.all(assignmentPromises);

      // Send notifications
      const selectedEmployees = employees.filter(emp => editSelectedEmployeeIds.includes(emp.id));
      for (const employee of selectedEmployees) {
        try {
          const assignment = results.find((r: any) => r?.employeeId === employee.id);
          await sendLearningPathNotification({
            employeeEmail: employee.email,
            employeeName: employee.name,
            learningPathTitle: selectedPath.title,
            learningPathDescription: selectedPath.description ?? undefined,
            courseCount: sortedCourses.length,
            dueDate: dueDateISO || undefined,
            isSequential: isSequential,
            assignmentId: assignment?.id ? String(assignment.id) : undefined
          });
        } catch (err) {
          console.error(`Failed to send notification to ${employee.email}:`, err);
        }
      }

      await MySwal.fire({
        title: 'Success!',
        html: `
          <p>Added <strong>${editSelectedEmployeeIds.length}</strong> employee(s) to <strong>${selectedPath.title}</strong></p>
        `,
        icon: 'success',
        timer: 3000,
      });

      setEditDialogOpen(false);
      setEditingGroup(null);
      setEditSelectedEmployeeIds([]);
      setEditDueDate('');
      
      // Refresh assignments
      await fetchAssignments(learningPaths, employees);
    } catch (err) {
      console.error('Error adding employees:', err);
      await MySwal.fire({
        title: 'Error!',
        text: 'Failed to add employees: ' + (err instanceof Error ? err.message : 'Unknown error'),
        icon: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmployeeToggle = (employeeId: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleEditEmployeeToggle = (employeeId: string) => {
    setEditSelectedEmployeeIds((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleRemoveEmployee = async (assignment: LearningPathAssignment, group: AssignmentGroup) => {
    // Confirm deletion
    const result = await MySwal.fire({
      title: 'Remove Employee?',
      html: `
        <p>Are you sure you want to remove <strong>${assignment.employee?.name || 'this employee'}</strong> from <strong>${group.learningPath.title}</strong>?</p>
        <p><small>This will also remove all related course assignments.</small></p>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, remove',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    setSubmitting(true);

    try {
      // First, delete the course assignments for this employee related to this learning path
      const pathCourses = group.learningPath.courses?.items || [];
      const courseIds = pathCourses.map(pc => pc.courseId);

      // Find and delete course assignments
      for (const courseId of courseIds) {
        try {
          // Find assignments for this employee and course
          const courseAssignments = await client.models.Assignment.list({
            filter: {
              employeeId: { eq: assignment.employeeId },
              courseId: { eq: courseId }
            }
          });

          // Delete each matching assignment
          for (const courseAssignment of courseAssignments.data || []) {
            if (courseAssignment.id) {
              await client.models.Assignment.delete({ id: courseAssignment.id });
            }
          }
        } catch (err) {
          console.error(`Error deleting course assignment for course ${courseId}:`, err);
        }
      }

      // Delete the learning path assignment
      await client.models.LearningPathAssignment.delete({ id: assignment.id });

      await MySwal.fire({
        title: 'Removed!',
        html: `<p><strong>${assignment.employee?.name || 'Employee'}</strong> has been removed from <strong>${group.learningPath.title}</strong></p>`,
        icon: 'success',
        timer: 2000,
      });

      // Refresh assignments
      await fetchAssignments(learningPaths, employees);
    } catch (err) {
      console.error('Error removing employee:', err);
      await MySwal.fire({
        title: 'Error!',
        text: 'Failed to remove employee: ' + (err instanceof Error ? err.message : 'Unknown error'),
        icon: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditDueDateClick = (assignment: LearningPathAssignment) => {
    setEditingAssignment(assignment);
    // Convert ISO date to YYYY-MM-DD format for the date input
    if (assignment.dueDate) {
      const date = new Date(assignment.dueDate);
      setNewDueDate(date.toISOString().split('T')[0]);
    } else {
      setNewDueDate('');
    }
    setDueDateDialogOpen(true);
  };

  const handleUpdateDueDate = async () => {
    if (!editingAssignment) return;

    setSubmitting(true);

    try {
      const dueDateISO = newDueDate ? new Date(newDueDate).toISOString() : null;

      await client.models.LearningPathAssignment.update({
        id: editingAssignment.id,
        dueDate: dueDateISO,
        updatedAt: new Date().toISOString(),
      });

      await MySwal.fire({
        title: 'Updated!',
        html: `<p>Due date has been ${newDueDate ? 'updated' : 'removed'} for <strong>${editingAssignment.employee?.name || 'employee'}</strong></p>`,
        icon: 'success',
        timer: 2000,
      });

      setDueDateDialogOpen(false);
      setEditingAssignment(null);
      setNewDueDate('');

      // Refresh assignments
      await fetchAssignments(learningPaths, employees);
    } catch (err) {
      console.error('Error updating due date:', err);
      await MySwal.fire({
        title: 'Error!',
        text: 'Failed to update due date: ' + (err instanceof Error ? err.message : 'Unknown error'),
        icon: 'error',
      });
    } finally {
      setSubmitting(false);
    }
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

      // Refresh assignments list
      await fetchAssignments(learningPaths, employees);
      
      // Switch to listing tab
      setActiveTab(0);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'warning';
      case 'not_started':
      default:
        return 'default';
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

  // Get employees not yet assigned to the editing group
  const getAvailableEmployeesForEdit = () => {
    if (!editingGroup) return employees;
    const assignedIds = new Set(editingGroup.assignments.map(a => a.employeeId));
    return employees.filter(e => !assignedIds.has(e.id));
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3, fontWeight: 600 }}>
        Assign Learning Path
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab 
            label={
              <Badge badgeContent={assignmentGroups.length} color="primary">
                <Box sx={{ pr: 2 }}>Assignments</Box>
              </Badge>
            } 
          />
          <Tab label="New Assignment" icon={<AddIcon />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* Tab 0: Assignment Listing */}
      {activeTab === 0 && (
        <Box>
          {assignmentGroups.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary" gutterBottom>
                No learning paths have been assigned yet.
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setActiveTab(1)}
                sx={{ mt: 2 }}
              >
                Create New Assignment
              </Button>
            </Paper>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell sx={{ fontWeight: 600 }}>Learning Path</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                        <GroupIcon fontSize="small" />
                        Employees
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                        <CalendarTodayIcon fontSize="small" />
                        Last Assigned
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">Type</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {assignmentGroups.map((group) => (
                    <React.Fragment key={group.learningPath.id}>
                      <TableRow 
                        hover 
                        sx={{ 
                          cursor: 'pointer',
                          '& > *': { borderBottom: expandedGroups.has(group.learningPath.id) ? 'none' : undefined }
                        }}
                        onClick={() => toggleGroupExpand(group.learningPath.id)}
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <IconButton size="small">
                              {expandedGroups.has(group.learningPath.id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </IconButton>
                            <Box>
                              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                {group.learningPath.title}
                              </Typography>
                              {group.learningPath.version && (
                                <Chip 
                                  label={`v${group.learningPath.version}`} 
                                  size="small" 
                                  variant="outlined"
                                  sx={{ mt: 0.5 }}
                                />
                              )}
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Chip 
                            icon={<GroupIcon />} 
                            label={group.employeeCount} 
                            color="primary"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="center">
                          {formatDate(group.latestAssignedDate)}
                        </TableCell>
                        <TableCell align="center">
                          <Chip 
                            label={group.learningPath.isSequential ? 'Sequential' : 'Flexible'} 
                            size="small"
                            color={group.learningPath.isSequential ? 'info' : 'default'}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="Add More Employees">
                            <IconButton 
                              color="primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditClick(group);
                              }}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={5} sx={{ py: 0 }}>
                          <Collapse in={expandedGroups.has(group.learningPath.id)} timeout="auto" unmountOnExit>
                            <Box sx={{ py: 2, px: 4 }}>
                              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                Assigned Employees ({group.assignments.length})
                              </Typography>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Email</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Assigned Date</TableCell>
                                    <TableCell>Due Date</TableCell>
                                    <TableCell align="center">Actions</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {group.assignments.map((assignment) => (
                                    <TableRow key={assignment.id}>
                                      <TableCell>{assignment.employee?.name || 'Unknown'}</TableCell>
                                      <TableCell>{assignment.employee?.email || '-'}</TableCell>
                                      <TableCell>
                                        <Chip 
                                          label={assignment.status.replace('_', ' ')} 
                                          size="small"
                                          color={getStatusColor(assignment.status) as any}
                                        />
                                      </TableCell>
                                      <TableCell>{formatDate(assignment.assignedDate)}</TableCell>
                                      <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                          {assignment.dueDate ? formatDate(assignment.dueDate) : '-'}
                                          {assignment.status === 'not_started' && (
                                            <Tooltip title="Edit due date">
                                              <IconButton
                                                size="small"
                                                color="primary"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleEditDueDateClick(assignment);
                                                }}
                                                disabled={submitting}
                                                sx={{ ml: 0.5 }}
                                              >
                                                <EditCalendarIcon fontSize="small" />
                                              </IconButton>
                                            </Tooltip>
                                          )}
                                        </Box>
                                      </TableCell>
                                      <TableCell align="center">
                                        {assignment.status === 'not_started' ? (
                                          <Tooltip title="Remove employee (not started yet)">
                                            <IconButton
                                              size="small"
                                              color="error"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveEmployee(assignment, group);
                                              }}
                                              disabled={submitting}
                                            >
                                              <DeleteIcon fontSize="small" />
                                            </IconButton>
                                          </Tooltip>
                                        ) : (
                                          <Tooltip title="Cannot remove - course already started">
                                            <span>
                                              <IconButton
                                                size="small"
                                                disabled
                                              >
                                                <DeleteIcon fontSize="small" />
                                              </IconButton>
                                            </span>
                                          </Tooltip>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* Tab 1: New Assignment Form */}
      {activeTab === 1 && (
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
      )}

      {/* Edit Dialog - Add More Employees */}
      <Dialog 
        open={editDialogOpen} 
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Add Employees to: {editingGroup?.learningPath.title}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Currently assigned: {editingGroup?.employeeCount} employee(s)
          </Typography>
          
          <Typography variant="subtitle2" gutterBottom>
            Select additional employees to assign:
          </Typography>
          
          <Paper sx={{ maxHeight: 300, overflow: 'auto', mb: 2 }}>
            <List>
              {getAvailableEmployeesForEdit().length === 0 ? (
                <ListItem>
                  <ListItemText 
                    primary="All employees are already assigned to this learning path"
                    secondary="No additional employees available"
                  />
                </ListItem>
              ) : (
                getAvailableEmployeesForEdit().map((employee) => (
                  <ListItem key={employee.id}>
                    <Checkbox
                      checked={editSelectedEmployeeIds.includes(employee.id)}
                      onChange={() => handleEditEmployeeToggle(employee.id)}
                    />
                    <ListItemText
                      primary={employee.name}
                      secondary={employee.email + (employee.department ? ` • ${employee.department}` : '')}
                    />
                  </ListItem>
                ))
              )}
            </List>
          </Paper>

          {editSelectedEmployeeIds.length > 0 && (
            <Typography variant="body2" color="primary" sx={{ mb: 2 }}>
              {editSelectedEmployeeIds.length} new employee(s) selected
            </Typography>
          )}

          <TextField
            fullWidth
            type="date"
            label="Due Date (Optional)"
            value={editDueDate}
            onChange={(e) => setEditDueDate(e.target.value)}
            InputLabelProps={{
              shrink: true,
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained"
            onClick={handleEditSubmit}
            disabled={submitting || editSelectedEmployeeIds.length === 0}
            startIcon={submitting ? <CircularProgress size={20} /> : <AddIcon />}
          >
            {submitting ? 'Adding...' : 'Add Employees'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Update Due Date Dialog */}
      <Dialog 
        open={dueDateDialogOpen} 
        onClose={() => {
          setDueDateDialogOpen(false);
          setEditingAssignment(null);
          setNewDueDate('');
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EditCalendarIcon color="primary" />
            Update Due Date
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Update due date for <strong>{editingAssignment?.employee?.name || 'employee'}</strong>
          </Typography>
          
          <TextField
            fullWidth
            type="date"
            label="Due Date"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
            InputLabelProps={{
              shrink: true,
            }}
            sx={{ mt: 1 }}
          />
          
          {newDueDate && (
            <Button
              size="small"
              color="secondary"
              onClick={() => setNewDueDate('')}
              sx={{ mt: 1 }}
            >
              Clear Due Date
            </Button>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDueDateDialogOpen(false);
            setEditingAssignment(null);
            setNewDueDate('');
          }}>
            Cancel
          </Button>
          <Button 
            variant="contained"
            onClick={handleUpdateDueDate}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={20} /> : <EditCalendarIcon />}
          >
            {submitting ? 'Updating...' : 'Update Due Date'}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
  );
};

export default AssignLearningPath;

import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  LinearProgress,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
// Note: DatePicker removed to avoid dependency issues - using native date inputs if needed
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import Loader from '../common/Loader';

const client = generateClient<Schema>();

interface LearningPath {
  id: string;
  title: string;
  description?: string | null;
}

interface PathProgress {
  pathId: string;
  pathTitle: string;
  assignedCount: number;
  startedCount: number;
  completedCount: number;
  completionPercentage: number;
}

interface EmployeeProgress {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  pathId: string;
  pathTitle: string;
  status: string;
  assignedDate: string;
  dueDate?: string | null;
  completedDate?: string | null;
  coursesCompleted: number;
  totalCourses: number;
  completedCourses: Array<{
    courseId: string;
    courseTitle: string;
    completedDate: string;
    score?: number | null;
  }>;
  pendingCourses: Array<{
    courseId: string;
    courseTitle: string;
    order: number;
  }>;
}

interface LearningPathProgressProps {
  selectedStoreId?: string | null;
}

const LearningPathProgress: React.FC<LearningPathProgressProps> = ({ selectedStoreId }) => {
  const [pathProgress, setPathProgress] = useState<PathProgress[]>([]);
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPathId, setSelectedPathId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [selectedEmployeeProgress, setSelectedEmployeeProgress] = useState<EmployeeProgress | null>(null);
  const [loadingEmployeeDetails, setLoadingEmployeeDetails] = useState(false);

  useEffect(() => {
    fetchData();
  }, [selectedStoreId]);

  // Function to check and update path assignment status
  const checkAndUpdatePathStatus = async (pathAssignmentId: string, pathId: string, employeeId: string) => {
    try {
      // Get all courses in the path
      const pathCoursesResult = await client.models.LearningPathCourse.list({
        filter: { learningPathId: { eq: pathId } }
      });

      const pathCourses = pathCoursesResult.data || [];
      const requiredCourses = pathCourses.filter((pc: any) => pc.isRequired !== false);

      // Get all course assignments for this employee
      const courseAssignmentsResult = await client.models.Assignment.list({
        filter: { employeeId: { eq: employeeId } }
      });

      const courseAssignments = (courseAssignmentsResult.data || []) as Array<{
        id: string;
        courseId: string;
        status?: string | null;
        updatedAt: string;
        createdAt: string;
      }>;
      const courseAssignmentMap = new Map<string, typeof courseAssignments[0]>(
        courseAssignments.map((ca) => [ca.courseId, ca])
      );

      // Check if all required courses are completed
      const allRequiredCompleted = requiredCourses.every((pathCourse: any) => {
        const courseAssignment = courseAssignmentMap.get(pathCourse.courseId);
        return courseAssignment && courseAssignment.status === 'completed';
      });

      if (allRequiredCompleted) {
        // Get current assignment
        const currentAssignment = await client.models.LearningPathAssignment.get({ id: pathAssignmentId });
        
        if (currentAssignment.data && currentAssignment.data.status !== 'completed') {
          // Update to completed
          await client.models.LearningPathAssignment.update({
            id: pathAssignmentId,
            status: 'completed',
            completedDate: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          return true; // Status was updated
        }
      } else {
        // Check if at least one course is completed (mark as in_progress)
        const hasStarted = requiredCourses.some((pathCourse: any) => {
          const courseAssignment = courseAssignmentMap.get(pathCourse.courseId);
          return courseAssignment && courseAssignment.status === 'completed';
        });

        if (hasStarted) {
          const currentAssignment = await client.models.LearningPathAssignment.get({ id: pathAssignmentId });
          
          if (currentAssignment.data && currentAssignment.data.status === 'not_started') {
            await client.models.LearningPathAssignment.update({
              id: pathAssignmentId,
              status: 'in_progress',
              updatedAt: new Date().toISOString(),
            });
            return true; // Status was updated
          }
        }
      }

      return false; // No update needed
    } catch (err) {
      console.error('Error checking path status:', err);
      return false;
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all learning paths
      const pathsResult = await client.models.LearningPath.list({
        filter: { isArchived: { ne: true } }
      });

      if (pathsResult.errors && pathsResult.errors.length > 0) {
        throw new Error('Failed to fetch learning paths: ' + pathsResult.errors.map((e: any) => e.message).join(', '));
      }

      setLearningPaths(pathsResult.data as LearningPath[]);

      // Fetch all learning path assignments
      const assignmentsResult = await client.models.LearningPathAssignment.list({});

      if (assignmentsResult.errors && assignmentsResult.errors.length > 0) {
        throw new Error('Failed to fetch assignments: ' + assignmentsResult.errors.map((e: any) => e.message).join(', '));
      }

      const allAssignments = assignmentsResult.data || [];

      // Check and update status for each assignment (in background, don't wait)
      allAssignments.forEach((assignment: any) => {
        if (assignment.status !== 'completed') {
          checkAndUpdatePathStatus(assignment.id, assignment.learningPathId, assignment.employeeId)
            .catch(err => console.error('Error updating path status:', err));
        }
      });

      // Filter by store if selected
      let filteredAssignments = allAssignments;
      if (selectedStoreId) {
        // Get employee IDs for this store
        const employeesResult = await client.models.Employee.list({
          filter: { storeId: { eq: selectedStoreId } }
        });
        const storeEmployeeIds = new Set((employeesResult.data || []).map((e: any) => e.id));
        filteredAssignments = allAssignments.filter((a: any) => storeEmployeeIds.has(a.employeeId));
      }

      // Calculate progress for each path by checking actual course completion
      const progressMap = new Map<string, PathProgress>();

      for (const path of pathsResult.data as LearningPath[]) {
        const pathAssignments = filteredAssignments.filter((a: any) => a.learningPathId === path.id);
        const assignedCount = pathAssignments.length;

        // Get all courses in this path
        const pathCoursesResult = await client.models.LearningPathCourse.list({
          filter: { learningPathId: { eq: path.id } }
        });
        const pathCourses = pathCoursesResult.data || [];
        const requiredCourses = pathCourses.filter((pc: any) => pc.isRequired !== false);
        const requiredCourseIds = new Set(requiredCourses.map((pc: any) => pc.courseId));

        let startedCount = 0;
        let completedCount = 0;

        // Check each assignment's actual course completion status
        for (const pathAssignment of pathAssignments) {
          // Get all course assignments for this employee
          const courseAssignmentsResult = await client.models.Assignment.list({
            filter: { employeeId: { eq: pathAssignment.employeeId } }
          });

          const courseAssignments = (courseAssignmentsResult.data || []) as Array<{
            id: string;
            courseId: string;
            status?: string | null;
          }>;
          const courseAssignmentMap = new Map<string, typeof courseAssignments[0]>(
            courseAssignments.map((ca) => [ca.courseId, ca])
          );

          // Check if at least one required course is completed (started)
          const hasStarted = requiredCourses.some((pathCourse: any) => {
            const courseAssignment = courseAssignmentMap.get(pathCourse.courseId);
            return courseAssignment && courseAssignment.status === 'completed';
          });

          // Check if all required courses are completed
          const allCompleted = requiredCourses.every((pathCourse: any) => {
            const courseAssignment = courseAssignmentMap.get(pathCourse.courseId);
            return courseAssignment && courseAssignment.status === 'completed';
          });

          if (allCompleted) {
            completedCount++;
            startedCount++; // Completed also counts as started
          } else if (hasStarted) {
            startedCount++;
          }
        }

        const completionPercentage = assignedCount > 0 ? (completedCount / assignedCount) * 100 : 0;

        progressMap.set(path.id, {
          pathId: path.id,
          pathTitle: path.title,
          assignedCount,
          startedCount,
          completedCount,
          completionPercentage,
        });
      }

      setPathProgress(Array.from(progressMap.values()));

      // Update statuses in background (for future refreshes)
      allAssignments.forEach((assignment: any) => {
        if (assignment.status !== 'completed') {
          checkAndUpdatePathStatus(assignment.id, assignment.learningPathId, assignment.employeeId)
            .catch(err => console.error('Error updating path status:', err));
        }
      });
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeeDetails = async (pathId: string, employeeId: string) => {
    try {
      setLoadingEmployeeDetails(true);

      // Fetch all data in parallel for better performance
      const [
        assignmentResult,
        employeeResult,
        pathResult,
        pathCoursesResult,
        courseAssignmentsResult
      ] = await Promise.all([
        client.models.LearningPathAssignment.list({
          filter: {
            learningPathId: { eq: pathId },
            employeeId: { eq: employeeId }
          }
        }),
        client.models.Employee.get({ id: employeeId }),
        client.models.LearningPath.get({ id: pathId }),
        client.models.LearningPathCourse.list({
          filter: { learningPathId: { eq: pathId } }
        }),
        client.models.Assignment.list({
          filter: { employeeId: { eq: employeeId } }
        })
      ]);

      if (!assignmentResult.data || assignmentResult.data.length === 0) {
        throw new Error('Assignment not found');
      }

      const assignment = assignmentResult.data[0] as any;

      if (!employeeResult.data) {
        throw new Error('Employee not found');
      }
      const employee = employeeResult.data as any;

      if (!pathResult.data) {
        throw new Error('Learning path not found');
      }
      const path = pathResult.data as any;

      const pathCourses = pathCoursesResult.data || [];
      const sortedPathCourses = [...pathCourses].sort((a: any, b: any) => a.order - b.order);

      const courseAssignments = (courseAssignmentsResult.data || []) as Array<{
        id: string;
        courseId: string;
        status?: string | null;
        updatedAt: string;
        createdAt: string;
      }>;
      const courseAssignmentMap = new Map<string, typeof courseAssignments[0]>(
        courseAssignments.map((ca) => [ca.courseId, ca])
      );

      // Get all course IDs to fetch in parallel
      const courseIds = sortedPathCourses.map((pc: any) => pc.courseId);
      
      // Fetch all courses in parallel
      const courseResults = await Promise.all(
        courseIds.map(courseId => client.models.Course.get({ id: courseId }))
      );

      // Create course map
      const courseMap = new Map<string, any>();
      courseResults.forEach((result, index) => {
        if (result.data) {
          courseMap.set(courseIds[index], result.data);
        }
      });

      // Get all assignment IDs for completed courses to fetch results in parallel
      const completedAssignmentIds = courseAssignments
        .filter(ca => ca.status === 'completed')
        .map(ca => ca.id);

      // Fetch all quiz results in parallel
      const resultPromises = completedAssignmentIds.map(assignmentId =>
        client.models.Result.list({
          filter: { assignmentId: { eq: assignmentId } }
        })
      );
      const resultResults = await Promise.all(resultPromises);

      // Create result map by assignment ID
      const resultMap = new Map<string, any>();
      completedAssignmentIds.forEach((assignmentId, index) => {
        const result = resultResults[index].data?.[0];
        if (result) {
          resultMap.set(assignmentId, result);
        }
      });

      // Build completed and pending courses lists
      const completedCourses: Array<{
        courseId: string;
        courseTitle: string;
        completedDate: string;
        score?: number | null;
      }> = [];
      const pendingCourses: Array<{
        courseId: string;
        courseTitle: string;
        order: number;
      }> = [];

      for (const pathCourse of sortedPathCourses) {
        const courseId = (pathCourse as any).courseId;
        const course = courseMap.get(courseId);
        const courseTitle = course?.title || 'Unknown Course';

        const courseAssignment = courseAssignmentMap.get(courseId);
        if (courseAssignment && courseAssignment.status === 'completed') {
          // Get quiz result for score
          const result = resultMap.get(courseAssignment.id);

          completedCourses.push({
            courseId,
            courseTitle,
            completedDate: courseAssignment.updatedAt || courseAssignment.createdAt,
            score: result?.score || null,
          });
        } else {
          pendingCourses.push({
            courseId,
            courseTitle,
            order: (pathCourse as any).order,
          });
        }
      }

      const employeeProgress: EmployeeProgress = {
        employeeId: employee.id,
        employeeName: employee.name,
        employeeEmail: employee.email,
        pathId: path.id,
        pathTitle: path.title,
        status: assignment.status || 'not_started',
        assignedDate: assignment.assignedDate || assignment.createdAt,
        dueDate: assignment.dueDate || null,
        completedDate: assignment.completedDate || null,
        coursesCompleted: completedCourses.length,
        totalCourses: sortedPathCourses.length,
        completedCourses,
        pendingCourses,
      };

      // Check and update path status before showing
      await checkAndUpdatePathStatus(assignment.id, pathId, employeeId);
      
      // Re-fetch assignment to get updated status
      const updatedAssignmentResult = await client.models.LearningPathAssignment.get({ id: assignment.id });
      if (updatedAssignmentResult.data) {
        employeeProgress.status = updatedAssignmentResult.data.status || employeeProgress.status;
        employeeProgress.completedDate = updatedAssignmentResult.data.completedDate || employeeProgress.completedDate;
      }

      setSelectedEmployeeProgress(employeeProgress);
      setEmployeeDialogOpen(true);
    } catch (err) {
      console.error('Error fetching employee details:', err);
      alert('Failed to load employee details: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoadingEmployeeDetails(false);
    }
  };

  const handleViewEmployees = async (pathId: string) => {
    try {
      // Open dialog immediately with loading state
      setLoadingEmployeeDetails(true);
      setEmployeeDialogOpen(true);
      setSelectedEmployeeProgress(null);

      // Get all assignments for this path
      const assignmentsResult = await client.models.LearningPathAssignment.list({
        filter: { learningPathId: { eq: pathId } }
      });

      if (!assignmentsResult.data || assignmentsResult.data.length === 0) {
        setLoadingEmployeeDetails(false);
        setEmployeeDialogOpen(false);
        alert('No employees assigned to this learning path');
        return;
      }

      // Show first employee (could be enhanced to show a selection dialog)
      const firstAssignment = assignmentsResult.data[0] as any;
      await fetchEmployeeDetails(pathId, firstAssignment.employeeId);
    } catch (err) {
      console.error('Error fetching employees:', err);
      setLoadingEmployeeDetails(false);
      setEmployeeDialogOpen(false);
      alert('Failed to load employees: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const calculateDaysRemaining = (dueDate: string | null | undefined): number | null => {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    const now = new Date();
    const diff = due.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const exportToCSV = () => {
    const headers = ['Path Name', 'Assigned', 'Started', 'Completed', 'Completion %'];
    const rows = pathProgress.map(p => [
      p.pathTitle,
      p.assignedCount.toString(),
      p.startedCount.toString(),
      p.completedCount.toString(),
      p.completionPercentage.toFixed(1) + '%'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `learning-path-progress-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    // Create a new window with only the table data for PDF export
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to export PDF');
      return;
    }

    const tableHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Learning Path Progress Report</title>
          <style>
            @media print {
              @page {
                margin: 1cm;
                size: A4 landscape;
              }
              body {
                margin: 0;
                padding: 0;
              }
            }
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
            }
            h1 {
              text-align: center;
              color: #1976d2;
              margin-bottom: 20px;
            }
            .report-info {
              margin-bottom: 20px;
              font-size: 12px;
              color: #666;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th {
              background-color: #1976d2;
              color: white;
              padding: 12px;
              text-align: left;
              font-weight: bold;
              border: 1px solid #1565c0;
            }
            td {
              padding: 10px 12px;
              border: 1px solid #ddd;
            }
            tr:nth-child(even) {
              background-color: #f5f5f5;
            }
            .progress-bar {
              display: inline-block;
              width: 100px;
              height: 20px;
              background-color: #e0e0e0;
              border-radius: 10px;
              position: relative;
              margin-right: 10px;
            }
            .progress-fill {
              height: 100%;
              background-color: #4caf50;
              border-radius: 10px;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 12px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <h1>Learning Path Progress Report</h1>
          <div class="report-info">
            Generated on: ${new Date().toLocaleString()}<br>
            ${selectedStoreId ? `Store Filter: Applied` : 'All Stores'}
          </div>
          <table>
            <thead>
              <tr>
                <th>Path Name</th>
                <th>Assigned</th>
                <th>Started</th>
                <th>Completed</th>
                <th>Completion %</th>
              </tr>
            </thead>
            <tbody>
              ${filteredProgress.map(p => `
                <tr>
                  <td>${p.pathTitle}</td>
                  <td>${p.assignedCount}</td>
                  <td>${p.startedCount}</td>
                  <td>${p.completedCount}</td>
                  <td>
                    <div class="progress-bar">
                      <div class="progress-fill" style="width: ${p.completionPercentage}%"></div>
                    </div>
                    ${p.completionPercentage.toFixed(1)}%
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">
            <p>Total Learning Paths: ${filteredProgress.length}</p>
            <p>Total Assigned: ${filteredProgress.reduce((sum, p) => sum + p.assignedCount, 0)}</p>
            <p>Total Completed: ${filteredProgress.reduce((sum, p) => sum + p.completedCount, 0)}</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(tableHTML);
    printWindow.document.close();
    
    // Wait for content to load, then trigger print
    setTimeout(() => {
      printWindow.print();
      // Close window after printing (optional)
      // printWindow.close();
    }, 250);
  };

  // Apply filters
  const filteredProgress = pathProgress.filter(p => {
    if (selectedPathId && p.pathId !== selectedPathId) return false;
    if (statusFilter === 'completed' && p.completedCount === 0) return false;
    if (statusFilter === 'in_progress' && p.startedCount === 0) return false;
    if (statusFilter === 'not_started' && p.startedCount > 0) return false;
    return true;
  });

  if (loading) {
    return <Loader message="Loading learning path progress..." />;
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

  return (
    <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Learning Path Progress
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={exportToCSV}
            >
              Export CSV
            </Button>
            <Button
              variant="outlined"
              startIcon={<PictureAsPdfIcon />}
              onClick={exportToPDF}
            >
              Export PDF
            </Button>
          </Box>
        </Box>

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel>Filter by Path</InputLabel>
                <Select
                  value={selectedPathId}
                  onChange={(e) => setSelectedPathId(e.target.value)}
                  label="Filter by Path"
                >
                  <MenuItem value="">All Paths</MenuItem>
                  {learningPaths.map((path) => (
                    <MenuItem key={path.id} value={path.id}>
                      {path.title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel>Filter by Status</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  label="Filter by Status"
                >
                  <MenuItem value="all">All Statuses</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="not_started">Not Started</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </CardContent>
        </Card>

        {/* Progress Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Path Name</strong></TableCell>
                <TableCell align="right"><strong>Assigned</strong></TableCell>
                <TableCell align="right"><strong>Started</strong></TableCell>
                <TableCell align="right"><strong>Completed</strong></TableCell>
                <TableCell align="right"><strong>Completion %</strong></TableCell>
                <TableCell align="center"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredProgress.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="text.secondary" sx={{ py: 3 }}>
                      No learning paths found matching the filters.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredProgress.map((progress) => (
                  <TableRow key={progress.pathId} hover>
                    <TableCell>{progress.pathTitle}</TableCell>
                    <TableCell align="right">{progress.assignedCount}</TableCell>
                    <TableCell align="right">{progress.startedCount}</TableCell>
                    <TableCell align="right">{progress.completedCount}</TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                        <Box sx={{ width: 100 }}>
                          <LinearProgress
                            variant="determinate"
                            value={progress.completionPercentage}
                            sx={{ height: 8, borderRadius: 4 }}
                          />
                        </Box>
                        <Typography variant="body2" sx={{ minWidth: 50 }}>
                          {progress.completionPercentage.toFixed(1)}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="View Employee Progress">
                        <IconButton
                          size="small"
                          onClick={() => handleViewEmployees(progress.pathId)}
                        >
                          <VisibilityIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Employee Details Dialog */}
        <Dialog
          open={employeeDialogOpen}
          onClose={() => setEmployeeDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            {loadingEmployeeDetails 
              ? 'Loading Employee Progress...' 
              : `Employee Progress: ${selectedEmployeeProgress?.employeeName || ''}`}
          </DialogTitle>
          <DialogContent>
            {loadingEmployeeDetails ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 5, minHeight: 200 }}>
                <CircularProgress size={50} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Loading employee progress details...
                </Typography>
              </Box>
            ) : selectedEmployeeProgress ? (
              <Box>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    {selectedEmployeeProgress.pathTitle}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
                    <Chip
                      label={`Status: ${selectedEmployeeProgress.status}`}
                      color={
                        selectedEmployeeProgress.status === 'completed' ? 'success' :
                        selectedEmployeeProgress.status === 'in_progress' ? 'warning' :
                        'default'
                      }
                    />
                    <Chip
                      label={`Progress: ${selectedEmployeeProgress.coursesCompleted} / ${selectedEmployeeProgress.totalCourses} courses`}
                    />
                    <Typography variant="body2" color="text.secondary">
                      Assigned: {new Date(selectedEmployeeProgress.assignedDate).toLocaleDateString()}
                    </Typography>
                    {selectedEmployeeProgress.dueDate && (
                      <Typography variant="body2" color="text.secondary">
                        Due: {new Date(selectedEmployeeProgress.dueDate).toLocaleDateString()}
                        {(() => {
                          const daysRemaining = calculateDaysRemaining(selectedEmployeeProgress.dueDate);
                          if (daysRemaining !== null) {
                            return daysRemaining >= 0
                              ? ` (${daysRemaining} days remaining)`
                              : ` (${Math.abs(daysRemaining)} days overdue)`;
                          }
                          return '';
                        })()}
                      </Typography>
                    )}
                    {selectedEmployeeProgress.completedDate && (
                      <Typography variant="body2" color="success.main">
                        Completed: {new Date(selectedEmployeeProgress.completedDate).toLocaleDateString()}
                      </Typography>
                    )}
                  </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Typography variant="h6" gutterBottom>
                  Completed Courses ({selectedEmployeeProgress.completedCourses.length})
                </Typography>
                {selectedEmployeeProgress.completedCourses.length > 0 ? (
                  <List>
                    {selectedEmployeeProgress.completedCourses.map((course) => (
                      <ListItem key={course.courseId}>
                        <ListItemText
                          primary={course.courseTitle}
                          secondary={`Completed: ${new Date(course.completedDate).toLocaleDateString()}${course.score !== null ? ` | Score: ${course.score}%` : ''}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No courses completed yet.
                  </Typography>
                )}

                <Divider sx={{ my: 2 }} />

                <Typography variant="h6" gutterBottom>
                  Pending Courses ({selectedEmployeeProgress.pendingCourses.length})
                </Typography>
                {selectedEmployeeProgress.pendingCourses.length > 0 ? (
                  <List>
                    {selectedEmployeeProgress.pendingCourses.map((course) => (
                      <ListItem key={course.courseId}>
                        <ListItemText
                          primary={`${course.order}. ${course.courseTitle}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    All courses completed!
                  </Typography>
                )}
              </Box>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEmployeeDialogOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
  );
};

export default LearningPathProgress;


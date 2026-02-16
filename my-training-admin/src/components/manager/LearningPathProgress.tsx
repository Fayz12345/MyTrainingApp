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
  Collapse,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import GroupIcon from '@mui/icons-material/Group';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import PendingIcon from '@mui/icons-material/Pending';
import Loader from '../common/Loader';

const client = generateClient<Schema>();

interface LearningPath {
  id: string;
  title: string;
  description?: string | null;
  version?: number | null;
  isSequential?: boolean | null;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  department?: string | null;
}

interface EmployeeAssignment {
  id: string;
  employeeId: string;
  employee?: Employee;
  status: string;
  assignedDate: string;
  dueDate?: string | null;
  completedDate?: string | null;
  coursesCompleted: number;
  totalCourses: number;
  progressPercentage: number;
}

interface PathProgressGroup {
  learningPath: LearningPath;
  courseCount: number;
  employeeAssignments: EmployeeAssignment[];
  assignedCount: number;
  startedCount: number;
  completedCount: number;
  completionPercentage: number;
}

interface EmployeeProgressDetail {
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
  const [pathProgressGroups, setPathProgressGroups] = useState<PathProgressGroup[]>([]);
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPathId, setSelectedPathId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [selectedEmployeeProgress, setSelectedEmployeeProgress] = useState<EmployeeProgressDetail | null>(null);
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

      // Get all course assignments for this employee (with pagination)
      let allCourseAssignments: Array<{
        id: string;
        courseId: string;
        status?: string | null;
        updatedAt: string;
        createdAt: string;
      }> = [];
      let nextToken: string | undefined = undefined;
      
      do {
        const courseAssignmentsResult: any = await client.models.Assignment.list({
          filter: { employeeId: { eq: employeeId } },
          nextToken: nextToken
        });
        
        if (courseAssignmentsResult.data) {
          allCourseAssignments = allCourseAssignments.concat(courseAssignmentsResult.data);
        }
        nextToken = courseAssignmentsResult.nextToken;
      } while (nextToken);

      const courseAssignmentMap = new Map<string, typeof allCourseAssignments[0]>(
        allCourseAssignments.map((ca) => [ca.courseId, ca])
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

      const paths = pathsResult.data as LearningPath[];
      setLearningPaths(paths);

      // Fetch all employees
      const employeesResult = await client.models.Employee.list({
        filter: { isActive: { eq: true } }
      });
      
      let filteredEmployees = employeesResult.data as Employee[];
      if (selectedStoreId) {
        filteredEmployees = filteredEmployees.filter((emp: any) => emp.storeId === selectedStoreId);
      }
      const employeeMap = new Map(filteredEmployees.map(e => [e.id, e]));
      const storeEmployeeIds = new Set(filteredEmployees.map(e => e.id));

      // Fetch all learning path assignments (with pagination)
      let allAssignments: any[] = [];
      let nextToken: string | undefined = undefined;
      
      do {
        const assignmentsResult: any = await client.models.LearningPathAssignment.list({
          nextToken: nextToken
        });

      if (assignmentsResult.errors && assignmentsResult.errors.length > 0) {
        throw new Error('Failed to fetch assignments: ' + assignmentsResult.errors.map((e: any) => e.message).join(', '));
      }

        if (assignmentsResult.data) {
          allAssignments = allAssignments.concat(assignmentsResult.data);
        }
        nextToken = assignmentsResult.nextToken;
      } while (nextToken);

      // Filter by store if selected
      const filteredAssignments = selectedStoreId 
        ? allAssignments.filter((a: any) => storeEmployeeIds.has(a.employeeId))
        : allAssignments;

      // Update statuses and wait for completion before proceeding
      const statusUpdatePromises = filteredAssignments
        .filter((assignment: any) => assignment.status !== 'completed')
        .map((assignment: any) => 
          checkAndUpdatePathStatus(assignment.id, assignment.learningPathId, assignment.employeeId)
            .catch(err => {
              console.error('Error updating path status:', err);
              return false;
            })
        );
      
      await Promise.all(statusUpdatePromises);
      
      // Re-fetch assignments after status updates to get fresh data
      allAssignments = [];
      nextToken = undefined;
      
      do {
        const assignmentsResult: any = await client.models.LearningPathAssignment.list({
          nextToken: nextToken
        });

        if (assignmentsResult.data) {
          allAssignments = allAssignments.concat(assignmentsResult.data);
        }
        nextToken = assignmentsResult.nextToken;
      } while (nextToken);

      // Re-filter by store if selected
      const updatedFilteredAssignments = selectedStoreId 
        ? allAssignments.filter((a: any) => storeEmployeeIds.has(a.employeeId))
        : allAssignments;

      // Build progress groups
      const progressGroups: PathProgressGroup[] = [];

      for (const path of paths) {
        const pathAssignments = updatedFilteredAssignments.filter((a: any) => a.learningPathId === path.id);

        if (pathAssignments.length === 0) continue; // Skip paths with no assignments

        // Get course count for this path
        const pathCoursesResult = await client.models.LearningPathCourse.list({
          filter: { learningPathId: { eq: path.id } }
        });
        const courseCount = (pathCoursesResult.data || []).length;
        const requiredCourses = (pathCoursesResult.data || []).filter((pc: any) => pc.isRequired !== false);

        // Build employee assignments with progress
        const employeeAssignments: EmployeeAssignment[] = [];
        let startedCount = 0;
        let completedCount = 0;

        for (const assignment of pathAssignments) {
          const employee = employeeMap.get(assignment.employeeId);
          
          // Get course assignments for this employee (with pagination)
          let allCourseAssignments: Array<{
            id: string;
            courseId: string;
            status?: string | null;
          }> = [];
          let courseNextToken: string | undefined = undefined;
          
          do {
            const courseAssignmentsResult: any = await client.models.Assignment.list({
              filter: { employeeId: { eq: assignment.employeeId } },
              nextToken: courseNextToken
            });
            
            if (courseAssignmentsResult.data) {
              allCourseAssignments = allCourseAssignments.concat(courseAssignmentsResult.data);
            }
            courseNextToken = courseAssignmentsResult.nextToken;
          } while (courseNextToken);
          
          const courseAssignmentMap = new Map<string, typeof allCourseAssignments[0]>(
            allCourseAssignments.map((ca) => [ca.courseId, ca])
          );

          // Calculate courses completed
          let coursesCompleted = 0;
          for (const pathCourse of requiredCourses) {
            const courseAssignment = courseAssignmentMap.get((pathCourse as any).courseId);
            if (courseAssignment && courseAssignment.status === 'completed') {
              coursesCompleted++;
            }
          }

          const totalCourses = requiredCourses.length;
          const progressPercentage = totalCourses > 0 ? (coursesCompleted / totalCourses) * 100 : 0;

          // Update counts
          if (progressPercentage === 100) {
            completedCount++;
            startedCount++;
          } else if (coursesCompleted > 0) {
            startedCount++;
          }

          employeeAssignments.push({
            id: String(assignment.id || ''),
            employeeId: String(assignment.employeeId || ''),
            employee: employee,
            status: String(assignment.status || 'not_started'),
            assignedDate: String(assignment.assignedDate || assignment.createdAt || new Date().toISOString()),
            dueDate: assignment.dueDate ? String(assignment.dueDate) : null,
            completedDate: assignment.completedDate ? String(assignment.completedDate) : null,
            coursesCompleted,
            totalCourses,
            progressPercentage,
          });
        }

        const assignedCount = employeeAssignments.length;
        const completionPercentage = assignedCount > 0 ? (completedCount / assignedCount) * 100 : 0;

        progressGroups.push({
          learningPath: path,
          courseCount,
          employeeAssignments,
          assignedCount,
          startedCount,
          completedCount,
          completionPercentage,
        });
      }

      // Sort by assigned count (most assigned first)
      progressGroups.sort((a, b) => b.assignedCount - a.assignedCount);

      setPathProgressGroups(progressGroups);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
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

  const fetchEmployeeDetails = async (pathId: string, employeeId: string) => {
    try {
      setLoadingEmployeeDetails(true);
      setEmployeeDialogOpen(true);

      // First, check and update path assignment status to ensure we have the latest status
      const pathAssignmentResult = await client.models.LearningPathAssignment.list({
        filter: {
          learningPathId: { eq: pathId },
          employeeId: { eq: employeeId }
        }
      });
      
      if (pathAssignmentResult.data && pathAssignmentResult.data.length > 0) {
        const pathAssignment = pathAssignmentResult.data[0];
        if (pathAssignment.status !== 'completed') {
          // Check and update status if needed
          await checkAndUpdatePathStatus(pathAssignment.id, pathId, employeeId);
        }
      }

      // Fetch all data in parallel
      const [
        assignmentResult,
        employeeResult,
        pathResult,
        pathCoursesResult,
        courseAssignmentsResult
      ] = await Promise.all([
        // Re-fetch assignment after status update to get fresh data
        (async () => {
          const result = await client.models.LearningPathAssignment.list({
          filter: {
            learningPathId: { eq: pathId },
            employeeId: { eq: employeeId }
          }
          });
          return result;
        })(),
        client.models.Employee.get({ id: employeeId }),
        client.models.LearningPath.get({ id: pathId }),
        client.models.LearningPathCourse.list({
          filter: { learningPathId: { eq: pathId } }
        }),
        // Fetch all course assignments with pagination
        (async () => {
          let allCourseAssignments: any[] = [];
          let nextToken: string | undefined = undefined;
          
          do {
            const result: any = await client.models.Assignment.list({
              filter: { employeeId: { eq: employeeId } },
              nextToken: nextToken
            });
            
            if (result.data) {
              allCourseAssignments = allCourseAssignments.concat(result.data);
            }
            nextToken = result.nextToken;
          } while (nextToken);
          
          return { data: allCourseAssignments };
        })()
      ]);

      if (!assignmentResult.data || assignmentResult.data.length === 0) {
        throw new Error('Assignment not found');
      }

      const assignment = assignmentResult.data[0] as any;
      const employee = employeeResult.data as any;
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

      // Get all course details
      const courseIds = sortedPathCourses.map((pc: any) => pc.courseId);
      const courseResults = await Promise.all(
        courseIds.map(courseId => client.models.Course.get({ id: courseId }))
      );

      const courseMap = new Map<string, any>();
      courseResults.forEach((result, index) => {
        if (result.data) {
          courseMap.set(courseIds[index], result.data);
        }
      });

      // Get quiz results for completed courses
      const completedAssignmentIds = courseAssignments
        .filter(ca => ca.status === 'completed')
        .map(ca => ca.id);

      const resultPromises = completedAssignmentIds.map(assignmentId =>
        client.models.Result.list({
          filter: { assignmentId: { eq: assignmentId } }
        })
      );
      const resultResults = await Promise.all(resultPromises);

      const resultMap = new Map<string, any>();
      completedAssignmentIds.forEach((assignmentId, index) => {
        const result = resultResults[index].data?.[0];
        if (result) {
          resultMap.set(assignmentId, result);
        }
      });

      // Build completed and pending courses lists
      const completedCourses: EmployeeProgressDetail['completedCourses'] = [];
      const pendingCourses: EmployeeProgressDetail['pendingCourses'] = [];

      for (const pathCourse of sortedPathCourses) {
        const courseId = (pathCourse as any).courseId;
        const course = courseMap.get(courseId);
        const courseTitle = course?.title || 'Unknown Course';

        const courseAssignment = courseAssignmentMap.get(courseId);
        if (courseAssignment && courseAssignment.status === 'completed') {
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

      const employeeProgress: EmployeeProgressDetail = {
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

      setSelectedEmployeeProgress(employeeProgress);
    } catch (err) {
      console.error('Error fetching employee details:', err);
      setEmployeeDialogOpen(false);
      alert('Failed to load employee details: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoadingEmployeeDetails(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon fontSize="small" color="success" />;
      case 'in_progress':
        return <HourglassEmptyIcon fontSize="small" color="warning" />;
      default:
        return <PendingIcon fontSize="small" color="disabled" />;
    }
  };

  const getStatusColor = (status: string): 'success' | 'warning' | 'default' => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'warning';
      default:
        return 'default';
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
    // Summary section headers
    const summaryHeaders = ['Learning Path', 'Version', 'Type', 'Courses', 'Assigned', 'Started', 'Completed', 'Completion %'];
    const summaryRows = filteredProgress.map(p => [
      `"${p.learningPath.title}"`,
      p.learningPath.version ? `v${p.learningPath.version}` : '-',
      p.learningPath.isSequential ? 'Sequential' : 'Flexible',
      p.courseCount.toString(),
      p.assignedCount.toString(),
      p.startedCount.toString(),
      p.completedCount.toString(),
      p.completionPercentage.toFixed(1) + '%'
    ]);

    // Detailed employee data headers
    const detailHeaders = ['Learning Path', 'Employee Name', 'Employee Email', 'Status', 'Progress', 'Courses Completed', 'Total Courses', 'Assigned Date', 'Due Date', 'Completed Date'];
    const detailRows: string[][] = [];

    filteredProgress.forEach(group => {
      group.employeeAssignments.forEach(emp => {
        detailRows.push([
          `"${group.learningPath.title}"`,
          `"${emp.employee?.name || 'Unknown'}"`,
          `"${emp.employee?.email || '-'}"`,
          emp.status.replace('_', ' '),
          emp.progressPercentage.toFixed(0) + '%',
          emp.coursesCompleted.toString(),
          emp.totalCourses.toString(),
          formatDate(emp.assignedDate),
          emp.dueDate ? formatDate(emp.dueDate) : '-',
          emp.completedDate ? formatDate(emp.completedDate) : '-'
        ]);
      });
    });

    const csvContent = [
      '=== LEARNING PATH PROGRESS SUMMARY ===',
      '',
      summaryHeaders.join(','),
      ...summaryRows.map(row => row.join(',')),
      '',
      '',
      '=== DETAILED EMPLOYEE PROGRESS ===',
      '',
      detailHeaders.join(','),
      ...detailRows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `learning-path-progress-detailed-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to export PDF');
      return;
    }

    // Generate detailed sections for each learning path
    const detailedSections = filteredProgress.map(group => `
      <div class="path-section">
        <h3 class="path-title">${group.learningPath.title} ${group.learningPath.version ? `(v${group.learningPath.version})` : ''}</h3>
        <div class="path-summary">
          <span class="badge">${group.learningPath.isSequential ? 'Sequential' : 'Flexible'}</span>
          <span>Courses: ${group.courseCount}</span>
          <span>Employees: ${group.assignedCount}</span>
          <span>Completed: ${group.completedCount}</span>
          <span>Progress: ${group.completionPercentage.toFixed(0)}%</span>
        </div>
        <table class="employee-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Email</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Assigned</th>
              <th>Due Date</th>
              <th>Completed</th>
            </tr>
          </thead>
          <tbody>
            ${group.employeeAssignments.map(emp => `
              <tr class="status-${emp.status}">
                <td>${emp.employee?.name || 'Unknown'}</td>
                <td>${emp.employee?.email || '-'}</td>
                <td>
                  <span class="status-badge status-${emp.status}">${emp.status.replace('_', ' ')}</span>
                </td>
                <td>
                  <div class="progress-container">
                    <div class="progress-bar-small">
                      <div class="progress-fill" style="width: ${emp.progressPercentage}%"></div>
                    </div>
                    <span>${emp.coursesCompleted}/${emp.totalCourses}</span>
                  </div>
                </td>
                <td>${formatDate(emp.assignedDate)}</td>
                <td>${emp.dueDate ? formatDate(emp.dueDate) : '-'}</td>
                <td>${emp.completedDate ? formatDate(emp.completedDate) : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `).join('');

    const tableHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Learning Path Progress Report - Detailed</title>
          <style>
            @media print {
              @page { margin: 1cm; size: A4 landscape; }
              body { margin: 0; padding: 0; }
              .path-section { page-break-inside: avoid; }
            }
            body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
            h1 { text-align: center; color: #1976d2; margin-bottom: 10px; }
            h2 { color: #1976d2; margin-top: 30px; border-bottom: 2px solid #1976d2; padding-bottom: 5px; }
            h3.path-title { color: #333; margin: 20px 0 10px 0; background: #f5f5f5; padding: 10px; border-left: 4px solid #1976d2; }
            .report-info { margin-bottom: 20px; font-size: 11px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; }
            th { background-color: #1976d2; color: white; padding: 8px; text-align: left; font-weight: bold; font-size: 11px; }
            td { padding: 6px 8px; border: 1px solid #ddd; font-size: 11px; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .summary-table th { background-color: #2196f3; }
            .employee-table th { background-color: #607d8b; }
            .progress-bar { display: inline-block; width: 80px; height: 16px; background-color: #e0e0e0; border-radius: 8px; margin-right: 8px; vertical-align: middle; }
            .progress-bar-small { display: inline-block; width: 50px; height: 10px; background-color: #e0e0e0; border-radius: 5px; margin-right: 5px; vertical-align: middle; }
            .progress-fill { height: 100%; background-color: #4caf50; border-radius: inherit; }
            .progress-container { display: flex; align-items: center; gap: 5px; }
            .path-summary { display: flex; gap: 15px; margin-bottom: 10px; font-size: 11px; color: #666; flex-wrap: wrap; }
            .path-section { margin-bottom: 30px; border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
            .badge { background: #1976d2; color: white; padding: 2px 8px; border-radius: 10px; font-size: 10px; }
            .status-badge { padding: 2px 8px; border-radius: 10px; font-size: 10px; text-transform: capitalize; }
            .status-badge.status-completed { background: #4caf50; color: white; }
            .status-badge.status-in_progress { background: #ff9800; color: white; }
            .status-badge.status-not_started { background: #9e9e9e; color: white; }
            .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #666; border-top: 1px solid #ddd; padding-top: 15px; }
            .totals { display: flex; justify-content: center; gap: 30px; margin-top: 10px; }
          </style>
        </head>
        <body>
          <h1>Learning Path Progress Report</h1>
          <div class="report-info">
            Generated on: ${new Date().toLocaleString()}<br>
            ${selectedStoreId ? 'Store Filter: Applied' : 'All Stores'}
          </div>
          
          <h2>Summary Overview</h2>
          <table class="summary-table">
            <thead>
              <tr>
                <th>Learning Path</th>
                <th>Version</th>
                <th>Type</th>
                <th>Courses</th>
                <th>Assigned</th>
                <th>Started</th>
                <th>Completed</th>
                <th>Completion %</th>
              </tr>
            </thead>
            <tbody>
              ${filteredProgress.map(p => `
                <tr>
                  <td><strong>${p.learningPath.title}</strong></td>
                  <td>${p.learningPath.version ? `v${p.learningPath.version}` : '-'}</td>
                  <td>${p.learningPath.isSequential ? 'Sequential' : 'Flexible'}</td>
                  <td>${p.courseCount}</td>
                  <td>${p.assignedCount}</td>
                  <td>${p.startedCount}</td>
                  <td>${p.completedCount}</td>
                  <td>
                    <div class="progress-bar">
                      <div class="progress-fill" style="width: ${p.completionPercentage}%"></div>
                    </div>
                    ${p.completionPercentage.toFixed(0)}%
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <h2>Detailed Employee Progress</h2>
          ${detailedSections}

          <div class="footer">
            <div class="totals">
              <span><strong>Total Learning Paths:</strong> ${filteredProgress.length}</span>
              <span><strong>Total Employees Assigned:</strong> ${filteredProgress.reduce((sum, p) => sum + p.assignedCount, 0)}</span>
              <span><strong>Total Completed:</strong> ${filteredProgress.reduce((sum, p) => sum + p.completedCount, 0)}</span>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(tableHTML);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 250);
  };

  // Apply filters
  const filteredProgress = pathProgressGroups.filter(p => {
    if (selectedPathId && p.learningPath.id !== selectedPathId) return false;
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
                <MenuItem value="completed">Has Completed</MenuItem>
                <MenuItem value="in_progress">Has In Progress</MenuItem>
                <MenuItem value="not_started">None Started</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </CardContent>
        </Card>

      {/* Progress Table with Expandable Rows */}
      {filteredProgress.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No learning paths with assignments found.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell sx={{ fontWeight: 600 }}>Learning Path</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Version</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Courses</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                    <GroupIcon fontSize="small" />
                    Employees
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Progress</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredProgress.map((group) => (
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
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {group.learningPath.title}
                    </Typography>
                      </Box>
                  </TableCell>
                    <TableCell align="center">
                      {group.learningPath.version ? (
                        <Chip label={`v${group.learningPath.version}`} size="small" variant="outlined" />
                      ) : '-'}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={group.learningPath.isSequential ? 'Sequential' : 'Flexible'}
                        size="small"
                        color={group.learningPath.isSequential ? 'info' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="center">{group.courseCount}</TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        <Chip icon={<GroupIcon />} label={group.assignedCount} color="primary" variant="outlined" />
                        <Typography variant="caption" color="text.secondary">
                          ({group.completedCount} done)
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        <Box sx={{ width: 80 }}>
                          <LinearProgress
                            variant="determinate"
                            value={group.completionPercentage}
                            sx={{ height: 8, borderRadius: 4 }}
                            color={group.completionPercentage === 100 ? 'success' : 'primary'}
                          />
                        </Box>
                        <Typography variant="body2" sx={{ minWidth: 45 }}>
                          {group.completionPercentage.toFixed(0)}%
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>

                  {/* Expanded Employee List */}
                  <TableRow>
                    <TableCell colSpan={6} sx={{ py: 0 }}>
                      <Collapse in={expandedGroups.has(group.learningPath.id)} timeout="auto" unmountOnExit>
                        <Box sx={{ py: 2, px: 4 }}>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Assigned Employees ({group.employeeAssignments.length})
                          </Typography>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Employee</TableCell>
                                <TableCell>Email</TableCell>
                                <TableCell align="center">Status</TableCell>
                                <TableCell align="center">Progress</TableCell>
                                <TableCell>Assigned</TableCell>
                                <TableCell>Due Date</TableCell>
                                <TableCell align="center">Details</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {group.employeeAssignments.map((empAssignment) => (
                                <TableRow key={empAssignment.id}>
                                  <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      {getStatusIcon(empAssignment.status)}
                                      <Typography variant="body2">
                                        {empAssignment.employee?.name || 'Unknown'}
                                      </Typography>
                                    </Box>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2" color="text.secondary">
                                      {empAssignment.employee?.email || '-'}
                                    </Typography>
                    </TableCell>
                    <TableCell align="center">
                                    <Chip
                                      label={empAssignment.status.replace('_', ' ')}
                                      size="small"
                                      color={getStatusColor(empAssignment.status)}
                                    />
                                  </TableCell>
                                  <TableCell align="center">
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Box sx={{ width: 60 }}>
                                        <LinearProgress
                                          variant="determinate"
                                          value={empAssignment.progressPercentage}
                                          sx={{ height: 6, borderRadius: 3 }}
                                          color={empAssignment.progressPercentage === 100 ? 'success' : 'primary'}
                                        />
                                      </Box>
                                      <Typography variant="caption">
                                        {empAssignment.coursesCompleted}/{empAssignment.totalCourses}
                                      </Typography>
                                    </Box>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2">
                                      {formatDate(empAssignment.assignedDate)}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    {empAssignment.dueDate ? (
                                      <Box>
                                        <Typography variant="body2">
                                          {formatDate(empAssignment.dueDate)}
                                        </Typography>
                                        {(() => {
                                          const days = calculateDaysRemaining(empAssignment.dueDate);
                                          if (days !== null && empAssignment.status !== 'completed') {
                                            return (
                                              <Typography
                                                variant="caption"
                                                color={days < 0 ? 'error' : days <= 3 ? 'warning.main' : 'text.secondary'}
                                              >
                                                {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                                              </Typography>
                                            );
                                          }
                                          return null;
                                        })()}
                                      </Box>
                                    ) : '-'}
                                  </TableCell>
                                  <TableCell align="center">
                                    <Tooltip title="View Details">
                        <IconButton
                          size="small"
                                        color="primary"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          fetchEmployeeDetails(group.learningPath.id, empAssignment.employeeId);
                                        }}
                        >
                                        <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
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
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2, alignItems: 'center' }}>
                    <Chip
                    label={`Status: ${selectedEmployeeProgress.status.replace('_', ' ')}`}
                    color={getStatusColor(selectedEmployeeProgress.status)}
                    />
                    <Chip
                      label={`Progress: ${selectedEmployeeProgress.coursesCompleted} / ${selectedEmployeeProgress.totalCourses} courses`}
                    />
                    <Typography variant="body2" color="text.secondary">
                    Assigned: {formatDate(selectedEmployeeProgress.assignedDate)}
                    </Typography>
                    {selectedEmployeeProgress.dueDate && (
                      <Typography variant="body2" color="text.secondary">
                      Due: {formatDate(selectedEmployeeProgress.dueDate)}
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
                      Completed: {formatDate(selectedEmployeeProgress.completedDate)}
                      </Typography>
                    )}
                  </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Typography variant="h6" gutterBottom>
                  Completed Courses ({selectedEmployeeProgress.completedCourses.length})
                </Typography>
                {selectedEmployeeProgress.completedCourses.length > 0 ? (
                <List dense>
                    {selectedEmployeeProgress.completedCourses.map((course) => (
                      <ListItem key={course.courseId}>
                        <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CheckCircleIcon color="success" fontSize="small" />
                            {course.courseTitle}
                          </Box>
                        }
                        secondary={`Completed: ${formatDate(course.completedDate)}${course.score !== null ? ` | Score: ${course.score}%` : ''}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                    No courses completed yet.
                  </Typography>
                )}

                <Divider sx={{ my: 2 }} />

                <Typography variant="h6" gutterBottom>
                  Pending Courses ({selectedEmployeeProgress.pendingCourses.length})
                </Typography>
                {selectedEmployeeProgress.pendingCourses.length > 0 ? (
                <List dense>
                    {selectedEmployeeProgress.pendingCourses.map((course) => (
                      <ListItem key={course.courseId}>
                        <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <PendingIcon color="disabled" fontSize="small" />
                            {`${course.order}. ${course.courseTitle}`}
                          </Box>
                        }
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                <Typography variant="body2" color="success.main" sx={{ ml: 2 }}>
                  All courses completed! 🎉
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

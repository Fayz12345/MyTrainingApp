import React, { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  useTheme,
  useMediaQuery,
  Collapse,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import EmployeeTrainingHistory from './EmployeeTrainingHistory';
// @ts-ignore - recharts types
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const client = generateClient<Schema>();

/** Recharts Tooltip formatter `value` is a wide union; normalize for safe math. */
function rechartsTooltipNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  department?: string | null;
  isActive?: boolean | null;
}

interface Assignment {
  id: string;
  employeeId: string;
  courseId: string;
  status: 'assigned' | 'completed' | null;
  isTrainingComplete: boolean;
  trainingCompletedAt?: string | null;
  assignmentSource?: string | null; // 'individual' or 'learning_path'
  learningPathId?: string | null;
  createdAt: string;
  updatedAt: string;
  course?: {
    id: string;
    title: string;
  } | null;
}

interface LearningPathAssignment {
  id: string;
  employeeId: string;
  learningPathId: string;
  status: string | null;
  assignedDate?: string | null;
  dueDate?: string | null;
  completedDate?: string | null;
  createdAt: string;
  updatedAt: string;
  learningPath?: {
    id: string;
    title: string;
  } | null;
}

interface Result {
  id: string;
  assignmentId: string;
  score: number;
  passed: boolean;
  createdAt: string;
}

interface EmployeeTrainingStatus {
  employee: Employee;
  assignments: Assignment[];
  learningPathAssignments: LearningPathAssignment[];
  allAssignments: Assignment[]; // All assignments including learning path ones
  results: Result[]; // Results for all assignments
  learningPathCourses: Map<string, { courseId: string; order: number; course?: { id: string; title: string } }[]>; // learningPathId -> courses
  assignedCount: number;
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  overallProgress: number;
  status: 'on_track' | 'in_progress' | 'overdue' | 'not_started';
  lastActivityDate?: string | null;
  // Separate counts for courses and learning paths
  courseAssignedCount: number;
  courseCompletedCount: number;
  courseInProgressCount: number;
  courseNotStartedCount: number;
  learningPathAssignedCount: number;
  learningPathCompletedCount: number;
  learningPathInProgressCount: number;
  learningPathNotStartedCount: number;
}

interface SummaryStats {
  totalEmployees: number;
  employeesWithAssignments: number;
  employeesStarted: number;
  employeesCompletedAll: number;
  employeesNotStarted: number;
  employeesOverdue: number;
}

interface TrainingStatusDashboardProps {
  selectedStoreId?: string | null;
}

const TrainingStatusDashboard: React.FC<TrainingStatusDashboardProps> = ({ selectedStoreId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<EmployeeTrainingStatus[]>([]);
  const [summaryStats, setSummaryStats] = useState<SummaryStats>({
    totalEmployees: 0,
    employeesWithAssignments: 0,
    employeesStarted: 0,
    employeesCompletedAll: 0,
    employeesNotStarted: 0,
    employeesOverdue: 0,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeTrainingStatus | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [showHistoryView, setShowHistoryView] = useState(false);
  const [selectedEmployeeForHistory, setSelectedEmployeeForHistory] = useState<{ id: string; name: string } | null>(null);
  const [expandedPathId, setExpandedPathId] = useState<string | null>(null);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

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

      // Fetch all independent data in parallel for maximum performance
      const [employeesData, coursesData, learningPathsData, allAssignmentsData, allPathAssignmentsData, resultsData, learningPathCoursesData] = await Promise.all([
        // Fetch employees with pagination
        fetchAllPages(
          (nextToken) => client.models.Employee.list({
            filter: { isActive: { eq: true } },
            nextToken,
          }),
          (e: any) => ({
            id: e.id!,
            name: e.name,
            email: e.email,
            department: e.department,
            isActive: e.isActive ?? true,
            storeId: e.storeId,
          })
        ),
        // Fetch courses with pagination
        fetchAllPages(
          (nextToken) => client.models.Course.list({
            nextToken,
          }),
          (c: any) => ({
            id: c.id!,
            title: c.title,
          })
        ),
        // Fetch learning paths with pagination
        fetchAllPages(
          (nextToken) => client.models.LearningPath.list({
            nextToken,
          }),
          (lp: any) => ({
            id: lp.id!,
            title: lp.title,
          })
        ),
        // Fetch all course assignments with pagination (both individual and learning_path)
        fetchAllPages(
          (nextToken) => client.models.Assignment.list({
            nextToken,
          }),
          (a: any) => ({
            id: a.id!,
            employeeId: a.employeeId,
            courseId: a.courseId,
            status: a.status,
            isTrainingComplete: a.isTrainingComplete ?? false,
            trainingCompletedAt: a.trainingCompletedAt,
            assignmentSource: a.assignmentSource || null, // Don't default to 'individual', keep null if not set
            learningPathId: a.learningPathId || null,
            createdAt: a.createdAt,
            updatedAt: a.updatedAt,
          })
        ),
        // Fetch all learning path assignments with pagination
        fetchAllPages(
          (nextToken) => client.models.LearningPathAssignment.list({
            nextToken,
          }),
          (p: any) => ({
            id: p.id!,
            employeeId: p.employeeId,
            learningPathId: p.learningPathId,
            status: p.status,
            assignedDate: p.assignedDate,
            dueDate: p.dueDate,
            completedDate: p.completedDate,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
          })
        ),
        // Fetch results for quiz scores and attempts
        fetchAllPages(
          (nextToken) => client.models.Result.list({
            nextToken,
          }),
          (r: any) => ({
            id: r.id!,
            assignmentId: r.assignmentId,
            score: r.score,
            passed: r.passed,
            createdAt: r.createdAt,
          })
        ),
        // Fetch learning path courses to know which courses belong to which learning path
        fetchAllPages(
          (nextToken) => client.models.LearningPathCourse.list({
            nextToken,
          }),
          (lpc: any) => ({
            id: lpc.id!,
            learningPathId: lpc.learningPathId,
            courseId: lpc.courseId,
            order: lpc.order || 0,
          })
        ),
      ]);

      // Create lookup maps for O(1) access
      const courseMap = new Map(coursesData.map((c: any) => [c.id, c]));
      const learningPathMap = new Map(learningPathsData.map((lp: any) => [lp.id, lp]));
      
      // Process learning path courses into a map: learningPathId -> courses[]
      const learningPathCoursesMap = new Map<string, { courseId: string; order: number; course?: { id: string; title: string } }[]>();
      learningPathCoursesData.forEach((lpc: any) => {
        if (!learningPathCoursesMap.has(lpc.learningPathId)) {
          learningPathCoursesMap.set(lpc.learningPathId, []);
        }
        const course = courseMap.get(lpc.courseId);
        learningPathCoursesMap.get(lpc.learningPathId)!.push({
          courseId: lpc.courseId,
          order: lpc.order,
          course: course ? { id: course.id, title: course.title } : undefined,
        });
      });
      
      // Sort courses by order within each learning path
      learningPathCoursesMap.forEach((courses, pathId) => {
        courses.sort((a, b) => a.order - b.order);
      });

      // Group assignments by employee ID - include ALL assignments regardless of status or source
      const assignmentsByEmployee = new Map<string, Assignment[]>();
      allAssignmentsData.forEach((a: any) => {
        if (!a.employeeId || !a.id) return;
        if (!assignmentsByEmployee.has(a.employeeId)) {
          assignmentsByEmployee.set(a.employeeId, []);
        }
        // Include all assignments - don't filter by status or source
        assignmentsByEmployee.get(a.employeeId)!.push({
          id: a.id,
          employeeId: a.employeeId,
          courseId: a.courseId,
          status: a.status,
          isTrainingComplete: a.isTrainingComplete ?? false,
          trainingCompletedAt: a.trainingCompletedAt,
          assignmentSource: a.assignmentSource || null, // Keep null if not set, don't default to 'individual'
          learningPathId: a.learningPathId || null,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
          course: a.courseId ? (courseMap.get(a.courseId) || null) : null,
        });
      });

      // Group path assignments by employee ID
      const pathAssignmentsByEmployee = new Map<string, LearningPathAssignment[]>();
      allPathAssignmentsData.forEach((p: any) => {
        if (!p.employeeId) return;
        if (!pathAssignmentsByEmployee.has(p.employeeId)) {
          pathAssignmentsByEmployee.set(p.employeeId, []);
        }
        pathAssignmentsByEmployee.get(p.employeeId)!.push({
          id: p.id,
          employeeId: p.employeeId,
          learningPathId: p.learningPathId,
          status: p.status,
          assignedDate: p.assignedDate,
          dueDate: p.dueDate,
          completedDate: p.completedDate,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          learningPath: p.learningPathId ? (learningPathMap.get(p.learningPathId) || null) : null,
        });
      });

      // Filter employees by store if selectedStoreId is provided
      let filteredEmployeesData = employeesData;
      if (selectedStoreId) {
        filteredEmployeesData = employeesData.filter((emp: any) => emp.storeId === selectedStoreId);
      }

      // Process each employee
      const employeeStatuses: EmployeeTrainingStatus[] = [];
      const now = new Date();

      for (const employee of filteredEmployeesData) {
        const allEmployeeAssignments = assignmentsByEmployee.get(employee.id) || [];
        // Separate individual assignments from learning path assignments
        const assignments = allEmployeeAssignments.filter(a => a.assignmentSource === 'individual' || !a.assignmentSource);
        const pathAssignments = pathAssignmentsByEmployee.get(employee.id) || [];
        
        // Get results for this employee's assignments
        const assignmentIds = new Set(allEmployeeAssignments.map(a => a.id));
        const employeeResults = resultsData.filter((r: any) => assignmentIds.has(r.assignmentId));

        // Calculate statistics - separate for courses and learning paths
        const totalAssignments = assignments.length;
        const totalPathAssignments = pathAssignments.length;
        const totalAssigned = totalAssignments + totalPathAssignments;

        // Course assignment statistics
        const completedAssignments = assignments.filter(
          (a) => a.status === 'completed' || a.isTrainingComplete
        ).length;
        const inProgressAssignments = assignments.filter(
          (a) => a.status === 'assigned' && !a.isTrainingComplete
        ).length;
        const courseNotStartedCount = totalAssignments - completedAssignments - inProgressAssignments;

        // Learning path assignment statistics - calculate based on actual course completions
        let completedPaths = 0;
        let inProgressPaths = 0;
        
        pathAssignments.forEach((pathAssignment) => {
          // Get all courses for this learning path
          const pathCourses = learningPathCoursesMap.get(pathAssignment.learningPathId) || [];
          
          if (pathCourses.length === 0) {
            // If no courses in path, use database status
            if (pathAssignment.status === 'completed') {
              completedPaths++;
            } else if (pathAssignment.status === 'in_progress') {
              inProgressPaths++;
            }
            return;
          }
          
          // Check if all courses in this learning path are completed
          const completedCourses = pathCourses.filter((pc) => {
            // Find the assignment for this course that belongs to this learning path
            const courseAssignment = allEmployeeAssignments.find((a) => 
              a.courseId === pc.courseId && 
              a.learningPathId === pathAssignment.learningPathId &&
              a.assignmentSource === 'learning_path'
            ) || allEmployeeAssignments.find((a) => a.courseId === pc.courseId);
            
            if (!courseAssignment) return false;
            
            // Check if course is completed - same logic as EmployeeTrainingHistory
            const hasCompletedDate = !!courseAssignment.trainingCompletedAt;
            const isMarkedComplete = courseAssignment.isTrainingComplete || courseAssignment.status === 'completed';
            
            return isMarkedComplete || hasCompletedDate;
          }).length;
          
          const allCoursesCompleted = completedCourses === pathCourses.length;
          const someCoursesCompleted = completedCourses > 0;
          
          if (allCoursesCompleted) {
            completedPaths++;
          } else if (someCoursesCompleted || pathAssignment.status === 'in_progress') {
            inProgressPaths++;
          }
        });
        
        const learningPathNotStartedCount = totalPathAssignments - completedPaths - inProgressPaths;

        // Combined counts (for overall progress calculation)
        const completedCount = completedAssignments + completedPaths;
        const inProgressCount = inProgressAssignments + inProgressPaths;
        const notStartedCount = totalAssigned - completedCount - inProgressCount;

        // Calculate overall progress percentage
        const overallProgress =
          totalAssigned > 0 ? Math.round((completedCount / totalAssigned) * 100) : 0;

        // Determine status
        let status: 'on_track' | 'in_progress' | 'overdue' | 'not_started' = 'not_started';
        if (totalAssigned === 0) {
          status = 'not_started';
        } else if (completedCount === totalAssigned) {
          status = 'on_track';
        } else {
          // Check for overdue
          const hasOverdue =
            pathAssignments.some(
              (p) =>
                p.dueDate &&
                new Date(p.dueDate) < now &&
                p.status !== 'completed'
            ) ||
            assignments.some(
              (a) =>
                a.status === 'assigned' &&
                !a.isTrainingComplete &&
                a.createdAt &&
                new Date(a.createdAt).getTime() < now.getTime() - 30 * 24 * 60 * 60 * 1000 // 30 days old
            );

          if (hasOverdue) {
            status = 'overdue';
          } else if (inProgressCount > 0 || completedCount > 0) {
            status = 'in_progress';
          }
        }

        // Find last activity date
        const allDates: string[] = [];
        assignments.forEach((a) => {
          if (a.trainingCompletedAt) allDates.push(a.trainingCompletedAt);
          if (a.updatedAt) allDates.push(a.updatedAt);
        });
        pathAssignments.forEach((p) => {
          if (p.completedDate) allDates.push(p.completedDate);
          if (p.updatedAt) allDates.push(p.updatedAt);
        });
        const lastActivityDate =
          allDates.length > 0
            ? allDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
            : null;

        employeeStatuses.push({
          employee: {
            id: employee.id,
            name: employee.name,
            email: employee.email,
            department: employee.department,
            isActive: employee.isActive,
          },
          assignments, // Only individual assignments
          learningPathAssignments: pathAssignments,
          allAssignments: allEmployeeAssignments, // All assignments including learning path ones
          results: employeeResults,
          learningPathCourses: learningPathCoursesMap,
          assignedCount: totalAssigned,
          completedCount,
          inProgressCount,
          notStartedCount,
          overallProgress,
          status,
          lastActivityDate,
          // Separate counts for courses
          courseAssignedCount: totalAssignments,
          courseCompletedCount: completedAssignments,
          courseInProgressCount: inProgressAssignments,
          courseNotStartedCount: courseNotStartedCount,
          // Separate counts for learning paths
          learningPathAssignedCount: totalPathAssignments,
          learningPathCompletedCount: completedPaths,
          learningPathInProgressCount: inProgressPaths,
          learningPathNotStartedCount: learningPathNotStartedCount,
        });
      }

      setEmployees(employeeStatuses);

      // Calculate summary statistics
      const stats: SummaryStats = {
        totalEmployees: filteredEmployeesData.length,
        employeesWithAssignments: employeeStatuses.filter((e) => e.assignedCount > 0).length,
        employeesStarted: employeeStatuses.filter(
          (e) => e.inProgressCount > 0 || e.completedCount > 0
        ).length,
        employeesCompletedAll: employeeStatuses.filter(
          (e) => e.assignedCount > 0 && e.completedCount === e.assignedCount
        ).length,
        employeesNotStarted: employeeStatuses.filter((e) => e.assignedCount === 0).length,
        employeesOverdue: employeeStatuses.filter((e) => e.status === 'overdue').length,
      };

      setSummaryStats(stats);
    } catch (err) {
      console.error('Error fetching training status:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch training status');
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchData]);

  // Get unique departments for filter
  const departments = Array.from(
    new Set(employees.map((e) => e.employee.department).filter((d): d is string => d !== null && d !== undefined))
  ).sort();

  // Filter employees
  const filteredEmployees = employees.filter((e) => {
    // Search filter
    if (
      searchQuery &&
      !e.employee.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !e.employee.email.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }

    // Department filter
    if (departmentFilter !== 'all' && e.employee.department !== departmentFilter) {
      return false;
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'completed' && e.status !== 'on_track') return false;
      if (statusFilter === 'in_progress' && e.status !== 'in_progress') return false;
      if (statusFilter === 'not_started' && e.status !== 'not_started') return false;
      if (statusFilter === 'overdue' && e.status !== 'overdue') return false;
    }

    return true;
  });

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case 'on_track':
        return <Chip label="On Track" color="success" size="small" />;
      case 'in_progress':
        return <Chip label="In Progress" color="warning" size="small" />;
      case 'overdue':
        return <Chip label="Overdue" color="error" size="small" />;
      case 'not_started':
        return <Chip label="Not Started" variant="outlined" size="small" />;
      default:
        return null;
    }
  };

  // Calculate status based on course assignments only
  const getCourseStatus = (employeeStatus: EmployeeTrainingStatus): 'on_track' | 'in_progress' | 'overdue' | 'not_started' => {
    const now = new Date();
    const { courseAssignedCount, courseCompletedCount, courseInProgressCount, assignments } = employeeStatus;
    
    if (courseAssignedCount === 0) {
      return 'not_started';
    }
    
    if (courseCompletedCount === courseAssignedCount) {
      return 'on_track';
    }
    
    // Check for overdue course assignments
    const hasOverdue = assignments.some(
      (a) =>
        a.status === 'assigned' &&
        !a.isTrainingComplete &&
        a.createdAt &&
        new Date(a.createdAt).getTime() < now.getTime() - 30 * 24 * 60 * 60 * 1000 // 30 days old
    );
    
    if (hasOverdue) {
      return 'overdue';
    }
    
    if (courseInProgressCount > 0 || courseCompletedCount > 0) {
      return 'in_progress';
    }
    
    return 'not_started';
  };

  // Calculate status based on learning path assignments only
  const getLearningPathStatus = (employeeStatus: EmployeeTrainingStatus): 'on_track' | 'in_progress' | 'overdue' | 'not_started' => {
    const now = new Date();
    const { learningPathAssignedCount, learningPathCompletedCount, learningPathInProgressCount, learningPathAssignments } = employeeStatus;
    
    if (learningPathAssignedCount === 0) {
      return 'not_started';
    }
    
    if (learningPathCompletedCount === learningPathAssignedCount) {
      return 'on_track';
    }
    
    // Check for overdue learning path assignments
    const hasOverdue = learningPathAssignments.some(
      (p) =>
        p.dueDate &&
        new Date(p.dueDate) < now &&
        p.status !== 'completed'
    );
    
    if (hasOverdue) {
      return 'overdue';
    }
    
    if (learningPathInProgressCount > 0 || learningPathCompletedCount > 0) {
      return 'in_progress';
    }
    
    return 'not_started';
  };

  const handleRowClick = (employee: EmployeeTrainingStatus) => {
    setSelectedEmployeeForHistory({ id: employee.employee.id, name: employee.employee.name });
    setShowHistoryView(true);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Never';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Invalid date';
    }
  };

  // Prepare chart data
  const statusDistributionData = [
    { name: 'On Track', value: employees.filter((e) => e.status === 'on_track').length, color: '#4caf50' },
    { name: 'In Progress', value: employees.filter((e) => e.status === 'in_progress').length, color: '#ff9800' },
    { name: 'Not Started', value: employees.filter((e) => e.status === 'not_started').length, color: '#9e9e9e' },
    { name: 'Overdue', value: employees.filter((e) => e.status === 'overdue').length, color: '#f44336' },
  ];

  const completionRateData = [
    { name: 'Completed All', value: summaryStats.employeesCompletedAll, color: '#4caf50' },
    { name: 'In Progress', value: summaryStats.employeesStarted - summaryStats.employeesCompletedAll, color: '#ff9800' },
    { name: 'Not Started', value: summaryStats.employeesNotStarted, color: '#9e9e9e' },
  ];

  // Department breakdown data
  const departmentData = departments.map((dept) => {
    const deptEmployees = employees.filter((e) => e.employee.department === dept);
    const total = deptEmployees.length;
    const completed = deptEmployees.filter((e) => e.status === 'on_track').length;
    const inProgress = deptEmployees.filter((e) => e.status === 'in_progress').length;
    const notStarted = deptEmployees.filter((e) => e.status === 'not_started').length;
    const overdue = deptEmployees.filter((e) => e.status === 'overdue').length;
    const avgProgress = total > 0 
      ? Math.round(deptEmployees.reduce((sum, e) => sum + e.overallProgress, 0) / total)
      : 0;

    return {
      department: dept || 'Unknown',
      total,
      completed,
      inProgress,
      notStarted,
      overdue,
      avgProgress,
    };
  });

  // Progress distribution data
  const progressRanges = [
    { range: '0%', count: employees.filter((e) => e.overallProgress === 0).length },
    { range: '1-25%', count: employees.filter((e) => e.overallProgress > 0 && e.overallProgress <= 25).length },
    { range: '26-50%', count: employees.filter((e) => e.overallProgress > 25 && e.overallProgress <= 50).length },
    { range: '51-75%', count: employees.filter((e) => e.overallProgress > 50 && e.overallProgress <= 75).length },
    { range: '76-99%', count: employees.filter((e) => e.overallProgress > 75 && e.overallProgress < 100).length },
    { range: '100%', count: employees.filter((e) => e.overallProgress === 100).length },
  ];

  const COLORS = ['#4caf50', '#ff9800', '#9e9e9e', '#f44336', '#2196f3', '#9c27b0'];

  const statusPieData = statusDistributionData.filter((d) => d.value > 0);
  const statusPieTotal = statusDistributionData.reduce((s, d) => s + d.value, 0);
  const completionPieData = completionRateData.filter((d) => d.value > 0);
  const completionPieTotal = completionRateData.reduce((s, d) => s + d.value, 0);

  if (showHistoryView && selectedEmployeeForHistory) {
    return (
      <EmployeeTrainingHistory
        employeeId={selectedEmployeeForHistory.id}
        employeeName={selectedEmployeeForHistory.name}
        onBack={() => {
          setShowHistoryView(false);
          setSelectedEmployeeForHistory(null);
        }}
      />
    );
  }

  if (loading && employees.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Typography variant="h4">Training Status Overview</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton onClick={() => fetchData()} color="primary" title="Refresh">
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Total Employees
              </Typography>
              <Typography variant="h4">{summaryStats.totalEmployees}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                With Assignments
              </Typography>
              <Typography variant="h4">{summaryStats.employeesWithAssignments}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Started
              </Typography>
              <Typography variant="h4" color="primary">
                {summaryStats.employeesStarted}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Completed All
              </Typography>
              <Typography variant="h4" color="success.main">
                {summaryStats.employeesCompletedAll}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Not Started
              </Typography>
              <Typography variant="h4" color="text.secondary">
                {summaryStats.employeesNotStarted}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Overdue
              </Typography>
              <Typography variant="h4" color="error">
                {summaryStats.employeesOverdue}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Section */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Status Distribution Pie Chart */}
        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Status Distribution
              </Typography>
              {statusPieData.length === 0 ? (
                <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
                  No employees in this view
                </Typography>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <Pie
                      data={statusPieData}
                      cx="50%"
                      cy="45%"
                      paddingAngle={2}
                      labelLine={false}
                      label={false}
                      innerRadius={48}
                      outerRadius={78}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => {
                        const n = rechartsTooltipNumber(value);
                        return [
                          `${n} (${statusPieTotal > 0 ? ((n / statusPieTotal) * 100).toFixed(0) : 0}%)`,
                          'Count',
                        ];
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      layout="vertical"
                      align="center"
                      wrapperStyle={{ paddingTop: 8, fontSize: 12, lineHeight: 1.5 }}
                      formatter={(value, entry: { payload?: { value?: number } }) => {
                        const v = entry.payload?.value ?? 0;
                        const pct =
                          statusPieTotal > 0 ? ((v / statusPieTotal) * 100).toFixed(0) : '0';
                        return `${value}: ${v} (${pct}%)`;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Completion Rate Pie Chart */}
        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Completion Overview
              </Typography>
              {completionPieData.length === 0 ? (
                <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
                  No employees in this view
                </Typography>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <Pie
                      data={completionPieData}
                      cx="50%"
                      cy="45%"
                      paddingAngle={2}
                      labelLine={false}
                      label={false}
                      innerRadius={48}
                      outerRadius={78}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {completionPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => {
                        const n = rechartsTooltipNumber(value);
                        return [
                          `${n} (${completionPieTotal > 0 ? ((n / completionPieTotal) * 100).toFixed(0) : 0}%)`,
                          'Count',
                        ];
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      layout="vertical"
                      align="center"
                      wrapperStyle={{ paddingTop: 8, fontSize: 12, lineHeight: 1.5 }}
                      formatter={(value, entry: { payload?: { value?: number } }) => {
                        const v = entry.payload?.value ?? 0;
                        const pct =
                          completionPieTotal > 0
                            ? ((v / completionPieTotal) * 100).toFixed(0)
                            : '0';
                        return `${value}: ${v} (${pct}%)`;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Progress Distribution Bar Chart */}
        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Progress Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={progressRanges}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2196f3" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Department Breakdown Bar Chart */}
        {departmentData.length > 0 && (
          <Grid item xs={12} lg={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Department Breakdown
                </Typography>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={departmentData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="department" 
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="completed" stackId="a" fill="#4caf50" name="Completed" />
                    <Bar dataKey="inProgress" stackId="a" fill="#ff9800" name="In Progress" />
                    <Bar dataKey="notStarted" stackId="a" fill="#9e9e9e" name="Not Started" />
                    <Bar dataKey="overdue" stackId="a" fill="#f44336" name="Overdue" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Average Progress by Department */}
        {departmentData.length > 0 && (
          <Grid item xs={12} lg={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Avg Progress by Department
                </Typography>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={departmentData} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis dataKey="department" type="category" width={100} />
                    <Tooltip />
                    <Bar dataKey="avgProgress" fill="#2196f3" name="Average Progress %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Department</InputLabel>
                <Select
                  value={departmentFilter}
                  label="Department"
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                >
                  <MenuItem value="all">All Departments</MenuItem>
                  {departments.map((dept) => (
                    <MenuItem key={dept || 'unknown'} value={dept || ''}>
                      {dept || 'Unknown'}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="all">All Statuses</MenuItem>
                  <MenuItem value="on_track">On Track</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="not_started">Not Started</MenuItem>
                  <MenuItem value="overdue">Overdue</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Course Assignments Table */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Course Assignments Status
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Employee Name</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell align="right">Assigned</TableCell>
                  <TableCell align="right">Completed</TableCell>
                  <TableCell align="right">In Progress</TableCell>
                  <TableCell align="right">Not Started</TableCell>
                  <TableCell align="right">Progress %</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Last Activity</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      <Typography color="textSecondary" sx={{ py: 3 }}>
                        No employees found matching the filters.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees
                    .filter(emp => emp.courseAssignedCount > 0) // Only show employees with course assignments
                    .map((employeeStatus) => {
                      const courseProgress = employeeStatus.courseAssignedCount > 0
                        ? Math.round((employeeStatus.courseCompletedCount / employeeStatus.courseAssignedCount) * 100)
                        : 0;
                      
                      return (
                        <TableRow
                          key={`course-${employeeStatus.employee.id}`}
                          hover
                          onClick={() => handleRowClick(employeeStatus)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell>
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {employeeStatus.employee.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {employeeStatus.employee.email}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>{employeeStatus.employee.department || 'N/A'}</TableCell>
                          <TableCell align="right">{employeeStatus.courseAssignedCount}</TableCell>
                          <TableCell align="right">{employeeStatus.courseCompletedCount}</TableCell>
                          <TableCell align="right">{employeeStatus.courseInProgressCount}</TableCell>
                          <TableCell align="right">{employeeStatus.courseNotStartedCount}</TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              color={
                                courseProgress === 100
                                  ? 'success.main'
                                  : courseProgress > 50
                                  ? 'warning.main'
                                  : 'text.secondary'
                              }
                            >
                              {courseProgress}%
                            </Typography>
                          </TableCell>
                          <TableCell>{getStatusIndicator(getCourseStatus(employeeStatus))}</TableCell>
                          <TableCell>{formatDate(employeeStatus.lastActivityDate)}</TableCell>
                        </TableRow>
                      );
                    })
                )}
                {filteredEmployees.filter(emp => emp.courseAssignedCount > 0).length === 0 && filteredEmployees.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      <Typography color="textSecondary" sx={{ py: 3 }}>
                        No employees with course assignments found.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Learning Path Assignments Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Learning Path Assignments Status
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Employee Name</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell align="right">Assigned</TableCell>
                  <TableCell align="right">Completed</TableCell>
                  <TableCell align="right">In Progress</TableCell>
                  <TableCell align="right">Not Started</TableCell>
                  <TableCell align="right">Progress %</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Last Activity</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      <Typography color="textSecondary" sx={{ py: 3 }}>
                        No employees found matching the filters.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees
                    .filter(emp => emp.learningPathAssignedCount > 0) // Only show employees with learning path assignments
                    .map((employeeStatus) => {
                      const learningPathProgress = employeeStatus.learningPathAssignedCount > 0
                        ? Math.round((employeeStatus.learningPathCompletedCount / employeeStatus.learningPathAssignedCount) * 100)
                        : 0;
                      
                      return (
                        <TableRow
                          key={`learningpath-${employeeStatus.employee.id}`}
                          hover
                          onClick={() => handleRowClick(employeeStatus)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell>
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {employeeStatus.employee.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {employeeStatus.employee.email}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>{employeeStatus.employee.department || 'N/A'}</TableCell>
                          <TableCell align="right">{employeeStatus.learningPathAssignedCount}</TableCell>
                          <TableCell align="right">{employeeStatus.learningPathCompletedCount}</TableCell>
                          <TableCell align="right">{employeeStatus.learningPathInProgressCount}</TableCell>
                          <TableCell align="right">{employeeStatus.learningPathNotStartedCount}</TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              color={
                                learningPathProgress === 100
                                  ? 'success.main'
                                  : learningPathProgress > 50
                                  ? 'warning.main'
                                  : 'text.secondary'
                              }
                            >
                              {learningPathProgress}%
                            </Typography>
                          </TableCell>
                          <TableCell>{getStatusIndicator(getLearningPathStatus(employeeStatus))}</TableCell>
                          <TableCell>{formatDate(employeeStatus.lastActivityDate)}</TableCell>
                        </TableRow>
                      );
                    })
                )}
                {filteredEmployees.filter(emp => emp.learningPathAssignedCount > 0).length === 0 && filteredEmployees.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      <Typography color="textSecondary" sx={{ py: 3 }}>
                        No employees with learning path assignments found.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Employee Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => {
          setDetailDialogOpen(false);
          setExpandedPathId(null);
        }}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          Training Details: {selectedEmployee?.employee.name}
        </DialogTitle>
        <DialogContent>
          {selectedEmployee && (
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>
                Employee Information
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Email: {selectedEmployee.employee.email}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Department: {selectedEmployee.employee.department || 'N/A'}
              </Typography>

              <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
                Course Assignments ({selectedEmployee.allAssignments.filter(a => a.courseId).length})
              </Typography>
              {selectedEmployee.allAssignments.filter(a => a.courseId).length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No course assignments
                </Typography>
              ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Source</TableCell>
                        <TableCell>Course Name</TableCell>
                        <TableCell>Assigned Date</TableCell>
                        <TableCell>Started Date</TableCell>
                        <TableCell>Completed Date</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Quiz Score</TableCell>
                        <TableCell>Attempts</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedEmployee.allAssignments
                        .filter((assignment) => assignment.courseId) // Only show assignments with a valid courseId
                        .map((assignment) => {
                          const isFromLearningPath = assignment.assignmentSource === 'learning_path' || (assignment.learningPathId !== null && assignment.learningPathId !== undefined);
                        const learningPath = isFromLearningPath && assignment.learningPathId
                          ? selectedEmployee.learningPathAssignments.find(lp => lp.learningPathId === assignment.learningPathId)?.learningPath
                          : null;
                        const assignmentResults = selectedEmployee.results.filter(r => r.assignmentId === assignment.id);
                        const latestResult = assignmentResults.length > 0
                          ? assignmentResults.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
                          : null;
                        const startedDate = assignmentResults.length > 0
                          ? assignmentResults.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0].createdAt
                          : null;
                        const status = assignment.isTrainingComplete ? 'Completed' : assignmentResults.length > 0 ? 'In Progress' : 'Not Started';
                        
                        return (
                          <TableRow key={assignment.id}>
                            <TableCell>
                              <Box>
                                <Chip
                                  label={isFromLearningPath ? 'Learning Path' : 'Individual'}
                                  size="small"
                                  color={isFromLearningPath ? 'secondary' : 'primary'}
                                  sx={{ mb: 0.5 }}
                                />
                                {isFromLearningPath && learningPath && (
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    {learningPath.title}
                                  </Typography>
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>
                              {assignment.course?.title || 'Unknown Course'}
                            </TableCell>
                            <TableCell>{formatDate(assignment.createdAt)}</TableCell>
                            <TableCell>{formatDate(startedDate)}</TableCell>
                            <TableCell>
                              {formatDate(assignment.trainingCompletedAt || (latestResult && assignment.isTrainingComplete ? latestResult.createdAt : null))}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={status}
                                size="small"
                                color={
                                  status === 'Completed' ? 'success' :
                                  status === 'In Progress' ? 'warning' : 'default'
                                }
                              />
                            </TableCell>
                            <TableCell>
                              {latestResult ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Typography variant="body2">
                                    {latestResult.score}%
                                  </Typography>
                                  {latestResult.passed ? (
                                    <CheckCircleIcon color="success" fontSize="small" />
                                  ) : (
                                    <CancelIcon color="error" fontSize="small" />
                                  )}
                                </Box>
                              ) : (
                                'N/A'
                              )}
                            </TableCell>
                            <TableCell>{assignmentResults.length}</TableCell>
                            <TableCell>
                              <IconButton size="small" title="View Details">
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
                Learning Path Assignments ({selectedEmployee.learningPathAssignments.length})
              </Typography>
              {selectedEmployee.learningPathAssignments.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No learning path assignments
                </Typography>
              ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell></TableCell>
                        <TableCell>Learning Path</TableCell>
                        <TableCell>Assigned Date</TableCell>
                        <TableCell>Due Date</TableCell>
                        <TableCell>Completed Date</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedEmployee.learningPathAssignments.map((pathAssignment) => {
                        const pathCourses = selectedEmployee.learningPathCourses.get(pathAssignment.learningPathId) || [];
                        const isExpanded = expandedPathId === pathAssignment.id;
                        const pathCourseAssignments = pathCourses.map((pc) => {
                          const assignment = selectedEmployee.allAssignments.find((a) => 
                            a.courseId === pc.courseId && a.learningPathId === pathAssignment.learningPathId
                          );
                          return { ...pc, assignment };
                        }).filter((pca) => pca.assignment);

                        return (
                          <React.Fragment key={pathAssignment.id}>
                            <TableRow>
                              <TableCell>
                                {pathCourseAssignments.length > 0 && (
                                  <IconButton
                                    size="small"
                                    onClick={() => setExpandedPathId(isExpanded ? null : pathAssignment.id)}
                                  >
                                    {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                  </IconButton>
                                )}
                              </TableCell>
                              <TableCell>
                                {pathAssignment.learningPath?.title || 'Unknown Path'}
                                {pathCourseAssignments.length > 0 && (
                                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                    ({pathCourseAssignments.length} courses)
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell>{formatDate(pathAssignment.assignedDate)}</TableCell>
                              <TableCell>
                                {pathAssignment.dueDate ? (
                                  <Typography
                                    color={
                                      pathAssignment.dueDate &&
                                      new Date(pathAssignment.dueDate) < new Date() &&
                                      pathAssignment.status !== 'completed'
                                        ? 'error'
                                        : 'text.primary'
                                    }
                                  >
                                    {formatDate(pathAssignment.dueDate)}
                                  </Typography>
                                ) : (
                                  'No due date'
                                )}
                              </TableCell>
                              <TableCell>{formatDate(pathAssignment.completedDate)}</TableCell>
                              <TableCell>
                                <Chip
                                  label={pathAssignment.status || 'Not Started'}
                                  size="small"
                                  color={
                                    pathAssignment.status === 'completed'
                                      ? 'success'
                                      : pathAssignment.status === 'in_progress'
                                      ? 'warning'
                                      : 'default'
                                  }
                                />
                              </TableCell>
                            </TableRow>
                            {isExpanded && pathCourseAssignments.length > 0 && (
                              <TableRow>
                                <TableCell colSpan={6} sx={{ py: 2, backgroundColor: 'grey.50' }}>
                                  <Typography variant="subtitle2" gutterBottom sx={{ mb: 1 }}>
                                    Courses in this Learning Path:
                                  </Typography>
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow>
                                        <TableCell>Course Name</TableCell>
                                        <TableCell>Assigned Date</TableCell>
                                        <TableCell>Started Date</TableCell>
                                        <TableCell>Completed Date</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Quiz Score</TableCell>
                                        <TableCell>Attempts</TableCell>
                                        <TableCell>Actions</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {pathCourseAssignments.map((pca) => {
                                        const assignment = pca.assignment!;
                                        const assignmentResults = selectedEmployee.results.filter(r => r.assignmentId === assignment.id);
                                        const latestResult = assignmentResults.length > 0
                                          ? assignmentResults.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
                                          : null;
                                        const startedDate = assignmentResults.length > 0
                                          ? assignmentResults.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0].createdAt
                                          : null;
                                        const status = assignment.isTrainingComplete ? 'Completed' : assignmentResults.length > 0 ? 'In Progress' : 'Not Started';

                                        return (
                                          <TableRow key={assignment.id}>
                                            <TableCell>{assignment.course?.title || pca.course?.title || 'Unknown Course'}</TableCell>
                                            <TableCell>{formatDate(assignment.createdAt)}</TableCell>
                                            <TableCell>{formatDate(startedDate)}</TableCell>
                                            <TableCell>
                                              {formatDate(assignment.trainingCompletedAt || (latestResult && assignment.isTrainingComplete ? latestResult.createdAt : null))}
                                            </TableCell>
                                            <TableCell>
                                              <Chip
                                                label={status}
                                                size="small"
                                                color={
                                                  status === 'Completed' ? 'success' :
                                                  status === 'In Progress' ? 'warning' : 'default'
                                                }
                                              />
                                            </TableCell>
                                            <TableCell>
                                              {latestResult ? (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                  <Typography variant="body2">
                                                    {latestResult.score}%
                                                  </Typography>
                                                  {latestResult.passed ? (
                                                    <CheckCircleIcon color="success" fontSize="small" />
                                                  ) : (
                                                    <CancelIcon color="error" fontSize="small" />
                                                  )}
                                                </Box>
                                              ) : (
                                                'N/A'
                                              )}
                                            </TableCell>
                                            <TableCell>{assignmentResults.length}</TableCell>
                                            <TableCell>
                                              <IconButton size="small" title="View Details">
                                                <VisibilityIcon fontSize="small" />
                                              </IconButton>
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TrainingStatusDashboard;


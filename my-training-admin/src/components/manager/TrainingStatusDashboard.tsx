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
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';
import EmployeeTrainingHistory from './EmployeeTrainingHistory';
// @ts-ignore - recharts types
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const client = generateClient<Schema>();

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

interface EmployeeTrainingStatus {
  employee: Employee;
  assignments: Assignment[];
  learningPathAssignments: LearningPathAssignment[];
  assignedCount: number;
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  overallProgress: number;
  status: 'on_track' | 'in_progress' | 'overdue' | 'not_started';
  lastActivityDate?: string | null;
}

interface SummaryStats {
  totalEmployees: number;
  employeesWithAssignments: number;
  employeesStarted: number;
  employeesCompletedAll: number;
  employeesNotStarted: number;
  employeesOverdue: number;
}

const TrainingStatusDashboard: React.FC = () => {
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
      const [employeesData, coursesData, learningPathsData, allAssignmentsData, allPathAssignmentsData] = await Promise.all([
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
        // Fetch all assignments with pagination
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
      ]);

      // Create lookup maps for O(1) access
      const courseMap = new Map(coursesData.map((c: any) => [c.id, c]));
      const learningPathMap = new Map(learningPathsData.map((lp: any) => [lp.id, lp]));

      // Group assignments by employee ID
      const assignmentsByEmployee = new Map<string, Assignment[]>();
      allAssignmentsData.forEach((a: any) => {
        if (!a.employeeId) return;
        if (!assignmentsByEmployee.has(a.employeeId)) {
          assignmentsByEmployee.set(a.employeeId, []);
        }
        assignmentsByEmployee.get(a.employeeId)!.push({
          id: a.id,
          employeeId: a.employeeId,
          courseId: a.courseId,
          status: a.status,
          isTrainingComplete: a.isTrainingComplete,
          trainingCompletedAt: a.trainingCompletedAt,
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

      // Process each employee
      const employeeStatuses: EmployeeTrainingStatus[] = [];
      const now = new Date();

      for (const employee of employeesData) {
        const assignments = assignmentsByEmployee.get(employee.id) || [];
        const pathAssignments = pathAssignmentsByEmployee.get(employee.id) || [];

        // Calculate statistics
        const totalAssignments = assignments.length;
        const totalPathAssignments = pathAssignments.length;
        const totalAssigned = totalAssignments + totalPathAssignments;

        const completedAssignments = assignments.filter(
          (a) => a.status === 'completed' || a.isTrainingComplete
        ).length;
        const completedPaths = pathAssignments.filter(
          (p) => p.status === 'completed'
        ).length;
        const completedCount = completedAssignments + completedPaths;

        const inProgressAssignments = assignments.filter(
          (a) => a.status === 'assigned' && !a.isTrainingComplete
        ).length;
        const inProgressPaths = pathAssignments.filter(
          (p) => p.status === 'in_progress'
        ).length;
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
          assignments,
          learningPathAssignments: pathAssignments,
          assignedCount: totalAssigned,
          completedCount,
          inProgressCount,
          notStartedCount,
          overallProgress,
          status,
          lastActivityDate,
        });
      }

      setEmployees(employeeStatuses);

      // Calculate summary statistics
      const stats: SummaryStats = {
        totalEmployees: employeesData.length,
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
  }, []);

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
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusDistributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(props: any) => {
                      const { name = '', percent = 0 } = props;
                      return `${name}: ${(percent * 100).toFixed(0)}%`;
                    }}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
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
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={completionRateData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(props: any) => {
                      const { name = '', value = 0, percent = 0 } = props;
                      return `${name}: ${value} (${(percent * 100).toFixed(0)}%)`;
                    }}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {completionRateData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
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

      {/* Employee Table */}
      <TableContainer component={Paper}>
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
              filteredEmployees.map((employeeStatus) => (
                <TableRow
                  key={employeeStatus.employee.id}
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
                  <TableCell align="right">{employeeStatus.assignedCount}</TableCell>
                  <TableCell align="right">{employeeStatus.completedCount}</TableCell>
                  <TableCell align="right">{employeeStatus.inProgressCount}</TableCell>
                  <TableCell align="right">{employeeStatus.notStartedCount}</TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      color={
                        employeeStatus.overallProgress === 100
                          ? 'success.main'
                          : employeeStatus.overallProgress > 50
                          ? 'warning.main'
                          : 'text.secondary'
                      }
                    >
                      {employeeStatus.overallProgress}%
                    </Typography>
                  </TableCell>
                  <TableCell>{getStatusIndicator(employeeStatus.status)}</TableCell>
                  <TableCell>{formatDate(employeeStatus.lastActivityDate)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Employee Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
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
                Course Assignments ({selectedEmployee.assignments.length})
              </Typography>
              {selectedEmployee.assignments.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No course assignments
                </Typography>
              ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Course</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Completed</TableCell>
                        <TableCell>Last Updated</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedEmployee.assignments.map((assignment) => (
                        <TableRow key={assignment.id}>
                          <TableCell>
                            {assignment.course?.title || 'Unknown Course'}
                          </TableCell>
                          <TableCell>
                            {assignment.status === 'completed' || assignment.isTrainingComplete
                              ? 'Completed'
                              : 'Assigned'}
                          </TableCell>
                          <TableCell>
                            {assignment.isTrainingComplete ? 'Yes' : 'No'}
                          </TableCell>
                          <TableCell>{formatDate(assignment.updatedAt)}</TableCell>
                        </TableRow>
                      ))}
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
                        <TableCell>Learning Path</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Assigned</TableCell>
                        <TableCell>Due Date</TableCell>
                        <TableCell>Completed</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedEmployee.learningPathAssignments.map((pathAssignment) => (
                        <TableRow key={pathAssignment.id}>
                          <TableCell>
                            {pathAssignment.learningPath?.title || 'Unknown Path'}
                          </TableCell>
                          <TableCell>
                            {pathAssignment.status || 'Not Started'}
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
                        </TableRow>
                      ))}
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


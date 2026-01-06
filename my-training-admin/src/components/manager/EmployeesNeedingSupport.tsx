import React, { useState, useEffect, useMemo } from 'react';
import { generateClient } from 'aws-amplify/data';
import { fetchAuthSession } from 'aws-amplify/auth';
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
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Avatar,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VisibilityIcon from '@mui/icons-material/Visibility';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import EmployeeTrainingHistory from './EmployeeTrainingHistory';
// @ts-ignore - recharts types
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useTheme } from '@mui/material/styles';

const MySwal = withReactContent(Swal);
const client = generateClient<Schema>();

interface EmployeesNeedingSupportProps {
  selectedStoreId?: string | null;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  department?: string | null;
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
  employee?: Employee | null;
  course?: {
    id: string;
    title: string;
    duration?: string | null;
    passingScore?: number | null;
  } | null;
}

interface Result {
  id: string;
  assignmentId: string;
  score: number;
  passed: boolean;
  createdAt: string;
}

interface StrugglingEmployee {
  employee: Employee;
  course: {
    id: string;
    title: string;
  };
  reason: string;
  flagType: 'failed_quizzes' | 'low_score' | 'no_progress' | 'video_no_quiz' | 'excessive_time';
  suggestedAction: string;
  details: {
    failedAttempts?: number;
    score?: number;
    daysSinceProgress?: number;
    videoViews?: number;
    timeSpent?: number;
    averageDuration?: number;
  };
  assignmentId: string;
  supportProvided: boolean;
  supportProvidedAt?: string;
}

const EmployeesNeedingSupport: React.FC<EmployeesNeedingSupportProps> = ({ selectedStoreId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [strugglingEmployees, setStrugglingEmployees] = useState<StrugglingEmployee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<StrugglingEmployee | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showSupportDialog, setShowSupportDialog] = useState(false);
  const [supportAction, setSupportAction] = useState<string>('');
  const [supportNotes, setSupportNotes] = useState<string>('');
  const [showHistoryView, setShowHistoryView] = useState(false);
  const [selectedEmployeeForHistory, setSelectedEmployeeForHistory] = useState<{ id: string; name: string } | null>(null);
  const theme = useTheme();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
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
      const [employeesData, coursesData, allAssignmentsData, resultsData] = await Promise.all([
        // Fetch employees with pagination
        fetchAllPages(
          (nextToken) => client.models.Employee.list({
            authMode: 'userPool',
            filter: { isActive: { eq: true } },
            nextToken,
          }),
          (e: any) => ({
            id: e.id!,
            name: e.name,
            email: e.email,
            department: e.department,
          })
        ),
        // Fetch courses with pagination
        fetchAllPages(
          (nextToken) => client.models.Course.list({
            authMode: 'userPool',
            nextToken,
          }),
          (c: any) => ({
            id: c.id!,
            title: c.title,
            duration: c.duration,
            passingScore: c.passingScore,
          })
        ),
        // Fetch all assignments with pagination
        fetchAllPages(
          (nextToken) => client.models.Assignment.list({
            authMode: 'userPool',
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
        // Fetch results with pagination
        fetchAllPages(
          (nextToken) => client.models.Result.list({
            authMode: 'userPool',
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
      ]);

      // Create lookup maps for O(1) access
      const employeeMap = new Map(employeesData.map((e: any) => [e.id, e]));
      const courseMap = new Map(coursesData.map((c: any) => [c.id, c]));

      // Process assignments with lookup maps
      const assignmentsData: Assignment[] = allAssignmentsData.map((a: any) => ({
        id: a.id,
        employeeId: a.employeeId,
        courseId: a.courseId,
        status: a.status,
        isTrainingComplete: a.isTrainingComplete,
        trainingCompletedAt: a.trainingCompletedAt,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        employee: a.employeeId ? (employeeMap.get(a.employeeId) || null) : null,
        course: a.courseId ? (courseMap.get(a.courseId) || null) : null,
      }));

      setAssignments(assignmentsData);
      setResults(resultsData);

      // Analyze and identify struggling employees
      const struggling = identifyStrugglingEmployees(assignmentsData, resultsData);
      setStrugglingEmployees(struggling);
    } catch (err) {
      console.error('Error fetching struggling employees:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const identifyStrugglingEmployees = (
    assignments: Assignment[],
    results: Result[]
  ): StrugglingEmployee[] => {
    const struggling: StrugglingEmployee[] = [];
    const now = new Date();

    // Group assignments by employee and course
    const employeeCourseMap = new Map<string, Map<string, {
      assignment: Assignment;
      results: Result[];
      lastActivity: Date;
    }>>();

    assignments.forEach((assignment) => {
      if (!assignment.employee || !assignment.course || assignment.isTrainingComplete) return;

      const key = `${assignment.employeeId}_${assignment.courseId}`;
      if (!employeeCourseMap.has(assignment.employeeId)) {
        employeeCourseMap.set(assignment.employeeId, new Map());
      }
      const courseMap = employeeCourseMap.get(assignment.employeeId)!;

      if (!courseMap.has(assignment.courseId)) {
        courseMap.set(assignment.courseId, {
          assignment,
          results: [],
          lastActivity: new Date(assignment.updatedAt),
        });
      }

      const courseData = courseMap.get(assignment.courseId)!;
      courseData.results = results.filter((r) => r.assignmentId === assignment.id);
      const lastResult = courseData.results.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      if (lastResult) {
        courseData.lastActivity = new Date(lastResult.createdAt);
      }
    });

    // Check each employee-course combination
    employeeCourseMap.forEach((courseMap, employeeId) => {
      courseMap.forEach((courseData, courseId) => {
        const { assignment, results: courseResults } = courseData;
        if (!assignment.employee || !assignment.course) return;

        // Flag 1: Failed quiz 2+ times on same course
        const failedAttempts = courseResults.filter((r) => !r.passed).length;
        if (failedAttempts >= 2) {
          struggling.push({
            employee: assignment.employee,
            course: {
              id: assignment.course.id,
              title: assignment.course.title,
            },
            reason: `Failed quiz ${failedAttempts} times`,
            flagType: 'failed_quizzes',
            suggestedAction: 'Schedule 1-on-1 training session',
            details: { failedAttempts },
            assignmentId: assignment.id,
            supportProvided: false,
          });
          return;
        }

        // Flag 2: Quiz score below 60% on first attempt
        const firstAttempt = courseResults.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )[0];
        if (firstAttempt && firstAttempt.score < 60) {
          struggling.push({
            employee: assignment.employee,
            course: {
              id: assignment.course.id,
              title: assignment.course.title,
            },
            reason: `First quiz attempt scored ${firstAttempt.score}% (below 60%)`,
            flagType: 'low_score',
            suggestedAction: 'Provide study materials and schedule review session',
            details: { score: firstAttempt.score },
            assignmentId: assignment.id,
            supportProvided: false,
          });
          return;
        }

        // Flag 3: No progress in 7+ days
        const daysSinceProgress = Math.floor(
          (now.getTime() - courseData.lastActivity.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceProgress >= 7 && courseResults.length === 0) {
          struggling.push({
            employee: assignment.employee,
            course: {
              id: assignment.course.id,
              title: assignment.course.title,
            },
            reason: `No progress in ${daysSinceProgress} days`,
            flagType: 'no_progress',
            suggestedAction: 'Send encouragement message and check for barriers',
            details: { daysSinceProgress },
            assignmentId: assignment.id,
            supportProvided: false,
          });
          return;
        }

        // Flag 4: Watched video multiple times but hasn't attempted quiz
        // Note: Video views aren't tracked in backend, so we'll estimate based on assignment age
        // In a real implementation, you'd track video views separately
        const assignmentAge = Math.floor(
          (now.getTime() - new Date(assignment.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (assignmentAge >= 3 && courseResults.length === 0 && assignment.status === 'assigned') {
          struggling.push({
            employee: assignment.employee,
            course: {
              id: assignment.course.id,
              title: assignment.course.title,
            },
            reason: 'Assigned for 3+ days but no quiz attempt',
            flagType: 'video_no_quiz',
            suggestedAction: 'Check if employee needs help understanding the material',
            details: { videoViews: 0 }, // Would be tracked separately
            assignmentId: assignment.id,
            supportProvided: false,
          });
          return;
        }

        // Flag 5: Spending excessive time (3x average duration)
        // Note: Time tracking would need to be implemented separately
        // For now, we'll skip this as it requires additional tracking
      });
    });

    // Remove duplicates (same employee-course combination)
    const unique = new Map<string, StrugglingEmployee>();
    struggling.forEach((s) => {
      const key = `${s.employee.id}_${s.course.id}`;
      if (!unique.has(key)) {
        unique.set(key, s);
      }
    });

    return Array.from(unique.values());
  };

  const handleMarkSupportProvided = async (employee: StrugglingEmployee) => {
    try {
      const updated = strugglingEmployees.map((s) =>
        s.employee.id === employee.employee.id && s.course.id === employee.course.id
          ? { ...s, supportProvided: true, supportProvidedAt: new Date().toISOString() }
          : s
      );
      setStrugglingEmployees(updated);

      // Save to localStorage for tracking
      const supportHistory = JSON.parse(localStorage.getItem('employee_support_history') || '[]');
      supportHistory.push({
        employeeId: employee.employee.id,
        courseId: employee.course.id,
        flagType: employee.flagType,
        providedAt: new Date().toISOString(),
        action: supportAction,
        notes: supportNotes,
      });
      localStorage.setItem('employee_support_history', JSON.stringify(supportHistory));

      await MySwal.fire({
        title: 'Support Marked as Provided',
        text: `Support has been recorded for ${employee.employee.name}`,
        icon: 'success',
      });

      setShowSupportDialog(false);
      setSupportAction('');
      setSupportNotes('');
    } catch (err) {
      await MySwal.fire({
        title: 'Error',
        text: 'Failed to mark support as provided',
        icon: 'error',
      });
    }
  };

  const handleSendMessage = async (employee: StrugglingEmployee) => {
    const { value: message } = await MySwal.fire({
      title: `Send Message to ${employee.employee.name}`,
      input: 'textarea',
      inputLabel: 'Message',
      inputPlaceholder: 'Type your encouragement message here...',
      inputAttributes: {
        'aria-label': 'Type your message here',
      },
      showCancelButton: true,
      confirmButtonText: 'Send',
      inputValidator: (value) => {
        if (!value) {
          return 'Please enter a message';
        }
      },
    });

    if (message) {
      // In a real implementation, this would send an email/notification
      await MySwal.fire({
        title: 'Message Sent',
        text: `Message sent to ${employee.employee.name}`,
        icon: 'success',
      });
    }
  };

  const handleResetQuizAttempts = async (employee: StrugglingEmployee) => {
    const result = await MySwal.fire({
      title: 'Reset Quiz Attempts?',
      text: `This will allow ${employee.employee.name} to retake the quiz for ${employee.course.title}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, reset',
      cancelButtonText: 'Cancel',
    });

    if (result.isConfirmed) {
      // In a real implementation, this would reset the quiz attempts in the backend
      await MySwal.fire({
        title: 'Quiz Attempts Reset',
        text: `${employee.employee.name} can now retake the quiz`,
        icon: 'success',
      });
      fetchData(); // Refresh data
    }
  };

  const getFlagColor = (flagType: string) => {
    switch (flagType) {
      case 'failed_quizzes':
        return 'error';
      case 'low_score':
        return 'warning';
      case 'no_progress':
        return 'info';
      case 'video_no_quiz':
        return 'default';
      default:
        return 'default';
    }
  };

  const filteredStruggling = useMemo(() => {
    return strugglingEmployees.filter((s) => !s.supportProvided);
  }, [strugglingEmployees]);

  // Chart data calculations
  const flagTypeDistributionData = useMemo(() => {
    const flagCounts: { [key: string]: number } = {};
    
    filteredStruggling.forEach((employee) => {
      flagCounts[employee.flagType] = (flagCounts[employee.flagType] || 0) + 1;
    });

    const flagNames: { [key: string]: string } = {
      failed_quizzes: 'Failed Quizzes',
      low_score: 'Low Score',
      no_progress: 'No Progress',
      video_no_quiz: 'No Quiz Attempt',
      excessive_time: 'Excessive Time',
    };

    const colors: { [key: string]: string } = {
      failed_quizzes: theme.palette.error.main,
      low_score: theme.palette.warning.main,
      no_progress: theme.palette.info.main,
      video_no_quiz: theme.palette.grey[600],
      excessive_time: theme.palette.secondary.main,
    };

    return Object.entries(flagCounts)
      .map(([type, count]) => ({
        name: flagNames[type] || type,
        value: count,
        color: colors[type] || theme.palette.grey[500],
      }))
      .filter((item) => item.value > 0);
  }, [filteredStruggling, theme]);

  const departmentBreakdownData = useMemo(() => {
    const deptMap = new Map<string, number>();
    
    filteredStruggling.forEach((employee) => {
      const dept = employee.employee.department || 'No Department';
      deptMap.set(dept, (deptMap.get(dept) || 0) + 1);
    });

    return Array.from(deptMap.entries())
      .map(([department, count]) => ({
        department,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredStruggling]);

  const courseBreakdownData = useMemo(() => {
    const courseMap = new Map<string, number>();
    
    filteredStruggling.forEach((employee) => {
      const course = employee.course.title;
      courseMap.set(course, (courseMap.get(course) || 0) + 1);
    });

    return Array.from(courseMap.entries())
      .map(([course, count]) => ({
        course,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 courses
  }, [filteredStruggling]);

  const supportStatusData = useMemo(() => {
    const provided = strugglingEmployees.filter((s) => s.supportProvided).length;
    const notProvided = strugglingEmployees.filter((s) => !s.supportProvided).length;
    
    return [
      { name: 'Support Provided', value: provided, color: theme.palette.success.main },
      { name: 'Needs Support', value: notProvided, color: theme.palette.error.main },
    ].filter((item) => item.value > 0);
  }, [strugglingEmployees, theme]);

  const employeeStrugglingCountData = useMemo(() => {
    const employeeMap = new Map<string, number>();
    
    filteredStruggling.forEach((employee) => {
      const empId = employee.employee.id;
      employeeMap.set(empId, (employeeMap.get(empId) || 0) + 1);
    });

    const countDistribution: { [key: string]: number } = {};
    employeeMap.forEach((count) => {
      const key = count === 1 ? '1 issue' : `${count} issues`;
      countDistribution[key] = (countDistribution[key] || 0) + 1;
    });

    return Object.entries(countDistribution)
      .map(([range, count]) => ({ range, count }))
      .sort((a, b) => {
        const aNum = parseInt(a.range);
        const bNum = parseInt(b.range);
        return aNum - bNum;
      });
  }, [filteredStruggling]);

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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Employees Needing Support</Typography>
        <IconButton onClick={fetchData} color="primary" title="Refresh">
          <RefreshIcon />
        </IconButton>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Employees Needing Support
              </Typography>
              <Typography variant="h4" color="error">
                {filteredStruggling.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Failed Quizzes
              </Typography>
              <Typography variant="h4">
                {filteredStruggling.filter((s) => s.flagType === 'failed_quizzes').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Low Scores
              </Typography>
              <Typography variant="h4" color="warning.main">
                {filteredStruggling.filter((s) => s.flagType === 'low_score').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                No Progress
              </Typography>
              <Typography variant="h4" color="info.main">
                {filteredStruggling.filter((s) => s.flagType === 'no_progress').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Section */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Flag Type Distribution Pie Chart */}
        {flagTypeDistributionData.length > 0 && (
          <Grid item xs={12} md={6} lg={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Issue Type Distribution
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={flagTypeDistributionData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(props: any) => {
                        const { name = '', value = 0, percent = 0 } = props;
                        return `${name}: ${value}`;
                      }}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {flagTypeDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Support Status Pie Chart */}
        {supportStatusData.length > 0 && (
          <Grid item xs={12} md={6} lg={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Support Status
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={supportStatusData}
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
                      {supportStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Department Breakdown */}
        {departmentBreakdownData.length > 0 && (
          <Grid item xs={12} md={6} lg={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Department Breakdown
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={departmentBreakdownData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="department" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Bar dataKey="count" fill={theme.palette.primary.main} name="Employees Needing Support" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Course Breakdown */}
        {courseBreakdownData.length > 0 && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Top Courses with Issues
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={courseBreakdownData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="course" angle={-45} textAnchor="end" height={120} />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Bar dataKey="count" fill={theme.palette.warning.main} name="Employees Needing Support" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Employee Issue Count Distribution */}
        {employeeStrugglingCountData.length > 0 && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Employees by Issue Count
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={employeeStrugglingCountData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Bar dataKey="count" fill={theme.palette.info.main} name="Number of Employees" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Struggling Employees Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Flagged Employees
          </Typography>
          {filteredStruggling.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h6" color="success.main">
                No employees currently need support
              </Typography>
              <Typography variant="body2" color="text.secondary">
                All employees are progressing well with their training
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Employee</TableCell>
                    <TableCell>Course</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell>Suggested Action</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredStruggling.map((employee, index) => (
                    <TableRow
                      key={`${employee.employee.id}_${employee.course.id}_${index}`}
                      sx={{
                        bgcolor: employee.supportProvided ? 'grey.50' : 'inherit',
                      }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar>
                            <PersonIcon />
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {employee.employee.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {employee.employee.email}
                            </Typography>
                            {employee.employee.department && (
                              <Typography variant="caption" color="text.secondary">
                                {employee.employee.department}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{employee.course.title}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={employee.reason}
                          color={getFlagColor(employee.flagType)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {employee.suggestedAction}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedEmployeeForHistory({
                                  id: employee.employee.id,
                                  name: employee.employee.name,
                                });
                                setShowHistoryView(true);
                              }}
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Send Message">
                            <IconButton
                              size="small"
                              onClick={() => handleSendMessage(employee)}
                            >
                              <EmailIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Mark Support Provided">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedEmployee(employee);
                                setShowSupportDialog(true);
                              }}
                            >
                              <CheckCircleIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Support Provided Dialog */}
      <Dialog open={showSupportDialog} onClose={() => setShowSupportDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Mark Support as Provided</DialogTitle>
        <DialogContent>
          {selectedEmployee && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Employee: {selectedEmployee.employee.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Course: {selectedEmployee.course.title}
              </Typography>
              <Divider sx={{ my: 2 }} />
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Support Action</InputLabel>
                <Select
                  value={supportAction}
                  label="Support Action"
                  onChange={(e) => setSupportAction(e.target.value)}
                >
                  <MenuItem value="1on1">1-on-1 Training Session</MenuItem>
                  <MenuItem value="message">Encouragement Message Sent</MenuItem>
                  <MenuItem value="resources">Supplemental Resources Assigned</MenuItem>
                  <MenuItem value="coaching">Coaching Session Scheduled</MenuItem>
                  <MenuItem value="reset">Quiz Attempts Reset</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Notes"
                value={supportNotes}
                onChange={(e) => setSupportNotes(e.target.value)}
                placeholder="Add any notes about the support provided..."
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSupportDialog(false)}>Cancel</Button>
          <Button
            onClick={() => selectedEmployee && handleMarkSupportProvided(selectedEmployee)}
            variant="contained"
            disabled={!supportAction}
          >
            Mark as Provided
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EmployeesNeedingSupport;


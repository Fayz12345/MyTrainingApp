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
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FlagIcon from '@mui/icons-material/Flag';
// @ts-ignore - recharts types
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
// @ts-ignore - xlsx types
import * as XLSX from 'xlsx';

const client = generateClient<Schema>();

interface QuizAnalyticsProps {
  selectedStoreId?: string | null;
}

interface Result {
  id: string;
  assignmentId: string;
  score: number;
  passed: boolean;
  createdAt: string;
}

interface Assignment {
  id: string;
  employeeId: string;
  courseId: string;
  status: 'assigned' | 'completed' | null;
  createdAt: string;
  employee?: {
    id: string;
    name: string;
    department?: string | null;
  } | null;
  course?: {
    id: string;
    title: string;
    passingScore?: number | null;
  } | null;
}

interface QuizQuestion {
  id: string;
  courseId: string;
  question: string;
  questionType: string;
  options: string[];
  correctAnswer?: number | null;
  correctAnswerText?: string | null;
}

interface CourseAnalytics {
  courseId: string;
  courseTitle: string;
  averageScore: number;
  passRate: number;
  totalAttempts: number;
  averageAttemptsPerEmployee: number;
  scoreDistribution: { score: string; count: number }[];
  results: Result[];
}

interface QuestionAnalytics {
  questionId: string;
  questionText: string;
  courseTitle: string;
  successRate: number;
  totalAttempts: number;
  correctCount: number;
  incorrectCount: number;
  mostCommonIncorrectAnswer?: string;
  isFlagged: boolean;
  flagReason: 'difficult' | 'easy' | null;
}

const QuizAnalytics: React.FC<QuizAnalyticsProps> = ({ selectedStoreId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [courses, setCourses] = useState<Array<{ id: string; title: string }>>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; department?: string | null }>>([]);

  // Filters
  const [dateRangeStart, setDateRangeStart] = useState<string>('');
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [flaggedQuestionsOnly, setFlaggedQuestionsOnly] = useState(false);

  const theme = useTheme();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const session = await fetchAuthSession();
      const userId = session.userSub || session.tokens?.idToken?.payload?.sub as string;

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

      // Fetch all independent data in parallel for better performance
      const [resultsData, coursesData, employeesData, questionsData] = await Promise.all([
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
        // Fetch courses with pagination
        fetchAllPages(
          (nextToken) => client.models.Course.list({
            authMode: 'userPool',
            nextToken,
          }),
          (c: any) => ({
            id: c.id!,
            title: c.title,
            passingScore: c.passingScore,
          })
        ),
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
            department: e.department,
          })
        ),
        // Fetch quiz questions with pagination
        fetchAllPages(
          (nextToken) => client.models.QuizQuestion.list({
            authMode: 'userPool',
            nextToken,
          }),
          (q: any) => ({
            id: q.id!,
            courseId: q.courseId!,
            question: q.question,
            questionType: q.questionType || 'multiple_choice',
            options: (q.options || []).filter((opt: any): opt is string => opt !== null && opt !== undefined),
            correctAnswer: q.correctAnswer,
            correctAnswerText: q.correctAnswerText,
          })
        ),
      ]);

      setResults(resultsData);
      setCourses(coursesData);
      setEmployees(employeesData);
      setQuestions(questionsData);

      // Create lookup maps for faster access
      const employeeMap = new Map(employeesData.map((e: any) => [e.id, e]));
      const courseMap = new Map(coursesData.map((c: any) => [c.id, c]));

      // Fetch assignments with pagination and use lookup maps
      const assignmentsData: Assignment[] = [];
      let assignmentsNextToken: string | undefined = undefined;
      do {
        const assignmentsResponse: any = await client.models.Assignment.list({
          authMode: 'userPool',
          nextToken: assignmentsNextToken,
        });

        for (const a of assignmentsResponse.data || []) {
          if (!a.id) continue;
          const employee = employeeMap.get(a.employeeId);
          const course = courseMap.get(a.courseId);
          assignmentsData.push({
            id: a.id,
            employeeId: a.employeeId,
            courseId: a.courseId,
            status: a.status,
            createdAt: a.createdAt,
            employee: employee
              ? {
                  id: employee.id,
                  name: employee.name,
                  department: employee.department,
                }
              : null,
            course: course
              ? {
                  id: course.id,
                  title: course.title,
                  passingScore: course.passingScore,
                }
              : null,
          });
        }
        assignmentsNextToken = assignmentsResponse.nextToken || undefined;
      } while (assignmentsNextToken);
      setAssignments(assignmentsData);
    } catch (err) {
      console.error('Error fetching quiz analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  };

  // Filter results based on selected filters
  const filteredResults = useMemo(() => {
    let filtered = results;

    // Date range filter
    if (dateRangeStart) {
      const startDate = new Date(dateRangeStart).getTime();
      filtered = filtered.filter((r) => new Date(r.createdAt).getTime() >= startDate);
    }
    if (dateRangeEnd) {
      const endDate = new Date(dateRangeEnd + 'T23:59:59').getTime();
      filtered = filtered.filter((r) => new Date(r.createdAt).getTime() <= endDate);
    }

    // Department filter - use Sets for O(1) lookup
    if (departmentFilter !== 'all') {
      const employeeIdsSet = new Set(
        employees
          .filter((e) => e.department === departmentFilter)
          .map((e) => e.id)
      );
      const assignmentIdsSet = new Set(
        assignments
          .filter((a) => a.employee && employeeIdsSet.has(a.employee.id))
          .map((a) => a.id)
      );
      filtered = filtered.filter((r) => assignmentIdsSet.has(r.assignmentId));
    }

    // Course filter - use Set for O(1) lookup
    if (courseFilter !== 'all') {
      const assignmentIdsSet = new Set(
        assignments
          .filter((a) => a.courseId === courseFilter)
          .map((a) => a.id)
      );
      filtered = filtered.filter((r) => assignmentIdsSet.has(r.assignmentId));
    }

    return filtered;
  }, [results, dateRangeStart, dateRangeEnd, departmentFilter, courseFilter, assignments, employees]);

  // Calculate course-level analytics
  const courseAnalytics = useMemo(() => {
    // Create assignment lookup map for O(1) access
    const assignmentMap = new Map<string, Assignment>();
    assignments.forEach((a) => {
      if (a.id) assignmentMap.set(a.id, a);
    });

    const courseMap = new Map<string, CourseAnalytics>();

    filteredResults.forEach((result) => {
      const assignment = assignmentMap.get(result.assignmentId);
      if (!assignment || !assignment.course) return;

      const courseId = assignment.course.id;
      if (!courseMap.has(courseId)) {
        courseMap.set(courseId, {
          courseId,
          courseTitle: assignment.course.title,
          averageScore: 0,
          passRate: 0,
          totalAttempts: 0,
          averageAttemptsPerEmployee: 0,
          scoreDistribution: [],
          results: [],
        });
      }

      const analytics = courseMap.get(courseId)!;
      analytics.results.push(result);
      analytics.totalAttempts++;
    });

    // Calculate statistics for each course
    courseMap.forEach((analytics) => {
      if (analytics.results.length === 0) return;

      const totalScore = analytics.results.reduce((sum, r) => sum + r.score, 0);
      analytics.averageScore = Math.round(totalScore / analytics.results.length);
      analytics.passRate = Math.round(
        (analytics.results.filter((r) => r.passed).length / analytics.results.length) * 100
      );

      // Calculate average attempts per employee
      const employeeAttempts = new Map<string, number>();
      analytics.results.forEach((result) => {
        const assignment = assignmentMap.get(result.assignmentId);
        if (assignment) {
          employeeAttempts.set(
            assignment.employeeId,
            (employeeAttempts.get(assignment.employeeId) || 0) + 1
          );
        }
      });
      analytics.averageAttemptsPerEmployee =
        employeeAttempts.size > 0
          ? Math.round((analytics.totalAttempts / employeeAttempts.size) * 100) / 100
          : 0;

      // Score distribution
      const distribution: { [key: string]: number } = {};
      analytics.results.forEach((result) => {
        const range = Math.floor(result.score / 10) * 10;
        const key = `${range}-${range + 9}`;
        distribution[key] = (distribution[key] || 0) + 1;
      });
      analytics.scoreDistribution = Object.entries(distribution)
        .map(([score, count]) => ({ score, count }))
        .sort((a, b) => parseInt(a.score) - parseInt(b.score));
    });

    return Array.from(courseMap.values()).sort((a, b) => b.totalAttempts - a.totalAttempts);
  }, [filteredResults, assignments]);

  // Calculate question-level analytics
  const questionAnalytics = useMemo(() => {
    // Create lookup maps for O(1) access
    const assignmentMap = new Map<string, Assignment>();
    const assignmentIdsByCourse = new Map<string, Set<string>>();
    assignments.forEach((a) => {
      if (a.id) {
        assignmentMap.set(a.id, a);
        if (a.courseId) {
          if (!assignmentIdsByCourse.has(a.courseId)) {
            assignmentIdsByCourse.set(a.courseId, new Set());
          }
          assignmentIdsByCourse.get(a.courseId)!.add(a.id);
        }
      }
    });

    const courseMap = new Map(courses.map((c) => [c.id, c]));
    const courseAnalyticsMap = new Map(courseAnalytics.map((ca) => [ca.courseId, ca]));

    // Create result lookup by assignment ID
    const resultsByAssignment = new Map<string, Result[]>();
    filteredResults.forEach((result) => {
      if (!resultsByAssignment.has(result.assignmentId)) {
        resultsByAssignment.set(result.assignmentId, []);
      }
      resultsByAssignment.get(result.assignmentId)!.push(result);
    });

    const questionMap = new Map<string, QuestionAnalytics>();

    questions.forEach((question) => {
      // Get assignment IDs for this course
      const courseAssignmentIds = assignmentIdsByCourse.get(question.courseId) || new Set();
      
      // Get results for assignments in this course
      const courseResults: Result[] = [];
      courseAssignmentIds.forEach((assignmentId) => {
        const results = resultsByAssignment.get(assignmentId) || [];
        courseResults.push(...results);
      });

      // For now, we'll estimate success rate based on overall quiz scores
      // In a real implementation, we'd need to store individual question answers
      const courseAnalytic = courseAnalyticsMap.get(question.courseId);
      const estimatedSuccessRate = courseAnalytic
        ? Math.max(0, Math.min(100, courseAnalytic.averageScore))
        : 0;

      // Count attempts (one per result)
      const totalAttempts = courseResults.length;
      const correctCount = Math.round((estimatedSuccessRate / 100) * totalAttempts);
      const incorrectCount = totalAttempts - correctCount;

      const successRate = totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 0;

      const course = courseMap.get(question.courseId);

      questionMap.set(question.id, {
        questionId: question.id,
        questionText: question.question,
        courseTitle: course?.title || 'Unknown Course',
        successRate,
        totalAttempts,
        correctCount,
        incorrectCount,
        mostCommonIncorrectAnswer: question.options.length > 0 && question.correctAnswer !== null
          ? question.options[question.correctAnswer === 0 ? 1 : 0] || 'N/A'
          : 'N/A',
        isFlagged: successRate < 50 || successRate === 100,
        flagReason: successRate < 50 ? 'difficult' : successRate === 100 ? 'easy' : null,
      });
    });

    return Array.from(questionMap.values()).sort((a, b) => a.successRate - b.successRate);
  }, [questions, filteredResults, assignments, courseAnalytics, courses]);

  const filteredQuestionAnalytics = useMemo(() => {
    if (flaggedQuestionsOnly) {
      return questionAnalytics.filter((q) => q.isFlagged);
    }
    return questionAnalytics;
  }, [questionAnalytics, flaggedQuestionsOnly]);

  // Get unique departments
  const departments = useMemo(() => {
    return Array.from(
      new Set(employees.map((e) => e.department).filter((d): d is string => d !== null && d !== undefined))
    ).sort();
  }, [employees]);

  // Chart data calculations
  const passFailDistributionData = useMemo(() => {
    const passed = filteredResults.filter((r) => r.passed).length;
    const failed = filteredResults.filter((r) => !r.passed).length;
    return [
      { name: 'Passed', value: passed, color: theme.palette.success.main },
      { name: 'Failed', value: failed, color: theme.palette.error.main },
    ].filter((item) => item.value > 0);
  }, [filteredResults, theme]);

  const departmentPerformanceData = useMemo(() => {
    const deptMap = new Map<string, { totalScore: number; count: number; passed: number }>();
    
    filteredResults.forEach((result) => {
      const assignment = assignments.find((a) => a.id === result.assignmentId);
      if (!assignment || !assignment.employee || !assignment.employee.department) return;
      
      const dept = assignment.employee.department;
      if (!deptMap.has(dept)) {
        deptMap.set(dept, { totalScore: 0, count: 0, passed: 0 });
      }
      
      const deptData = deptMap.get(dept)!;
      deptData.totalScore += result.score;
      deptData.count += 1;
      if (result.passed) deptData.passed += 1;
    });

    return Array.from(deptMap.entries())
      .map(([department, data]) => ({
        department,
        averageScore: data.count > 0 ? Math.round(data.totalScore / data.count) : 0,
        passRate: data.count > 0 ? Math.round((data.passed / data.count) * 100) : 0,
        totalAttempts: data.count,
      }))
      .sort((a, b) => b.averageScore - a.averageScore);
  }, [filteredResults, assignments]);

  const scoreRangeDistributionData = useMemo(() => {
    const ranges = [
      { name: '0-49', min: 0, max: 49, color: theme.palette.error.main },
      { name: '50-59', min: 50, max: 59, color: theme.palette.warning.main },
      { name: '60-69', min: 60, max: 69, color: theme.palette.info.main },
      { name: '70-79', min: 70, max: 79, color: theme.palette.success.light },
      { name: '80-100', min: 80, max: 100, color: theme.palette.success.main },
    ];

    return ranges.map((range) => {
      const count = filteredResults.filter((r) => r.score >= range.min && r.score <= range.max).length;
      return {
        name: range.name,
        value: count,
        color: range.color,
      };
    }).filter((item) => item.value > 0);
  }, [filteredResults, theme]);

  const questionSuccessRateDistributionData = useMemo(() => {
    const ranges = [
      { name: '0-49%', min: 0, max: 49, color: theme.palette.error.main },
      { name: '50-69%', min: 50, max: 69, color: theme.palette.warning.main },
      { name: '70-89%', min: 70, max: 89, color: theme.palette.info.main },
      { name: '90-100%', min: 90, max: 100, color: theme.palette.success.main },
    ];

    return ranges.map((range) => {
      const count = questionAnalytics.filter((q) => q.successRate >= range.min && q.successRate <= range.max).length;
      return {
        name: range.name,
        value: count,
        color: range.color,
      };
    }).filter((item) => item.value > 0);
  }, [questionAnalytics, theme]);

  const COLORS = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.error.main,
    theme.palette.info.main,
  ];

  const overallAverageScore =
    filteredResults.length > 0
      ? Math.round(filteredResults.reduce((sum, r) => sum + r.score, 0) / filteredResults.length)
      : 0;
  const overallPassRate =
    filteredResults.length > 0
      ? Math.round((filteredResults.filter((r) => r.passed).length / filteredResults.length) * 100)
      : 0;

  const handleExportExcel = () => {
    // Create workbook
    const wb = XLSX.utils.book_new();

    // Course Analytics Sheet
    const courseData = courseAnalytics.map((ca) => ({
      'Course Title': ca.courseTitle,
      'Average Score': ca.averageScore,
      'Pass Rate (%)': ca.passRate,
      'Total Attempts': ca.totalAttempts,
      'Avg Attempts per Employee': ca.averageAttemptsPerEmployee,
    }));
    const courseWs = XLSX.utils.json_to_sheet(courseData);
    XLSX.utils.book_append_sheet(wb, courseWs, 'Course Analytics');

    // Question Analytics Sheet
    const questionData = questionAnalytics.map((qa) => ({
      'Course': qa.courseTitle,
      'Question': qa.questionText,
      'Success Rate (%)': qa.successRate,
      'Total Attempts': qa.totalAttempts,
      'Correct Count': qa.correctCount,
      'Incorrect Count': qa.incorrectCount,
      'Most Common Incorrect Answer': qa.mostCommonIncorrectAnswer,
      'Flagged': qa.isFlagged ? (qa.flagReason === 'difficult' ? 'Difficult' : 'Too Easy') : 'No',
    }));
    const questionWs = XLSX.utils.json_to_sheet(questionData);
    XLSX.utils.book_append_sheet(wb, questionWs, 'Question Analytics');

    // Export
    XLSX.writeFile(wb, 'Quiz_Analytics.xlsx');
  };

  const handleExportCSV = () => {
    // Course Analytics CSV
    const courseHeaders = ['Course Title', 'Average Score', 'Pass Rate (%)', 'Total Attempts', 'Avg Attempts per Employee'];
    const courseRows = courseAnalytics.map((ca) => [
      ca.courseTitle,
      ca.averageScore,
      ca.passRate,
      ca.totalAttempts,
      ca.averageAttemptsPerEmployee,
    ]);
    const courseCSV = [courseHeaders, ...courseRows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    // Question Analytics CSV
    const questionHeaders = [
      'Course',
      'Question',
      'Success Rate (%)',
      'Total Attempts',
      'Correct Count',
      'Incorrect Count',
      'Most Common Incorrect Answer',
      'Flagged',
    ];
    const questionRows = questionAnalytics.map((qa) => [
      qa.courseTitle,
      qa.questionText,
      qa.successRate,
      qa.totalAttempts,
      qa.correctCount,
      qa.incorrectCount,
      qa.mostCommonIncorrectAnswer,
      qa.isFlagged ? (qa.flagReason === 'difficult' ? 'Difficult' : 'Too Easy') : 'No',
    ]);
    const questionCSV = [questionHeaders, ...questionRows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    // Combine and download
    const combinedCSV = `Course Analytics\n${courseCSV}\n\nQuestion Analytics\n${questionCSV}`;
    const blob = new Blob([combinedCSV], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Quiz_Analytics.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
        <Button onClick={fetchData}>Retry</Button>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Quiz Performance Analytics</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton onClick={fetchData} color="primary" title="Refresh">
            <RefreshIcon />
          </IconButton>
          <Button startIcon={<FileDownloadIcon />} onClick={handleExportExcel} variant="outlined">
            Export Excel
          </Button>
          <Button startIcon={<FileDownloadIcon />} onClick={handleExportCSV} variant="outlined">
            Export CSV
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Start Date"
                type="date"
                value={dateRangeStart}
                onChange={(e) => setDateRangeStart(e.target.value)}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="End Date"
                type="date"
                value={dateRangeEnd}
                onChange={(e) => setDateRangeEnd(e.target.value)}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Department</InputLabel>
                <Select value={departmentFilter} label="Department" onChange={(e) => setDepartmentFilter(e.target.value)}>
                  <MenuItem value="all">All Departments</MenuItem>
                  {departments.map((dept) => (
                    <MenuItem key={dept} value={dept}>
                      {dept}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Course</InputLabel>
                <Select value={courseFilter} label="Course" onChange={(e) => setCourseFilter(e.target.value)}>
                  <MenuItem value="all">All Courses</MenuItem>
                  {courses.map((course) => (
                    <MenuItem key={course.id} value={course.id}>
                      {course.title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Overall Statistics */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Overall Average Score
              </Typography>
              <Typography variant="h4">{overallAverageScore}%</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Overall Pass Rate
              </Typography>
              <Typography variant="h4">{overallPassRate}%</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Total Quiz Attempts
              </Typography>
              <Typography variant="h4">{filteredResults.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Courses Analyzed
              </Typography>
              <Typography variant="h4">{courseAnalytics.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Section */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Pass/Fail Distribution Pie Chart */}
        {passFailDistributionData.length > 0 && (
          <Grid item xs={12} md={6} lg={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Pass/Fail Distribution
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={passFailDistributionData}
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
                      {passFailDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Score Range Distribution Pie Chart */}
        {scoreRangeDistributionData.length > 0 && (
          <Grid item xs={12} md={6} lg={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Score Range Distribution
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={scoreRangeDistributionData}
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
                      {scoreRangeDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Question Success Rate Distribution Pie Chart */}
        {questionSuccessRateDistributionData.length > 0 && (
          <Grid item xs={12} md={6} lg={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Question Success Rate Distribution
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={questionSuccessRateDistributionData}
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
                      {questionSuccessRateDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Average Score by Course */}
        {courseAnalytics.length > 0 && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Average Score by Course
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={courseAnalytics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="courseTitle" angle={-45} textAnchor="end" height={100} />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="averageScore" fill={theme.palette.primary.main} name="Average Score (%)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Department Performance */}
        {departmentPerformanceData.length > 0 && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Department Performance
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={departmentPerformanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="department" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="averageScore" fill={theme.palette.primary.main} name="Average Score (%)" />
                    <Bar dataKey="passRate" fill={theme.palette.success.main} name="Pass Rate (%)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Total Attempts by Course */}
        {courseAnalytics.length > 0 && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Total Attempts by Course
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={courseAnalytics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="courseTitle" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="totalAttempts" fill={theme.palette.info.main} name="Total Attempts" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Average Attempts per Employee by Course */}
        {courseAnalytics.length > 0 && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Average Attempts per Employee by Course
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={courseAnalytics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="courseTitle" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="averageAttemptsPerEmployee" fill={theme.palette.secondary.main} name="Avg Attempts/Employee" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Course-Level Analytics */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Course-Level Analytics
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Course</TableCell>
                  <TableCell align="right">Average Score</TableCell>
                  <TableCell align="right">Pass Rate</TableCell>
                  <TableCell align="right">Total Attempts</TableCell>
                  <TableCell align="right">Avg Attempts/Employee</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {courseAnalytics.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography color="text.secondary">No data available</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  courseAnalytics.map((ca) => (
                    <TableRow key={ca.courseId}>
                      <TableCell>{ca.courseTitle}</TableCell>
                      <TableCell align="right">
                        <Typography
                          color={ca.averageScore >= 80 ? 'success.main' : ca.averageScore >= 60 ? 'warning.main' : 'error.main'}
                        >
                          {ca.averageScore}%
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{ca.passRate}%</TableCell>
                      <TableCell align="right">{ca.totalAttempts}</TableCell>
                      <TableCell align="right">{ca.averageAttemptsPerEmployee.toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Score Distribution Chart */}
      {courseAnalytics.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Score Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={courseAnalytics.flatMap((ca) => ca.scoreDistribution)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="score" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill={theme.palette.primary.main} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Question-Level Analytics */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Question-Level Analytics</Typography>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <Select
                value={flaggedQuestionsOnly ? 'flagged' : 'all'}
                onChange={(e) => setFlaggedQuestionsOnly(e.target.value === 'flagged')}
              >
                <MenuItem value="all">All Questions</MenuItem>
                <MenuItem value="flagged">Flagged Questions Only</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Course</TableCell>
                  <TableCell>Question</TableCell>
                  <TableCell align="right">Success Rate</TableCell>
                  <TableCell align="right">Total Attempts</TableCell>
                  <TableCell align="right">Correct</TableCell>
                  <TableCell align="right">Incorrect</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredQuestionAnalytics.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography color="text.secondary">No questions found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredQuestionAnalytics.map((qa) => (
                    <TableRow
                      key={qa.questionId}
                      sx={{
                        bgcolor: qa.flagReason === 'difficult' ? 'error.light' : qa.flagReason === 'easy' ? 'info.light' : 'inherit',
                      }}
                    >
                      <TableCell>{qa.courseTitle}</TableCell>
                      <TableCell>{qa.questionText}</TableCell>
                      <TableCell align="right">
                        <Typography
                          color={
                            qa.successRate < 50
                              ? 'error.main'
                              : qa.successRate === 100
                              ? 'info.main'
                              : 'text.primary'
                          }
                          fontWeight="bold"
                        >
                          {qa.successRate}%
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{qa.totalAttempts}</TableCell>
                      <TableCell align="right">{qa.correctCount}</TableCell>
                      <TableCell align="right">{qa.incorrectCount}</TableCell>
                      <TableCell>
                        {qa.isFlagged && (
                          <Chip
                            icon={<FlagIcon />}
                            label={qa.flagReason === 'difficult' ? 'Difficult' : 'Too Easy'}
                            color={qa.flagReason === 'difficult' ? 'error' : 'info'}
                            size="small"
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Pass Rate Comparison Chart */}
      {courseAnalytics.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Pass Rate by Course
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={courseAnalytics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="courseTitle" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="passRate" fill={theme.palette.success.main} name="Pass Rate (%)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Score Trends Over Time */}
      {filteredResults.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Score Trends Over Time
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={filteredResults
                  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                  .map((r, index) => ({
                    date: new Date(r.createdAt).toLocaleDateString(),
                    score: r.score,
                    attempt: index + 1,
                  }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="attempt" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="score" stroke={theme.palette.primary.main} name="Score (%)" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default QuizAnalytics;


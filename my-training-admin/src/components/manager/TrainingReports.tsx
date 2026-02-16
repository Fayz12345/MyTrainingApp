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
  Tabs,
  Tab,
  Divider,
  useTheme,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import CodeIcon from '@mui/icons-material/Code';
import HistoryIcon from '@mui/icons-material/History';
import PreviewIcon from '@mui/icons-material/Preview';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AssessmentIcon from '@mui/icons-material/Assessment';
import BarChartIcon from '@mui/icons-material/BarChart';
// @ts-ignore - jspdf types
import jsPDF from 'jspdf';
// @ts-ignore - xlsx types
import * as XLSX from 'xlsx';

const client = generateClient<Schema>();

interface TrainingReportsProps {
  selectedStoreId?: string | null;
}

type ReportType =
  | 'completion'
  | 'incomplete'
  | 'department'
  | 'quiz-score'
  | 'training-hours';

interface ReportConfig {
  reportType: ReportType;
  startDate: string;
  endDate: string;
  courseFilter: string;
  departmentFilter: string;
  employeeFilter: string[];
}

interface ReportHistory {
  id: string;
  reportType: ReportType;
  generatedAt: string;
  generatedBy: string;
  config: ReportConfig;
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
  employee?: Employee | null;
  course?: {
    id: string;
    title: string;
    duration?: string | null;
  } | null;
}

interface Result {
  id: string;
  assignmentId: string;
  score: number;
  passed: boolean;
  createdAt: string;
}

interface LearningPathAssignment {
  id: string;
  employeeId: string;
  learningPathId: string;
  status: string | null;
  assignedDate?: string | null;
  dueDate?: string | null;
  completedDate?: string | null;
  employee?: Employee | null;
  learningPath?: {
    id: string;
    title: string;
  } | null;
}

const TrainingReports: React.FC<TrainingReportsProps> = ({ selectedStoreId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [pathAssignments, setPathAssignments] = useState<LearningPathAssignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [courses, setCourses] = useState<Array<{ id: string; title: string; duration?: string | null }>>([]);
  const [learningPaths, setLearningPaths] = useState<Array<{ id: string; title: string }>>([]);
  const [managerName, setManagerName] = useState<string>('');

  // Report configuration
  const [reportType, setReportType] = useState<ReportType>('completion');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [reportHistory, setReportHistory] = useState<ReportHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const theme = useTheme();

  useEffect(() => {
    fetchData();
    loadReportHistory();
  }, [selectedStoreId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const session = await fetchAuthSession();
      const userId = session.userSub || session.tokens?.idToken?.payload?.sub as string;

      // Helper function to fetch all pages
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

      // Fetch manager name
      const managersResponse = await client.models.Manager.list({
        authMode: 'userPool',
        filter: { userId: { eq: userId } },
      });
      if (managersResponse.data && managersResponse.data.length > 0) {
        setManagerName(managersResponse.data[0].name);
      }

      // Fetch independent data in parallel for better performance
      const [employeesData, coursesData, learningPathsData, resultsData] = await Promise.all([
        // Fetch employees
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
            storeId: e.storeId,
          })
        ),
        // Fetch courses
        fetchAllPages(
          (nextToken) => client.models.Course.list({
            authMode: 'userPool',
            nextToken,
          }),
          (c: any) => ({
            id: c.id!,
            title: c.title,
            duration: c.duration,
          })
        ),
        // Fetch learning paths
        fetchAllPages(
          (nextToken) => client.models.LearningPath.list({
            authMode: 'userPool',
            nextToken,
          }),
          (lp: any) => ({
            id: lp.id!,
            title: lp.title,
          })
        ),
        // Fetch results
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

      // Filter employees by store if selectedStoreId is provided
      let filteredEmployeesData = employeesData;
      if (selectedStoreId) {
        filteredEmployeesData = employeesData.filter((emp: any) => emp.storeId === selectedStoreId);
      }

      setEmployees(filteredEmployeesData);
      setCourses(coursesData);
      setLearningPaths(learningPathsData);
      setResults(resultsData);

      // Create lookup maps for faster access (using filtered employees)
      const employeeMap = new Map(filteredEmployeesData.map((e: any) => [e.id, e]));
      const courseMap = new Map(coursesData.map((c: any) => [c.id, c]));
      const learningPathMap = new Map(learningPathsData.map((lp: any) => [lp.id, lp]));

      // Fetch assignments - handle pagination and use lookup maps
      // Only process assignments for filtered employees
      const filteredEmployeeIds = new Set(filteredEmployeesData.map((e: any) => e.id));
      const assignmentsData: Assignment[] = [];
      let assignmentsNextToken: string | undefined = undefined;
      do {
        const assignmentsResponse: any = await client.models.Assignment.list({
          authMode: 'userPool',
          nextToken: assignmentsNextToken,
        });

        for (const a of assignmentsResponse.data || []) {
          if (!a.id || !filteredEmployeeIds.has(a.employeeId)) continue;
          const employee = employeeMap.get(a.employeeId);
          const course = courseMap.get(a.courseId);
          assignmentsData.push({
            id: a.id,
            employeeId: a.employeeId,
            courseId: a.courseId,
            status: a.status,
            isTrainingComplete: a.isTrainingComplete ?? false,
            trainingCompletedAt: a.trainingCompletedAt,
            createdAt: a.createdAt,
            employee: employee
              ? {
                  id: employee.id,
                  name: employee.name,
                  email: employee.email,
                  department: employee.department,
                }
              : null,
            course: course
              ? {
                  id: course.id,
                  title: course.title,
                  duration: course.duration,
                }
              : null,
          });
        }
        assignmentsNextToken = assignmentsResponse.nextToken || undefined;
      } while (assignmentsNextToken);
      setAssignments(assignmentsData);

      // Fetch learning path assignments - handle pagination and use lookup maps
      // Only process path assignments for filtered employees
      const pathAssignmentsData: LearningPathAssignment[] = [];
      let pathAssignmentsNextToken: string | undefined = undefined;
      do {
        const pathAssignmentsResponse: any = await client.models.LearningPathAssignment.list({
          authMode: 'userPool',
          nextToken: pathAssignmentsNextToken,
        });
        for (const p of pathAssignmentsResponse.data || []) {
          if (!p.id || !filteredEmployeeIds.has(p.employeeId)) continue;
          const employee = employeeMap.get(p.employeeId);
          const learningPath = learningPathMap.get(p.learningPathId);
          pathAssignmentsData.push({
            id: p.id,
            employeeId: p.employeeId,
            learningPathId: p.learningPathId,
            status: p.status,
            assignedDate: p.assignedDate,
            dueDate: p.dueDate,
            completedDate: p.completedDate,
            employee: employee
              ? {
                  id: employee.id,
                  name: employee.name,
                  email: employee.email,
                  department: employee.department,
                }
              : null,
            learningPath: learningPath
              ? { id: learningPath.id, title: learningPath.title }
              : null,
          });
        }
        pathAssignmentsNextToken = pathAssignmentsResponse.nextToken || undefined;
      } while (pathAssignmentsNextToken);
      setPathAssignments(pathAssignmentsData);
    } catch (err) {
      console.error('Error fetching report data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const loadReportHistory = () => {
    const saved = localStorage.getItem('training_reports_history');
    if (saved) {
      setReportHistory(JSON.parse(saved));
    }
  };

  const saveReportHistory = (report: ReportHistory) => {
    const updated = [report, ...reportHistory].slice(0, 50); // Keep last 50 reports
    setReportHistory(updated);
    localStorage.setItem('training_reports_history', JSON.stringify(updated));
  };

  // Filter data based on configuration
  const filteredData = useMemo(() => {
    let filteredAssignments = assignments;
    let filteredPathAssignments = pathAssignments;
    let filteredResults = results;

    // Date range filter
    if (startDate) {
      filteredAssignments = filteredAssignments.filter(
        (a) => new Date(a.createdAt) >= new Date(startDate)
      );
      filteredPathAssignments = filteredPathAssignments.filter(
        (p) => (p.assignedDate && new Date(p.assignedDate) >= new Date(startDate)) || !p.assignedDate
      );
      filteredResults = filteredResults.filter(
        (r) => new Date(r.createdAt) >= new Date(startDate)
      );
    }
    if (endDate) {
      filteredAssignments = filteredAssignments.filter(
        (a) => new Date(a.createdAt) <= new Date(endDate + 'T23:59:59')
      );
      filteredPathAssignments = filteredPathAssignments.filter(
        (p) => (p.assignedDate && new Date(p.assignedDate) <= new Date(endDate + 'T23:59:59')) || !p.assignedDate
      );
      filteredResults = filteredResults.filter(
        (r) => new Date(r.createdAt) <= new Date(endDate + 'T23:59:59')
      );
    }

    // Course filter
    if (courseFilter !== 'all') {
      filteredAssignments = filteredAssignments.filter((a) => a.courseId === courseFilter);
      filteredResults = filteredResults.filter((r) => {
        const assignment = filteredAssignments.find((a) => a.id === r.assignmentId);
        return assignment !== undefined;
      });
    }

    // Department filter
    if (departmentFilter !== 'all') {
      filteredAssignments = filteredAssignments.filter(
        (a) => a.employee?.department === departmentFilter
      );
      filteredPathAssignments = filteredPathAssignments.filter(
        (p) => p.employee?.department === departmentFilter
      );
    }

    // Employee filter
    if (selectedEmployees.length > 0) {
      filteredAssignments = filteredAssignments.filter((a) =>
        selectedEmployees.includes(a.employeeId)
      );
      filteredPathAssignments = filteredPathAssignments.filter((p) =>
        selectedEmployees.includes(p.employeeId)
      );
    }

    return { filteredAssignments, filteredPathAssignments, filteredResults };
  }, [assignments, pathAssignments, results, startDate, endDate, courseFilter, departmentFilter, selectedEmployees]);

  // Generate report data based on type
  const generateReportData = () => {
    const { filteredAssignments, filteredPathAssignments, filteredResults } = filteredData;

    switch (reportType) {
      case 'completion':
        return generateCompletionReport(filteredAssignments, filteredPathAssignments);
      case 'incomplete':
        return generateIncompleteReport(filteredAssignments, filteredPathAssignments);
      case 'department':
        return generateDepartmentReport(filteredAssignments, filteredPathAssignments, filteredResults);
      case 'quiz-score':
        return generateQuizScoreReport(filteredAssignments, filteredResults);
      case 'training-hours':
        return generateTrainingHoursReport(filteredAssignments);
      default:
        return { headers: [], rows: [], summary: {} };
    }
  };

  const generateCompletionReport = (
    assignments: Assignment[],
    pathAssignments: LearningPathAssignment[]
  ) => {
    const completed = assignments.filter((a) => a.isTrainingComplete || a.status === 'completed');
    const completedPaths = pathAssignments.filter((p) => p.status === 'completed');

    const rows = [
      ...completed.map((a) => ({
        employee: a.employee?.name || 'Unknown',
        email: a.employee?.email || 'N/A',
        department: a.employee?.department || 'N/A',
        course: a.course?.title || 'Unknown Course',
        type: 'Course',
        completedDate: a.trainingCompletedAt || a.createdAt,
      })),
      ...completedPaths.map((p) => ({
        employee: p.employee?.name || 'Unknown',
        email: p.employee?.email || 'N/A',
        department: p.employee?.department || 'N/A',
        course: p.learningPath?.title || 'Unknown Path',
        type: 'Learning Path',
        completedDate: p.completedDate || 'N/A',
      })),
    ];

    return {
      headers: ['Employee', 'Email', 'Department', 'Course/Path', 'Type', 'Completed Date'],
      rows,
      summary: {
        totalCompletions: rows.length,
        courseCompletions: completed.length,
        pathCompletions: completedPaths.length,
      },
    };
  };

  const generateIncompleteReport = (
    assignments: Assignment[],
    pathAssignments: LearningPathAssignment[]
  ) => {
    const now = new Date();
    const incomplete = assignments.filter(
      (a) => !a.isTrainingComplete && a.status !== 'completed'
    );
    const overduePaths = pathAssignments.filter(
      (p) => p.status !== 'completed' && p.dueDate && new Date(p.dueDate) < now
    );

    const rows = [
      ...incomplete.map((a) => ({
        employee: a.employee?.name || 'Unknown',
        email: a.employee?.email || 'N/A',
        department: a.employee?.department || 'N/A',
        course: a.course?.title || 'Unknown Course',
        type: 'Course',
        assignedDate: a.createdAt,
        daysOverdue: Math.floor((now.getTime() - new Date(a.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
      })),
      ...overduePaths.map((p) => ({
        employee: p.employee?.name || 'Unknown',
        email: p.employee?.email || 'N/A',
        department: p.employee?.department || 'N/A',
        course: p.learningPath?.title || 'Unknown Path',
        type: 'Learning Path',
        assignedDate: p.assignedDate || 'N/A',
        daysOverdue: p.dueDate ? Math.floor((now.getTime() - new Date(p.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : 0,
      })),
    ];

    return {
      headers: ['Employee', 'Email', 'Department', 'Course/Path', 'Type', 'Assigned Date', 'Days Overdue'],
      rows,
      summary: {
        totalIncomplete: rows.length,
        overdueCount: rows.filter((r) => r.daysOverdue > 0).length,
      },
    };
  };

  const generateDepartmentReport = (
    assignments: Assignment[],
    pathAssignments: LearningPathAssignment[],
    results: Result[]
  ) => {
    const departments = new Map<string, {
      totalEmployees: number;
      totalAssignments: number;
      completedAssignments: number;
      averageScore: number;
      totalAttempts: number;
    }>();

    employees.forEach((emp) => {
      if (emp.department && !departments.has(emp.department)) {
        departments.set(emp.department, {
          totalEmployees: 0,
          totalAssignments: 0,
          completedAssignments: 0,
          averageScore: 0,
          totalAttempts: 0,
        });
      }
    });

    assignments.forEach((a) => {
      if (a.employee?.department) {
        const dept = departments.get(a.employee.department);
        if (dept) {
          dept.totalAssignments++;
          if (a.isTrainingComplete) dept.completedAssignments++;
        }
      }
    });

    employees.forEach((emp) => {
      if (emp.department) {
        const dept = departments.get(emp.department);
        if (dept) dept.totalEmployees++;
      }
    });

    results.forEach((r) => {
      const assignment = assignments.find((a) => a.id === r.assignmentId);
      if (assignment?.employee?.department) {
        const dept = departments.get(assignment.employee.department);
        if (dept) {
          dept.totalAttempts++;
          dept.averageScore = (dept.averageScore * (dept.totalAttempts - 1) + r.score) / dept.totalAttempts;
        }
      }
    });

    const rows = Array.from(departments.entries()).map(([dept, stats]) => ({
      department: dept,
      totalEmployees: stats.totalEmployees,
      totalAssignments: stats.totalAssignments,
      completedAssignments: stats.completedAssignments,
      completionRate: stats.totalAssignments > 0
        ? Math.round((stats.completedAssignments / stats.totalAssignments) * 100)
        : 0,
      averageScore: Math.round(stats.averageScore),
      totalAttempts: stats.totalAttempts,
    }));

    return {
      headers: ['Department', 'Total Employees', 'Total Assignments', 'Completed', 'Completion Rate (%)', 'Avg Score', 'Quiz Attempts'],
      rows,
      summary: {
        totalDepartments: rows.length,
        totalEmployees: rows.reduce((sum, r) => sum + r.totalEmployees, 0),
      },
    };
  };

  const generateQuizScoreReport = (
    assignments: Assignment[],
    results: Result[]
  ) => {
    const courseMap = new Map<string, {
      courseTitle: string;
      attempts: Array<{ employee: string; score: number; passed: boolean; date: string }>;
    }>();

    results.forEach((r) => {
      const assignment = assignments.find((a) => a.id === r.assignmentId);
      if (assignment?.course) {
        if (!courseMap.has(assignment.courseId)) {
          courseMap.set(assignment.courseId, {
            courseTitle: assignment.course.title,
            attempts: [],
          });
        }
        const courseData = courseMap.get(assignment.courseId)!;
        courseData.attempts.push({
          employee: assignment.employee?.name || 'Unknown',
          score: r.score,
          passed: r.passed,
          date: r.createdAt,
        });
      }
    });

    const rows: any[] = [];
    courseMap.forEach((courseData, courseId) => {
      courseData.attempts.forEach((attempt) => {
        rows.push({
          course: courseData.courseTitle,
          employee: attempt.employee,
          score: attempt.score,
          passed: attempt.passed ? 'Yes' : 'No',
          date: attempt.date,
        });
      });
    });

    const summary: any = {};
    courseMap.forEach((courseData, courseId) => {
      const scores = courseData.attempts.map((a) => a.score);
      summary[courseData.courseTitle] = {
        totalAttempts: scores.length,
        averageScore: Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length),
        passRate: Math.round((courseData.attempts.filter((a) => a.passed).length / scores.length) * 100),
        minScore: Math.min(...scores),
        maxScore: Math.max(...scores),
      };
    });

    return {
      headers: ['Course', 'Employee', 'Score', 'Passed', 'Date'],
      rows,
      summary,
    };
  };

  const generateTrainingHoursReport = (assignments: Assignment[]) => {
    const employeeMap = new Map<string, {
      employee: string;
      email: string;
      department: string;
      totalHours: number;
      courses: string[];
    }>();

    assignments.forEach((a) => {
      if (!a.employee) return;
      if (!employeeMap.has(a.employeeId)) {
        employeeMap.set(a.employeeId, {
          employee: a.employee.name,
          email: a.employee.email,
          department: a.employee.department || 'N/A',
          totalHours: 0,
          courses: [],
        });
      }
      const empData = employeeMap.get(a.employeeId)!;
      if (a.course?.title && !empData.courses.includes(a.course.title)) {
        empData.courses.push(a.course.title);
        if (a.course.duration) {
          const durationStr = a.course.duration.toLowerCase();
          const match = durationStr.match(/(\d+)\s*(?:hour|hr|h|minute|min|m)/g);
          if (match) {
            let minutes = 0;
            match.forEach((m) => {
              const num = parseInt(m);
              if (m.includes('hour') || m.includes('hr') || m.includes('h')) {
                minutes += num * 60;
              } else {
                minutes += num;
              }
            });
            empData.totalHours += minutes / 60;
          }
        }
      }
    });

    const rows = Array.from(employeeMap.values()).map((emp) => ({
      employee: emp.employee,
      email: emp.email,
      department: emp.department,
      totalHours: emp.totalHours.toFixed(2),
      coursesCompleted: emp.courses.length,
    }));

    return {
      headers: ['Employee', 'Email', 'Department', 'Total Hours', 'Courses Completed'],
      rows,
      summary: {
        totalEmployees: rows.length,
        totalHours: rows.reduce((sum, r) => sum + parseFloat(r.totalHours), 0).toFixed(2),
      },
    };
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const handleExportPDF = () => {
    const reportData = generateReportData();
    const doc = new jsPDF();
    let yPos = 20;

    // Header
    doc.setFontSize(18);
    doc.text('Training Completion Report', 14, yPos);
    yPos += 10;

    // Company/Store header
    doc.setFontSize(12);
    doc.text('Company Training Management System', 14, yPos);
    yPos += 8;

    // Report metadata
    doc.setFontSize(10);
    doc.text(`Generated: ${formatDateTime(new Date().toISOString())}`, 14, yPos);
    yPos += 6;
    doc.text(`Generated By: ${managerName || 'Manager'}`, 14, yPos);
    yPos += 6;
    doc.text(`Report Type: ${reportType.charAt(0).toUpperCase() + reportType.slice(1).replace('-', ' ')}`, 14, yPos);
    yPos += 6;
    if (startDate) doc.text(`Start Date: ${formatDate(startDate)}`, 14, yPos);
    if (startDate) yPos += 6;
    if (endDate) doc.text(`End Date: ${formatDate(endDate)}`, 14, yPos);
    if (endDate) yPos += 6;
    if (courseFilter !== 'all') {
      const course = courses.find((c) => c.id === courseFilter);
      doc.text(`Course: ${course?.title || 'N/A'}`, 14, yPos);
      yPos += 6;
    }
    if (departmentFilter !== 'all') {
      doc.text(`Department: ${departmentFilter}`, 14, yPos);
      yPos += 6;
    }
    yPos += 5;

    // Summary
    if (reportData.summary && Object.keys(reportData.summary).length > 0) {
      doc.setFontSize(12);
      doc.text('Summary', 14, yPos);
      yPos += 8;
      doc.setFontSize(10);
      Object.entries(reportData.summary).forEach(([key, value]) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(`${key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}: ${value}`, 14, yPos);
        yPos += 6;
      });
      yPos += 5;
    }

    // Data table
    if (reportData.rows.length > 0) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(12);
      doc.text('Report Data', 14, yPos);
      yPos += 8;

      // Table headers
      doc.setFontSize(9);
      const colWidths = reportData.headers.map(() => 40);
      let xPos = 14;
      reportData.headers.forEach((header, i) => {
        doc.setFont(undefined, 'bold');
        doc.text(header.substring(0, 20), xPos, yPos);
        xPos += colWidths[i];
      });
      yPos += 6;

      // Table rows
      doc.setFont(undefined, 'normal');
      reportData.rows.slice(0, 20).forEach((row: any) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        xPos = 14;
        reportData.headers.forEach((header, i) => {
          const value = row[header.toLowerCase().replace(/\s+/g, '')] || row[Object.keys(row)[i]] || '';
          doc.text(String(value).substring(0, 20), xPos, yPos);
          xPos += colWidths[i];
        });
        yPos += 6;
      });

      if (reportData.rows.length > 20) {
        yPos += 5;
        doc.text(`... and ${reportData.rows.length - 20} more rows`, 14, yPos);
      }
    }

    // Signature line
    yPos = 270;
    doc.setFontSize(10);
    doc.text('_________________________', 14, yPos);
    yPos += 6;
    doc.text('Manager Signature', 14, yPos);

    doc.save(`Training_Report_${reportType}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleExportExcel = () => {
    const reportData = generateReportData();
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = Object.entries(reportData.summary || {}).map(([key, value]) => ({
      Metric: key,
      Value: value,
    }));
    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

    // Data sheet
    const dataWs = XLSX.utils.json_to_sheet(reportData.rows);
    XLSX.utils.book_append_sheet(wb, dataWs, 'Data');

    XLSX.writeFile(wb, `Training_Report_${reportType}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportCSV = () => {
    const reportData = generateReportData();
    const csv = [
      reportData.headers.join(','),
      ...reportData.rows.map((row: any) =>
        reportData.headers
          .map((header) => {
            const key = header.toLowerCase().replace(/\s+/g, '');
            const value = row[key] || row[Object.keys(row)[reportData.headers.indexOf(header)]] || '';
            return `"${String(value).replace(/"/g, '""')}"`;
          })
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Training_Report_${reportType}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const reportData = generateReportData();
    const jsonData = {
      reportType,
      generatedAt: new Date().toISOString(),
      generatedBy: managerName || 'Manager',
      config: {
        startDate,
        endDate,
        courseFilter,
        departmentFilter,
        employeeFilter: selectedEmployees,
      },
      summary: reportData.summary,
      data: reportData.rows,
    };

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Training_Report_${reportType}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleGenerateReport = () => {
    const report: ReportHistory = {
      id: Date.now().toString(),
      reportType,
      generatedAt: new Date().toISOString(),
      generatedBy: managerName || 'Manager',
      config: {
        reportType,
        startDate,
        endDate,
        courseFilter,
        departmentFilter,
        employeeFilter: selectedEmployees,
      },
    };
    saveReportHistory(report);
    setShowPreview(true);
  };

  const reportData = generateReportData();
  // Extract departments from both employees and assignments to get all departments
  const employeeDepartments = employees
    .map((e) => e.department)
    .filter((d): d is string => d !== null && d !== undefined);
  const assignmentDepartments = assignments
    .map((a) => a.employee?.department)
    .filter((d): d is string => d !== null && d !== undefined);
  const pathAssignmentDepartments = pathAssignments
    .map((p) => p.employee?.department)
    .filter((d): d is string => d !== null && d !== undefined);
  const departments = Array.from(
    new Set([...employeeDepartments, ...assignmentDepartments, ...pathAssignmentDepartments])
  ).sort();

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Training Completion Reports</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<HistoryIcon />} onClick={() => setShowHistory(true)} variant="outlined">
            Report History
          </Button>
          <IconButton onClick={fetchData} color="primary" title="Refresh">
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Configuration Panel */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Report Configuration
              </Typography>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Report Type</InputLabel>
                <Select value={reportType} label="Report Type" onChange={(e) => setReportType(e.target.value as ReportType)}>
                  <MenuItem value="completion">Completion Report</MenuItem>
                  <MenuItem value="incomplete">Incomplete Training Report</MenuItem>
                  <MenuItem value="department">Department Summary</MenuItem>
                  <MenuItem value="quiz-score">Quiz Score Report</MenuItem>
                  <MenuItem value="training-hours">Training Hours Report</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Start Date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="End Date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ mb: 2 }}
              />

              <FormControl fullWidth sx={{ mb: 2 }}>
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

              <FormControl fullWidth sx={{ mb: 2 }}>
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

              <Button
                fullWidth
                variant="contained"
                startIcon={<PreviewIcon />}
                onClick={handleGenerateReport}
                sx={{ mt: 2 }}
              >
                Preview Report
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Preview Panel */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Report Preview</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    startIcon={<PictureAsPdfIcon />}
                    onClick={handleExportPDF}
                    variant="outlined"
                    size="small"
                    disabled={reportData.rows.length === 0}
                  >
                    PDF
                  </Button>
                  <Button
                    startIcon={<FileDownloadIcon />}
                    onClick={handleExportExcel}
                    variant="outlined"
                    size="small"
                    disabled={reportData.rows.length === 0}
                  >
                    Excel
                  </Button>
                  <Button
                    startIcon={<DescriptionIcon />}
                    onClick={handleExportCSV}
                    variant="outlined"
                    size="small"
                    disabled={reportData.rows.length === 0}
                  >
                    CSV
                  </Button>
                  <Button
                    startIcon={<CodeIcon />}
                    onClick={handleExportJSON}
                    variant="outlined"
                    size="small"
                    disabled={reportData.rows.length === 0}
                  >
                    JSON
                  </Button>
                </Box>
              </Box>

              {reportData.rows.length === 0 ? (
                <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  Configure and preview a report to see data
                </Typography>
              ) : (
                <>
                  {/* Summary */}
                  {Object.keys(reportData.summary).length > 0 && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="h6" gutterBottom sx={{ mb: 2, fontWeight: 600 }}>
                        Summary
                      </Typography>
                      <Grid container spacing={3}>
                        {Object.entries(reportData.summary).map(([key, value], index) => {
                          // Handle quiz score report summary (value is an object)
                          if (reportType === 'quiz-score' && typeof value === 'object' && value !== null) {
                            const stats = value as { totalAttempts: number; averageScore: number; passRate: number; minScore: number; maxScore: number };
                            const colors = [
                              { primary: '#1976d2', secondary: '#e3f2fd' },
                              { primary: '#2e7d32', secondary: '#e8f5e9' },
                              { primary: '#ed6c02', secondary: '#fff3e0' },
                              { primary: '#9c27b0', secondary: '#f3e5f5' },
                              { primary: '#d32f2f', secondary: '#ffebee' },
                              { primary: '#0288d1', secondary: '#e1f5fe' },
                            ];
                            const colorScheme = colors[index % colors.length];
                            
                            // Determine score color based on performance
                            const getScoreColor = (score: number) => {
                              if (score >= 80) return '#2e7d32';
                              if (score >= 60) return '#ed6c02';
                              return '#d32f2f';
                            };

                            return (
                              <Grid item xs={12} sm={6} md={4} key={key}>
                                <Card
                                  sx={{
                                    height: '100%',
                                    borderRadius: 2,
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                    transition: 'all 0.3s ease',
                                    borderLeft: `4px solid ${colorScheme.primary}`,
                                    '&:hover': {
                                      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                                      transform: 'translateY(-2px)',
                                    },
                                  }}
                                >
                                  <CardContent sx={{ p: 2.5 }}>
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        mb: 2,
                                        pb: 1.5,
                                        borderBottom: `2px solid ${colorScheme.secondary}`,
                                      }}
                                    >
                                      <Box
                                        sx={{
                                          width: 40,
                                          height: 40,
                                          borderRadius: '50%',
                                          bgcolor: colorScheme.secondary,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          mr: 1.5,
                                        }}
                                      >
                                        <AssessmentIcon sx={{ color: colorScheme.primary, fontSize: 24 }} />
                                      </Box>
                                      <Typography
                                        variant="h6"
                                        sx={{
                                          fontWeight: 600,
                                          fontSize: '1rem',
                                          color: 'text.primary',
                                          flex: 1,
                                          lineHeight: 1.3,
                                        }}
                                      >
                                        {key}
                                      </Typography>
                                    </Box>

                                    <Grid container spacing={2}>
                                      <Grid item xs={6}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                                          <BarChartIcon
                                            sx={{
                                              fontSize: 18,
                                              color: colorScheme.primary,
                                              mr: 1,
                                              opacity: 0.8,
                                            }}
                                          />
                                          <Box>
                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
                                              Total Attempts
                                            </Typography>
                                            <Typography variant="h6" sx={{ fontWeight: 700, color: colorScheme.primary, fontSize: '1.1rem' }}>
                                              {stats.totalAttempts}
                                            </Typography>
                                          </Box>
                                        </Box>
                                      </Grid>

                                      <Grid item xs={6}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                                          <TrendingUpIcon
                                            sx={{
                                              fontSize: 18,
                                              color: getScoreColor(stats.averageScore),
                                              mr: 1,
                                              opacity: 0.8,
                                            }}
                                          />
                                          <Box>
                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
                                              Average Score
                                            </Typography>
                                            <Typography
                                              variant="h6"
                                              sx={{
                                                fontWeight: 700,
                                                color: getScoreColor(stats.averageScore),
                                                fontSize: '1.1rem',
                                              }}
                                            >
                                              {stats.averageScore}%
                                            </Typography>
                                          </Box>
                                        </Box>
                                      </Grid>

                                      <Grid item xs={6}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                                          <CheckCircleIcon
                                            sx={{
                                              fontSize: 18,
                                              color: stats.passRate >= 50 ? '#2e7d32' : '#d32f2f',
                                              mr: 1,
                                              opacity: 0.8,
                                            }}
                                          />
                                          <Box>
                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
                                              Pass Rate
                                            </Typography>
                                            <Typography
                                              variant="h6"
                                              sx={{
                                                fontWeight: 700,
                                                color: stats.passRate >= 50 ? '#2e7d32' : '#d32f2f',
                                                fontSize: '1.1rem',
                                              }}
                                            >
                                              {stats.passRate}%
                                            </Typography>
                                          </Box>
                                        </Box>
                                      </Grid>

                                      <Grid item xs={6}>
                                        <Box>
                                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem', mb: 0.5 }}>
                                            Score Range
                                          </Typography>
                                          <Chip
                                            label={`${stats.minScore}% - ${stats.maxScore}%`}
                                            size="small"
                                            sx={{
                                              bgcolor: colorScheme.secondary,
                                              color: colorScheme.primary,
                                              fontWeight: 600,
                                              fontSize: '0.75rem',
                                              height: 24,
                                            }}
                                          />
                                        </Box>
                                      </Grid>
                                    </Grid>
                                  </CardContent>
                                </Card>
                              </Grid>
                            );
                          }
                          // Handle other report types (value is a number or string)
                          return (
                            <Grid item xs={6} sm={4} key={key}>
                              <Card
                                sx={{
                                  p: 2,
                                  borderRadius: 2,
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                  textAlign: 'center',
                                }}
                              >
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: '0.85rem' }}>
                                  {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                                </Typography>
                                <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                                  {String(value)}
                                </Typography>
                              </Card>
                            </Grid>
                          );
                        })}
                      </Grid>
                    </Box>
                  )}

                  {/* Data Table */}
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          {reportData.headers.map((header) => (
                            <TableCell key={header}>{header}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {reportData.rows.slice(0, 50).map((row: any, index) => (
                          <TableRow key={index}>
                            {reportData.headers.map((header) => {
                              const key = header.toLowerCase().replace(/\s+/g, '');
                              const value = row[key] || row[Object.keys(row)[reportData.headers.indexOf(header)]] || '';
                              return (
                                <TableCell key={header}>
                                  {header.toLowerCase().includes('date')
                                    ? formatDate(String(value))
                                    : String(value)}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {reportData.rows.length > 50 && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                      Showing first 50 of {reportData.rows.length} rows. Export to see all data.
                    </Typography>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Report History Dialog */}
      <Dialog open={showHistory} onClose={() => setShowHistory(false)} maxWidth="md" fullWidth>
        <DialogTitle>Report History</DialogTitle>
        <DialogContent>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Report Type</TableCell>
                  <TableCell>Generated By</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reportHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <Typography color="text.secondary">No report history</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  reportHistory.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>{formatDateTime(report.generatedAt)}</TableCell>
                      <TableCell>{report.reportType.charAt(0).toUpperCase() + report.reportType.slice(1).replace('-', ' ')}</TableCell>
                      <TableCell>{report.generatedBy}</TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          onClick={() => {
                            setReportType(report.config.reportType);
                            setStartDate(report.config.startDate);
                            setEndDate(report.config.endDate);
                            setCourseFilter(report.config.courseFilter);
                            setDepartmentFilter(report.config.departmentFilter);
                            setSelectedEmployees(report.config.employeeFilter);
                            setShowHistory(false);
                            setShowPreview(true);
                          }}
                        >
                          Reload
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHistory(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TrainingReports;


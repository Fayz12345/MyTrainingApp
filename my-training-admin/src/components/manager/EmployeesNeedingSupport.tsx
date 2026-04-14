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
  Tabs,
  Tab,
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
  type: 'course' | 'learning_path';
  course?: {
    id: string;
    title: string;
  };
  learningPath?: {
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

function groupFlaggedEmployeesByEmployeeId(items: StrugglingEmployee[]): Array<{
  employee: StrugglingEmployee['employee'];
  rows: StrugglingEmployee[];
}> {
  const order: string[] = [];
  const map = new Map<string, StrugglingEmployee[]>();
  for (const item of items) {
    const id = item.employee.id;
    if (!map.has(id)) {
      order.push(id);
      map.set(id, []);
    }
    map.get(id)!.push(item);
  }
  return order.map((id) => {
    const rows = map.get(id)!;
    return { employee: rows[0].employee, rows };
  });
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
  const [currentTab, setCurrentTab] = useState(0); // 0 = Needing Support, 1 = Support History
  const [supportRecords, setSupportRecords] = useState<any[]>([]);
  const theme = useTheme();

  useEffect(() => {
    fetchData();
  }, [selectedStoreId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user ID to filter employees by createdBy
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

      // Fetch all independent data in parallel for maximum performance
      // Note: EmployeeSupport model might not be available until schema is deployed
      const fetchSupportData = async () => {
        try {
          if (client.models && client.models.EmployeeSupport) {
            return await fetchAllPages(
              (nextToken) => client.models.EmployeeSupport!.list({
                authMode: 'userPool',
                nextToken,
              }),
              (s: any) => ({
                id: s.id!,
                employeeId: s.employeeId,
                courseId: s.courseId,
                assignmentId: s.assignmentId,
                flagType: s.flagType,
                supportAction: s.supportAction,
                notes: s.notes,
                providedBy: s.providedBy,
                providedAt: s.providedAt,
              })
            );
          }
        } catch (err) {
          console.warn('[EmployeesNeedingSupport] EmployeeSupport model not available:', err);
        }
        return [];
      };

      const [employeesDataRaw, coursesData, allAssignmentsData, resultsData, supportData, learningPathsData, learningPathAssignmentsData] = await Promise.all([
        // Fetch employees with pagination - we'll filter by createdBy and storeId after fetching
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
            createdBy: e.createdBy,
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
        // Fetch employee support records (if model is available)
        fetchSupportData(),
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
        // Fetch learning path assignments
        fetchAllPages(
          (nextToken) => client.models.LearningPathAssignment.list({
            authMode: 'userPool',
            nextToken,
          }),
          (lpa: any) => ({
            id: lpa.id!,
            employeeId: lpa.employeeId,
            learningPathId: lpa.learningPathId,
            status: lpa.status,
            assignedDate: lpa.assignedDate,
            dueDate: lpa.dueDate,
            completedDate: lpa.completedDate,
            createdAt: lpa.createdAt,
            updatedAt: lpa.updatedAt,
          })
        ),
      ]);

      // Filter employees by createdBy - managers should only see employees they created
      let employeesData = employeesDataRaw;
      if (userId) {
        console.log('[EmployeesNeedingSupport] Filtering employees by createdBy:', userId);
        employeesData = employeesData.filter((emp: any) => emp.createdBy === userId);
        console.log('[EmployeesNeedingSupport] Employees after createdBy filter:', employeesData.length);
      }

      // Filter employees by selected store (if store is selected)
      if (selectedStoreId) {
        console.log('[EmployeesNeedingSupport] Filtering employees by storeId:', selectedStoreId);
        const beforeStoreFilter = employeesData.length;
        employeesData = employeesData.filter((emp: any) => emp.storeId === selectedStoreId);
        console.log(`[EmployeesNeedingSupport] Filtered employees by store: ${beforeStoreFilter} -> ${employeesData.length}`);
      }

      // Create lookup maps for O(1) access
      const employeeMap = new Map(employeesData.map((e: any) => [e.id, e]));
      const courseMap = new Map(coursesData.map((c: any) => [c.id, c]));
      const learningPathMap = new Map(learningPathsData.map((lp: any) => [lp.id, lp]));

      // Process assignments - only include assignments for employees in the filtered set
      const filteredEmployeeIds = new Set(employeesData.map((e: any) => e.id));
      const assignmentsData: Assignment[] = allAssignmentsData
        .filter((a: any) => filteredEmployeeIds.has(a.employeeId))
        .map((a: any) => {
          const employee = a.employeeId ? (employeeMap.get(a.employeeId) as Employee | undefined) : null;
          const course = a.courseId ? (courseMap.get(a.courseId) || null) : null;
          return {
        id: a.id,
        employeeId: a.employeeId,
        courseId: a.courseId,
        status: a.status,
        isTrainingComplete: a.isTrainingComplete,
        trainingCompletedAt: a.trainingCompletedAt,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
            employee: employee || null,
            course: course,
          };
        });

      // Filter results to only include results for assignments we care about
      const assignmentIds = new Set(assignmentsData.map((a: any) => a.id));
      const filteredResultsData = resultsData.filter((r: any) => assignmentIds.has(r.assignmentId));

      // Filter support data to only include support for employees we care about (for struggling employees analysis)
      const filteredSupportData = supportData.filter((s: any) => filteredEmployeeIds.has(s.employeeId));

      // For Support History view: enrich ALL support records with employee and course information
      // We need to fetch all employees (not just filtered ones) to enrich support records
      const allEmployeesMap = new Map(employeesDataRaw.map((e: any) => [e.id, e]));
      
      console.log('[EmployeesNeedingSupport] Total support records fetched:', supportData.length);
      console.log('[EmployeesNeedingSupport] Total employees available for enrichment:', allEmployeesMap.size);
      console.log('[EmployeesNeedingSupport] Current userId:', userId);
      
      // Fetch missing employees for support records that aren't in the map
      const missingEmployeeIds = supportData
        .map((s: any) => s.employeeId)
        .filter((id: string) => id && !allEmployeesMap.has(id));
      
      if (missingEmployeeIds.length > 0) {
        console.log('[EmployeesNeedingSupport] Fetching', missingEmployeeIds.length, 'missing employees for support records');
        const missingEmployeesPromises = missingEmployeeIds.map(async (id: string) => {
          try {
            const result = await client.models.Employee.get({ id });
            if (result.data) {
              return result.data;
            }
          } catch (err) {
            console.warn('[EmployeesNeedingSupport] Failed to fetch employee', id, err);
          }
          return null;
        });
        const missingEmployees = await Promise.all(missingEmployeesPromises);
        missingEmployees.forEach((emp: any) => {
          if (emp) {
            allEmployeesMap.set(emp.id, {
              id: emp.id,
              name: emp.name,
              email: emp.email,
              department: emp.department,
              storeId: emp.storeId,
              createdBy: emp.createdBy,
            });
          }
        });
      }
      
      const enrichedSupportRecords = supportData.map((s: any) => {
        const employee = allEmployeesMap.get(s.employeeId);
        const course = courseMap.get(s.courseId);
        if (!employee) {
          console.warn('[EmployeesNeedingSupport] Support record has employeeId that not found in employees:', s.employeeId, 'Record:', s);
        }
        if (!course) {
          console.warn('[EmployeesNeedingSupport] Support record has courseId that not found in courses:', s.courseId, 'Record:', s);
        }
        return {
          ...s,
          employee: employee || null,
          course: course || null,
        };
      });

      // Filter support records:
      // 1. By store if selectedStoreId is set (optional - only if store is selected)
      // Note: We show all support records, not just ones provided by current manager
      // This allows managers to see support history from other managers if needed
      let filteredSupportRecords = enrichedSupportRecords;
      if (selectedStoreId) {
        // Optionally filter by store if a store is selected
        filteredSupportRecords = filteredSupportRecords.filter((s: any) => s.employee?.storeId === selectedStoreId);
        console.log('[EmployeesNeedingSupport] Support records after store filter:', filteredSupportRecords.length);
      }

      console.log('[EmployeesNeedingSupport] Final support records to display:', filteredSupportRecords.length);
      console.log('[EmployeesNeedingSupport] Sample support record:', filteredSupportRecords[0]);
      setSupportRecords(filteredSupportRecords);

      // Process learning path assignments - only include assignments for employees in the filtered set
      const processedLearningPathAssignments = learningPathAssignmentsData
        .filter((lpa: any) => filteredEmployeeIds.has(lpa.employeeId))
        .map((lpa: any) => {
          const employee = lpa.employeeId ? (employeeMap.get(lpa.employeeId) as Employee | undefined) : null;
          const learningPath = lpa.learningPathId ? (learningPathMap.get(lpa.learningPathId) || null) : null;
          return {
            ...lpa,
            employee: employee || null,
            learningPath: learningPath,
          };
        });

      setAssignments(assignmentsData);
      setResults(filteredResultsData);

      // Analyze and identify struggling employees for courses
      const strugglingCourses = identifyStrugglingEmployees(assignmentsData, filteredResultsData, filteredSupportData);
      
      // Analyze and identify struggling employees for learning paths
      const strugglingLearningPaths = identifyStrugglingLearningPaths(
        processedLearningPathAssignments,
        assignmentsData,
        filteredResultsData,
        filteredSupportData
      );

      // Combine both course and learning path struggling employees
      const struggling = [...strugglingCourses, ...strugglingLearningPaths];
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
    results: Result[],
    supportData: any[] = []
  ): StrugglingEmployee[] => {
    const struggling: StrugglingEmployee[] = [];
    const now = new Date();

    // Create a map of support records by employee-course key
    const supportMap = new Map<string, any>();
    supportData.forEach((support) => {
      const key = `${support.employeeId}_${support.courseId}`;
      // Keep the most recent support record if multiple exist
      if (!supportMap.has(key) || new Date(support.providedAt) > new Date(supportMap.get(key).providedAt)) {
        supportMap.set(key, support);
      }
    });

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
            type: 'course',
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
            type: 'course',
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
            type: 'course',
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
            type: 'course',
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

    // Remove duplicates (same employee-course or employee-learningPath combination)
    const unique = new Map<string, StrugglingEmployee>();
    struggling.forEach((s) => {
      // Create unique key based on type
      const itemId = s.type === 'course' ? s.course?.id : s.learningPath?.id;
      const key = `${s.employee.id}_${s.type}_${itemId || ''}`;
      // Check if support was provided for this employee-item combination
      // For courses, check support map; for learning paths, we'll need to extend support model later
      if (s.type === 'course' && s.course?.id) {
        const supportKey = `${s.employee.id}_${s.course.id}`;
        const supportRecord = supportMap.get(supportKey);
        if (supportRecord) {
          s.supportProvided = true;
          s.supportProvidedAt = supportRecord.providedAt;
        }
      }
      if (!unique.has(key)) {
        unique.set(key, s);
      }
    });

    return Array.from(unique.values());
  };

  const identifyStrugglingLearningPaths = (
    learningPathAssignments: any[],
    courseAssignments: Assignment[],
    results: Result[],
    supportData: any[] = []
  ): StrugglingEmployee[] => {
    const struggling: StrugglingEmployee[] = [];
    const now = new Date();

    // Create a map of support records by employee-learningPath key
    const supportMap = new Map<string, any>();
    supportData.forEach((support) => {
      // Support data might be for courses, so we'll check learning path assignments separately
      // For now, we'll create a separate key structure for learning paths
    });

    learningPathAssignments.forEach((pathAssignment) => {
      if (!pathAssignment.employee || !pathAssignment.learningPath) return;
      if (pathAssignment.status === 'completed') return;

      // Get all course assignments for this learning path and employee
      const pathCourseAssignments = courseAssignments.filter(
        (a) => a.employeeId === pathAssignment.employeeId && 
        (a as any).learningPathId === pathAssignment.learningPathId
      );

      // Check if assigned but no progress
      const assignedDate = pathAssignment.assignedDate ? new Date(pathAssignment.assignedDate) : new Date(pathAssignment.createdAt);
      const daysSinceAssigned = Math.floor((now.getTime() - assignedDate.getTime()) / (1000 * 60 * 60 * 24));

      // Check if any courses have been started
      const hasStarted = pathCourseAssignments.some((a) => {
        const assignmentResults = results.filter((r) => r.assignmentId === a.id);
        return assignmentResults.length > 0 || a.status === 'completed';
      });

      // Flag: No progress in 7+ days after assignment
      if (daysSinceAssigned >= 7 && !hasStarted) {
        struggling.push({
          employee: pathAssignment.employee,
          type: 'learning_path',
          learningPath: {
            id: pathAssignment.learningPathId,
            title: pathAssignment.learningPath.title,
          },
          reason: `No progress in ${daysSinceAssigned} days`,
          flagType: 'no_progress',
          suggestedAction: 'Send encouragement message and check for barriers',
          details: { daysSinceProgress: daysSinceAssigned },
          assignmentId: pathAssignment.id,
          supportProvided: false,
        });
        return;
      }

      // Flag: Assigned for 3+ days but no course started
      if (daysSinceAssigned >= 3 && !hasStarted) {
        struggling.push({
          employee: pathAssignment.employee,
          type: 'learning_path',
          learningPath: {
            id: pathAssignment.learningPathId,
            title: pathAssignment.learningPath.title,
          },
          reason: 'Assigned for 3+ days but no course started',
          flagType: 'video_no_quiz',
          suggestedAction: 'Check if employee needs help understanding the material',
          details: { videoViews: 0 },
          assignmentId: pathAssignment.id,
          supportProvided: false,
        });
        return;
      }
    });

    // Remove duplicates (same employee-learningPath combination)
    const unique = new Map<string, StrugglingEmployee>();
    struggling.forEach((s) => {
      const key = `${s.employee.id}_${s.learningPath?.id || ''}`;
      if (!unique.has(key)) {
        unique.set(key, s);
      }
    });

    return Array.from(unique.values());
  };

  const handleMarkSupportProvided = async (employee: StrugglingEmployee) => {
    try {
      // Get current user ID
      const session = await fetchAuthSession();
      const userId = session.userSub || session.tokens?.idToken?.payload?.sub as string;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Save to database
      // Check if EmployeeSupport model is available
      // In Amplify Gen 2, models are dynamically available after schema deployment
      if (!client.models || !client.models.EmployeeSupport) {
        // Log diagnostic information
        const availableModels = client.models ? Object.keys(client.models) : [];
        console.error('[EmployeesNeedingSupport] EmployeeSupport model not available');
        console.error('[EmployeesNeedingSupport] Available models:', availableModels);
        console.error('[EmployeesNeedingSupport] Client models object:', client.models);
        
        // Show user-friendly error with instructions
        await MySwal.fire({
          icon: 'error',
          title: 'Model Not Available',
          html: `
            <p>The EmployeeSupport model is not available in the client.</p>
            <p><strong>Available models:</strong> ${availableModels.length > 0 ? availableModels.join(', ') : 'None'}</p>
            <hr>
            <p><strong>To fix this:</strong></p>
            <ol style="text-align: left; margin: 10px 0;">
              <li>Ensure the Amplify sandbox is running: <code>npx ampx sandbox</code></li>
              <li>Wait for the schema to deploy (check the sandbox output)</li>
              <li>Refresh the browser page to reload the client</li>
              <li>If the issue persists, restart the development server</li>
            </ol>
            <p><strong>Note:</strong> The support action will still be marked locally, but won't be saved to the database until the model is available.</p>
          `,
          confirmButtonText: 'OK'
        });
        
        // Still update local state even if DB save fails
        const updated = strugglingEmployees.map((s) => {
          const matches = s.employee.id === employee.employee.id && 
            ((employee.type === 'course' && s.course?.id === employee.course?.id) ||
             (employee.type === 'learning_path' && s.learningPath?.id === employee.learningPath?.id));
          return matches
            ? { ...s, supportProvided: true, supportProvidedAt: new Date().toISOString() }
            : s;
        });
        setStrugglingEmployees(updated);
        return; // Exit early - don't try to save to DB
      }

      const now = new Date().toISOString();
      
      // For learning paths, we need to get the first course from the learning path
      // Note: The schema requires courseId, so we need to provide it even for learning paths
      let courseIdForSupport = employee.course?.id;
      if (!courseIdForSupport && employee.type === 'learning_path' && employee.learningPath) {
        // Fetch the first course from the learning path
        try {
          const learningPathCoursesResult = await client.models.LearningPathCourse.list({
            filter: { learningPathId: { eq: employee.learningPath.id } },
          });
          
          if (learningPathCoursesResult.data && learningPathCoursesResult.data.length > 0) {
            // Sort by order and get the first course
            const sortedCourses = [...learningPathCoursesResult.data].sort((a: any, b: any) => 
              (a.order || 0) - (b.order || 0)
            );
            const firstCourse = sortedCourses[0];
            courseIdForSupport = firstCourse.courseId;
            
            if (!courseIdForSupport) {
              throw new Error('Learning path has no courses assigned');
            }
            
            console.log('[EmployeesNeedingSupport] Using first course from learning path:', courseIdForSupport);
          } else {
            throw new Error('Learning path has no courses assigned');
          }
        } catch (err) {
          console.error('[EmployeesNeedingSupport] Error fetching learning path courses:', err);
          throw new Error('Failed to get course from learning path. Please ensure the learning path has at least one course.');
        }
      }
      
      if (!courseIdForSupport) {
        throw new Error('Course ID is required to create support record');
      }
      
      const supportRecord = await client.models.EmployeeSupport.create({
        employeeId: employee.employee.id,
        courseId: courseIdForSupport,
        assignmentId: employee.assignmentId,
        flagType: employee.flagType,
        supportAction: supportAction,
        notes: supportNotes || null,
        providedBy: userId,
        providedAt: now,
        createdAt: now,
        updatedAt: now,
      } as any);

      if (supportRecord.errors && supportRecord.errors.length > 0) {
        throw new Error('Failed to save support record: ' + supportRecord.errors.map((e: any) => e.message).join(', '));
      }

      // Update local state
      const updated = strugglingEmployees.map((s) => {
        const matches = s.employee.id === employee.employee.id && 
          ((employee.type === 'course' && s.course?.id === employee.course?.id) ||
           (employee.type === 'learning_path' && s.learningPath?.id === employee.learningPath?.id));
        return matches
          ? { ...s, supportProvided: true, supportProvidedAt: new Date().toISOString() }
          : s;
      });
      setStrugglingEmployees(updated);

      // Close the dialog first
      setShowSupportDialog(false);
      setSupportAction('');
      setSupportNotes('');

      // Wait a bit for the dialog to close, then show success popup
      setTimeout(async () => {
      await MySwal.fire({
        title: 'Support Marked as Provided',
        text: `Support has been recorded for ${employee.employee.name}`,
        icon: 'success',
      });
        // Refresh data to show updated support status
        fetchData();
      }, 300);
    } catch (err) {
      console.error('Error marking support as provided:', err);
      await MySwal.fire({
        title: 'Error',
        text: err instanceof Error ? err.message : 'Failed to mark support as provided',
        icon: 'error',
      });
    }
  };

  const sendEmployeeSupportMessage = async (messageData: {
    employeeEmail: string;
    employeeName: string;
    managerName?: string;
    courseTitle?: string;
    message: string;
    supportReason?: string;
  }) => {
    // Lambda Function URL - Configure after deployment
    // Get this from AWS Lambda Console → Function → Configuration → Function URL
    const LAMBDA_FUNCTION_URL = process.env.REACT_APP_EMPLOYEE_SUPPORT_MESSAGE_LAMBDA_URL || '';
    
    if (!LAMBDA_FUNCTION_URL) {
      console.log('[EmployeesNeedingSupport] Lambda Function URL not configured. Skipping notification.');
      return { success: false, error: 'Lambda Function URL not configured' };
    }

    try {
      console.log('[EmployeesNeedingSupport] Sending support message...');
      const response = await fetch(LAMBDA_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData)
      });

      if (!response.ok) {
        throw new Error(`Lambda returned status ${response.status}`);
      }

      const result = await response.json();
      console.log('[EmployeesNeedingSupport] Message sent:', result);
      return result;
    } catch (err) {
      console.error('[EmployeesNeedingSupport] Message sending error:', err);
      throw err;
    }
  };

  const handleSendMessage = async (employee: StrugglingEmployee) => {
    try {
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
        // Get current user info for manager name
        const session = await fetchAuthSession();
        const userId = session.userSub || session.tokens?.idToken?.payload?.sub as string;
        let managerName: string | undefined;
        
        try {
          // Try to get manager name from Manager model
          // Check if Manager model is available
          if (client.models && client.models.Manager) {
            const managers = await client.models.Manager.list({
              filter: { userId: { eq: userId } },
              authMode: 'userPool'
            });
            if (managers.data && managers.data.length > 0) {
              managerName = (managers.data[0] as any).name;
            }
          }
        } catch (err) {
          console.warn('[EmployeesNeedingSupport] Could not fetch manager name:', err);
          // Continue without manager name - it's optional
        }

        // Get flag type display name
        const flagTypeNames: { [key: string]: string } = {
          failed_quizzes: 'Failed Quizzes',
          low_score: 'Low Score',
          no_progress: 'No Progress',
          video_no_quiz: 'No Quiz Attempt',
          excessive_time: 'Excessive Time',
        };

        // Send message via Lambda function
        await sendEmployeeSupportMessage({
          employeeEmail: employee.employee.email,
          employeeName: employee.employee.name,
          managerName: managerName,
          courseTitle: employee.type === 'course' ? employee.course?.title : employee.learningPath?.title,
          message: message,
          supportReason: flagTypeNames[employee.flagType] || employee.reason,
        });

      await MySwal.fire({
        title: 'Message Sent',
          text: `Message sent to ${employee.employee.name} via email`,
        icon: 'success',
        });
      }
    } catch (err) {
      console.error('Error sending message:', err);
      await MySwal.fire({
        title: 'Error',
        text: err instanceof Error ? err.message : 'Failed to send message',
        icon: 'error',
      });
    }
  };

  const handleResetQuizAttempts = async (employee: StrugglingEmployee) => {
    const result = await MySwal.fire({
      title: 'Reset Quiz Attempts?',
      text: `This will allow ${employee.employee.name} to retake the quiz for ${employee.type === 'course' ? employee.course?.title : employee.learningPath?.title}`,
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

  const getFlagColor = (flagType: string | null | undefined) => {
    if (!flagType) return 'default';
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

  const groupedFlaggedEmployees = useMemo(
    () => groupFlaggedEmployeesByEmployeeId(filteredStruggling),
    [filteredStruggling]
  );

  // Calculate unique employee counts (not course-based)
  const uniqueEmployeeCounts = useMemo(() => {
    // Get unique employee IDs
    const uniqueEmployeeIds = new Set(filteredStruggling.map((s) => s.employee.id));
    
    // Get unique employee IDs by flag type
    const failedQuizzesEmployees = new Set(
      filteredStruggling
        .filter((s) => s.flagType === 'failed_quizzes')
        .map((s) => s.employee.id)
    );
    
    const lowScoreEmployees = new Set(
      filteredStruggling
        .filter((s) => s.flagType === 'low_score')
        .map((s) => s.employee.id)
    );
    
    const noProgressEmployees = new Set(
      filteredStruggling
        .filter((s) => s.flagType === 'no_progress')
        .map((s) => s.employee.id)
    );
    
    return {
      total: uniqueEmployeeIds.size,
      failedQuizzes: failedQuizzesEmployees.size,
      lowScore: lowScoreEmployees.size,
      noProgress: noProgressEmployees.size,
    };
  }, [filteredStruggling]);

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
      const title = employee.type === 'course' ? employee.course?.title : employee.learningPath?.title;
      if (title) {
        courseMap.set(title, (courseMap.get(title) || 0) + 1);
      }
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

      {/* Tabs to switch between views */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={currentTab} onChange={(e, newValue) => setCurrentTab(newValue)}>
          <Tab label="Needing Support" />
          <Tab label="Support History" />
        </Tabs>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Support History View */}
      {currentTab === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Support History
            </Typography>
            {supportRecords.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CheckCircleIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  No support records found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Support records will appear here once you mark support as provided for employees
                </Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Employee</TableCell>
                      <TableCell>Course</TableCell>
                      <TableCell>Flag Type</TableCell>
                      <TableCell>Support Action</TableCell>
                      <TableCell>Notes</TableCell>
                      <TableCell>Provided By</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {supportRecords
                      .sort((a, b) => new Date(b.providedAt).getTime() - new Date(a.providedAt).getTime())
                      .map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            {new Date(record.providedAt).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                            <br />
                            <Typography variant="caption" color="text.secondary">
                              {new Date(record.providedAt).toLocaleTimeString('en-GB', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar>
                                <PersonIcon />
                              </Avatar>
                              <Box>
                                <Typography variant="body2" fontWeight="medium">
                                  {record.employee?.name || 'Unknown'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {record.employee?.email || ''}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {record.course?.title || 'Unknown Course'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={record.flagType || 'N/A'}
                              color={getFlagColor(record.flagType)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {record.supportAction === '1on1' && '1-on-1 Training Session'}
                              {record.supportAction === 'message' && 'Encouragement Message Sent'}
                              {record.supportAction === 'resources' && 'Supplemental Resources Assigned'}
                              {record.supportAction === 'coaching' && 'Coaching Session Scheduled'}
                              {record.supportAction === 'reset' && 'Quiz Attempts Reset'}
                              {record.supportAction === 'other' && 'Other'}
                              {!['1on1', 'message', 'resources', 'coaching', 'reset', 'other'].includes(record.supportAction) && record.supportAction}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {record.notes || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {record.providedBy || '—'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Needing Support View */}
      {currentTab === 0 && (
        <>
          {/* Summary Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Employees Needing Support
              </Typography>
              <Typography variant="h4" color="error">
                {uniqueEmployeeCounts.total}
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
                {uniqueEmployeeCounts.failedQuizzes}
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
                {uniqueEmployeeCounts.lowScore}
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
                {uniqueEmployeeCounts.noProgress}
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
                    <XAxis dataKey="course" tick={false} />
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
                    <TableCell>Course / Learning Path</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell>Suggested Action</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {groupedFlaggedEmployees.map((group) =>
                    group.rows.map((row, rowIndex) => (
                      <TableRow
                        key={row.assignmentId}
                        sx={{
                          bgcolor: row.supportProvided ? 'grey.50' : 'inherit',
                        }}
                      >
                        {rowIndex === 0 && (
                          <TableCell
                            rowSpan={group.rows.length}
                            sx={{ verticalAlign: 'top', borderBottom:
                              group.rows.length > 1 ? 'none' : undefined }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                              <Avatar>
                                <PersonIcon />
                              </Avatar>
                              <Box>
                                <Typography variant="body2" fontWeight="medium">
                                  {group.employee.name?.trim() || group.employee.email}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" display="block">
                                  {group.employee.email}
                                </Typography>
                                {group.employee.department && (
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    {group.employee.department}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </TableCell>
                        )}
                        <TableCell>
                          <Box>
                            <Chip
                              label={row.type === 'course' ? 'Course' : 'Learning Path'}
                              size="small"
                              color={row.type === 'course' ? 'primary' : 'secondary'}
                              sx={{ mb: 0.5 }}
                            />
                            <Typography variant="body2">
                              {row.type === 'course' ? row.course?.title : row.learningPath?.title}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={row.reason}
                            color={getFlagColor(row.flagType)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {row.suggestedAction}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Tooltip title="View Details">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setSelectedEmployeeForHistory({
                                    id: row.employee.id,
                                    name: row.employee.name,
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
                                onClick={() => handleSendMessage(row)}
                              >
                                <EmailIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Mark Support Provided">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setSelectedEmployee(row);
                                  setShowSupportDialog(true);
                                }}
                              >
                                <CheckCircleIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
        </>
      )}

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
                {selectedEmployee.type === 'course' ? 'Course' : 'Learning Path'}: {selectedEmployee.type === 'course' ? selectedEmployee.course?.title : selectedEmployee.learningPath?.title}
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


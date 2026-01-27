import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import { fetchAuthSession } from 'aws-amplify/auth';
import type { Schema } from '../../../../amplify/data/resource';
import Loader from '../common/Loader';

const client = generateClient<Schema>();

type Assignment = {
  readonly id: string;
  readonly employeeId: string;
  readonly courseId: string;
  readonly status?: 'assigned' | 'completed' | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

type Result = {
  readonly id: string;
  readonly assignmentId: string;
  readonly score: number;
  readonly passed: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
};

type Course = {
  readonly id: string;
  readonly title: string;
  readonly videoKey?: string | null;
  readonly passingScore?: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

type Employee = {
  readonly id: string;
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly department?: string | null;
  readonly managerId?: string | null;
  readonly createdBy?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

type Manager = {
  readonly id: string;
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

interface AnalyticsData {
  totalAssignments: number;
  completedAssignments: number;
  completionRate: number;
  totalEmployees: number;
  totalCourses: number;
  averageScore: number;
  passRate: number;
  courseStats: CourseStat[];
  employeeProgress: EmployeeProgress[];
  recentCompletions: RecentCompletion[];
  // Learning Path Analytics
  totalLearningPathAssignments: number;
  completedLearningPathAssignments: number;
  learningPathCompletionRate: number;
  learningPathStats: LearningPathStat[];
}

interface LearningPathStat {
  pathId: string;
  pathTitle: string;
  totalAssignments: number;
  completedAssignments: number;
  inProgressAssignments: number;
  notStartedAssignments: number;
  completionRate: number;
}

interface CourseStat {
  courseId: string;
  courseTitle: string;
  totalAssignments: number;
  completedAssignments: number;
  completionRate: number;
  averageScore: number;
  passRate: number;
}

interface EmployeeProgress {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  managerName: string;
  totalAssignments: number; // Individual course assignments only
  completedAssignments: number; // Individual course assignments completed only
  completionRate: number;
  averageScore: number;
  // Learning Path assignments (the learning path itself)
  totalLearningPathAssignments: number;
  completedLearningPathAssignments: number;
  learningPathCompletionRate: number;
  assignedLearningPaths: string[]; // Array of learning path titles
  // Learning path course assignments (courses within learning paths)
  totalLearningPathCourseAssignments: number;
  completedLearningPathCourseAssignments: number;
}

interface RecentCompletion {
  employeeName: string;
  courseTitle: string;
  score: number;
  passed: boolean;
  completedAt: string;
}

interface TrainingAnalyticsProps {
  selectedStoreId?: string | null;
}

const TrainingAnalytics: React.FC<TrainingAnalyticsProps> = ({ selectedStoreId }) => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user ID to filter employees
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

      // Fetch all independent data in parallel with pagination for better performance
      const [assignmentsData, resultsData, coursesData, employeesDataRaw, managersData, learningPathAssignmentsData, learningPathsData] = await Promise.all([
        fetchAllPages(
          (nextToken) => client.models.Assignment.list({ authMode: 'userPool', nextToken }),
          (a: any) => ({
            id: a.id!,
            employeeId: a.employeeId,
            courseId: a.courseId,
            status: a.status,
            assignmentSource: a.assignmentSource || null,
            learningPathId: a.learningPathId || null,
            createdAt: a.createdAt,
            updatedAt: a.updatedAt,
          })
        ),
        fetchAllPages(
          (nextToken) => client.models.Result.list({ authMode: 'userPool', nextToken }),
          (r: any) => ({
            id: r.id!,
            assignmentId: r.assignmentId,
            score: r.score,
            passed: r.passed,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          })
        ),
        fetchAllPages(
          (nextToken) => client.models.Course.list({ authMode: 'userPool', nextToken }),
          (c: any) => ({
            id: c.id!,
            title: c.title,
            passingScore: c.passingScore,
          })
        ),
        fetchAllPages(
          (nextToken) => client.models.Employee.list({ 
            authMode: 'userPool',
            filter: { isActive: { eq: true } },
            nextToken 
          }),
          (e: any) => ({
            id: e.id!,
            userId: e.userId,
            email: e.email,
            name: e.name,
            department: e.department,
            managerId: e.managerId,
            createdBy: e.createdBy,
            storeId: e.storeId,
            createdAt: e.createdAt,
            updatedAt: e.updatedAt,
          })
        ),
        fetchAllPages(
          (nextToken) => client.models.Manager.list({ authMode: 'userPool', nextToken }),
          (m: any) => ({
            id: m.id!,
            userId: m.userId,
            name: m.name,
          })
        ),
        fetchAllPages(
          (nextToken) => client.models.LearningPathAssignment.list({ authMode: 'userPool', nextToken }),
          (lp: any) => ({
            id: lp.id!,
            employeeId: lp.employeeId,
            learningPathId: lp.learningPathId,
            status: lp.status,
            assignedDate: lp.assignedDate,
            dueDate: lp.dueDate,
            completedDate: lp.completedDate,
            updatedAt: lp.updatedAt,
          })
        ),
        fetchAllPages(
          (nextToken) => client.models.LearningPath.list({ authMode: 'userPool', nextToken }),
          (lp: any) => ({
            id: lp.id!,
            title: lp.title,
          })
        ),
      ]);

      // Cast data to proper types
      let employeesData = employeesDataRaw as Employee[];
      const managersDataTyped = managersData as Manager[];

      // Filter employees by createdBy - managers should only see employees they created
      if (userId) {
        employeesData = employeesData.filter(emp => emp.createdBy === userId);
      }

      // Filter employees by selected store (if store is selected)
      if (selectedStoreId) {
        employeesData = employeesData.filter(emp => (emp as any).storeId === selectedStoreId);
      }

      // Get employee IDs for filtering assignments and results - use Set for O(1) lookup
      const employeeIds = new Set(employeesData.map(emp => emp.id));

      // Filter assignments to only include those for employees created by this manager
      const filteredAssignmentsData = assignmentsData.filter(
        assignment => employeeIds.has(assignment.employeeId)
      );

      // Filter learning path assignments to only include those for employees created by this manager
      const filteredLearningPathAssignmentsData = learningPathAssignmentsData.filter(
        assignment => employeeIds.has(assignment.employeeId)
      );

      // Filter results to only include those for assignments of employees created by this manager
      const assignmentIds = new Set(filteredAssignmentsData.map(a => a.id));
      const filteredResultsData = resultsData.filter(
        result => assignmentIds.has(result.assignmentId)
      );

      // Create lookup maps for O(1) access instead of using .find()
      const employeeMap = new Map(employeesData.map(emp => [emp.id, emp]));
      const courseMap = new Map(coursesData.map(c => [c.id, c]));
      const learningPathMap = new Map(learningPathsData.map(lp => [lp.id, lp]));
      const managerMap = new Map(managersDataTyped.map(m => [m.id, m]));
      const managerByUserIdMap = new Map(managersDataTyped.map(m => [m.userId, m]));
      
      // Create result lookup by assignment ID for O(1) access
      const resultsByAssignment = new Map<string, Result[]>();
      filteredResultsData.forEach(result => {
        if (!resultsByAssignment.has(result.assignmentId)) {
          resultsByAssignment.set(result.assignmentId, []);
        }
        resultsByAssignment.get(result.assignmentId)!.push(result);
      });

      // Create assignment lookup maps for efficient processing
      // Separate individual course assignments from learning path course assignments
      const assignmentsByEmployee = new Map<string, Assignment[]>();
      const learningPathCourseAssignmentsByEmployee = new Map<string, Assignment[]>();
      const assignmentsByCourse = new Map<string, Assignment[]>();
      filteredAssignmentsData.forEach(assignment => {
        // Check if this is a learning path assignment
        // An assignment is from a learning path if:
        // 1. assignmentSource is explicitly 'learning_path', OR
        // 2. learningPathId is set (not null/undefined)
        const isLearningPathAssignment = 
          assignment.assignmentSource === 'learning_path' || 
          (assignment.learningPathId !== null && assignment.learningPathId !== undefined);
        
        // By employee - separate individual and learning path assignments
        if (isLearningPathAssignment) {
          if (!learningPathCourseAssignmentsByEmployee.has(assignment.employeeId)) {
            learningPathCourseAssignmentsByEmployee.set(assignment.employeeId, []);
          }
          learningPathCourseAssignmentsByEmployee.get(assignment.employeeId)!.push(assignment);
        } else {
          if (!assignmentsByEmployee.has(assignment.employeeId)) {
            assignmentsByEmployee.set(assignment.employeeId, []);
          }
          assignmentsByEmployee.get(assignment.employeeId)!.push(assignment);
        }
        
        // By course (for course stats, include all assignments)
        if (!assignmentsByCourse.has(assignment.courseId)) {
          assignmentsByCourse.set(assignment.courseId, []);
        }
        assignmentsByCourse.get(assignment.courseId)!.push(assignment);
      });

      // Create learning path assignments lookup by employee
      const learningPathAssignmentsByEmployee = new Map<string, any[]>();
      filteredLearningPathAssignmentsData.forEach(lpAssignment => {
        if (!learningPathAssignmentsByEmployee.has(lpAssignment.employeeId)) {
          learningPathAssignmentsByEmployee.set(lpAssignment.employeeId, []);
        }
        learningPathAssignmentsByEmployee.get(lpAssignment.employeeId)!.push(lpAssignment);
      });

      // Create learning path assignments lookup by path
      const learningPathAssignmentsByPath = new Map<string, any[]>();
      filteredLearningPathAssignmentsData.forEach(lpAssignment => {
        if (!learningPathAssignmentsByPath.has(lpAssignment.learningPathId)) {
          learningPathAssignmentsByPath.set(lpAssignment.learningPathId, []);
        }
        learningPathAssignmentsByPath.get(lpAssignment.learningPathId)!.push(lpAssignment);
      });

      // Get current manager info
      const currentManager = userId ? managerByUserIdMap.get(userId) : null;
      const currentManagerName = currentManager ? currentManager.name : 'Current Manager';

      // Calculate overall statistics
      const totalAssignments = filteredAssignmentsData.length;
      // Count assignments as completed if they have a result (quiz taken) OR status is 'completed'
      const assignmentIdsWithResults = new Set(filteredResultsData.map((r: Result) => r.assignmentId));
      const completedAssignments = filteredAssignmentsData.filter(
        (a: Assignment) => 
          a.status === 'completed' || assignmentIdsWithResults.has(a.id)
      ).length;
      const completionRate = totalAssignments > 0 
        ? (completedAssignments / totalAssignments) * 100 
        : 0;

      // Calculate average score and pass rate
      const allScores = filteredResultsData.map((r: Result) => r.score);
      const averageScore = allScores.length > 0
        ? allScores.reduce((sum: number, score: number) => sum + score, 0) / allScores.length
        : 0;
      
      const passedResults = filteredResultsData.filter((r: Result) => r.passed);
      const passRate = filteredResultsData.length > 0
        ? (passedResults.length / filteredResultsData.length) * 100
        : 0;

      // Calculate course statistics - only for courses with assignments
      const courseStats: CourseStat[] = [];
      assignmentsByCourse.forEach((courseAssignments, courseId) => {
        const course = courseMap.get(courseId);
        if (!course) return;

        // Get results for this course's assignments
        const courseResults: Result[] = [];
        const courseAssignmentIdsWithResults = new Set<string>();
        courseAssignments.forEach(assignment => {
          const results = resultsByAssignment.get(assignment.id) || [];
          courseResults.push(...results);
          if (results.length > 0 || assignment.status === 'completed') {
            courseAssignmentIdsWithResults.add(assignment.id);
          }
        });

        const courseCompleted = courseAssignments.filter(
          (a: Assignment) => courseAssignmentIdsWithResults.has(a.id)
        ).length;
        
        const courseScores = courseResults.map((r: Result) => r.score);
        const courseAverageScore = courseScores.length > 0
          ? courseScores.reduce((sum: number, score: number) => sum + score, 0) / courseScores.length
          : 0;
        
        const coursePassed = courseResults.filter((r: Result) => r.passed).length;
        const coursePassRate = courseResults.length > 0
          ? (coursePassed / courseResults.length) * 100
          : 0;

        courseStats.push({
          courseId: course.id,
          courseTitle: course.title,
          totalAssignments: courseAssignments.length,
          completedAssignments: courseCompleted,
          completionRate: courseAssignments.length > 0
            ? (courseCompleted / courseAssignments.length) * 100
            : 0,
          averageScore: courseAverageScore,
          passRate: coursePassRate
        });
      });

      // Calculate employee progress - only for employees with assignments
      const employeeProgress: EmployeeProgress[] = [];
      employeesData.forEach((employee: Employee) => {
        // Individual course assignments (not from learning paths)
        const employeeAssignments = assignmentsByEmployee.get(employee.id) || [];
        // Learning path course assignments (courses within learning paths)
        const employeeLearningPathCourseAssignments = learningPathCourseAssignmentsByEmployee.get(employee.id) || [];
        // Learning path assignments (the learning path itself)
        const employeeLearningPathAssignments = learningPathAssignmentsByEmployee.get(employee.id) || [];
        
        // Skip employees with no assignments
        if (employeeAssignments.length === 0 && employeeLearningPathCourseAssignments.length === 0 && employeeLearningPathAssignments.length === 0) {
          return;
        }
        
        // Get results for individual course assignments only
        const employeeResults: Result[] = [];
        employeeAssignments.forEach(assignment => {
          const results = resultsByAssignment.get(assignment.id) || [];
          employeeResults.push(...results);
        });
        
        // Count individual course assignments as completed if status is 'completed' OR has a result (quiz taken)
        const employeeAssignmentIdsWithResults = new Set(employeeResults.map((r: Result) => r.assignmentId));
        const employeeCompleted = employeeAssignments.filter(
          (a: Assignment) => 
            a.status === 'completed' || employeeAssignmentIdsWithResults.has(a.id)
        ).length;
        
        const employeeScores = employeeResults.map((r: Result) => r.score);
        const employeeAverageScore = employeeScores.length > 0
          ? employeeScores.reduce((sum: number, score: number) => sum + score, 0) / employeeScores.length
          : 0;

        // Count learning path course assignments completed
        const learningPathCourseResults: Result[] = [];
        employeeLearningPathCourseAssignments.forEach(assignment => {
          const results = resultsByAssignment.get(assignment.id) || [];
          learningPathCourseResults.push(...results);
        });
        const learningPathCourseAssignmentIdsWithResults = new Set(learningPathCourseResults.map((r: Result) => r.assignmentId));
        const completedLearningPathCourseAssignments = employeeLearningPathCourseAssignments.filter(
          (a: Assignment) => 
            a.status === 'completed' || learningPathCourseAssignmentIdsWithResults.has(a.id)
        ).length;

        // Learning path assignments (the learning path itself)
        const completedLearningPathAssignments = employeeLearningPathAssignments.filter(
          (lpAssignment: any) => lpAssignment.status === 'completed'
        ).length;
        
        const learningPathCompletionRate = employeeLearningPathAssignments.length > 0
          ? (completedLearningPathAssignments / employeeLearningPathAssignments.length) * 100
          : 0;
        
        // Get assigned learning path titles
        const assignedLearningPaths = employeeLearningPathAssignments
          .map((lpAssignment: any) => {
            const learningPath = learningPathMap.get(lpAssignment.learningPathId);
            return learningPath ? learningPath.title : null;
          })
          .filter((title: string | null): title is string => title !== null);

        // Get manager name who created this employee
        let managerName = currentManagerName;
        if (employee.managerId) {
          const manager = managerMap.get(employee.managerId);
          if (manager) managerName = manager.name;
        } else if (employee.createdBy) {
          const manager = managerByUserIdMap.get(employee.createdBy);
          if (manager) managerName = manager.name;
        }

        employeeProgress.push({
          employeeId: employee.id,
          employeeName: employee.name,
          employeeEmail: employee.email,
          managerName: managerName,
          totalAssignments: employeeAssignments.length, // Only individual course assignments
          completedAssignments: employeeCompleted, // Only individual course assignments completed
          completionRate: employeeAssignments.length > 0
            ? (employeeCompleted / employeeAssignments.length) * 100
            : 0,
          averageScore: employeeAverageScore,
          // Learning Path assignments
          totalLearningPathAssignments: employeeLearningPathAssignments.length,
          completedLearningPathAssignments,
          learningPathCompletionRate,
          assignedLearningPaths,
          // Learning path course assignments (courses within learning paths)
          totalLearningPathCourseAssignments: employeeLearningPathCourseAssignments.length,
          completedLearningPathCourseAssignments: completedLearningPathCourseAssignments,
        });
      });

      // Get recent completions (last 10) - include both course and learning path completions
      const courseCompletions: RecentCompletion[] = filteredResultsData
        .map((result: Result) => {
          const assignment = filteredAssignmentsData.find((a: Assignment) => a.id === result.assignmentId);
          if (!assignment) return null;
          
          const employee = employeeMap.get(assignment.employeeId);
          const course = courseMap.get(assignment.courseId);
          
          if (!employee || !course) return null;
          
          return {
            employeeName: employee.name,
            courseTitle: course.title,
            score: result.score,
            passed: result.passed,
            completedAt: result.createdAt
          };
        })
        .filter((item: RecentCompletion | null): item is RecentCompletion => item !== null);

      // Add learning path completions to recent completions
      const learningPathCompletions: RecentCompletion[] = filteredLearningPathAssignmentsData
        .filter((lpAssignment: any) => lpAssignment.status === 'completed' && lpAssignment.completedDate)
        .map((lpAssignment: any) => {
          const employee = employeeMap.get(lpAssignment.employeeId);
          const learningPath = learningPathMap.get(lpAssignment.learningPathId);
          
          if (!employee || !learningPath) return null;
          
          return {
            employeeName: employee.name,
            courseTitle: `Learning Path: ${learningPath.title}`,
            score: 0, // Learning paths don't have scores
            passed: true,
            completedAt: lpAssignment.completedDate || lpAssignment.updatedAt
          };
        })
        .filter((item: RecentCompletion | null): item is RecentCompletion => item !== null);

      // Combine and sort all recent completions
      const allRecentCompletions = [...courseCompletions, ...learningPathCompletions]
        .sort((a: RecentCompletion, b: RecentCompletion) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
        .slice(0, 10);

      // Calculate learning path statistics
      const totalLearningPathAssignments = filteredLearningPathAssignmentsData.length;
      const completedLearningPathAssignments = filteredLearningPathAssignmentsData.filter(
        (lpAssignment: any) => lpAssignment.status === 'completed'
      ).length;
      const learningPathCompletionRate = totalLearningPathAssignments > 0
        ? (completedLearningPathAssignments / totalLearningPathAssignments) * 100
        : 0;

      // Calculate learning path stats by path - only for paths with assignments
      const learningPathStats: LearningPathStat[] = [];
      learningPathAssignmentsByPath.forEach((pathAssignments, pathId) => {
        const learningPath = learningPathMap.get(pathId);
        if (!learningPath) return;
        
        const completed = pathAssignments.filter((a: any) => a.status === 'completed').length;
        const inProgress = pathAssignments.filter((a: any) => a.status === 'in_progress').length;
        const notStarted = pathAssignments.filter((a: any) => a.status === 'not_started').length;
        
        learningPathStats.push({
          pathId: learningPath.id,
          pathTitle: learningPath.title,
          totalAssignments: pathAssignments.length,
          completedAssignments: completed,
          inProgressAssignments: inProgress,
          notStartedAssignments: notStarted,
          completionRate: pathAssignments.length > 0
            ? (completed / pathAssignments.length) * 100
            : 0
        });
      });

      // Filter courseStats to only show courses with assignments
      const filteredCourseStats = courseStats.filter((stat: CourseStat) => stat.totalAssignments > 0);
      
      // Filter employeeProgress to only show employees with assignments (course or learning path)
      const filteredEmployeeProgress = employeeProgress.filter(
        (progress: EmployeeProgress) => progress.totalAssignments > 0 || progress.totalLearningPathAssignments > 0
      );

      setAnalytics({
        totalAssignments,
        completedAssignments,
        completionRate,
        totalEmployees: employeesData.length,
        totalCourses: coursesData.length,
        averageScore: Math.round(averageScore * 10) / 10,
        passRate: Math.round(passRate * 10) / 10,
        courseStats: filteredCourseStats.sort((a: CourseStat, b: CourseStat) => b.completionRate - a.completionRate),
        employeeProgress: filteredEmployeeProgress.sort((a: EmployeeProgress, b: EmployeeProgress) => b.completionRate - a.completionRate),
        recentCompletions: allRecentCompletions,
        // Learning Path Analytics
        totalLearningPathAssignments,
        completedLearningPathAssignments,
        learningPathCompletionRate: Math.round(learningPathCompletionRate * 10) / 10,
        learningPathStats: learningPathStats.sort((a: LearningPathStat, b: LearningPathStat) => b.completionRate - a.completionRate)
      });
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics data: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [selectedStoreId]); // Refetch when storeId changes

  // Show message if no store is selected
  if (!selectedStoreId) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Training Analytics</h2>
        <p style={{ color: '#666', marginTop: '1rem', fontStyle: 'italic' }}>
          Please select a store from the dashboard to view training analytics.
        </p>
      </div>
    );
  }

  if (loading) {
    return <Loader message="Loading analytics..." fullHeight />;
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'red' }}>
        <p>{error}</p>
        <button 
          onClick={fetchAnalytics}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginTop: '1rem'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p>No analytics data available</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Training Analytics</h2>
        <button 
          onClick={fetchAnalytics}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#f5f5f5',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Overall Statistics */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          borderLeft: '4px solid #1976d2'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#666' }}>Course Completion Rate</h3>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#1976d2' }}>
            {analytics.completionRate.toFixed(1)}%
          </p>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#999' }}>
            {analytics.completedAssignments} / {analytics.totalAssignments} course assignments
          </p>
        </div>

        {/* Hidden: Learning Path Completion card */}
        {/* <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          borderLeft: '4px solid #9c27b0'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#666' }}>Learning Path Completion</h3>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#9c27b0' }}>
            {analytics.learningPathCompletionRate.toFixed(1)}%
          </p>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#999' }}>
            {analytics.completedLearningPathAssignments} / {analytics.totalLearningPathAssignments} learning paths
          </p>
        </div> */}

        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          borderLeft: '4px solid #4caf50'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#666' }}>Average Score</h3>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#4caf50' }}>
            {analytics.averageScore.toFixed(1)}%
          </p>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#999' }}>
            Across all quizzes
          </p>
        </div>

        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          borderLeft: '4px solid #ff9800'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#666' }}>Pass Rate</h3>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#ff9800' }}>
            {analytics.passRate.toFixed(1)}%
          </p>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#999' }}>
            Quizzes passed
          </p>
        </div>

        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          borderLeft: '4px solid #e91e63'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#666' }}>Total Employees</h3>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#e91e63' }}>
            {analytics.totalEmployees}
          </p>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#999' }}>
            Active employees
          </p>
        </div>
      </div>

      {/* Hidden: Learning Path Statistics */}
      {/* {analytics.learningPathStats.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Learning Path Performance</h3>
          <div style={{ 
            display: 'grid', 
            gap: '1rem'
          }}>
            {analytics.learningPathStats.map((stat) => (
              <div 
                key={stat.pathId}
                style={{
                  backgroundColor: 'white',
                  padding: '1.5rem',
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#9c27b0' }}>{stat.pathTitle}</h4>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                      {stat.completedAssignments} / {stat.totalAssignments} completed
                    </p>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#999' }}>
                      {stat.inProgressAssignments} in progress • {stat.notStartedAssignments} not started
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', color: '#9c27b0' }}>
                      {stat.completionRate.toFixed(1)}%
                    </p>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#999' }}>
                      Completion
                    </p>
                  </div>
                </div>
                <div style={{ 
                  width: '100%', 
                  height: '8px', 
                  backgroundColor: '#f0f0f0', 
                  borderRadius: '4px',
                  overflow: 'hidden',
                  marginBottom: '0.5rem'
                }}>
                  <div style={{
                    width: `${stat.completionRate}%`,
                    height: '100%',
                    backgroundColor: '#9c27b0',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                <div style={{ display: 'flex', gap: '2rem', fontSize: '0.9rem', color: '#666' }}>
                  <span>Completed: <strong style={{ color: '#4caf50' }}>{stat.completedAssignments}</strong></span>
                  <span>In Progress: <strong style={{ color: '#ff9800' }}>{stat.inProgressAssignments}</strong></span>
                  <span>Not Started: <strong style={{ color: '#999' }}>{stat.notStartedAssignments}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )} */}

      {/* Course Statistics */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Course Performance</h3>
        <div style={{ 
          display: 'grid', 
          gap: '1rem'
        }}>
          {analytics.courseStats.map((stat) => (
            <div 
              key={stat.courseId}
              style={{
                backgroundColor: 'white',
                padding: '1.5rem',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#1976d2' }}>{stat.courseTitle}</h4>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                    {stat.completedAssignments} / {stat.totalAssignments} completed
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', color: '#1976d2' }}>
                    {stat.completionRate.toFixed(1)}%
                  </p>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#999' }}>
                    Completion
                  </p>
                </div>
              </div>
              <div style={{ 
                width: '100%', 
                height: '8px', 
                backgroundColor: '#f0f0f0', 
                borderRadius: '4px',
                overflow: 'hidden',
                marginBottom: '0.5rem'
              }}>
                <div style={{
                  width: `${stat.completionRate}%`,
                  height: '100%',
                  backgroundColor: '#1976d2',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <div style={{ display: 'flex', gap: '2rem', fontSize: '0.9rem', color: '#666' }}>
                <span>Avg Score: <strong>{stat.averageScore.toFixed(1)}%</strong></span>
                <span>Pass Rate: <strong>{stat.passRate.toFixed(1)}%</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Employee Progress */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Employee Progress</h3>
        <div style={{ 
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Employee</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Email</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Manager</th>
                <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '2px solid #e0e0e0' }}>Individual Courses</th>
                <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '2px solid #e0e0e0' }}>Learning Path Courses</th>
                <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '2px solid #e0e0e0' }}>Course Completion Rate</th>
                <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '2px solid #e0e0e0' }}>Avg Score</th>
              </tr>
            </thead>
            <tbody>
              {analytics.employeeProgress.map((employee) => {
                // Calculate completion rate for individual courses only
                const individualCompletionRate = employee.totalAssignments > 0
                  ? (employee.completedAssignments / employee.totalAssignments) * 100
                  : 0;
                
                return (
                  <tr key={employee.employeeId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '1rem' }}>{employee.employeeName}</td>
                    <td style={{ padding: '1rem', color: '#666' }}>{employee.employeeEmail}</td>
                    <td style={{ padding: '1rem', color: '#666' }}>{employee.managerName}</td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      {employee.totalAssignments > 0 ? (
                        <span>
                          {employee.completedAssignments} / {employee.totalAssignments}
                        </span>
                      ) : (
                        <span style={{ color: '#999' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      {employee.totalLearningPathCourseAssignments > 0 ? (
                        <span>
                          {employee.completedLearningPathCourseAssignments} / {employee.totalLearningPathCourseAssignments}
                        </span>
                      ) : (
                        <span style={{ color: '#999' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ 
                          flex: 1, 
                          height: '8px', 
                          backgroundColor: '#f0f0f0', 
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${individualCompletionRate}%`,
                            height: '100%',
                            backgroundColor: individualCompletionRate >= 80 ? '#4caf50' : individualCompletionRate >= 50 ? '#ff9800' : '#f44336',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                        <span style={{ minWidth: '50px', fontSize: '0.9rem' }}>
                          {individualCompletionRate.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold' }}>
                      {employee.averageScore > 0 ? `${employee.averageScore.toFixed(1)}%` : 'N/A'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Completions */}
      <div>
        <h3 style={{ marginBottom: '1rem' }}>Recent Completions</h3>
        <div style={{ 
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          padding: '1rem'
        }}>
          {analytics.recentCompletions.length === 0 ? (
            <p style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>
              No completions yet
            </p>
          ) : (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {analytics.recentCompletions.map((completion, index) => (
                <div 
                  key={index}
                  style={{
                    padding: '1rem',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 'bold' }}>
                      {completion.employeeName} completed {completion.courseTitle}
                    </p>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: '#666' }}>
                      {new Date(completion.completedAt).toLocaleString()}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ 
                      margin: 0, 
                      fontSize: '1.2rem', 
                      fontWeight: 'bold',
                      color: completion.passed ? '#4caf50' : '#f44336'
                    }}>
                      {completion.score}%
                    </p>
                    <p style={{ 
                      margin: '0.25rem 0 0 0', 
                      fontSize: '0.8rem',
                      color: completion.passed ? '#4caf50' : '#f44336'
                    }}>
                      {completion.passed ? '✓ Passed' : '✗ Failed'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrainingAnalytics;


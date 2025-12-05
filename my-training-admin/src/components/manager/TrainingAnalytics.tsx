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
  totalAssignments: number;
  completedAssignments: number;
  completionRate: number;
  averageScore: number;
}

interface RecentCompletion {
  employeeName: string;
  courseTitle: string;
  score: number;
  passed: boolean;
  completedAt: string;
}

const TrainingAnalytics: React.FC = () => {
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

      // Fetch all assignments with related data
      const assignments = await client.models.Assignment.list({
        authMode: 'userPool'
      });

      // Fetch all results
      const results = await client.models.Result.list({
        authMode: 'userPool'
      });

      // Fetch all courses
      const courses = await client.models.Course.list({
        authMode: 'userPool'
      });

      // Fetch all employees
      const employees = await client.models.Employee.list({
        authMode: 'userPool'
      });

      // Fetch all managers
      const managers = await client.models.Manager.list({
        authMode: 'userPool'
      });

      if (!assignments.data || !results.data || !courses.data || !employees.data || !managers.data) {
        throw new Error('Failed to fetch analytics data');
      }

      // Cast data to proper types
      const coursesData = courses.data as Course[];
      let employeesData = employees.data as Employee[];
      const managersData = managers.data as Manager[];

      // Filter employees by createdBy - managers should only see employees they created
      if (userId) {
        employeesData = employeesData.filter(emp => emp.createdBy === userId);
      }

      // Get employee IDs for filtering assignments and results
      const employeeIds = new Set(employeesData.map(emp => emp.id));

      // Filter assignments to only include those for employees created by this manager
      const assignmentsData = (assignments.data as Assignment[]).filter(
        assignment => employeeIds.has(assignment.employeeId)
      );

      // Filter results to only include those for assignments of employees created by this manager
      const assignmentIds = new Set(assignmentsData.map(a => a.id));
      const resultsData = (results.data as Result[]).filter(
        result => assignmentIds.has(result.assignmentId)
      );

      // Create a map of managers for easy lookup by ID and by userId
      const managerMap: Record<string, Manager> = {};
      const managerByUserIdMap: Record<string, Manager> = {};
      managersData.forEach(manager => {
        managerMap[manager.id] = manager;
        managerByUserIdMap[manager.userId] = manager;
      });

      // Get current manager info
      const currentManager = userId ? managerByUserIdMap[userId] : null;
      const currentManagerName = currentManager ? currentManager.name : 'Current Manager';

      // Calculate overall statistics
      const totalAssignments = assignmentsData.length;
      // Count assignments as completed if they have a result (quiz taken) OR status is 'completed'
      const assignmentIdsWithResults = new Set(resultsData.map((r: Result) => r.assignmentId));
      const completedAssignments = assignmentsData.filter(
        (a: Assignment) => 
          a.status === 'completed' || assignmentIdsWithResults.has(a.id)
      ).length;
      const completionRate = totalAssignments > 0 
        ? (completedAssignments / totalAssignments) * 100 
        : 0;

      // Calculate average score and pass rate
      const allScores = resultsData.map((r: Result) => r.score);
      const averageScore = allScores.length > 0
        ? allScores.reduce((sum: number, score: number) => sum + score, 0) / allScores.length
        : 0;
      
      const passedResults = resultsData.filter((r: Result) => r.passed);
      const passRate = resultsData.length > 0
        ? (passedResults.length / resultsData.length) * 100
        : 0;

      // Calculate course statistics
      const courseStats: CourseStat[] = coursesData.map((course: Course) => {
        const courseAssignments = assignmentsData.filter(
          (a: Assignment) => a.courseId === course.id
        );
        // Get assignment IDs with results for this course
        const courseAssignmentIds = courseAssignments.map((a: Assignment) => a.id);
        const courseResults = resultsData.filter((r: Result) => 
          courseAssignmentIds.includes(r.assignmentId)
        );
        const courseAssignmentIdsWithResults = new Set(courseResults.map((r: Result) => r.assignmentId));
        // Count as completed if status is 'completed' OR has a result
        const courseCompleted = courseAssignments.filter(
          (a: Assignment) => 
            a.status === 'completed' || courseAssignmentIdsWithResults.has(a.id)
        );
        
        // courseResults already calculated above
        
        const courseScores = courseResults.map((r: Result) => r.score);
        const courseAverageScore = courseScores.length > 0
          ? courseScores.reduce((sum: number, score: number) => sum + score, 0) / courseScores.length
          : 0;
        
        const coursePassed = courseResults.filter((r: Result) => r.passed);
        const coursePassRate = courseResults.length > 0
          ? (coursePassed.length / courseResults.length) * 100
          : 0;

        return {
          courseId: course.id,
          courseTitle: course.title,
          totalAssignments: courseAssignments.length,
          completedAssignments: courseCompleted.length,
          completionRate: courseAssignments.length > 0
            ? (courseCompleted.length / courseAssignments.length) * 100
            : 0,
          averageScore: courseAverageScore,
          passRate: coursePassRate
        };
      });

      // Calculate employee progress
      const employeeProgress: EmployeeProgress[] = employeesData.map((employee: Employee) => {
        const employeeAssignments = assignmentsData.filter(
          (a: Assignment) => a.employeeId === employee.id
        );
        
        // Get results for this employee's assignments
        const employeeAssignmentIds = employeeAssignments.map((a: Assignment) => a.id);
        const employeeResults = resultsData.filter((r: Result) => 
          employeeAssignmentIds.includes(r.assignmentId)
        );
        
        // Count as completed if status is 'completed' OR has a result (quiz taken)
        const employeeAssignmentIdsWithResults = new Set(employeeResults.map((r: Result) => r.assignmentId));
        const employeeCompleted = employeeAssignments.filter(
          (a: Assignment) => 
            a.status === 'completed' || employeeAssignmentIdsWithResults.has(a.id)
        );
        
        const employeeScores = employeeResults.map((r: Result) => r.score);
        const employeeAverageScore = employeeScores.length > 0
          ? employeeScores.reduce((sum: number, score: number) => sum + score, 0) / employeeScores.length
          : 0;

        // Get manager name who created this employee
        // Since we filter by createdBy, all employees are created by the current manager
        // But we can also check if there's a managerId assigned
        let managerName = currentManagerName;
        if (employee.managerId && managerMap[employee.managerId]) {
          // If employee has a managerId, show that manager's name
          managerName = managerMap[employee.managerId].name;
        } else if (employee.createdBy && managerByUserIdMap[employee.createdBy]) {
          // Otherwise, show the manager who created this employee
          managerName = managerByUserIdMap[employee.createdBy].name;
        }

        return {
          employeeId: employee.id,
          employeeName: employee.name,
          employeeEmail: employee.email,
          managerName: managerName,
          totalAssignments: employeeAssignments.length,
          completedAssignments: employeeCompleted.length,
          completionRate: employeeAssignments.length > 0
            ? (employeeCompleted.length / employeeAssignments.length) * 100
            : 0,
          averageScore: employeeAverageScore
        };
      });

      // Get recent completions (last 10)
      const recentCompletions: RecentCompletion[] = resultsData
        .map((result: Result) => {
          const assignment = assignmentsData.find((a: Assignment) => a.id === result.assignmentId);
          if (!assignment) return null;
          
          const employee = employeesData.find((e: Employee) => e.id === assignment.employeeId);
          const course = coursesData.find((c: Course) => c.id === assignment.courseId);
          
          if (!employee || !course) return null;
          
          return {
            employeeName: employee.name,
            courseTitle: course.title,
            score: result.score,
            passed: result.passed,
            completedAt: result.createdAt
          };
        })
        .filter((item: RecentCompletion | null): item is RecentCompletion => item !== null)
        .sort((a: RecentCompletion, b: RecentCompletion) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
        .slice(0, 10);

      setAnalytics({
        totalAssignments,
        completedAssignments,
        completionRate,
        totalEmployees: employeesData.length,
        totalCourses: coursesData.length,
        averageScore: Math.round(averageScore * 10) / 10,
        passRate: Math.round(passRate * 10) / 10,
        courseStats: courseStats.sort((a: CourseStat, b: CourseStat) => b.completionRate - a.completionRate),
        employeeProgress: employeeProgress.sort((a: EmployeeProgress, b: EmployeeProgress) => b.completionRate - a.completionRate),
        recentCompletions
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
  }, []);

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
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#666' }}>Completion Rate</h3>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#1976d2' }}>
            {analytics.completionRate.toFixed(1)}%
          </p>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#999' }}>
            {analytics.completedAssignments} / {analytics.totalAssignments} assignments
          </p>
        </div>

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
          borderLeft: '4px solid #9c27b0'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#666' }}>Total Employees</h3>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#9c27b0' }}>
            {analytics.totalEmployees}
          </p>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#999' }}>
            Active employees
          </p>
        </div>
      </div>

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
                <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '2px solid #e0e0e0' }}>Completed</th>
                <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '2px solid #e0e0e0' }}>Completion Rate</th>
                <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '2px solid #e0e0e0' }}>Avg Score</th>
              </tr>
            </thead>
            <tbody>
              {analytics.employeeProgress.map((employee) => (
                <tr key={employee.employeeId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '1rem' }}>{employee.employeeName}</td>
                  <td style={{ padding: '1rem', color: '#666' }}>{employee.employeeEmail}</td>
                  <td style={{ padding: '1rem', color: '#666' }}>{employee.managerName}</td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    {employee.completedAssignments} / {employee.totalAssignments}
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
                          width: `${employee.completionRate}%`,
                          height: '100%',
                          backgroundColor: employee.completionRate >= 80 ? '#4caf50' : employee.completionRate >= 50 ? '#ff9800' : '#f44336',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                      <span style={{ minWidth: '50px', fontSize: '0.9rem' }}>
                        {employee.completionRate.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold' }}>
                    {employee.averageScore > 0 ? `${employee.averageScore.toFixed(1)}%` : 'N/A'}
                  </td>
                </tr>
              ))}
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


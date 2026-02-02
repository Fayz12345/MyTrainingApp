import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import { fetchAuthSession } from 'aws-amplify/auth';
import type { Schema } from '../../../../amplify/data/resource';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  Avatar,
  Chip,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import WarningIcon from '@mui/icons-material/Warning';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

const client = generateClient<Schema>();

interface EmployeesNeedingSupportWidgetProps {
  onViewAll: () => void;
  selectedStoreId?: string | null;
}

interface StrugglingEmployee {
  employee: {
    id: string;
    name: string;
    email: string;
    department?: string | null;
  };
  course: {
    id: string;
    title: string;
  };
  reason: string;
  flagType: string;
}

const EmployeesNeedingSupportWidget: React.FC<EmployeesNeedingSupportWidgetProps> = ({ onViewAll, selectedStoreId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [strugglingEmployees, setStrugglingEmployees] = useState<StrugglingEmployee[]>([]);

  useEffect(() => {
    fetchData();
  }, [selectedStoreId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user's ID for filtering
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
      const [employeesDataRaw, coursesData, allAssignmentsData, resultsData] = await Promise.all([
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

      // Filter employees by createdBy - managers should only see employees they created
      let employeesData = employeesDataRaw;
      if (userId) {
        employeesData = employeesData.filter((emp: any) => emp.createdBy === userId);
      }

      // Filter employees by selected store (if store is selected)
      if (selectedStoreId) {
        employeesData = employeesData.filter((emp: any) => emp.storeId === selectedStoreId);
      }

      // Create lookup maps for O(1) access
      const employeeMap = new Map(employeesData.map((e: any) => [e.id, e]));
      const courseMap = new Map(coursesData.map((c: any) => [c.id, c]));

      // Get employee IDs for filtering assignments
      const employeeIds = new Set(employeesData.map((e: any) => e.id));

      // Process assignments with lookup maps - only include assignments for filtered employees
      const assignmentsData: any[] = allAssignmentsData
        .filter((a: any) => employeeIds.has(a.employeeId))
        .map((a: any) => ({
        id: a.id,
        employeeId: a.employeeId,
        courseId: a.courseId,
        status: a.status,
        isTrainingComplete: a.isTrainingComplete,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        employee: a.employeeId ? (employeeMap.get(a.employeeId) || null) : null,
        course: a.courseId ? (courseMap.get(a.courseId) || null) : null,
      }));

      // Identify struggling employees (simplified version)
      const struggling: StrugglingEmployee[] = [];
      const employeeCourseMap = new Map<string, Map<string, { assignment: any; results: any[] }>>();

      assignmentsData.forEach((assignment) => {
        if (!assignment.employee || !assignment.course || assignment.isTrainingComplete) return;

        if (!employeeCourseMap.has(assignment.employeeId)) {
          employeeCourseMap.set(assignment.employeeId, new Map());
        }
        const courseMap = employeeCourseMap.get(assignment.employeeId)!;

        if (!courseMap.has(assignment.courseId)) {
          courseMap.set(assignment.courseId, {
            assignment,
            results: [],
          });
        }

        const courseData = courseMap.get(assignment.courseId)!;
        courseData.results = resultsData.filter((r: any) => r.assignmentId === assignment.id);
      });

      employeeCourseMap.forEach((courseMap) => {
        courseMap.forEach((courseData) => {
          const { assignment, results } = courseData;
          if (!assignment.employee || !assignment.course) return;

          // Failed quiz 2+ times
          const failedAttempts = results.filter((r) => !r.passed).length;
          if (failedAttempts >= 2) {
            struggling.push({
              employee: assignment.employee,
              course: {
                id: assignment.course.id,
                title: assignment.course.title,
              },
              reason: `Failed quiz ${failedAttempts} times`,
              flagType: 'failed_quizzes',
            });
            return;
          }

          // Low score on first attempt
          const firstAttempt = results.sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          )[0];
          if (firstAttempt && firstAttempt.score < 60) {
            struggling.push({
              employee: assignment.employee,
              course: {
                id: assignment.course.id,
                title: assignment.course.title,
              },
              reason: `First attempt: ${firstAttempt.score}%`,
              flagType: 'low_score',
            });
            return;
          }

          // No progress in 7+ days
          const now = new Date();
          const daysSinceProgress = Math.floor(
            (now.getTime() - new Date(assignment.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysSinceProgress >= 7 && results.length === 0) {
            struggling.push({
              employee: assignment.employee,
              course: {
                id: assignment.course.id,
                title: assignment.course.title,
              },
              reason: `No progress in ${daysSinceProgress} days`,
              flagType: 'no_progress',
            });
          }
        });
      });

      // Remove duplicates
      const unique = new Map<string, StrugglingEmployee>();
      struggling.forEach((s) => {
        const key = `${s.employee.id}_${s.course.id}`;
        if (!unique.has(key)) {
          unique.set(key, s);
        }
      });

      setStrugglingEmployees(Array.from(unique.values()).slice(0, 5)); // Show top 5
    } catch (err) {
      console.error('Error fetching struggling employees:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <CircularProgress size={40} />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningIcon color="error" />
            <Typography variant="h6">Employees Needing Support</Typography>
          </Box>
          <Chip
            label={strugglingEmployees.length}
            color="error"
            size="small"
          />
        </Box>

        {strugglingEmployees.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography variant="body2" color="text.secondary">
              No employees currently need support
            </Typography>
          </Box>
        ) : (
          <>
            <List dense>
              {strugglingEmployees.map((employee, index) => (
                <ListItem
                  key={`${employee.employee.id}_${employee.course.id}_${index}`}
                  sx={{ px: 0 }}
                >
                  <Avatar sx={{ width: 32, height: 32, mr: 1 }}>
                    <PersonIcon fontSize="small" />
                  </Avatar>
                  <ListItemText
                    primary={employee.employee.name}
                    secondary={
                      <Box>
                        <Typography variant="caption" display="block">
                          {employee.course.title}
                        </Typography>
                        <Typography variant="caption" color="error">
                          {employee.reason}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
            <Button
              fullWidth
              endIcon={<ArrowForwardIcon />}
              onClick={onViewAll}
              sx={{ mt: 2 }}
            >
              View All
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default EmployeesNeedingSupportWidget;


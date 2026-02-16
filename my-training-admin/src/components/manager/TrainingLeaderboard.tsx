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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Button,
  Chip,
  IconButton,
  Switch,
  FormControlLabel,
  Avatar,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import SpeedIcon from '@mui/icons-material/Speed';
import SchoolIcon from '@mui/icons-material/School';
import StarIcon from '@mui/icons-material/Star';
// @ts-ignore - recharts types
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { useTheme } from '@mui/material/styles';

const client = generateClient<Schema>();

interface TrainingLeaderboardProps {
  selectedStoreId?: string | null;
}

type RankingMetric = 'courses_completed' | 'average_score' | 'fastest_completion' | 'training_hours';

interface EmployeeRanking {
  employee: {
    id: string;
    name: string;
    email: string;
    department?: string | null;
  };
  rank: number;
  value: number;
  displayValue: string;
  badges: Badge[];
}

interface Badge {
  id: string;
  type: 'first_to_complete' | 'perfect_score' | 'speed_learner' | 'training_champion';
  name: string;
  description: string;
  earnedAt: string;
  courseId?: string;
  courseTitle?: string;
}

interface LeaderboardSettings {
  enabled: boolean;
  visibleToEmployees: boolean;
  metrics: RankingMetric[];
}

const TrainingLeaderboard: React.FC<TrainingLeaderboardProps> = ({ selectedStoreId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [badges, setBadges] = useState<Map<string, Badge[]>>(new Map());
  const theme = useTheme();

  // Settings
  const [settings, setSettings] = useState<LeaderboardSettings>({
    enabled: true,
    visibleToEmployees: true,
    metrics: ['courses_completed', 'average_score', 'training_hours'],
  });
  const [showSettings, setShowSettings] = useState(false);

  // Filters
  const [rankingMetric, setRankingMetric] = useState<RankingMetric>('courses_completed');
  const [timePeriod, setTimePeriod] = useState<'week' | 'month' | 'all'>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [anonymizeNames, setAnonymizeNames] = useState(false);

  useEffect(() => {
    fetchData();
    loadSettings();
    loadBadges();
  }, [selectedStoreId]);

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
            storeId: e.storeId,
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

      // Filter employees by store if selectedStoreId is provided
      let filteredEmployeesData = employeesData;
      if (selectedStoreId) {
        filteredEmployeesData = employeesData.filter((emp: any) => emp.storeId === selectedStoreId);
      }

      // Create lookup maps for O(1) access (using filtered employees)
      const employeeMap = new Map(filteredEmployeesData.map((e: any) => [e.id, e]));
      const courseMap = new Map(coursesData.map((c: any) => [c.id, c]));

      // Process assignments with lookup maps (only for filtered employees)
      const filteredEmployeeIds = new Set(filteredEmployeesData.map((e: any) => e.id));
      const assignmentsData: any[] = allAssignmentsData
        .filter((a: any) => filteredEmployeeIds.has(a.employeeId)) // Filter assignments by employee IDs from the selected store
        .map((a: any) => ({
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

      // Filter results to only include those for filtered employees
      const filteredResultsData = resultsData.filter((r: any) => {
        const assignment = assignmentsData.find((a: any) => a.id === r.assignmentId);
        return assignment !== undefined;
      });

      setAssignments(assignmentsData);
      setResults(filteredResultsData);
      setEmployees(filteredEmployeesData);
      setCourses(coursesData);

      // Generate badges after data is loaded
      // Use setTimeout to ensure state is updated
      setTimeout(() => {
        generateBadgesFromData(assignmentsData, resultsData);
      }, 100);
    } catch (err) {
      console.error('Error fetching leaderboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = () => {
    const saved = localStorage.getItem('leaderboard_settings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  };

  const saveSettings = (newSettings: LeaderboardSettings) => {
    setSettings(newSettings);
    localStorage.setItem('leaderboard_settings', JSON.stringify(newSettings));
  };

  const loadBadges = () => {
    const saved = localStorage.getItem('employee_badges');
    if (saved) {
      try {
        const badgesData = JSON.parse(saved);
        const badgesMap = new Map<string, Badge[]>();
        Object.entries(badgesData).forEach(([employeeId, badgeList]: [string, any]) => {
          badgesMap.set(employeeId, badgeList);
        });
        setBadges(badgesMap);
      } catch (e) {
        console.error('Error loading badges from localStorage:', e);
      }
    }
    // Badges will be generated after data is loaded in fetchData
  };

  const generateBadgesFromData = (assignmentsData: any[], resultsData: any[]) => {
    if (assignmentsData.length === 0 && resultsData.length === 0) {
      return; // No data to generate badges from
    }

    const badgesMap = new Map<string, Badge[]>();

    // Perfect Score badges
    resultsData.forEach((result) => {
      if (result.score === 100) {
        const assignment = assignmentsData.find((a) => a.id === result.assignmentId);
        if (assignment?.employee?.id) {
          const employeeId = assignment.employee.id;
          if (!badgesMap.has(employeeId)) {
            badgesMap.set(employeeId, []);
          }
          const existing = badgesMap.get(employeeId)!;
          if (!existing.some((b) => b.type === 'perfect_score' && b.courseId === assignment.courseId)) {
            existing.push({
              id: `perfect_${result.id}`,
              type: 'perfect_score',
              name: 'Perfect Score',
              description: `Scored 100% on ${assignment.course?.title || 'quiz'}`,
              earnedAt: result.createdAt,
              courseId: assignment.courseId,
              courseTitle: assignment.course?.title,
            });
          }
        }
      }
    });

    // First to Complete badges
    const courseFirstCompletions = new Map<string, { employeeId: string; completedAt: string; courseTitle: string }>();
    assignmentsData
      .filter((a) => a.isTrainingComplete && a.trainingCompletedAt)
      .sort((a, b) => new Date(a.trainingCompletedAt!).getTime() - new Date(b.trainingCompletedAt!).getTime())
      .forEach((assignment) => {
        if (!courseFirstCompletions.has(assignment.courseId)) {
          courseFirstCompletions.set(assignment.courseId, {
            employeeId: assignment.employeeId,
            completedAt: assignment.trainingCompletedAt!,
            courseTitle: assignment.course?.title || 'Course',
          });
        }
      });

    courseFirstCompletions.forEach((data, courseId) => {
      if (!badgesMap.has(data.employeeId)) {
        badgesMap.set(data.employeeId, []);
      }
      badgesMap.get(data.employeeId)!.push({
        id: `first_${courseId}_${data.employeeId}`,
        type: 'first_to_complete',
        name: 'First to Complete',
        description: `First employee to complete ${data.courseTitle}`,
        earnedAt: data.completedAt,
        courseId,
        courseTitle: data.courseTitle,
      });
    });

    // Speed Learner badges (completed within 24 hours of assignment)
    assignmentsData
      .filter((a) => a.isTrainingComplete && a.trainingCompletedAt && a.createdAt)
      .forEach((assignment) => {
        const assignedTime = new Date(assignment.createdAt).getTime();
        const completedTime = new Date(assignment.trainingCompletedAt!).getTime();
        const hoursToComplete = (completedTime - assignedTime) / (1000 * 60 * 60);
        
        if (hoursToComplete <= 24 && hoursToComplete > 0) {
          const employeeId = assignment.employeeId;
          if (!badgesMap.has(employeeId)) {
            badgesMap.set(employeeId, []);
          }
          const existing = badgesMap.get(employeeId)!;
          if (!existing.some((b) => b.type === 'speed_learner' && b.courseId === assignment.courseId)) {
            existing.push({
              id: `speed_${assignment.id}`,
              type: 'speed_learner',
              name: 'Speed Learner',
              description: `Completed ${assignment.course?.title || 'course'} within 24 hours`,
              earnedAt: assignment.trainingCompletedAt!,
              courseId: assignment.courseId,
              courseTitle: assignment.course?.title,
            });
          }
        }
      });

    // Training Champion (most courses in a month)
    const now = new Date();
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const monthlyCompletions = new Map<string, number>();
    assignmentsData
      .filter((a) => a.isTrainingComplete && a.trainingCompletedAt && new Date(a.trainingCompletedAt) >= oneMonthAgo)
      .forEach((assignment) => {
        const count = monthlyCompletions.get(assignment.employeeId) || 0;
        monthlyCompletions.set(assignment.employeeId, count + 1);
      });

    const maxCompletions = Math.max(...Array.from(monthlyCompletions.values()), 0);
    if (maxCompletions > 0) {
      monthlyCompletions.forEach((count, employeeId) => {
        if (count === maxCompletions && count >= 3) {
          if (!badgesMap.has(employeeId)) {
            badgesMap.set(employeeId, []);
          }
          const existing = badgesMap.get(employeeId)!;
          if (!existing.some((b) => b.type === 'training_champion' && b.id?.includes(`${now.getMonth()}`))) {
            existing.push({
              id: `champion_${employeeId}_${now.getMonth()}_${now.getFullYear()}`,
              type: 'training_champion',
              name: 'Training Champion',
              description: `Completed ${count} courses this month`,
              earnedAt: now.toISOString(),
            });
          }
        }
      });
    }

    // Merge with existing badges from localStorage
    const saved = localStorage.getItem('employee_badges');
    if (saved) {
      try {
        const existingBadges = JSON.parse(saved);
        Object.entries(existingBadges).forEach(([employeeId, badgeList]: [string, any]) => {
          if (!badgesMap.has(employeeId)) {
            badgesMap.set(employeeId, []);
          }
          const existing = badgesMap.get(employeeId)!;
          // Add existing badges that aren't duplicates
          (badgeList as Badge[]).forEach((badge) => {
            if (!existing.some((b) => b.id === badge.id)) {
              existing.push(badge);
            }
          });
        });
      } catch (e) {
        console.error('Error merging existing badges:', e);
      }
    }

    setBadges(badgesMap);
    const badgesObj: any = {};
    badgesMap.forEach((badgeList, employeeId) => {
      badgesObj[employeeId] = badgeList;
    });
    localStorage.setItem('employee_badges', JSON.stringify(badgesObj));
  };

  // Filter data based on time period
  const filteredData = useMemo(() => {
    const now = new Date();
    let startDate: Date | null = null;

    if (timePeriod === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (timePeriod === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    }

    let filteredAssignments = assignments;
    let filteredResults = results;

    if (startDate) {
      filteredAssignments = filteredAssignments.filter(
        (a) => a.trainingCompletedAt && new Date(a.trainingCompletedAt) >= startDate!
      );
      filteredResults = filteredResults.filter((r) => new Date(r.createdAt) >= startDate!);
    }

    if (departmentFilter !== 'all') {
      filteredAssignments = filteredAssignments.filter(
        (a) => a.employee?.department === departmentFilter
      );
    }

    if (courseFilter !== 'all') {
      filteredAssignments = filteredAssignments.filter((a) => a.courseId === courseFilter);
      filteredResults = filteredResults.filter((r) => {
        const assignment = filteredAssignments.find((a) => a.id === r.assignmentId);
        return assignment !== undefined;
      });
    }

    return { filteredAssignments, filteredResults };
  }, [assignments, results, timePeriod, departmentFilter, courseFilter]);

  // Calculate rankings
  const rankings = useMemo(() => {
    const { filteredAssignments, filteredResults } = filteredData;
    const employeeMap = new Map<string, EmployeeRanking>();

    employees.forEach((emp) => {
      if (!employeeMap.has(emp.id)) {
        employeeMap.set(emp.id, {
          employee: emp,
          rank: 0,
          value: 0,
          displayValue: '',
          badges: badges.get(emp.id) || [],
        });
      }
    });

    switch (rankingMetric) {
      case 'courses_completed':
        filteredAssignments
          .filter((a) => a.isTrainingComplete)
          .forEach((assignment) => {
            const ranking = employeeMap.get(assignment.employeeId);
            if (ranking) {
              ranking.value += 1;
            }
          });
        employeeMap.forEach((ranking) => {
          ranking.displayValue = `${ranking.value} courses`;
        });
        break;

      case 'average_score':
        const employeeScores = new Map<string, number[]>();
        filteredResults.forEach((result) => {
          const assignment = filteredAssignments.find((a) => a.id === result.assignmentId);
          if (assignment) {
            if (!employeeScores.has(assignment.employeeId)) {
              employeeScores.set(assignment.employeeId, []);
            }
            employeeScores.get(assignment.employeeId)!.push(result.score);
          }
        });
        employeeScores.forEach((scores, employeeId) => {
          const ranking = employeeMap.get(employeeId);
          if (ranking) {
            ranking.value = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
            ranking.displayValue = `${ranking.value}%`;
          }
        });
        break;

      case 'training_hours':
        filteredAssignments
          .filter((a) => a.isTrainingComplete)
          .forEach((assignment) => {
            const ranking = employeeMap.get(assignment.employeeId);
            if (ranking && assignment.course?.duration) {
              const durationStr = assignment.course.duration.toLowerCase();
              const match = durationStr.match(/(\d+)\s*(?:hour|hr|h|minute|min|m)/g);
              if (match) {
                let minutes = 0;
                match.forEach((m: string) => {
                  const num = parseInt(m);
                  if (m.includes('hour') || m.includes('hr') || m.includes('h')) {
                    minutes += num * 60;
                  } else {
                    minutes += num;
                  }
                });
                ranking.value += minutes / 60;
              }
            }
          });
        employeeMap.forEach((ranking) => {
          ranking.displayValue = `${ranking.value.toFixed(1)} hours`;
        });
        break;

      case 'fastest_completion':
        const completionTimes = new Map<string, number[]>();
        filteredAssignments
          .filter((a) => a.isTrainingComplete && a.trainingCompletedAt)
          .forEach((assignment) => {
            const timeDiff = new Date(assignment.trainingCompletedAt!).getTime() - new Date(assignment.createdAt).getTime();
            const hours = timeDiff / (1000 * 60 * 60);
            if (!completionTimes.has(assignment.employeeId)) {
              completionTimes.set(assignment.employeeId, []);
            }
            completionTimes.get(assignment.employeeId)!.push(hours);
          });
        completionTimes.forEach((times, employeeId) => {
          const ranking = employeeMap.get(employeeId);
          if (ranking) {
            ranking.value = Math.round((times.reduce((sum, t) => sum + t, 0) / times.length) * 10) / 10;
            ranking.displayValue = `${ranking.value} hours avg`;
          }
        });
        break;
    }

    // Sort and assign ranks
    const sorted = Array.from(employeeMap.values())
      .filter((r) => r.value > 0)
      .sort((a, b) => {
        if (rankingMetric === 'fastest_completion') {
          return a.value - b.value; // Lower is better
        }
        return b.value - a.value; // Higher is better
      });

    sorted.forEach((ranking, index) => {
      ranking.rank = index + 1;
    });

    return sorted;
  }, [filteredData, rankingMetric, employees, badges]);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getBadgeIcon = (type: string) => {
    switch (type) {
      case 'first_to_complete':
        return <EmojiEventsIcon fontSize="small" />;
      case 'perfect_score':
        return <StarIcon fontSize="small" />;
      case 'speed_learner':
        return <SpeedIcon fontSize="small" />;
      case 'training_champion':
        return <MilitaryTechIcon fontSize="small" />;
      default:
        return <SchoolIcon fontSize="small" />;
    }
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'first_to_complete':
        return 'primary';
      case 'perfect_score':
        return 'warning';
      case 'speed_learner':
        return 'info';
      case 'training_champion':
        return 'success';
      default:
        return 'default';
    }
  };

  const departments = Array.from(
    new Set(employees.map((e) => e.department).filter((d): d is string => d !== null && d !== undefined))
  ).sort();

  // Chart data calculations
  const topPerformersChartData = useMemo(() => {
    return rankings.slice(0, 10).map((ranking) => ({
      name: anonymizeNames ? `Employee ${ranking.rank}` : ranking.employee.name.split(' ')[0],
      value: ranking.value,
      rank: ranking.rank,
      department: ranking.employee.department || 'N/A',
    }));
  }, [rankings, anonymizeNames]);

  const departmentPerformanceData = useMemo(() => {
    const deptMap = new Map<string, { total: number; count: number; employees: string[] }>();
    
    rankings.forEach((ranking) => {
      const dept = ranking.employee.department || 'N/A';
      if (!deptMap.has(dept)) {
        deptMap.set(dept, { total: 0, count: 0, employees: [] });
      }
      const deptData = deptMap.get(dept)!;
      deptData.total += ranking.value;
      deptData.count += 1;
      if (!deptData.employees.includes(ranking.employee.id)) {
        deptData.employees.push(ranking.employee.id);
      }
    });

    return Array.from(deptMap.entries())
      .map(([department, data]) => ({
        department,
        averageValue: data.count > 0 ? Math.round((data.total / data.count) * 10) / 10 : 0,
        employeeCount: data.employees.length,
        totalValue: Math.round(data.total * 10) / 10,
      }))
      .sort((a, b) => b.averageValue - a.averageValue);
  }, [rankings]);

  const valueDistributionData = useMemo(() => {
    const distribution: { [key: string]: number } = {};
    
    rankings.forEach((ranking) => {
      let key: string;
      if (rankingMetric === 'courses_completed') {
        const range = Math.floor(ranking.value / 5) * 5;
        key = `${range}-${range + 4}`;
      } else if (rankingMetric === 'average_score') {
        const range = Math.floor(ranking.value / 10) * 10;
        key = `${range}-${range + 9}%`;
      } else if (rankingMetric === 'training_hours') {
        const range = Math.floor(ranking.value / 5) * 5;
        key = `${range}-${range + 4}h`;
      } else {
        const range = Math.floor(ranking.value / 5) * 5;
        key = `${range}-${range + 4}h`;
      }
      distribution[key] = (distribution[key] || 0) + 1;
    });

    return Object.entries(distribution)
      .map(([range, count]) => ({ range, count }))
      .sort((a, b) => {
        const aNum = parseInt(a.range);
        const bNum = parseInt(b.range);
        return aNum - bNum;
      });
  }, [rankings, rankingMetric]);

  const badgeDistributionData = useMemo(() => {
    const badgeCounts: { [key: string]: number } = {};
    
    badges.forEach((badgeList) => {
      badgeList.forEach((badge) => {
        badgeCounts[badge.type] = (badgeCounts[badge.type] || 0) + 1;
      });
    });

    const badgeNames: { [key: string]: string } = {
      first_to_complete: 'First to Complete',
      perfect_score: 'Perfect Score',
      speed_learner: 'Speed Learner',
      training_champion: 'Training Champion',
    };

    const colors: { [key: string]: string } = {
      first_to_complete: theme.palette.primary.main,
      perfect_score: theme.palette.warning.main,
      speed_learner: theme.palette.info.main,
      training_champion: theme.palette.success.main,
    };

    return Object.entries(badgeCounts)
      .map(([type, count]) => ({
        name: badgeNames[type] || type,
        value: count,
        color: colors[type] || theme.palette.grey[500],
      }))
      .filter((item) => item.value > 0);
  }, [badges, theme]);

  const metricComparisonData = useMemo(() => {
    if (rankings.length === 0) return [];
    
    const top10 = rankings.slice(0, 10);
    return top10.map((ranking) => {
      const employeeScores = results
        .filter((r) => {
          const assignment = assignments.find((a) => a.id === r.assignmentId);
          return assignment?.employeeId === ranking.employee.id;
        })
        .map((r) => r.score);
      
      const completedCourses = assignments.filter(
        (a) => a.employeeId === ranking.employee.id && a.isTrainingComplete
      ).length;

      const trainingHours = assignments
        .filter((a) => a.employeeId === ranking.employee.id && a.isTrainingComplete && a.course?.duration)
        .reduce((total, a) => {
          const durationStr = a.course.duration.toLowerCase();
          const match = durationStr.match(/(\d+)\s*(?:hour|hr|h|minute|min|m)/g);
          if (match) {
            let minutes = 0;
            match.forEach((m: string) => {
              const num = parseInt(m);
              if (m.includes('hour') || m.includes('hr') || m.includes('h')) {
                minutes += num * 60;
              } else {
                minutes += num;
              }
            });
            return total + minutes / 60;
          }
          return total;
        }, 0);

      return {
        name: anonymizeNames ? `Emp ${ranking.rank}` : ranking.employee.name.split(' ')[0],
        coursesCompleted: completedCourses,
        averageScore: employeeScores.length > 0 
          ? Math.round(employeeScores.reduce((sum, s) => sum + s, 0) / employeeScores.length)
          : 0,
        trainingHours: Math.round(trainingHours * 10) / 10,
      };
    });
  }, [rankings, results, assignments, anonymizeNames]);

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
        <Typography variant="h4">Training Leaderboard</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton onClick={() => setShowSettings(true)} color="primary" title="Settings">
            <SettingsIcon />
          </IconButton>
          <IconButton onClick={fetchData} color="primary" title="Refresh">
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {!settings.enabled && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Leaderboard is currently disabled. Enable it in settings to view rankings.
        </Alert>
      )}

      {settings.enabled && (
        <>
          {/* Filters */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Ranking By</InputLabel>
                    <Select
                      value={rankingMetric}
                      label="Ranking By"
                      onChange={(e) => setRankingMetric(e.target.value as RankingMetric)}
                    >
                      <MenuItem value="courses_completed">Courses Completed</MenuItem>
                      <MenuItem value="average_score">Average Quiz Score</MenuItem>
                      <MenuItem value="training_hours">Training Hours</MenuItem>
                      <MenuItem value="fastest_completion">Fastest Completion</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Time Period</InputLabel>
                    <Select
                      value={timePeriod}
                      label="Time Period"
                      onChange={(e) => setTimePeriod(e.target.value as 'week' | 'month' | 'all')}
                    >
                      <MenuItem value="week">This Week</MenuItem>
                      <MenuItem value="month">This Month</MenuItem>
                      <MenuItem value="all">All Time</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Department</InputLabel>
                    <Select
                      value={departmentFilter}
                      label="Department"
                      onChange={(e) => setDepartmentFilter(e.target.value)}
                    >
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
                    <Select
                      value={courseFilter}
                      label="Course"
                      onChange={(e) => setCourseFilter(e.target.value)}
                    >
                      <MenuItem value="all">All Courses</MenuItem>
                      {courses.map((course) => (
                        <MenuItem key={course.id} value={course.id}>
                          {course.title}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={anonymizeNames}
                        onChange={(e) => setAnonymizeNames(e.target.checked)}
                      />
                    }
                    label="Anonymize Employee Names"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Charts Section */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            {/* Top Performers Bar Chart */}
            {topPerformersChartData.length > 0 && (
              <Grid item xs={12} md={8}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Top 10 Performers
                    </Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={topPerformersChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <RechartsTooltip />
                        <Legend />
                        <Bar 
                          dataKey="value" 
                          fill={theme.palette.primary.main} 
                          name={rankingMetric.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Badge Distribution Pie Chart */}
            {badgeDistributionData.length > 0 && (
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Badge Distribution
                    </Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={badgeDistributionData}
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
                          {badgeDistributionData.map((entry, index) => (
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
                        <RechartsTooltip />
                        <Legend />
                        <Bar 
                          dataKey="averageValue" 
                          fill={theme.palette.primary.main} 
                          name="Average Value"
                        />
                        <Bar 
                          dataKey="employeeCount" 
                          fill={theme.palette.secondary.main} 
                          name="Employee Count"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Value Distribution */}
            {valueDistributionData.length > 0 && (
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Value Distribution
                    </Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={valueDistributionData}>
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

            {/* Metric Comparison - Multi-metric view for top performers */}
            {metricComparisonData.length > 0 && rankingMetric === 'courses_completed' && (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Top Performers - Multi-Metric Comparison
                    </Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={metricComparisonData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <RechartsTooltip />
                        <Legend />
                        <Bar dataKey="coursesCompleted" fill={theme.palette.primary.main} name="Courses Completed" />
                        <Bar dataKey="averageScore" fill={theme.palette.success.main} name="Average Score (%)" />
                        <Bar dataKey="trainingHours" fill={theme.palette.warning.main} name="Training Hours" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>

          {/* Leaderboard Table */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Top Performers - {rankingMetric.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Last updated: {new Date().toLocaleString()}
                </Typography>
              </Box>
              {rankings.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary">No rankings available for the selected filters</Typography>
                </Box>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Rank</TableCell>
                        <TableCell>Employee</TableCell>
                        <TableCell>Department</TableCell>
                        <TableCell align="right">Value</TableCell>
                        <TableCell>Badges</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rankings.map((ranking) => (
                        <TableRow
                          key={ranking.employee.id}
                          sx={{
                            bgcolor:
                              ranking.rank === 1
                                ? 'rgba(255, 215, 0, 0.1)'
                                : ranking.rank === 2
                                ? 'rgba(192, 192, 192, 0.1)'
                                : ranking.rank === 3
                                ? 'rgba(205, 127, 50, 0.1)'
                                : 'inherit',
                          }}
                        >
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="h6" fontWeight="bold">
                                {getRankIcon(ranking.rank)}
                              </Typography>
                              {ranking.rank <= 3 && <EmojiEventsIcon color="primary" />}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar>
                                <PersonIcon />
                              </Avatar>
                              <Box>
                                <Typography variant="body2" fontWeight="medium">
                                  {anonymizeNames
                                    ? `Employee ${ranking.rank}`
                                    : ranking.employee.name}
                                </Typography>
                                {!anonymizeNames && (
                                  <Typography variant="caption" color="text.secondary">
                                    {ranking.employee.email}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>{ranking.employee.department || 'N/A'}</TableCell>
                          <TableCell align="right">
                            <Typography variant="body1" fontWeight="bold" color="primary">
                              {ranking.displayValue}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {ranking.badges.slice(0, 3).map((badge) => (
                                <Tooltip key={badge.id} title={badge.description}>
                                  <Chip
                                    icon={getBadgeIcon(badge.type)}
                                    label={badge.name}
                                    color={getBadgeColor(badge.type) as any}
                                    size="small"
                                  />
                                </Tooltip>
                              ))}
                              {ranking.badges.length > 3 && (
                                <Chip label={`+${ranking.badges.length - 3}`} size="small" variant="outlined" />
                              )}
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

          {/* Additional Charts Section - After Table */}
          <Grid container spacing={3} sx={{ mt: 3, mb: 3 }}>
            {/* Rank Distribution */}
            {rankings.length > 0 && (
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Performance Distribution
                    </Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={rankings.slice(0, 20).map((r) => ({
                        rank: r.rank,
                        value: r.value,
                        name: anonymizeNames ? `Rank ${r.rank}` : r.employee.name.split(' ')[0],
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="rank" />
                        <YAxis />
                        <RechartsTooltip />
                        <Legend />
                        <Bar 
                          dataKey="value" 
                          fill={theme.palette.secondary.main} 
                          name={rankingMetric.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Top 3 Comparison */}
            {rankings.length >= 3 && (
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Top 3 Performers Comparison
                    </Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={rankings.slice(0, 3).map((r) => ({
                        name: anonymizeNames ? `Rank ${r.rank}` : r.employee.name.split(' ')[0],
                        value: r.value,
                        rank: r.rank,
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <RechartsTooltip />
                        <Legend />
                        <Bar 
                          dataKey="value" 
                          fill={theme.palette.success.main} 
                          name={rankingMetric.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Department Leaderboard Comparison */}
            {departmentPerformanceData.length > 0 && (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Department Leaderboard Comparison
                    </Typography>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={departmentPerformanceData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="department" angle={-45} textAnchor="end" height={100} />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <RechartsTooltip />
                        <Legend />
                        <Bar 
                          yAxisId="left"
                          dataKey="averageValue" 
                          fill={theme.palette.primary.main} 
                          name="Average Value"
                        />
                        <Bar 
                          yAxisId="right"
                          dataKey="employeeCount" 
                          fill={theme.palette.info.main} 
                          name="Participating Employees"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Ranking Metric Comparison - All Metrics */}
            {metricComparisonData.length > 0 && (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Comprehensive Performance Metrics (Top 10)
                    </Typography>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={metricComparisonData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <RechartsTooltip />
                        <Legend />
                        <Bar 
                          yAxisId="left"
                          dataKey="coursesCompleted" 
                          fill={theme.palette.primary.main} 
                          name="Courses Completed"
                        />
                        <Bar 
                          yAxisId="left"
                          dataKey="averageScore" 
                          fill={theme.palette.success.main} 
                          name="Average Score (%)"
                        />
                        <Bar 
                          yAxisId="right"
                          dataKey="trainingHours" 
                          fill={theme.palette.warning.main} 
                          name="Training Hours"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Value Range Distribution */}
            {valueDistributionData.length > 0 && (
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Value Range Distribution
                    </Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={valueDistributionData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="range" />
                        <YAxis />
                        <RechartsTooltip />
                        <Legend />
                        <Bar 
                          dataKey="count" 
                          fill={theme.palette.info.main} 
                          name="Number of Employees"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Top Performers by Department */}
            {rankings.length > 0 && departmentPerformanceData.length > 0 && (
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Top Performer by Department
                    </Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={departmentPerformanceData.slice(0, 8).map((dept) => {
                        const topEmployee = rankings.find(
                          (r) => r.employee.department === dept.department
                        );
                        return {
                          department: dept.department,
                          topValue: topEmployee?.value || 0,
                          averageValue: dept.averageValue,
                        };
                      }).filter((d) => d.topValue > 0)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="department" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <RechartsTooltip />
                        <Legend />
                        <Bar 
                          dataKey="topValue" 
                          fill={theme.palette.success.main} 
                          name="Top Performer Value"
                        />
                        <Bar 
                          dataKey="averageValue" 
                          fill={theme.palette.primary.main} 
                          name="Department Average"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>

          {/* Badges Overview */}
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Badge Achievements
              </Typography>
              {badges.size === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    No badges have been earned yet. Badges are awarded for achievements like perfect scores, first completions, and training milestones.
                  </Typography>
                </Box>
              ) : (
                <Grid container spacing={2}>
                  {Array.from(badges.entries())
                    .filter(([employeeId, badgeList]) => {
                      const employee = employees.find((e) => e.id === employeeId);
                      return employee && badgeList.length > 0;
                    })
                    .map(([employeeId, badgeList]) => {
                      const employee = employees.find((e) => e.id === employeeId);
                      if (!employee) return null;
                      return (
                        <Grid item xs={12} sm={6} md={4} key={employeeId}>
                          <Card variant="outlined" sx={{ height: '100%' }}>
                            <CardContent>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                                <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                                  <PersonIcon />
                                </Avatar>
                                <Typography variant="subtitle2" fontWeight={600}>
                                  {anonymizeNames ? 'Employee' : employee.name}
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {badgeList.map((badge) => (
                                  <Tooltip key={badge.id} title={badge.description}>
                                    <Chip
                                      icon={getBadgeIcon(badge.type)}
                                      label={badge.name}
                                      color={getBadgeColor(badge.type) as any}
                                      size="small"
                                      sx={{ fontWeight: 500 }}
                                    />
                                  </Tooltip>
                                ))}
                              </Box>
                            </CardContent>
                          </Card>
                        </Grid>
                      );
                    })}
                </Grid>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Settings Dialog */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Leaderboard Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.enabled}
                  onChange={(e) => saveSettings({ ...settings, enabled: e.target.checked })}
                />
              }
              label="Enable Leaderboard"
            />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              When enabled, the leaderboard will be visible and rankings will be calculated.
            </Typography>

            <Divider sx={{ my: 2 }} />

            <FormControlLabel
              control={
                <Switch
                  checked={settings.visibleToEmployees}
                  onChange={(e) => saveSettings({ ...settings, visibleToEmployees: e.target.checked })}
                  disabled={!settings.enabled}
                />
              }
              label="Visible to Employees"
            />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              When enabled, employees can see the leaderboard in their app. When disabled, only managers can view it.
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" gutterBottom>
              Displayed Metrics
            </Typography>
            {(['courses_completed', 'average_score', 'training_hours', 'fastest_completion'] as RankingMetric[]).map(
              (metric) => (
                <FormControlLabel
                  key={metric}
                  control={
                    <Switch
                      checked={settings.metrics.includes(metric)}
                      onChange={(e) => {
                        const newMetrics = e.target.checked
                          ? [...settings.metrics, metric]
                          : settings.metrics.filter((m: RankingMetric) => m !== metric);
                        saveSettings({ ...settings, metrics: newMetrics });
                      }}
                      disabled={!settings.enabled}
                    />
                  }
                  label={metric.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                />
              )
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TrainingLeaderboard;


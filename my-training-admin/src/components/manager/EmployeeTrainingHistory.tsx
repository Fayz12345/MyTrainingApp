import React, { useState, useEffect } from 'react';
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
  CircularProgress,
  Alert,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  IconButton,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import VisibilityIcon from '@mui/icons-material/Visibility';
// @ts-ignore - jspdf types may not be perfect
import jsPDF from 'jspdf';

const client = generateClient<Schema>();

interface EmployeeTrainingHistoryProps {
  employeeId: string;
  employeeName: string;
  onBack: () => void;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  department?: string | null;
  createdAt: string;
}

interface Assignment {
  id: string;
  employeeId: string;
  courseId: string;
  status: 'assigned' | 'completed' | null;
  isTrainingComplete: boolean;
  trainingCompletedAt?: string | null;
  hasViewedPdf: boolean;
  createdAt: string;
  updatedAt: string;
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
  answers?: number[] | null; // Array of answer indices (0-based) for each question
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
  createdAt: string;
  updatedAt: string;
  learningPath?: {
    id: string;
    title: string;
  } | null;
}

interface QuizQuestion {
  id: string;
  question: string;
  questionType: string;
  options: string[];
  correctAnswer?: number | null;
  correctAnswerText?: string | null;
}

interface QuizAttempt {
  result: Result;
  questions: QuizQuestion[];
  answers?: number[]; // This would need to be stored separately if we want to track individual answers
}

interface TrainingNote {
  id: string;
  assignmentId?: string;
  note: string;
  createdAt: string;
  createdBy: string;
}

const EmployeeTrainingHistory: React.FC<EmployeeTrainingHistoryProps> = ({
  employeeId,
  employeeName,
  onBack,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]); // Store all assignments including learning path ones
  const [pathAssignments, setPathAssignments] = useState<LearningPathAssignment[]>([]);
  const [learningPathCourses, setLearningPathCourses] = useState<Map<string, { courseId: string; order: number; course?: { id: string; title: string } }[]>>(new Map());
  const [results, setResults] = useState<Result[]>([]);
  const [quizDetails, setQuizDetails] = useState<Map<string, QuizQuestion[]>>(new Map());
  const [selectedQuiz, setSelectedQuiz] = useState<{ assignmentId: string; result: Result } | null>(null);
  const [notes, setNotes] = useState<TrainingNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [selectedAssignmentForNote, setSelectedAssignmentForNote] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  const [expandedPathId, setExpandedPathId] = useState<string | null>(null);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    fetchData();
  }, [employeeId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Helper function to fetch all pages
      const fetchAllPages = async <T,>(
        fetchFn: (nextToken?: string) => Promise<any>,
        mapFn: (item: any) => T
      ): Promise<T[]> => {
        const allData: T[] = [];
        let nextToken: string | undefined = undefined;
        do {
          const response: { data?: any[]; nextToken?: string } = await fetchFn(nextToken);
          const items = (response.data || []).map(mapFn).filter((item: T) => item !== null && item !== undefined);
          allData.push(...items);
          nextToken = response.nextToken;
        } while (nextToken);
        return allData;
      };

      // Fetch all independent data in parallel
      const [employeeResponse, assignmentsResponse, pathAssignmentsResponse] = await Promise.all([
        client.models.Employee.get({ id: employeeId }),
        fetchAllPages(
          (nextToken) => client.models.Assignment.list({
            filter: { employeeId: { eq: employeeId } },
            nextToken,
          }),
          (a: any) => a
        ),
        fetchAllPages(
          (nextToken) => client.models.LearningPathAssignment.list({
            filter: { employeeId: { eq: employeeId } },
            nextToken,
          }),
          (p: any) => p
        ),
      ]);

      // Set employee data
      if (!employeeResponse.data || !employeeResponse.data.id) {
        throw new Error('Employee not found');
      }
      setEmployee({
        id: employeeResponse.data.id,
        name: employeeResponse.data.name,
        email: employeeResponse.data.email,
        department: employeeResponse.data.department,
        createdAt: employeeResponse.data.createdAt,
      });

      // Process assignments - fetch courses in parallel
      const assignmentsList = assignmentsResponse.filter((a: any) => a.id);
      const coursePromises = assignmentsList.map((a: any) => 
        a.course ? a.course() : Promise.resolve(null)
      );
      const courseResults = await Promise.all(coursePromises);

      const assignmentsData: Assignment[] = assignmentsList.map((a: any, index: number) => {
        const course = courseResults[index];
        return {
          id: a.id,
          employeeId: a.employeeId,
          courseId: a.courseId,
          status: a.status,
          isTrainingComplete: a.isTrainingComplete ?? false,
          trainingCompletedAt: a.trainingCompletedAt,
          hasViewedPdf: a.hasViewedPdf ?? false,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
          course: course?.data
            ? {
                id: course.data.id || '',
                title: course.data.title || '',
                duration: course.data.duration,
                passingScore: course.data.passingScore,
              }
            : null,
        };
      });
      setAssignments(assignmentsData);

      // Process learning path assignments - fetch learning paths in parallel
      const pathAssignmentsList = pathAssignmentsResponse.filter((p: any) => p.id);
      const learningPathPromises = pathAssignmentsList.map((p: any) =>
        p.learningPath ? p.learningPath() : Promise.resolve(null)
      );
      const learningPathResults = await Promise.all(learningPathPromises);

      const pathAssignmentsData: LearningPathAssignment[] = pathAssignmentsList.map((p: any, index: number) => {
        const learningPath = learningPathResults[index];
        return {
          id: p.id,
          employeeId: p.employeeId,
          learningPathId: p.learningPathId,
          status: p.status,
          assignedDate: p.assignedDate,
          dueDate: p.dueDate,
          completedDate: p.completedDate,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          learningPath: learningPath?.data
            ? { id: learningPath.data.id || '', title: learningPath.data.title || '' }
            : null,
        };
      });
      setPathAssignments(pathAssignmentsData);

      // Fetch all LearningPathCourse records for the assigned learning paths to identify which courses belong to learning paths
      const learningPathIds = pathAssignmentsData.map((p) => p.learningPathId).filter((id): id is string => !!id);
      const learningPathCoursePromises = learningPathIds.map((learningPathId) =>
        fetchAllPages(
          (nextToken) => client.models.LearningPathCourse.list({
            filter: { learningPathId: { eq: learningPathId } },
            nextToken,
          }),
          (lpc: any) => lpc.id ? {
            learningPathId: lpc.learningPathId,
            courseId: lpc.courseId,
            order: lpc.order || 0,
          } : null
        )
      );
      const learningPathCourseArrays = await Promise.all(learningPathCoursePromises);
      const allLearningPathCourseRecords = learningPathCourseArrays.flat().filter((lpc): lpc is { learningPathId: string; courseId: string; order: number } => lpc !== null);
      
      // Create a set of courseIds that belong to learning paths
      const learningPathCourseIds = new Set<string>(allLearningPathCourseRecords.map((lpc) => lpc.courseId));

      // Store all assignments (we'll need them to show courses in learning paths)
      setAllAssignments(assignmentsData);

      // Filter out assignments that belong to learning paths from the standalone assignments
      const standaloneAssignments = assignmentsData.filter((assignment) => 
        !learningPathCourseIds.has(assignment.courseId)
      );
      setAssignments(standaloneAssignments);

      // Organize learning path courses by learningPathId with order
      const finalPathCoursesMap = new Map<string, { courseId: string; order: number; course?: { id: string; title: string } }[]>();
      for (const lpcRecord of allLearningPathCourseRecords) {
        if (!lpcRecord) continue;
        if (!finalPathCoursesMap.has(lpcRecord.learningPathId)) {
          finalPathCoursesMap.set(lpcRecord.learningPathId, []);
        }
        const course = assignmentsData.find((a) => a.courseId === lpcRecord.courseId)?.course;
        finalPathCoursesMap.get(lpcRecord.learningPathId)!.push({
          courseId: lpcRecord.courseId,
          order: lpcRecord.order,
          course: course ? { id: course.id, title: course.title } : undefined,
        });
      }

      // Sort courses by order within each learning path
      finalPathCoursesMap.forEach((courses) => {
        courses.sort((a: { courseId: string; order: number; course?: { id: string; title: string } }, b: { courseId: string; order: number; course?: { id: string; title: string } }) => a.order - b.order);
      });
      setLearningPathCourses(finalPathCoursesMap);

      // Fetch all results in parallel for all assignments with pagination (use allAssignments, not filtered ones)
      const assignmentIds = assignmentsData.map((a) => a.id);
      const resultPromises = assignmentIds.map((assignmentId) =>
        fetchAllPages(
          (nextToken) => client.models.Result.list({
            filter: { assignmentId: { eq: assignmentId } },
            nextToken,
          }),
          (r: any): Result | null => r.id ? {
            id: r.id,
            assignmentId: assignmentId,
            score: r.score,
            passed: r.passed,
            answers: r.answers || null,
            createdAt: r.createdAt,
          } : null
        )
      );
      const resultArrays = await Promise.all(resultPromises);
      const allResults: Result[] = resultArrays.flat().filter((r): r is Result => r !== null);
      setResults(allResults);

      // Load notes from localStorage (simple implementation)
      const savedNotes = localStorage.getItem(`employee_notes_${employeeId}`);
      if (savedNotes) {
        try {
          const parsedNotes = JSON.parse(savedNotes);
          setNotes(Array.isArray(parsedNotes) ? parsedNotes : []);
        } catch (err) {
          console.error('Error parsing notes from localStorage:', err);
          setNotes([]);
        }
      } else {
        setNotes([]);
      }

      // Note: Quiz questions are now loaded lazily when viewing quiz details
      // This significantly improves initial load time
    } catch (err) {
      console.error('Error fetching employee training history:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch training history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Invalid date';
    }
  };

  const calculateTotalHours = () => {
    let totalMinutes = 0;
    assignments.forEach((assignment) => {
      if (assignment.course?.duration) {
        const durationStr = assignment.course.duration.toLowerCase();
        const match = durationStr.match(/(\d+)\s*(?:hour|hr|h|minute|min|m)/g);
        if (match) {
          match.forEach((m) => {
            const num = parseInt(m);
            if (m.includes('hour') || m.includes('hr') || m.includes('h')) {
              totalMinutes += num * 60;
            } else {
              totalMinutes += num;
            }
          });
        }
      }
    });
    return (totalMinutes / 60).toFixed(1);
  };

  const calculateAverageScore = () => {
    if (results.length === 0) return 0;
    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    return Math.round(totalScore / results.length);
  };

  const getAssignmentResults = (assignmentId: string) => {
    return results.filter((r) => r.assignmentId === assignmentId);
  };

  const getAssignmentStatus = (assignment: Assignment) => {
    if (assignment.isTrainingComplete || assignment.status === 'completed') {
      return { label: 'Completed', color: 'success' as const };
    }
    const assignmentResults = getAssignmentResults(assignment.id);
    if (assignmentResults.length > 0) {
      return { label: 'In Progress', color: 'warning' as const };
    }
    return { label: 'Not Started', color: 'default' as const };
  };

  const handleViewQuiz = async (assignmentId: string) => {
    const assignmentResults = getAssignmentResults(assignmentId);
    if (assignmentResults.length > 0) {
      // Get the most recent result
      const mostRecent = assignmentResults.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      
      // Load quiz questions lazily if not already loaded
      if (!quizDetails.has(assignmentId)) {
        // Check both assignments and allAssignments (for learning path courses)
        const assignment = assignments.find((a) => a.id === assignmentId) || 
                          allAssignments.find((a) => a.id === assignmentId);
        if (assignment?.course?.id) {
          try {
            const questionsResponse = await client.models.QuizQuestion.list({
              filter: { courseId: { eq: assignment.course.id } },
            });
            const questions: QuizQuestion[] = (questionsResponse.data || [])
              .filter((q: any) => q.id !== null)
              .map((q: any) => ({
                id: q.id!,
                question: q.question,
                questionType: q.questionType || 'multiple_choice',
                options: (q.options || []).filter((opt: any): opt is string => opt !== null && opt !== undefined),
                correctAnswer: q.correctAnswer,
                correctAnswerText: q.correctAnswerText,
              }));
            setQuizDetails((prev) => new Map(prev).set(assignmentId, questions));
          } catch (err) {
            console.error('Error loading quiz questions:', err);
          }
        }
      }
      
      setSelectedQuiz({ assignmentId, result: mostRecent });
    }
  };

  const handleAddNote = () => {
    if (!newNote.trim() || !selectedAssignmentForNote) return;

    const note: TrainingNote = {
      id: Date.now().toString(),
      assignmentId: selectedAssignmentForNote,
      note: newNote.trim(),
      createdAt: new Date().toISOString(),
      createdBy: 'Manager', // In a real app, get from auth context
    };

    const updatedNotes = [...notes, note];
    setNotes(updatedNotes);
    localStorage.setItem(`employee_notes_${employeeId}`, JSON.stringify(updatedNotes));
    setNewNote('');
    setShowNoteDialog(false);
    setSelectedAssignmentForNote(null);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    let yPos = 20;

    // Header
    doc.setFontSize(18);
    doc.text('Employee Training History', 14, yPos);
    yPos += 10;

    if (employee) {
      doc.setFontSize(12);
      doc.text(`Employee: ${employee.name}`, 14, yPos);
      yPos += 6;
      doc.text(`Email: ${employee.email}`, 14, yPos);
      yPos += 6;
      doc.text(`Department: ${employee.department || 'N/A'}`, 14, yPos);
      yPos += 6;
      doc.text(`Hire Date: ${formatDate(employee.createdAt)}`, 14, yPos);
      yPos += 10;
    }

    // Statistics
    doc.setFontSize(14);
    doc.text('Training Statistics', 14, yPos);
    yPos += 8;
    doc.setFontSize(11);
    doc.text(`Total Training Hours: ${calculateTotalHours()}`, 14, yPos);
    yPos += 6;
    doc.text(`Average Quiz Score: ${calculateAverageScore()}%`, 14, yPos);
    yPos += 6;
    doc.text(`Total Assignments: ${assignments.length}`, 14, yPos);
    yPos += 6;
    doc.text(`Completed: ${assignments.filter((a) => a.isTrainingComplete).length}`, 14, yPos);
    yPos += 10;

    // Assignments
    doc.setFontSize(14);
    doc.text('Course Assignments', 14, yPos);
    yPos += 8;

    assignments.forEach((assignment, index) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text(`${index + 1}. ${assignment.course?.title || 'Unknown Course'}`, 14, yPos);
      yPos += 6;
      doc.setFont(undefined, 'normal');
      doc.text(`Assigned: ${formatDate(assignment.createdAt)}`, 14, yPos);
      yPos += 5;
      doc.text(`Status: ${getAssignmentStatus(assignment).label}`, 14, yPos);
      yPos += 5;
      if (assignment.trainingCompletedAt) {
        doc.text(`Completed: ${formatDate(assignment.trainingCompletedAt)}`, 14, yPos);
        yPos += 5;
      }
      const assignmentResults = getAssignmentResults(assignment.id);
      if (assignmentResults.length > 0) {
        doc.text(`Quiz Attempts: ${assignmentResults.length}`, 14, yPos);
        yPos += 5;
        const latestResult = assignmentResults.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];
        doc.text(`Latest Score: ${latestResult.score}% (${latestResult.passed ? 'Passed' : 'Failed'})`, 14, yPos);
        yPos += 5;
      }
      yPos += 5;
    });

    doc.save(`${employeeName}_Training_History.pdf`);
  };

  const getAllActivities = () => {
    const activities: Array<{
      date: string;
      type: 'assignment' | 'completion' | 'quiz' | 'path_assignment' | 'path_completion';
      title: string;
      description: string;
    }> = [];

    assignments.forEach((assignment) => {
      activities.push({
        date: assignment.createdAt,
        type: 'assignment',
        title: `Assigned: ${assignment.course?.title || 'Unknown Course'}`,
        description: `Course assigned to employee`,
      });

      if (assignment.trainingCompletedAt) {
        activities.push({
          date: assignment.trainingCompletedAt,
          type: 'completion',
          title: `Completed: ${assignment.course?.title || 'Unknown Course'}`,
          description: `Course completed successfully`,
        });
      }

      getAssignmentResults(assignment.id).forEach((result) => {
        activities.push({
          date: result.createdAt,
          type: 'quiz',
          title: `Quiz Attempt: ${assignment.course?.title || 'Unknown Course'}`,
          description: `Score: ${result.score}% (${result.passed ? 'Passed' : 'Failed'})`,
        });
      });
    });

    pathAssignments.forEach((pathAssignment) => {
      activities.push({
        date: pathAssignment.assignedDate || pathAssignment.createdAt,
        type: 'path_assignment',
        title: `Assigned Learning Path: ${pathAssignment.learningPath?.title || 'Unknown Path'}`,
        description: `Learning path assigned to employee`,
      });

      if (pathAssignment.completedDate) {
        activities.push({
          date: pathAssignment.completedDate,
          type: 'path_completion',
          title: `Completed Learning Path: ${pathAssignment.learningPath?.title || 'Unknown Path'}`,
          description: `Learning path completed successfully`,
        });
      }
    });

    return activities.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !employee) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mb: 2 }}>
          Back
        </Button>
        <Alert severity="error">{error || 'Employee not found'}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={onBack}>
          Back to Training Status
        </Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant={viewMode === 'list' ? 'contained' : 'outlined'}
            onClick={() => setViewMode('list')}
          >
            List View
          </Button>
          <Button
            variant={viewMode === 'timeline' ? 'contained' : 'outlined'}
            onClick={() => setViewMode('timeline')}
          >
            Timeline View
          </Button>
          <Button startIcon={<PictureAsPdfIcon />} onClick={handleExportPDF} variant="outlined">
            Export PDF
          </Button>
        </Box>
      </Box>

      {/* Employee Profile */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            {employee.name}
          </Typography>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" color="text.secondary">
                Email
              </Typography>
              <Typography variant="body1">{employee.email}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" color="text.secondary">
                Department
              </Typography>
              <Typography variant="body1">{employee.department || 'N/A'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" color="text.secondary">
                Hire Date
              </Typography>
              <Typography variant="body1">{formatDate(employee.createdAt)}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" color="text.secondary">
                Total Training Hours
              </Typography>
              <Typography variant="body1" fontWeight="bold">
                {calculateTotalHours()} hours
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" color="text.secondary">
                Average Quiz Score
              </Typography>
              <Typography variant="body1" fontWeight="bold" color="primary">
                {calculateAverageScore()}%
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" color="text.secondary">
                Total Assignments
              </Typography>
              <Typography variant="body1">{assignments.length}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" color="text.secondary">
                Completed
              </Typography>
              <Typography variant="body1" color="success.main">
                {assignments.filter((a) => a.isTrainingComplete).length}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {viewMode === 'list' ? (
        <>
          {/* Course Assignments */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Course Assignments
              </Typography>
              <TableContainer>
                <Table>
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
                    {assignments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center">
                          <Typography color="text.secondary">No assignments found</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      assignments.map((assignment) => {
                        const assignmentResults = getAssignmentResults(assignment.id);
                        const latestResult = assignmentResults.length > 0
                          ? assignmentResults.sort(
                              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                            )[0]
                          : null;
                        const status = getAssignmentStatus(assignment);
                        const startedDate = assignmentResults.length > 0
                          ? assignmentResults.sort(
                              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                            )[0].createdAt
                          : null;

                        return (
                          <TableRow key={assignment.id}>
                            <TableCell>{assignment.course?.title || 'Unknown Course'}</TableCell>
                            <TableCell>{formatDate(assignment.createdAt)}</TableCell>
                            <TableCell>{formatDate(startedDate)}</TableCell>
                            <TableCell>
                              {formatDate(
                                assignment.trainingCompletedAt || 
                                (latestResult && assignment.isTrainingComplete ? latestResult.createdAt : null)
                              )}
                            </TableCell>
                            <TableCell>
                              <Chip label={status.label} color={status.color} size="small" />
                            </TableCell>
                            <TableCell>
                              {latestResult ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                {assignmentResults.length > 0 && (
                                  <IconButton
                                    size="small"
                                    onClick={() => handleViewQuiz(assignment.id)}
                                    title="View Quiz Details"
                                  >
                                    <VisibilityIcon fontSize="small" />
                                  </IconButton>
                                )}
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setSelectedAssignmentForNote(assignment.id);
                                    setShowNoteDialog(true);
                                  }}
                                  title="Add Note"
                                >
                                  <NoteAddIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* Learning Path Assignments */}
          {pathAssignments.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Learning Path Assignments
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell width="50px"></TableCell>
                        <TableCell>Learning Path</TableCell>
                        <TableCell>Assigned Date</TableCell>
                        <TableCell>Due Date</TableCell>
                        <TableCell>Completed Date</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pathAssignments.map((pathAssignment) => {
                        const pathCourses = learningPathCourses.get(pathAssignment.learningPathId) || [];
                        const isExpanded = expandedPathId === pathAssignment.id;
                        const pathCourseAssignments = pathCourses.map((pc) => {
                          const assignment = allAssignments.find((a) => a.courseId === pc.courseId);
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
                                    <ExpandMoreIcon
                                      sx={{
                                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                        transition: 'transform 0.3s',
                                      }}
                                    />
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
                              </TableCell>
                              <TableCell>{formatDate(pathAssignment.completedDate)}</TableCell>
                              <TableCell>
                                <Chip
                                  label={pathAssignment.status || 'Not Started'}
                                  color={
                                    pathAssignment.status === 'completed'
                                      ? 'success'
                                      : pathAssignment.status === 'in_progress'
                                      ? 'warning'
                                      : 'default'
                                  }
                                  size="small"
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
                                        const assignmentResults = getAssignmentResults(assignment.id);
                                        const latestResult = assignmentResults.length > 0
                                          ? assignmentResults.sort(
                                              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                                            )[0]
                                          : null;
                                        const status = getAssignmentStatus(assignment);
                                        const startedDate = assignmentResults.length > 0
                                          ? assignmentResults.sort(
                                              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                                            )[0].createdAt
                                          : null;

                                        return (
                                          <TableRow key={assignment.id}>
                                            <TableCell>{assignment.course?.title || 'Unknown Course'}</TableCell>
                                            <TableCell>{formatDate(assignment.createdAt)}</TableCell>
                                            <TableCell>{formatDate(startedDate)}</TableCell>
                                            <TableCell>
                                              {formatDate(
                                                assignment.trainingCompletedAt || 
                                                (latestResult && assignment.isTrainingComplete ? latestResult.createdAt : null)
                                              )}
                                            </TableCell>
                                            <TableCell>
                                              <Chip label={status.label} color={status.color} size="small" />
                                            </TableCell>
                                            <TableCell>
                                              {latestResult ? (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                                              <Box sx={{ display: 'flex', gap: 1 }}>
                                                {assignmentResults.length > 0 && (
                                                  <IconButton
                                                    size="small"
                                                    onClick={() => handleViewQuiz(assignment.id)}
                                                    title="View Quiz Details"
                                                  >
                                                    <VisibilityIcon fontSize="small" />
                                                  </IconButton>
                                                )}
                                                <IconButton
                                                  size="small"
                                                  onClick={() => {
                                                    setSelectedAssignmentForNote(assignment.id);
                                                    setShowNoteDialog(true);
                                                  }}
                                                  title="Add Note"
                                                >
                                                  <NoteAddIcon fontSize="small" />
                                                </IconButton>
                                              </Box>
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
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {notes.filter((n) => {
            // Check both standalone assignments and all assignments (including learning path courses)
            return assignments.some((a) => a.id === n.assignmentId) || 
                   allAssignments.some((a) => a.id === n.assignmentId);
          }).length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Training Notes
                </Typography>
                {notes
                  .filter((n) => {
                    // Check both standalone assignments and all assignments (including learning path courses)
                    return assignments.some((a) => a.id === n.assignmentId) || 
                           allAssignments.some((a) => a.id === n.assignmentId);
                  })
                  .map((note) => {
                    // Try to find assignment in both arrays
                    const assignment = assignments.find((a) => a.id === note.assignmentId) || 
                                      allAssignments.find((a) => a.id === note.assignmentId);
                    return (
                      <Box key={note.id} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          {assignment?.course?.title || 'Unknown Course'} - {formatDate(note.createdAt)}
                        </Typography>
                        <Typography variant="body2">{note.note}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                          Added by: {note.createdBy}
                        </Typography>
                      </Box>
                    );
                  })}
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Training Timeline
            </Typography>
            <Box>
              {getAllActivities().map((activity, index) => (
                <Box
                  key={index}
                  sx={{
                    display: 'flex',
                    mb: 2,
                    pb: 2,
                    borderBottom: index < getAllActivities().length - 1 ? '1px solid' : 'none',
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ minWidth: 120, mr: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(activity.date)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor:
                          activity.type === 'completion' || activity.type === 'path_completion'
                            ? 'success.main'
                            : activity.type === 'quiz'
                            ? 'primary.main'
                            : 'grey.300',
                        color: 'white',
                      }}
                    >
                      {activity.type === 'completion' || activity.type === 'path_completion' ? (
                        <CheckCircleIcon fontSize="small" />
                      ) : activity.type === 'quiz' ? (
                        'Q'
                      ) : (
                        'A'
                      )}
                    </Box>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2">{activity.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {activity.description}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Quiz Details Dialog */}
      <Dialog
        open={selectedQuiz !== null}
        onClose={() => setSelectedQuiz(null)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        {selectedQuiz && (
          <>
            <DialogTitle>
              Quiz Details - {(assignments.find((a) => a.id === selectedQuiz.assignmentId) || 
                              allAssignments.find((a) => a.id === selectedQuiz.assignmentId))?.course?.title || 'Unknown Course'}
            </DialogTitle>
            <DialogContent>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1">Quiz Result</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  <Typography variant="body2" component="span">
                    Score: {selectedQuiz.result.score}%
                  </Typography>
                  <Typography variant="body2" component="span">|</Typography>
                  {selectedQuiz.result.passed ? (
                    <Chip label="Passed" color="success" size="small" />
                  ) : (
                    <Chip label="Failed" color="error" size="small" />
                  )}
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Attempted: {formatDate(selectedQuiz.result.createdAt)}
                </Typography>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom>
                Questions
              </Typography>
              {quizDetails.get(selectedQuiz.assignmentId)?.map((question, qIndex) => {
                const employeeAnswer = selectedQuiz.result.answers && selectedQuiz.result.answers.length > qIndex 
                  ? selectedQuiz.result.answers[qIndex] 
                  : null;
                const isCorrect = employeeAnswer !== null && employeeAnswer === question.correctAnswer;
                
                return (
                  <Accordion key={question.id} sx={{ mt: 1 }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                        <Typography>
                          {qIndex + 1}. {question.question}
                        </Typography>
                        {employeeAnswer !== null && (
                          <Chip
                            label={isCorrect ? 'Correct' : 'Incorrect'}
                            color={isCorrect ? 'success' : 'error'}
                            size="small"
                            sx={{ ml: 'auto' }}
                          />
                        )}
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      {question.questionType === 'multiple_choice' || question.questionType === 'true_false' ? (
                        <>
                          <Typography variant="body2" gutterBottom>
                            Options:
                          </Typography>
                          {question.options.map((option, oIndex) => {
                            const isEmployeeAnswer = employeeAnswer === oIndex;
                            const isCorrectAnswer = oIndex === question.correctAnswer;
                            
                            return (
                              <Box
                                key={oIndex}
                                sx={{
                                  pl: 2,
                                  py: 0.5,
                                  mb: 0.5,
                                  borderRadius: 1,
                                  backgroundColor: isEmployeeAnswer 
                                    ? (isCorrectAnswer ? 'success.light' : 'error.light')
                                    : isCorrectAnswer 
                                    ? 'success.light'
                                    : 'transparent',
                                }}
                              >
                                <Typography
                                  variant="body2"
                                  sx={{
                                    color: isCorrectAnswer ? 'success.main' : 'text.primary',
                                    fontWeight: (isCorrectAnswer || isEmployeeAnswer) ? 'bold' : 'normal',
                                  }}
                                >
                                  {String.fromCharCode(65 + oIndex)}. {option}
                                  {isCorrectAnswer && ' ✓ (Correct Answer)'}
                                  {isEmployeeAnswer && !isCorrectAnswer && ' ✗ (Your Answer)'}
                                  {isEmployeeAnswer && isCorrectAnswer && ' ✓ (Your Answer)'}
                                </Typography>
                              </Box>
                            );
                          })}
                        </>
                      ) : (
                        <>
                          <Typography variant="body2" gutterBottom>
                            Correct Answer:
                          </Typography>
                          <Typography variant="body2" sx={{ pl: 2, color: 'success.main', fontWeight: 'bold' }}>
                            {question.correctAnswerText || 'N/A'}
                          </Typography>
                          {employeeAnswer !== null && (
                            <>
                              <Typography variant="body2" gutterBottom sx={{ mt: 2 }}>
                                Employee Answer:
                              </Typography>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  pl: 2, 
                                  color: isCorrect ? 'success.main' : 'error.main',
                                  fontWeight: 'bold'
                                }}
                              >
                                {question.options[employeeAnswer] || 'N/A'}
                                {isCorrect ? ' ✓' : ' ✗'}
                              </Typography>
                            </>
                          )}
                        </>
                      )}
                      {employeeAnswer === null && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                          No answer recorded for this question.
                        </Typography>
                      )}
                    </AccordionDetails>
                  </Accordion>
                );
              })}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedQuiz(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={showNoteDialog} onClose={() => setShowNoteDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Training Note</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Note"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Enter notes about this employee's training..."
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNoteDialog(false)}>Cancel</Button>
          <Button onClick={handleAddNote} variant="contained" disabled={!newNote.trim()}>
            Add Note
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EmployeeTrainingHistory;


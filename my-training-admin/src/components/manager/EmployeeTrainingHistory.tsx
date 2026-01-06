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
  const [pathAssignments, setPathAssignments] = useState<LearningPathAssignment[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [quizDetails, setQuizDetails] = useState<Map<string, QuizQuestion[]>>(new Map());
  const [selectedQuiz, setSelectedQuiz] = useState<{ assignmentId: string; result: Result } | null>(null);
  const [notes, setNotes] = useState<TrainingNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [selectedAssignmentForNote, setSelectedAssignmentForNote] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    fetchData();
  }, [employeeId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch employee
      const employeeResponse = await client.models.Employee.get({ id: employeeId });
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

      // Fetch assignments
      const assignmentsResponse = await client.models.Assignment.list({
        filter: { employeeId: { eq: employeeId } },
      });

      const assignmentsData: Assignment[] = [];
      for (const a of assignmentsResponse.data || []) {
        if (!a.id) continue;
        const course = a.course ? await a.course() : null;
        assignmentsData.push({
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
        });

        // Fetch quiz questions for this course
        if (course?.data?.id) {
          const questionsResponse = await client.models.QuizQuestion.list({
            filter: { courseId: { eq: course.data.id } },
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
          setQuizDetails((prev) => new Map(prev).set(a.id!, questions));
        }
      }
      setAssignments(assignmentsData);

      // Fetch learning path assignments
      const pathAssignmentsResponse = await client.models.LearningPathAssignment.list({
        filter: { employeeId: { eq: employeeId } },
      });

      const pathAssignmentsData: LearningPathAssignment[] = [];
      for (const p of pathAssignmentsResponse.data || []) {
        if (!p.id) continue;
        const learningPath = p.learningPath ? await p.learningPath() : null;
        pathAssignmentsData.push({
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
        });
      }
      setPathAssignments(pathAssignmentsData);

      // Fetch all results
      const allResults: Result[] = [];
      for (const assignment of assignmentsData) {
        const resultsResponse = await client.models.Result.list({
          filter: { assignmentId: { eq: assignment.id } },
        });
        for (const r of resultsResponse.data || []) {
          if (r.id) {
            allResults.push({
              id: r.id,
              assignmentId: r.assignmentId,
              score: r.score,
              passed: r.passed,
              createdAt: r.createdAt,
            });
          }
        }
      }
      setResults(allResults);

      // Load notes from localStorage (simple implementation)
      const savedNotes = localStorage.getItem(`employee_notes_${employeeId}`);
      if (savedNotes) {
        setNotes(JSON.parse(savedNotes));
      }
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

  const handleViewQuiz = (assignmentId: string) => {
    const assignmentResults = getAssignmentResults(assignmentId);
    if (assignmentResults.length > 0) {
      // Get the most recent result
      const mostRecent = assignmentResults.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
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
                            <TableCell>{formatDate(assignment.trainingCompletedAt)}</TableCell>
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
                        <TableCell>Learning Path</TableCell>
                        <TableCell>Assigned Date</TableCell>
                        <TableCell>Due Date</TableCell>
                        <TableCell>Completed Date</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pathAssignments.map((pathAssignment) => (
                        <TableRow key={pathAssignment.id}>
                          <TableCell>
                            {pathAssignment.learningPath?.title || 'Unknown Path'}
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
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {notes.filter((n) => assignments.some((a) => a.id === n.assignmentId)).length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Training Notes
                </Typography>
                {notes
                  .filter((n) => assignments.some((a) => a.id === n.assignmentId))
                  .map((note) => {
                    const assignment = assignments.find((a) => a.id === note.assignmentId);
                    return (
                      <Box key={note.id} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          {assignment?.course?.title || 'Unknown Course'} - {formatDate(note.createdAt)}
                        </Typography>
                        <Typography variant="body2">{note.note}</Typography>
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
              Quiz Details - {assignments.find((a) => a.id === selectedQuiz.assignmentId)?.course?.title || 'Unknown Course'}
            </DialogTitle>
            <DialogContent>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1">Quiz Result</Typography>
                <Typography variant="body2">
                  Score: {selectedQuiz.result.score}% |{' '}
                  {selectedQuiz.result.passed ? (
                    <Chip label="Passed" color="success" size="small" />
                  ) : (
                    <Chip label="Failed" color="error" size="small" />
                  )}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Attempted: {formatDate(selectedQuiz.result.createdAt)}
                </Typography>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom>
                Questions
              </Typography>
              {quizDetails.get(selectedQuiz.assignmentId)?.map((question, qIndex) => (
                <Accordion key={question.id} sx={{ mt: 1 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>
                      {qIndex + 1}. {question.question}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    {question.questionType === 'multiple_choice' || question.questionType === 'true_false' ? (
                      <>
                        <Typography variant="body2" gutterBottom>
                          Options:
                        </Typography>
                        {question.options.map((option, oIndex) => (
                          <Typography
                            key={oIndex}
                            variant="body2"
                            sx={{
                              pl: 2,
                              color: oIndex === question.correctAnswer ? 'success.main' : 'text.primary',
                              fontWeight: oIndex === question.correctAnswer ? 'bold' : 'normal',
                            }}
                          >
                            {String.fromCharCode(65 + oIndex)}. {option}
                            {oIndex === question.correctAnswer && ' ✓'}
                          </Typography>
                        ))}
                      </>
                    ) : (
                      <Typography variant="body2">
                        Correct Answer: {question.correctAnswerText || 'N/A'}
                      </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                      Note: Individual employee answers are not currently stored. This shows the quiz questions and correct answers.
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              ))}
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


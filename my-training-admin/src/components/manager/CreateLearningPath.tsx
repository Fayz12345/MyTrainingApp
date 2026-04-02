import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import { fetchAuthSession } from 'aws-amplify/auth';
import type { Schema } from '../../../../amplify/data/resource';
import { activityLogger, getCurrentUserInfo } from '../../utils/activityLogger';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  FormControlLabel,
  Switch,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  Alert,
  CircularProgress,
  Divider,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import AddIcon from '@mui/icons-material/Add';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);
const client = generateClient<Schema>();

interface Course {
  id: string;
  title: string;
  description?: string | null;
  duration?: string | null;
  category?: string | null;
}

interface LearningPathCourse {
  courseId: string;
  course: Course;
  order: number;
  isRequired: boolean;
}

interface CreateLearningPathProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const CreateLearningPath: React.FC<CreateLearningPathProps> = ({ onSuccess, onCancel }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSequential, setIsSequential] = useState(true);
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [mandatoryForScheduling, setMandatoryForScheduling] = useState(false);
  const [isCertification, setIsCertification] = useState(false);
  const [certificationExpirationDays, setCertificationExpirationDays] = useState<number>(365);
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<LearningPathCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const session = await fetchAuthSession();
      const currentUserId =
        session.userSub ?? (session.tokens?.idToken?.payload?.sub as string | undefined);
      if (!currentUserId) {
        throw new Error('User not authenticated');
      }
      const result = await client.models.Course.list({
        filter: { createdBy: { eq: currentUserId } },
      });
      if (result.errors && result.errors.length > 0) {
        throw new Error('Failed to fetch courses: ' + result.errors.map((e: any) => e.message).join(', '));
      }
      setAvailableCourses(result.data as Course[]);
    } catch (err) {
      console.error('Error fetching courses:', err);
      setError(err instanceof Error ? err.message : 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCourse = (courseId: string) => {
    const course = availableCourses.find(c => c.id === courseId);
    if (!course) return;

    // Check if course is already added
    if (selectedCourses.some(sc => sc.courseId === courseId)) {
      MySwal.fire({
        title: 'Course Already Added',
        text: 'This course is already in the learning path.',
        icon: 'warning',
        timer: 2000,
        showConfirmButton: false,
      });
      return;
    }

    const newCourse: LearningPathCourse = {
      courseId: course.id,
      course,
      order: selectedCourses.length + 1,
      isRequired: true,
    };

    setSelectedCourses([...selectedCourses, newCourse]);
  };

  const handleRemoveCourse = (index: number) => {
    const newCourses = selectedCourses.filter((_, i) => i !== index);
    // Reorder remaining courses
    const reorderedCourses = newCourses.map((course, i) => ({
      ...course,
      order: i + 1,
    }));
    setSelectedCourses(reorderedCourses);
  };

  const handleToggleRequired = (index: number) => {
    const newCourses = [...selectedCourses];
    newCourses[index].isRequired = !newCourses[index].isRequired;
    setSelectedCourses(newCourses);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null) return;

    if (draggedIndex !== index) {
      const newCourses = [...selectedCourses];
      const draggedCourse = newCourses[draggedIndex];
      newCourses.splice(draggedIndex, 1);
      newCourses.splice(index, 0, draggedCourse);
      
      // Reorder
      const reorderedCourses = newCourses.map((course, i) => ({
        ...course,
        order: i + 1,
      }));
      setSelectedCourses(reorderedCourses);
      setDraggedIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!title.trim()) {
      errors.title = 'Learning path title is required';
    }

    if (selectedCourses.length === 0) {
      errors.courses = 'At least one course must be added to the learning path';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async (publish: boolean = false) => {
    if (!validateForm()) {
      MySwal.fire({
        title: 'Validation Error',
        text: 'Please fix the errors before saving.',
        icon: 'error',
      });
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Get current user's manager ID
      const session = await fetchAuthSession();
      const userId = session.userSub || session.tokens?.idToken?.payload?.sub as string;

      if (!userId) {
        throw new Error('Unable to get user ID');
      }

      const now = new Date().toISOString();

      // Create learning path (version 1, no parent)
      const learningPathResult = await client.models.LearningPath.create({
        title: title.trim(),
        description: description.trim() || null,
        createdBy: userId,
        isSequential,
        status: publish ? 'published' : 'draft',
        version: 1,
        isArchived: false,
        mandatoryForScheduling,
        isCertification,
        certificationExpirationDays: isCertification ? certificationExpirationDays : null,
        createdAt: now,
        updatedAt: now,
      });

      if (learningPathResult.errors && learningPathResult.errors.length > 0) {
        throw new Error('Failed to create learning path: ' + learningPathResult.errors.map((e: any) => e.message).join(', '));
      }

      const learningPathId = learningPathResult.data?.id;
      if (!learningPathId) {
        throw new Error('Failed to get learning path ID');
      }

      // Create learning path courses
      const coursePromises = selectedCourses.map(course =>
        client.models.LearningPathCourse.create({
          learningPathId,
          courseId: course.courseId,
          order: course.order,
          isRequired: course.isRequired,
          createdAt: now,
          updatedAt: now,
        })
      );

      const courseResults = await Promise.all(coursePromises);
      const courseErrors = courseResults.filter(result => result.errors && result.errors.length > 0);
      
      if (courseErrors.length > 0) {
        throw new Error('Failed to add some courses: ' + courseErrors.map(e => e.errors?.map((err: any) => err.message).join(', ')).join('; '));
      }

      await MySwal.fire({
        title: 'Success!',
        text: `Learning path ${publish ? 'published' : 'saved as draft'} successfully.`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false,
      });

      // Log activity
      try {
        const userInfo = await getCurrentUserInfo();
        await activityLogger.logActivity(
          'LEARNING_PATH_CREATED',
          userInfo.userId,
          userInfo.userName,
          userInfo.userEmail,
          `Created learning path: ${title} (${publish ? 'published' : 'draft'})`,
          {
            learningPathId,
            learningPathTitle: title,
            description: description || null,
            isSequential,
            status: publish ? 'published' : 'draft',
            coursesCount: selectedCourses.length,
            courses: selectedCourses.map(sc => ({
              courseId: sc.courseId,
              courseTitle: sc.course.title,
              order: sc.order,
              isRequired: sc.isRequired,
            })),
          }
        );
      } catch (logError) {
        console.error('[CreateLearningPath] Error logging activity:', logError);
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Error creating learning path:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create learning path';
      setError(errorMessage);
      await MySwal.fire({
        title: 'Error!',
        text: errorMessage,
        icon: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const availableCourseIds = selectedCourses.map(sc => sc.courseId);
  const unselectedCourses = availableCourses.filter(c => !availableCourseIds.includes(c.id));

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Create Learning Path</Typography>
        {onCancel && (
          <Button onClick={onCancel} variant="outlined">
            Cancel
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Basic Information
          </Typography>
          <TextField
            fullWidth
            label="Learning Path Title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (fieldErrors.title) {
                setFieldErrors({ ...fieldErrors, title: '' });
              }
            }}
            error={!!fieldErrors.title}
            helperText={fieldErrors.title}
            required
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={3}
            sx={{ mb: 2 }}
          />
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexDirection: 'column' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={isSequential}
                  onChange={(e) => setIsSequential(e.target.checked)}
                />
              }
              label="Sequential (courses must be completed in order)"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={mandatoryForScheduling}
                  onChange={(e) => setMandatoryForScheduling(e.target.checked)}
                />
              }
              label="Mandatory for Scheduling"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={isCertification}
                  onChange={(e) => setIsCertification(e.target.checked)}
                />
              }
              label="Certification (expires and requires recertification)"
            />
            {isCertification && (
              <TextField
                type="number"
                label="Certification valid for (days)"
                value={certificationExpirationDays}
                onChange={(e) => setCertificationExpirationDays(Math.max(1, parseInt(e.target.value, 10) || 365))}
                inputProps={{ min: 1, max: 3650 }}
                size="small"
                sx={{ maxWidth: 200 }}
                helperText="e.g. 365 for 1 year"
              />
            )}
          </Box>
          {!isSequential && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Flexible mode: Employees can take courses in any order.
            </Alert>
          )}
          {mandatoryForScheduling && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              This learning path is mandatory for scheduling eligibility. Employees must complete this path and have banking information on file to be eligible for scheduling.
            </Alert>
          )}
          {isCertification && (
            <Alert severity="info" sx={{ mb: 2 }}>
              This path will expire after {certificationExpirationDays} days. Employees will receive reminders before expiration and will be re-assigned automatically when it lapses.
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Add Courses
          </Typography>
          {unselectedCourses.length > 0 ? (
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Select a course to add</InputLabel>
              <Select
                value=""
                onChange={(e) => handleAddCourse(e.target.value)}
                label="Select a course to add"
              >
                {unselectedCourses.map((course) => (
                  <MenuItem key={course.id} value={course.id}>
                    {course.title} {course.duration && `(${course.duration})`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>
              All available courses have been added to this learning path.
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Course Sequence ({selectedCourses.length} course{selectedCourses.length !== 1 ? 's' : ''})
            </Typography>
            {fieldErrors.courses && (
              <Typography variant="body2" color="error">
                {fieldErrors.courses}
              </Typography>
            )}
          </Box>

          {selectedCourses.length === 0 ? (
            <Alert severity="warning">
              No courses added yet. Add at least one course to create the learning path.
            </Alert>
          ) : (
            <List>
              {selectedCourses.map((item, index) => (
                <React.Fragment key={`${item.courseId}-${index}`}>
                  <Paper
                    elevation={draggedIndex === index ? 8 : 1}
                    sx={{
                      mb: 1,
                      p: 1,
                      cursor: 'move',
                      bgcolor: draggedIndex === index ? 'action.selected' : 'background.paper',
                      transition: 'all 0.2s',
                    }}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                  >
                    <ListItem>
                      <DragIndicatorIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body1" fontWeight="medium">
                              {index + 1}. {item.course.title}
                            </Typography>
                            <Chip
                              label={item.isRequired ? 'Required' : 'Optional'}
                              size="small"
                              color={item.isRequired ? 'primary' : 'default'}
                              onClick={() => handleToggleRequired(index)}
                              sx={{ cursor: 'pointer' }}
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            {item.course.description && (
                              <Typography variant="body2" color="text.secondary">
                                {item.course.description}
                              </Typography>
                            )}
                            <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                              {item.course.duration && (
                                <Chip label={`Duration: ${item.course.duration}`} size="small" variant="outlined" />
                              )}
                              {item.course.category && (
                                <Chip label={item.course.category} size="small" variant="outlined" />
                              )}
                            </Box>
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => handleRemoveCourse(index)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  </Paper>
                </React.Fragment>
              ))}
            </List>
          )}

          {selectedCourses.length > 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Drag and drop</strong> courses to reorder them. Click on "Required" or "Optional" chips to toggle course requirement status.
              </Typography>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          onClick={() => handleSave(false)}
          disabled={submitting}
        >
          Save as Draft
        </Button>
        <Button
          variant="contained"
          onClick={() => handleSave(true)}
          disabled={submitting || selectedCourses.length === 0}
        >
          {submitting ? <CircularProgress size={24} /> : 'Publish Learning Path'}
        </Button>
      </Box>
    </Box>
  );
};

export default CreateLearningPath;


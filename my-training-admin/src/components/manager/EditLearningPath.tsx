import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import { fetchAuthSession } from 'aws-amplify/auth';
import type { Schema } from '../../../../amplify/data/resource';
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
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Radio,
  RadioGroup,
  FormLabel,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
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
  id?: string;
  courseId: string;
  course: Course;
  order: number;
  isRequired: boolean;
}

interface LearningPath {
  id: string;
  title: string;
  description?: string | null;
  status?: string | null;
  version?: number | null;
  parentPathId?: string | null;
  isArchived?: boolean | null;
  isSequential?: boolean | null;
  createdBy?: string | null;
}

interface EditLearningPathProps {
  learningPath: LearningPath;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const EditLearningPath: React.FC<EditLearningPathProps> = ({ learningPath, onSuccess, onCancel }) => {
  const [title, setTitle] = useState(learningPath.title);
  const [description, setDescription] = useState(learningPath.description || '');
  const [isSequential, setIsSequential] = useState(learningPath.isSequential ?? true);
  const [status, setStatus] = useState<'draft' | 'published'>(learningPath.status === 'published' ? 'published' : 'draft');
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<LearningPathCourse[]>([]);
  const [originalCourses, setOriginalCourses] = useState<LearningPathCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [versionChoice, setVersionChoice] = useState<'new' | 'update'>('new');
  const [activeAssignments, setActiveAssignments] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all courses
      const coursesResult = await client.models.Course.list({});
      if (coursesResult.errors && coursesResult.errors.length > 0) {
        throw new Error('Failed to fetch courses: ' + coursesResult.errors.map((e: any) => e.message).join(', '));
      }
      setAvailableCourses(coursesResult.data as Course[]);

      // Fetch learning path courses
      const pathCoursesResult = await client.models.LearningPathCourse.list({
        filter: { learningPathId: { eq: learningPath.id } }
      });

      if (pathCoursesResult.data) {
        const coursesWithDetails = await Promise.all(
          pathCoursesResult.data.map(async (pc: any) => {
            if (!pc.courseId) return null;
            const courseResult = await client.models.Course.get({ id: pc.courseId });
            if (!courseResult.data) return null;
            return {
              id: pc.id,
              courseId: pc.courseId,
              course: courseResult.data as Course,
              order: pc.order,
              isRequired: pc.isRequired ?? true,
            };
          })
        );
        const validCourses = coursesWithDetails.filter(c => c !== null) as LearningPathCourse[];
        const sortedCourses = validCourses.sort((a, b) => a.order - b.order);
        setSelectedCourses(sortedCourses);
        setOriginalCourses(sortedCourses);
      }

      // Check for active assignments
      const assignmentsResult = await client.models.LearningPathAssignment.list({
        filter: { learningPathId: { eq: learningPath.id } }
      });
      setActiveAssignments(assignmentsResult.data?.length || 0);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCourse = (courseId: string) => {
    const course = availableCourses.find(c => c.id === courseId);
    if (!course) return;

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

  const hasChanges = () => {
    if (title !== learningPath.title) return true;
    if (description !== (learningPath.description || '')) return true;
    if (isSequential !== (learningPath.isSequential ?? true)) return true;
    if (status !== (learningPath.status || 'draft')) return true;
    if (selectedCourses.length !== originalCourses.length) return true;
    
    for (let i = 0; i < selectedCourses.length; i++) {
      const selected = selectedCourses[i];
      const original = originalCourses[i];
      if (!original || 
          selected.courseId !== original.courseId ||
          selected.isRequired !== original.isRequired ||
          selected.order !== original.order) {
        return true;
      }
    }
    return false;
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

    // If publish button was clicked, set status to published
    const finalStatus = publish ? 'published' : status;
    
    // Check if status is changing
    const statusChanged = finalStatus !== (learningPath.status || 'draft');
    
    // Check if there are other changes (excluding status since we check it separately)
    const hasOtherChanges = title !== learningPath.title ||
      description !== (learningPath.description || '') ||
      isSequential !== (learningPath.isSequential ?? true) ||
      selectedCourses.length !== originalCourses.length ||
      selectedCourses.some((selected, i) => {
        const original = originalCourses[i];
        return !original || 
          selected.courseId !== original.courseId ||
          selected.isRequired !== original.isRequired ||
          selected.order !== original.order;
      });

    // If no changes at all, show message
    if (!hasOtherChanges && !statusChanged) {
      MySwal.fire({
        title: 'No Changes',
        text: 'No changes were made to the learning path.',
        icon: 'info',
        timer: 2000,
        showConfirmButton: false,
      });
      return;
    }

    // If path is published and we're not changing status, show version dialog
    // This allows choosing between creating new version or updating existing
    if (learningPath.status === 'published' && finalStatus === 'published' && !statusChanged && hasOtherChanges) {
      setVersionDialogOpen(true);
      return;
    }

    // If changing from draft to published, show confirmation
    if (learningPath.status !== 'published' && finalStatus === 'published') {
      const confirmResult = await MySwal.fire({
        title: 'Publish Learning Path?',
        text: 'Are you sure you want to publish this learning path? Once published, it will be available for assignment.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, Publish',
        cancelButtonText: 'Cancel',
      });

      if (!confirmResult.isConfirmed) {
        return;
      }
    }

    // Update status if publish button was clicked
    if (publish) {
      setStatus('published');
    }

    // Otherwise proceed with save
    await performSave('update', finalStatus);
  };

  const performSave = async (mode: 'new' | 'update', finalStatus?: 'draft' | 'published') => {
    setSubmitting(true);
    setError(null);
    setVersionDialogOpen(false);

    try {
      const session = await fetchAuthSession();
      const userId = session.userSub || session.tokens?.idToken?.payload?.sub as string;

      if (!userId) {
        throw new Error('Unable to get user ID');
      }

      const now = new Date().toISOString();
      const saveStatus = finalStatus || status;

      if (mode === 'new') {
        // Create new version
        const maxVersion = learningPath.version || 1;
        const parentPathId = learningPath.parentPathId || learningPath.id;

        const newPathResult = await client.models.LearningPath.create({
          title: title.trim(),
          description: description.trim() || null,
          createdBy: userId,
          isSequential,
          status: saveStatus,
          version: maxVersion + 1,
          parentPathId,
          isArchived: false,
          createdAt: now,
          updatedAt: now,
        });

        if (newPathResult.errors && newPathResult.errors.length > 0) {
          throw new Error('Failed to create new version: ' + newPathResult.errors.map((e: any) => e.message).join(', '));
        }

        const newPathId = newPathResult.data?.id;
        if (!newPathId) {
          throw new Error('Failed to get new learning path ID');
        }

        // Create learning path courses for new version
        const coursePromises = selectedCourses.map(course =>
          client.models.LearningPathCourse.create({
            learningPathId: newPathId,
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
          text: `New version (v${maxVersion + 1}) created successfully. Existing assignments continue with the old version.`,
          icon: 'success',
          timer: 3000,
        });
      } else {
        // Update existing version
        if (activeAssignments > 0) {
          const confirmResult = await MySwal.fire({
            title: 'Warning',
            text: `This learning path has ${activeAssignments} active assignment(s). Changes will apply to all current and future assignments. Continue?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, update',
            cancelButtonText: 'Cancel',
          });

          if (!confirmResult.isConfirmed) {
            setSubmitting(false);
            return;
          }
        }

        // Update learning path
        await client.models.LearningPath.update({
          id: learningPath.id,
          title: title.trim(),
          description: description.trim() || null,
          isSequential,
          status: saveStatus,
          updatedAt: now,
        });

        // Get current courses
        const currentCoursesResult = await client.models.LearningPathCourse.list({
          filter: { learningPathId: { eq: learningPath.id } }
        });
        const currentCourses = currentCoursesResult.data || [];

        // Delete removed courses
        const coursesToDelete = currentCourses.filter((cc: any) => 
          !selectedCourses.some(sc => sc.id === cc.id)
        );
        for (const courseToDelete of coursesToDelete) {
          await client.models.LearningPathCourse.delete({ id: courseToDelete.id });
        }

        // Track which courses are new (need assignments created)
        const newCourseIds: string[] = [];

        // Update or create courses
        for (const selectedCourse of selectedCourses) {
          if (selectedCourse.id) {
            // Update existing
            await client.models.LearningPathCourse.update({
              id: selectedCourse.id,
              order: selectedCourse.order,
              isRequired: selectedCourse.isRequired,
              updatedAt: now,
            });
          } else {
            // Create new course in path
            await client.models.LearningPathCourse.create({
              learningPathId: learningPath.id,
              courseId: selectedCourse.courseId,
              order: selectedCourse.order,
              isRequired: selectedCourse.isRequired,
              createdAt: now,
              updatedAt: now,
            });
            newCourseIds.push(selectedCourse.courseId);
          }
        }

        // If new courses were added, create assignments for employees with active path assignments
        if (newCourseIds.length > 0 && activeAssignments > 0) {
          // Get all active path assignments for this learning path
          const pathAssignmentsResult = await client.models.LearningPathAssignment.list({
            filter: { 
              learningPathId: { eq: learningPath.id },
              status: { ne: 'completed' } // Only for in-progress assignments
            }
          });

          const pathAssignments = pathAssignmentsResult.data || [];
          
          // Create course assignments for each employee with an active path assignment
          for (const pathAssignment of pathAssignments) {
            const employeeId = (pathAssignment as any).employeeId;
            if (!employeeId) continue;

            // Create assignments for each new course
            for (const courseId of newCourseIds) {
              try {
                // Check if a learning path assignment already exists for this employee, course, and learning path
                // We only check for learning path assignments, not individual ones, so they can coexist
                const existingLearningPathAssignments = await client.models.Assignment.list({
                  filter: {
                    employeeId: { eq: employeeId },
                    courseId: { eq: courseId },
                    assignmentSource: { eq: 'learning_path' },
                    learningPathId: { eq: learningPath.id }
                  }
                });

                // Only create if a learning path assignment doesn't exist (individual assignments can coexist)
                if (!existingLearningPathAssignments.data || existingLearningPathAssignments.data.length === 0) {
                  await client.models.Assignment.create({
                    employeeId: employeeId,
                    courseId: courseId,
                    status: 'assigned',
                    assignmentSource: 'learning_path',
                    learningPathId: learningPath.id,
                    createdAt: now,
                    updatedAt: now,
                  });
                } else {
                  console.log(`[EditLearningPath] Learning path assignment already exists for employee ${employeeId}, course ${courseId}, learning path ${learningPath.id}, skipping creation`);
                }
              } catch (err) {
                console.error(`Error creating assignment for employee ${employeeId}, course ${courseId}:`, err);
                // Continue with other assignments even if one fails
              }
            }
          }
        }

        const statusMessage = saveStatus === 'published' && learningPath.status !== 'published' 
          ? 'Learning path published successfully.' 
          : 'Learning path updated successfully.';

        await MySwal.fire({
          title: 'Success!',
          text: statusMessage,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false,
        });
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Error saving learning path:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to save learning path';
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
        <Typography variant="h4">
          Edit Learning Path
          {learningPath.version && (
            <Chip label={`v${learningPath.version}`} size="small" sx={{ ml: 2 }} />
          )}
        </Typography>
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

      {learningPath.status === 'published' && activeAssignments > 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          This learning path has {activeAssignments} active assignment(s). When you save, you'll be asked whether to create a new version or update the existing one.
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
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={isSequential}
                  onChange={(e) => setIsSequential(e.target.checked)}
                />
              }
              label="Sequential (courses must be completed in order)"
            />
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}
                label="Status"
              >
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="published">Published</MenuItem>
              </Select>
            </FormControl>
          </Box>
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
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        {learningPath.status === 'draft' && (
          <Button
            variant="outlined"
            onClick={() => handleSave(true)}
            disabled={submitting || selectedCourses.length === 0}
            color="success"
          >
            {submitting ? <CircularProgress size={24} /> : 'Publish'}
          </Button>
        )}
        <Button
          variant="contained"
          onClick={() => handleSave(false)}
          disabled={submitting || selectedCourses.length === 0}
        >
          {submitting ? <CircularProgress size={24} /> : 'Save Changes'}
        </Button>
      </Box>

      {/* Version Choice Dialog */}
      <Dialog
        open={versionDialogOpen}
        onClose={() => setVersionDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>How would you like to save changes?</DialogTitle>
        <DialogContent>
          <FormControl component="fieldset" fullWidth>
            <FormLabel component="legend">Choose an option:</FormLabel>
            <RadioGroup
              value={versionChoice}
              onChange={(e) => setVersionChoice(e.target.value as 'new' | 'update')}
            >
              <FormControlLabel
                value="new"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body1" fontWeight="medium">
                      Create New Version
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • New version will be created with incremented version number
                      • Existing assignments continue with old version
                      • New assignments will use the new version
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="update"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body1" fontWeight="medium">
                      Update Existing Version
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Changes apply to all current and future assignments
                      • If courses are added, they appear for in-progress employees
                      • If courses are removed, they're marked as "removed from path"
                    </Typography>
                  </Box>
                }
              />
            </RadioGroup>
          </FormControl>
          {versionChoice === 'update' && activeAssignments > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Warning: This will affect {activeAssignments} active assignment(s).
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVersionDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => performSave(versionChoice, status)}
            disabled={submitting}
          >
            {submitting ? <CircularProgress size={24} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EditLearningPath;


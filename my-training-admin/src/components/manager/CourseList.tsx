import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import { fetchAuthSession } from 'aws-amplify/auth';
import { getUrl, remove } from 'aws-amplify/storage';
import type { Schema } from '../../../../amplify/data/resource';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Grid,
  Chip,
  IconButton,
  Alert,
  AlertTitle,
  useTheme,
  useMediaQuery,
  CircularProgress,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import ImageIcon from '@mui/icons-material/Image';
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import Loader from '../common/Loader';
const MySwal = withReactContent(Swal);

const client = generateClient<Schema>();

type Course = {
  readonly id: string;
  readonly title: string;
  readonly description?: string | null;
  readonly videoKey?: string | null;
  readonly imageKey?: string | null;
  readonly pdfKey?: string | null;
  readonly pdfTitle?: string | null;
  readonly contentType?: string | null;
  readonly passingScore?: number | null;
  readonly duration?: string | null;
  readonly category?: string | null;
  readonly randomizeQuestions?: boolean | null;
  readonly randomizeOptions?: boolean | null;
  readonly useQuestionPool?: boolean | null;
  readonly poolSize?: number | null;
  readonly questionsToDisplay?: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly quiz?: any;
};

interface CourseListProps {
  onEditCourse?: (course: Course) => void;
  refreshTrigger?: number;
}

const CourseList: React.FC<CourseListProps> = ({ onEditCourse, refreshTrigger }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const fetchCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get current manager's userId
      const session = await fetchAuthSession();
      const currentUserId = session.userSub || session.tokens?.idToken?.payload?.sub as string;

      if (!currentUserId) {
        throw new Error('User not authenticated');
      }

      console.log('[CourseList] Fetching courses for manager:', currentUserId);
      
      // Fetch courses created by the current manager
      const result = await client.models.Course.list({
        filter: { createdBy: { eq: currentUserId } }
      });
      console.log('Course list result:', result);
      
      // Check for GraphQL errors
      if (result.errors && result.errors.length > 0) {
        console.error('GraphQL errors:', result.errors);
        setError('GraphQL error: ' + result.errors.map((e: any) => e.message).join(', '));
      }
      
      if (result.data) {
        console.log('Found courses:', result.data.length, result.data);
        console.log('[CourseList] Sample course from list():', result.data[0]);
        console.log('[CourseList] Has description?', result.data[0]?.description !== undefined);
        console.log('[CourseList] Has imageKey?', result.data[0]?.imageKey !== undefined);
        
        // Since list() doesn't return description and imageKey, fetch full details for ALL courses
        // Use Promise.allSettled to handle individual failures gracefully
        console.log('[CourseList] Fetching full details for all courses...');
        const coursesWithFullData = await Promise.allSettled(
          result.data.map(async (course: any) => {
            try {
              console.log(`[CourseList] Fetching full details for course ${course.id}...`);
              const fullCourse = await client.models.Course.get({ id: course.id });
              console.log(`[CourseList] Raw get() response for ${course.id}:`, fullCourse);
              console.log(`[CourseList] Raw get() data:`, fullCourse.data);
              console.log(`[CourseList] Raw get() errors:`, fullCourse.errors);
              
              if (fullCourse.data) {
                console.log(`[CourseList] Full course data for ${course.id}:`, {
                  id: fullCourse.data.id,
                  title: fullCourse.data.title,
                  description: fullCourse.data.description,
                  descriptionType: typeof fullCourse.data.description,
                  descriptionIsUndefined: fullCourse.data.description === undefined,
                  descriptionIsNull: fullCourse.data.description === null,
                  imageKey: fullCourse.data.imageKey,
                  imageKeyType: typeof fullCourse.data.imageKey,
                  imageKeyIsUndefined: fullCourse.data.imageKey === undefined,
                  imageKeyIsNull: fullCourse.data.imageKey === null,
                  videoKey: fullCourse.data.videoKey,
                  fullDataKeys: Object.keys(fullCourse.data)
                });
                console.log(`[CourseList] Full course data (JSON):`, JSON.stringify(fullCourse.data, null, 2));
                
                // Map to Course type, ensuring all fields are included
                const mappedCourse = {
                  id: fullCourse.data.id || course.id,
                  title: fullCourse.data.title || course.title,
                  description: fullCourse.data.description ?? course.description ?? null,
                  videoKey: fullCourse.data.videoKey ?? course.videoKey ?? null,
                  imageKey: fullCourse.data.imageKey ?? course.imageKey ?? null,
                  pdfKey: fullCourse.data.pdfKey ?? course.pdfKey ?? null,
                  pdfTitle: fullCourse.data.pdfTitle ?? course.pdfTitle ?? null,
                  contentType: fullCourse.data.contentType ?? course.contentType ?? null,
                  passingScore: fullCourse.data.passingScore ?? course.passingScore ?? null,
                  duration: fullCourse.data.duration ?? course.duration ?? null,
                  category: fullCourse.data.category ?? course.category ?? null,
                  randomizeQuestions: fullCourse.data.randomizeQuestions ?? course.randomizeQuestions ?? false,
                  randomizeOptions: fullCourse.data.randomizeOptions ?? course.randomizeOptions ?? false,
                  useQuestionPool: fullCourse.data.useQuestionPool ?? course.useQuestionPool ?? false,
                  poolSize: fullCourse.data.poolSize ?? course.poolSize ?? null,
                  questionsToDisplay: fullCourse.data.questionsToDisplay ?? course.questionsToDisplay ?? null,
                  createdAt: fullCourse.data.createdAt || course.createdAt,
                  updatedAt: fullCourse.data.updatedAt || course.updatedAt
                } as Course;
                
                console.log(`[CourseList] Mapped course for ${course.id}:`, {
                  description: mappedCourse.description,
                  imageKey: mappedCourse.imageKey,
                  fullMapped: mappedCourse
                });
                
                return mappedCourse;
              } else {
                console.warn(`[CourseList] No data returned for course ${course.id}, using list data`);
                return course as Course;
              }
            } catch (err) {
              console.error(`[CourseList] Could not fetch full details for course ${course.id}:`, err);
              // Return original course if fetch fails
              return course as Course;
            }
          })
        );
        
        // Extract successful results from Promise.allSettled
        const successfulCourses = coursesWithFullData
          .map((result) => {
            if (result.status === 'fulfilled') {
              return result.value;
            } else {
              console.error('[CourseList] Failed to process course:', result.reason);
              return null;
            }
          })
          .filter((course): course is Course => course !== null);
        
        console.log('[CourseList] Final courses with full data:', successfulCourses.length);
        console.log('[CourseList] Sample final course:', successfulCourses[0]);
        console.log('[CourseList] Sample final course - has description?', successfulCourses[0]?.description !== undefined && successfulCourses[0]?.description !== null);
        console.log('[CourseList] Sample final course - has imageKey?', successfulCourses[0]?.imageKey !== undefined && successfulCourses[0]?.imageKey !== null);
        console.log('[CourseList] Sample final course - description value:', successfulCourses[0]?.description);
        console.log('[CourseList] Sample final course - imageKey value:', successfulCourses[0]?.imageKey);
        setCourses(successfulCourses);
      } else {
        console.log('No course data in result');
        setCourses([]);
      }
    } catch (err) {
      console.error('Error fetching courses:', err);
      setError('Failed to load courses: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const deleteCourse = async (courseId: string, videoKey?: string | null, imageKey?: string | null, pdfKey?: string | null) => {
    const result = await MySwal.fire({
      title: "Are you sure?",
      text: "Are you sure you want to delete this course? This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    try {
      // Delete quiz questions first (due to foreign key relationship)
      const quizQuestions = await client.models.QuizQuestion.list({
        filter: { courseId: { eq: courseId } }
      });
      
      if (quizQuestions.data) {
        for (const question of quizQuestions.data) {
          await client.models.QuizQuestion.delete({ id: question.id });
        }
      }

      // Delete course from database
      await client.models.Course.delete({ id: courseId });

      // Delete video from S3 if it exists
      if (videoKey) {
        try {
          await remove({ path: videoKey });
        } catch (storageError) {
          console.warn('Failed to delete video from storage:', storageError);
        }
      }

      // Delete image from S3 if it exists
      if (imageKey) {
        try {
          await remove({ path: imageKey });
        } catch (storageError) {
          console.warn('Failed to delete image from storage:', storageError);
        }
      }

      // Delete PDF from S3 if it exists
      if (pdfKey) {
        try {
          await remove({ path: pdfKey });
        } catch (storageError) {
          console.warn('Failed to delete PDF from storage:', storageError);
        }
      }

      // Refresh course list
      fetchCourses();
      await MySwal.fire({
        title: "Deleted!",
        text: "Course deleted successfully",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error('Error deleting course:', err);
      await MySwal.fire({
        title: "Error!",
        text: "Failed to delete course",
        icon: "error",
      });
    }
  };

  const getVideoPreview = async (videoKey: string) => {
    try {
      const url = await getUrl({ path: videoKey });
      return url.url.toString();
    } catch (err) {
      console.error('Error getting video URL:', err);
      return null;
    }
  };

  useEffect(() => {
    fetchCourses();
  }, [refreshTrigger]);

  if (loading) {
    return <Loader message="Loading courses..." />;
  }

  if (error) {
    return (
      <Alert 
        severity="error" 
        action={
          <Button color="inherit" size="small" onClick={fetchCourses}>
            Retry
          </Button>
        }
        sx={{ m: 2 }}
      >
        <AlertTitle>Error</AlertTitle>
        {error}
      </Alert>
    );
  }

  if (courses.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4, px: 2 }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No courses found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Create your first course to get started!
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          mb: 3,
          flexWrap: 'wrap',
          gap: 2
        }}
      >
        <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
          Courses ({courses.length})
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchCourses}
          size={isMobile ? 'small' : 'medium'}
        >
          Refresh
        </Button>
      </Box>

      <Grid container spacing={{ xs: 2, sm: 3 }}>
        {courses.map((course) => (
          <Grid item xs={12} sm={6} md={4} key={course.id}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: { xs: 'none', sm: 'translateY(-4px)' },
                  boxShadow: { xs: 1, sm: 4 },
                },
                borderRadius: { xs: 1, sm: 2 },
                overflow: 'hidden',
              }}
            >
              {/* Course Image */}
              {course.imageKey ? (
                <CardMedia
                  component="div"
                  sx={{
                    height: { xs: 140, sm: 180 },
                    position: 'relative',
                    backgroundColor: 'grey.200',
                  }}
                >
                  <ImagePreview imageKey={course.imageKey} />
                </CardMedia>
              ) : (
                <Box
                  sx={{
                    height: { xs: 140, sm: 180 },
                    backgroundColor: 'primary.light',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                  }}
                >
                  <ImageIcon sx={{ fontSize: { xs: 40, sm: 60 }, opacity: 0.5 }} />
                </Box>
              )}

              <CardContent sx={{ flexGrow: 1, p: { xs: 1.5, sm: 2 } }}>
                {/* Course Title */}
                <Typography
                  variant="h6"
                  component="h3"
                  sx={{
                    fontWeight: 600,
                    mb: { xs: 0.75, sm: 1 },
                    color: 'primary.main',
                    fontSize: { xs: '0.95rem', sm: '1.1rem' },
                    lineHeight: 1.3,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {course.title}
                </Typography>

                {/* Description */}
                {course.description && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      mb: { xs: 1, sm: 1.5 },
                      display: '-webkit-box',
                      WebkitLineClamp: { xs: 2, sm: 2 },
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      lineHeight: 1.4,
                    }}
                  >
                    {course.description}
                  </Typography>
                )}

                {/* Tags */}
                <Box sx={{ display: 'flex', gap: { xs: 0.25, sm: 0.5 }, mb: { xs: 1, sm: 1.5 }, flexWrap: 'wrap', alignItems: 'center' }}>
                  {/* Content Type Icon */}
                  {(() => {
                    const contentType = course.contentType || (course.videoKey && course.pdfKey ? 'both' : course.pdfKey ? 'pdf' : 'video');
                    const iconMap: Record<string, string> = {
                      'video': '🎥',
                      'pdf': '📄',
                      'both': '🎥📄'
                    };
                    return (
                      <Chip
                        icon={<span style={{ fontSize: '1rem' }}>{iconMap[contentType] || '🎥'}</span>}
                        label={contentType === 'both' ? 'Video & PDF' : contentType === 'pdf' ? 'PDF' : 'Video'}
                        size="small"
                        color="info"
                        variant="outlined"
                        sx={{ 
                          fontSize: { xs: '0.7rem', sm: '0.75rem' },
                          height: { xs: 20, sm: 24 },
                          '& .MuiChip-label': {
                            px: { xs: 0.75, sm: 1 },
                          },
                        }}
                      />
                    );
                  })()}
                  {course.duration && (
                    <Chip
                      label={course.duration}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ 
                        fontSize: { xs: '0.7rem', sm: '0.75rem' },
                        height: { xs: 20, sm: 24 },
                        '& .MuiChip-label': {
                          px: { xs: 0.75, sm: 1 },
                        },
                      }}
                    />
                  )}
                  {course.category && (
                    <Chip
                      label={course.category}
                      size="small"
                      color="secondary"
                      variant="outlined"
                      sx={{ 
                        fontSize: { xs: '0.7rem', sm: '0.75rem' },
                        height: { xs: 20, sm: 24 },
                        '& .MuiChip-label': {
                          px: { xs: 0.75, sm: 1 },
                        },
                      }}
                    />
                  )}
                </Box>

                {/* Course Details */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 0.25, sm: 0.5 }, mb: { xs: 0.75, sm: 1 } }}>
                  <Typography 
                    variant="caption" 
                    color="text.secondary"
                    sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                  >
                    <strong>Passing Score:</strong> {course.passingScore ?? 'Not set'}%
                  </Typography>
                  {course.randomizeQuestions && (
                    <Typography 
                      variant="caption" 
                      color="info.main"
                      sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <span>🔀</span>
                      <strong>Questions Randomized</strong>
                    </Typography>
                  )}
                  {course.randomizeOptions && (
                    <Typography 
                      variant="caption" 
                      color="info.main"
                      sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <span>🔀</span>
                      <strong>Options Randomized</strong>
                    </Typography>
                  )}
                  {course.useQuestionPool && (
                    <Typography 
                      variant="caption" 
                      color="success.main"
                      sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <span>📚</span>
                      <strong>Question Pool: {course.questionsToDisplay}/{course.poolSize}</strong>
                    </Typography>
                  )}
                  <Typography 
                    variant="caption" 
                    color="text.secondary"
                    sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                  >
                    <strong>Created:</strong>{' '}
                    {new Date(course.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Typography>
                </Box>

                {/* Video Preview */}
                {course.videoKey && (
                  <Box sx={{ mt: { xs: 1, sm: 1.5 }, mb: { xs: 0.5, sm: 1 } }}>
                    <VideoPreview videoKey={course.videoKey} />
                  </Box>
                )}
              </CardContent>

              {/* Action Buttons */}
              <CardActions
                sx={{
                  p: { xs: 1, sm: 1.5 },
                  pt: 0,
                  display: 'flex',
                  gap: { xs: 0.5, sm: 1 },
                  justifyContent: 'flex-end',
                }}
              >
                {onEditCourse && (
                  <IconButton
                    color="primary"
                    size="small"
                    onClick={() => onEditCourse(course)}
                    aria-label="edit course"
                    sx={{
                      '&:hover': {
                        backgroundColor: 'primary.light',
                        color: 'white',
                      },
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                )}
                <IconButton
                  color="error"
                  size="small"
                  onClick={() => deleteCourse(course.id, course.videoKey, course.imageKey, course.pdfKey)}
                  aria-label="delete course"
                  sx={{
                    '&:hover': {
                      backgroundColor: 'error.light',
                      color: 'white',
                    },
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

// Helper component for image preview
const ImagePreview: React.FC<{ imageKey: string }> = ({ imageKey }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchImageUrl = async () => {
      try {
        setLoading(true);
        setError(null);
        if (!imageKey) {
          throw new Error('Image key is empty');
        }
        const url = await getUrl({ path: imageKey });
        setImageUrl(url.url.toString());
      } catch (err) {
        console.error('[ImagePreview] Error loading image:', err);
        setError(err instanceof Error ? err.message : 'Failed to load image');
        setImageUrl(null);
      } finally {
        setLoading(false);
      }
    };

    if (imageKey) {
      fetchImageUrl();
    } else {
      setLoading(false);
      setError('No image key provided');
    }
  }, [imageKey]);

  if (loading) {
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'grey.200',
        }}
      >
        <CircularProgress size={30} />
      </Box>
    );
  }

  if (error || !imageUrl) {
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'grey.200',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <ImageIcon sx={{ fontSize: 40, color: 'grey.400' }} />
        <Typography variant="caption" color="error">
          {error || 'Image not available'}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      component="img"
      src={imageUrl}
      alt="Course thumbnail"
      sx={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block',
      }}
      onError={() => {
        console.error('[ImagePreview] Image failed to load:', imageUrl);
        setError('Image failed to load');
        setImageUrl(null);
      }}
    />
  );
};

// Helper component for video preview (compact version for course cards)
const VideoPreview: React.FC<{ videoKey: string }> = ({ videoKey }) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    const fetchVideoUrl = async () => {
      try {
        // Get signed URL with 1 hour expiration
        const urlResult = await getUrl({ 
          path: videoKey,
          options: {
            expiresIn: 3600 // 1 hour
          }
        });
        
        const url = urlResult.url.toString();
        setVideoUrl(url);
        setError(null);
      } catch (err: any) {
        console.error('[VideoPreview] Error loading video:', err);
        setError('Video not available');
        setVideoUrl(null);
      } finally {
        setLoading(false);
      }
    };

    if (videoKey) {
      fetchVideoUrl();
    } else {
      setError('No video key provided');
      setLoading(false);
    }
  }, [videoKey]);

  if (loading) {
    return (
      <Box
        sx={{
          width: '100%',
          height: { xs: 100, sm: 120 },
          backgroundColor: 'grey.200',
          borderRadius: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress size={isMobile ? 20 : 24} />
      </Box>
    );
  }

  if (error || !videoUrl) {
    return (
      <Box
        sx={{
          width: '100%',
          height: { xs: 100, sm: 120 },
          backgroundColor: 'grey.200',
          borderRadius: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 0.5,
        }}
      >
        <PlayCircleOutlineIcon sx={{ fontSize: { xs: 24, sm: 32 }, color: 'text.secondary', opacity: 0.5 }} />
        <Typography 
          variant="caption" 
          color="text.secondary"
          sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}
        >
          {error || 'Video not available'}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: '100%',
        borderRadius: 1,
        overflow: 'hidden',
        backgroundColor: '#000',
        maxHeight: { xs: '150px', sm: '200px' },
      }}
    >
      <video 
        controls 
        preload="metadata"
        style={{ 
          display: 'block',
          width: '100%',
          height: 'auto',
          maxHeight: isMobile ? '150px' : '200px',
        }}
        onError={(e) => {
          console.error('[VideoPreview] Video playback error:', e);
          setError('Video playback failed');
        }}
      >
        <source src={videoUrl} type="video/mp4" />
        <source src={videoUrl} type="video/webm" />
        <source src={videoUrl} type="video/ogg" />
        Your browser does not support the video tag.
      </video>
    </Box>
  );
};

export default CourseList;
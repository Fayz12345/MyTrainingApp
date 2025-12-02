import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import { getUrl, remove } from 'aws-amplify/storage';
import type { Schema } from '../../../../amplify/data/resource';

const client = generateClient<Schema>();

type Course = {
  readonly id: string;
  readonly title: string;
  readonly description?: string | null;
  readonly videoKey?: string | null;
  readonly imageKey?: string | null;
  readonly passingScore?: number | null;
  readonly duration?: string | null;
  readonly category?: string | null;
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

  const fetchCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching courses...');
      const result = await client.models.Course.list({});
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
                  passingScore: fullCourse.data.passingScore ?? course.passingScore ?? null,
                  duration: fullCourse.data.duration ?? course.duration ?? null,
                  category: fullCourse.data.category ?? course.category ?? null,
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

  const deleteCourse = async (courseId: string, videoKey?: string | null, imageKey?: string | null) => {
    if (!window.confirm('Are you sure you want to delete this course? This action cannot be undone.')) {
      return;
    }

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

      // Refresh course list
      fetchCourses();
      alert('Course deleted successfully');
    } catch (err) {
      console.error('Error deleting course:', err);
      alert('Failed to delete course');
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
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p>Loading courses...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'red' }}>
        <p>{error}</p>
        <button 
          onClick={fetchCourses}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p>No courses found. Create your first course to get started!</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3>Existing Courses ({courses.length})</h3>
        <button 
          onClick={fetchCourses}
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

      <div style={{ display: 'grid', gap: '1rem' }}>
        {courses.map((course) => (
          <div 
            key={course.id} 
            style={{
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              padding: '1.5rem',
              backgroundColor: 'white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, display: 'flex', gap: '1rem' }}>
                {/* Image Preview */}
                {course.imageKey && (
                  <div style={{ flexShrink: 0 }}>
                    <ImagePreview imageKey={course.imageKey} />
                  </div>
                )}
                
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#1976d2', fontSize: '1.25rem', fontWeight: 'bold' }}>
                    {course.title}
                  </h4>
                  
                  {/* Description */}
                  {course.description && (
                    <p style={{ 
                      margin: '0 0 1rem 0', 
                      color: '#555', 
                      fontSize: '0.95rem',
                      lineHeight: '1.5'
                    }}>
                      {course.description}
                    </p>
                  )}
                  
                  {/* Duration and Category Tags */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    {course.duration && (
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        backgroundColor: '#e3f2fd',
                        color: '#1976d2',
                        borderRadius: '16px',
                        fontSize: '0.875rem',
                        fontWeight: '500'
                      }}>
                        {course.duration}
                      </span>
                    )}
                    {course.category && (
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        backgroundColor: '#e3f2fd',
                        color: '#1976d2',
                        borderRadius: '16px',
                        fontSize: '0.875rem',
                        fontWeight: '500'
                      }}>
                        {course.category}
                      </span>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem' }}>
                    <p style={{ margin: 0, color: '#666' }}>
                      <strong>Passing Score:</strong> {course.passingScore ?? 'Not set'}%
                    </p>
                    <p style={{ margin: 0, color: '#666' }}>
                      <strong>Created:</strong> {new Date(course.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  
                  {course.videoKey && (
                    <div style={{ marginBottom: '1rem' }}>
                      <VideoPreview videoKey={course.videoKey} />
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                {onEditCourse && (
                  <button
                    onClick={() => {
                      console.log('[CourseList] ========== EDIT BUTTON CLICKED ==========');
                      console.log('[CourseList] Course object being passed:', course);
                      console.log('[CourseList] Course ID:', course.id);
                      console.log('[CourseList] Course title:', course.title);
                      console.log('[CourseList] Course description:', course.description);
                      console.log('[CourseList] Course description type:', typeof course.description);
                      console.log('[CourseList] Course description === undefined?', course.description === undefined);
                      console.log('[CourseList] Course description === null?', course.description === null);
                      console.log('[CourseList] Course imageKey:', course.imageKey);
                      console.log('[CourseList] Course imageKey type:', typeof course.imageKey);
                      console.log('[CourseList] Course imageKey === undefined?', course.imageKey === undefined);
                      console.log('[CourseList] Course imageKey === null?', course.imageKey === null);
                      console.log('[CourseList] Full course object (JSON):', JSON.stringify(course, null, 2));
                      console.log('[CourseList] ===========================================');
                      onEditCourse(course);
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#1976d2',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    ✏️ Edit
                  </button>
                )}
                <button
                  onClick={() => deleteCourse(course.id, course.videoKey, course.imageKey)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#d32f2f',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
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
      <div style={{ 
        width: '150px', 
        height: '100px', 
        backgroundColor: '#f5f5f5', 
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.8rem',
        color: '#666'
      }}>
        Loading...
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div style={{ 
        width: '150px', 
        height: '100px', 
        backgroundColor: '#f5f5f5', 
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.8rem',
        color: '#d32f2f'
      }}>
        {error || 'Image not available'}
      </div>
    );
  }

  return (
    <img 
      src={imageUrl || undefined} 
      alt="Course thumbnail" 
      style={{ 
        width: '150px', 
        height: '100px', 
        objectFit: 'cover',
        borderRadius: '4px',
        border: '1px solid #e0e0e0'
      }}
      onError={(e) => {
        console.error('[ImagePreview] Image failed to load:', imageUrl, e);
        setError('Image failed to load');
        setImageUrl(null);
      }}
    />
  );
};

// Helper component for video preview
const VideoPreview: React.FC<{ videoKey: string }> = ({ videoKey }) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVideoUrl = async () => {
      try {
        console.log('[VideoPreview] Fetching URL for video key:', videoKey);
        
        // Get signed URL with 1 hour expiration
        const urlResult = await getUrl({ 
          path: videoKey,
          options: {
            expiresIn: 3600 // 1 hour
          }
        });
        
        const url = urlResult.url.toString();
        console.log('[VideoPreview] Video URL retrieved:', url.substring(0, 100) + '...');
        setVideoUrl(url);
        setError(null);
      } catch (err: any) {
        console.error('[VideoPreview] Error loading video:', err);
        console.error('[VideoPreview] Error details:', {
          message: err?.message,
          name: err?.name,
          stack: err?.stack,
          videoKey: videoKey
        });
        
        // Provide more specific error messages
        let errorMessage = 'Video not available';
        if (err?.message?.includes('AccessDenied') || err?.message?.includes('403')) {
          errorMessage = 'Access denied. Check storage permissions.';
        } else if (err?.message?.includes('NotFound') || err?.message?.includes('404')) {
          errorMessage = 'Video file not found in storage.';
        } else if (err?.message) {
          errorMessage = `Error: ${err.message}`;
        }
        
        setError(errorMessage);
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
      <div style={{ marginBottom: '1rem' }}>
        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#666' }}>
          <strong>Video:</strong>
        </p>
        <p style={{ color: '#666', fontSize: '0.9rem' }}>Loading video preview...</p>
      </div>
    );
  }

  if (error || !videoUrl) {
    return (
      <div style={{ marginBottom: '1rem' }}>
        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#666' }}>
          <strong>Video:</strong>
        </p>
        <p style={{ color: '#d32f2f', fontSize: '0.9rem' }}>
          {error || 'Video not available'}
        </p>
        {videoKey && (
          <p style={{ color: '#999', fontSize: '0.8rem', marginTop: '0.25rem' }}>
            Key: <code>{videoKey}</code>
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#666' }}>
        <strong>Video:</strong>
      </p>
      <video 
        width="300" 
        height="180" 
        controls 
        preload="metadata"
        style={{ 
          borderRadius: '4px',
          maxWidth: '100%',
          backgroundColor: '#000'
        }}
        onError={(e) => {
          console.error('[VideoPreview] Video playback error:', e);
          const videoElement = e.target as HTMLVideoElement;
          const error = videoElement.error;
          let errorMessage = 'Video playback failed.';
          
          if (error) {
            switch (error.code) {
              case error.MEDIA_ERR_ABORTED:
                errorMessage = 'Video loading aborted.';
                break;
              case error.MEDIA_ERR_NETWORK:
                errorMessage = 'Network error while loading video.';
                break;
              case error.MEDIA_ERR_DECODE:
                errorMessage = 'Video decoding error.';
                break;
              case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                errorMessage = 'Video format not supported.';
                break;
              default:
                errorMessage = `Video error (code: ${error.code}).`;
            }
          }
          
          console.error('[VideoPreview] Video error details:', {
            code: error?.code,
            message: error?.message,
            videoUrl: videoUrl?.substring(0, 100)
          });
          
          setError(errorMessage);
        }}
        onLoadStart={() => {
          console.log('[VideoPreview] Video started loading');
        }}
        onCanPlay={() => {
          console.log('[VideoPreview] Video can play');
        }}
        onWaiting={() => {
          console.log('[VideoPreview] Video buffering...');
        }}
        onPlaying={() => {
          console.log('[VideoPreview] Video playing');
        }}
        onLoadedMetadata={() => {
          console.log('[VideoPreview] Video metadata loaded');
        }}
      >
        <source src={videoUrl} type="video/mp4" />
        <source src={videoUrl} type="video/webm" />
        <source src={videoUrl} type="video/ogg" />
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

export default CourseList;
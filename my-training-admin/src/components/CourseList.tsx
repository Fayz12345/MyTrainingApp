import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import { getUrl, remove } from 'aws-amplify/storage';
import type { Schema } from '../../../amplify/data/resource';

const client = generateClient<Schema>();

type Course = {
  readonly id: string;
  readonly title: string;
  readonly videoKey?: string | null;
  readonly passingScore?: number | null;
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
      const result = await client.models.Course.list();
      console.log('Course list result:', result);
      
      // Check for GraphQL errors
      if (result.errors && result.errors.length > 0) {
        console.error('GraphQL errors:', result.errors);
        setError('GraphQL error: ' + result.errors.map((e: any) => e.message).join(', '));
      }
      
      if (result.data) {
        console.log('Found courses:', result.data.length, result.data);
        setCourses(result.data as Course[]);
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

  const deleteCourse = async (courseId: string, videoKey?: string | null) => {
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

      // Refresh course list
      fetchCourses();
      alert('Course deleted successfully');
    } catch (err) {
      console.error('Error deleting course:', err);
      alert('Failed to delete course');
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
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#1976d2' }}>
                  {course.title}
                </h4>
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

              <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                {onEditCourse && (
                  <button
                    onClick={() => onEditCourse(course)}
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
                  onClick={() => deleteCourse(course.id, course.videoKey)}
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

// Helper component for video preview
const VideoPreview: React.FC<{ videoKey: string }> = ({ videoKey }) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVideoUrl = async () => {
      try {
        const url = await getUrl({ path: videoKey });
        setVideoUrl(url.url.toString());
      } catch (err) {
        console.error('Error loading video:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchVideoUrl();
  }, [videoKey]);

  if (loading) {
    return <p style={{ color: '#666', fontSize: '0.9rem' }}>Loading video preview...</p>;
  }

  if (!videoUrl) {
    return <p style={{ color: '#d32f2f', fontSize: '0.9rem' }}>Video not available</p>;
  }

  return (
    <div>
      <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#666' }}>
        <strong>Video:</strong>
      </p>
      <video 
        width="200" 
        height="120" 
        controls 
        style={{ borderRadius: '4px' }}
      >
        <source src={videoUrl} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

export default CourseList;
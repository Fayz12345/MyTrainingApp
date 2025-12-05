import React, { useState, useEffect } from 'react';
import { AuthUser } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';
import { fetchAuthSession } from 'aws-amplify/auth';
import { getUrl } from 'aws-amplify/storage';
import Loader from '../common/Loader';

const client = generateClient<Schema>();

type QuizQuestion = {
  id: string;
  courseId: string;
  question: string;
  options: string[];
  correctAnswer: string;
};

interface EmployeeDashboardProps {
  signOut: (() => void) | undefined;
  user: AuthUser;
}

type CourseWithAssignment = {
  id: string;
  title: string;
  description?: string | null;
  videoKey?: string | null;
  imageKey?: string | null;
  passingScore?: number | null;
  duration?: string | null;
  category?: string | null;
  assignmentId: string;
  employeeId?: string; // Add employeeId for Lambda invocation
  assignmentStatus: 'assigned' | 'completed';
  isTrainingComplete?: boolean | null;
  trainingCompletedAt?: string | null; // Date when training was completed (for recertification)
  createdAt: string;
  updatedAt: string;
};

const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ signOut, user }) => {
  const [courses, setCourses] = useState<CourseWithAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<CourseWithAssignment | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<{ [key: string]: string }>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [quizPassed, setQuizPassed] = useState<boolean | false>(false);
  const [totalCourses, setTotalCourses] = useState<number>(0);
  const [completedCourses, setCompletedCourses] = useState<number>(0);

  useEffect(() => {
    loadUserInfo();
    loadCourses();
  }, []);

  const loadUserInfo = async () => {
    try {
      const session = await fetchAuthSession();
      const email = session.tokens?.idToken?.payload['email'] as string | undefined;
      if (email) {
        setUserEmail(email);
      }
    } catch (err) {
      console.error('Error loading user info:', err);
    }
  };

  const loadCourses = async () => {
    try {
      setLoading(true);
      setError(null);

      const session = await fetchAuthSession();
      const userId = session.tokens?.idToken?.payload['sub'] as string;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      console.log('[EmployeeDashboard] Loading courses for userId:', userId);

      // Use GraphQL query to get nested course data (similar to Flutter app)
      const query = `
        query GetAssignedCourses($userId: String!) {
          listEmployees(filter: { userId: { eq: $userId } }) {
            items {
              id
              assignments {
                items {
                  id
                  status
                  isTrainingComplete
                  trainingCompletedAt
                  course {
                    id
                    title
                    description
                    videoKey
                    imageKey
                    passingScore
                    duration
                    category
                    createdAt
                    updatedAt
                  }
                }
              }
            }
          }
        }
      `;

      const response = await client.graphql({
        query,
        variables: { userId }
      });

      const data = (response as any).data;
      const errors = (response as any).errors;

      if (errors && errors.length > 0) {
        console.error('[EmployeeDashboard] GraphQL errors:', errors);
        throw new Error(errors[0].message || 'Failed to load courses');
      }

      console.log('[EmployeeDashboard] GraphQL response:', data);

      const employees = (data as any)?.listEmployees?.items;
      if (!employees || employees.length === 0) {
        console.log('[EmployeeDashboard] No employee found for userId:', userId);
        setCourses([]);
        setLoading(false);
        return;
      }

      const employee = employees[0];
      const assignments = employee.assignments?.items || [];

      console.log('[EmployeeDashboard] Found assignments:', assignments.length);

      const coursesList: CourseWithAssignment[] = [];

      for (const assignment of assignments) {
        if (assignment.course) {
          const course = assignment.course;
          coursesList.push({
            id: course.id,
            title: course.title || 'Untitled Course',
            description: course.description || null,
            videoKey: course.videoKey || null,
            imageKey: course.imageKey || null,
            passingScore: course.passingScore || null,
            duration: course.duration || null,
            category: course.category || null,
            assignmentId: assignment.id,
            employeeId: employee.id, // Store employeeId for Lambda
            assignmentStatus: assignment.status as 'assigned' | 'completed',
            isTrainingComplete: assignment.isTrainingComplete ?? false,
            trainingCompletedAt: assignment.trainingCompletedAt || null,
            createdAt: course.createdAt,
            updatedAt: course.updatedAt,
          });
        }
      }

      console.log('[EmployeeDashboard] Courses loaded:', coursesList.length);
      setCourses(coursesList);
      
      // Calculate progress
      const total = coursesList.length;
      const completed = coursesList.filter(c => c.assignmentStatus === 'completed').length;
      setTotalCourses(total);
      setCompletedCourses(completed);
      
      console.log('[EmployeeDashboard] Progress:', {
        total,
        completed,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0
      });
    } catch (err) {
      console.error('[EmployeeDashboard] Error loading courses:', err);
      setError(err instanceof Error ? err.message : 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  const handleViewCourse = async (course: CourseWithAssignment) => {
    setSelectedCourse(course);
    setShowQuiz(false);
    setQuizQuestions([]);
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(null);
    setQuizPassed(false);
    
    // Load video URL if available
    if (course.videoKey) {
      try {
        console.log('[EmployeeDashboard] Loading video from key:', course.videoKey);
        const url = await getUrl({
          path: course.videoKey,
          options: {
            expiresIn: 3600 // 1 hour
          }
        });
        console.log('[EmployeeDashboard] Video URL loaded:', url.url.toString());
        setVideoUrl(url.url.toString());
      } catch (err) {
        console.error('[EmployeeDashboard] Error loading video:', err);
        setVideoUrl(null);
      }
    } else {
      setVideoUrl(null);
    }
  };

  const handleCloseCourse = () => {
    setSelectedCourse(null);
    setVideoUrl(null);
    setShowQuiz(false);
    setQuizQuestions([]);
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(null);
    setQuizPassed(false);
  };

  // Check if recertification is needed (1 year has passed since training completion)
  const isRecertificationNeeded = (course: CourseWithAssignment): boolean => {
    if (!course.isTrainingComplete || !course.trainingCompletedAt) {
      return false;
    }
    
    const completedDate = new Date(course.trainingCompletedAt);
    const now = new Date();
    const oneYearInMs = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
    const timeSinceCompletion = now.getTime() - completedDate.getTime();
    
    return timeSinceCompletion >= oneYearInMs;
  };

  // Check if quiz should be enabled (either not completed, or recertification needed)
  const isQuizEnabled = (course: CourseWithAssignment): boolean => {
    // Quiz is enabled if:
    // 1. Training is not complete, OR
    // 2. Recertification is needed (1 year passed)
    return !course.isTrainingComplete || isRecertificationNeeded(course);
  };

  const invokeQuizCompletionLambda = async (event: {
    assignmentId: string;
    employeeId: string;
    courseId: string;
    score: number;
    passed: boolean;
  }) => {
    // Lambda Function URL - Configure after deployment
    // Get this from AWS Lambda Console → Function → Configuration → Function URL
    const LAMBDA_FUNCTION_URL = process.env.REACT_APP_QUIZ_COMPLETION_LAMBDA_URL || '';
    
    if (!LAMBDA_FUNCTION_URL) {
      console.log('[EmployeeDashboard] Lambda Function URL not configured. Skipping notification.');
      return;
    }

    try {
      console.log('[EmployeeDashboard] Invoking quiz completion Lambda...');
      const response = await fetch(LAMBDA_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event)
      });

      if (!response.ok) {
        throw new Error(`Lambda returned status ${response.status}`);
      }

      const result = await response.json();
      console.log('[EmployeeDashboard] Lambda response:', result);
      return result;
    } catch (err) {
      console.error('[EmployeeDashboard] Lambda invocation error:', err);
      throw err;
    }
  };

  const loadQuizQuestions = async (courseId: string) => {
    try {
      console.log('[EmployeeDashboard] Loading quiz questions for course:', courseId);
      const query = `
        query GetQuizQuestions($courseId: ID!) {
          listQuizQuestions(filter: { courseId: { eq: $courseId } }) {
            items {
              id
              courseId
              question
              options
              correctAnswer
            }
          }
        }
      `;

      const response = await client.graphql({
        query,
        variables: { courseId }
      });

      const data = (response as any).data;
      const errors = (response as any).errors;

      if (errors && errors.length > 0) {
        throw new Error(errors[0].message || 'Failed to load quiz questions');
      }

      const questions = data?.listQuizQuestions?.items || [];
      console.log('[EmployeeDashboard] Quiz questions loaded:', questions.length);
      
      // Parse options if they're stored as JSON string
      const parsedQuestions = questions.map((q: any) => ({
        ...q,
        options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options
      }));

      setQuizQuestions(parsedQuestions);
      setShowQuiz(true);
    } catch (err) {
      console.error('[EmployeeDashboard] Error loading quiz:', err);
      alert('Failed to load quiz questions: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleQuizAnswer = (questionId: string, answerIndex: number) => {
    setQuizAnswers({
      ...quizAnswers,
      [questionId]: answerIndex.toString()
    });
  };

  const submitQuiz = async () => {
    if (!selectedCourse) return;

    // Calculate score
    // correctAnswer is an integer (index), quizAnswers stores index as string
    let correctAnswers = 0;
    for (const question of quizQuestions) {
      const userAnswerIndex = parseInt(quizAnswers[question.id] || '-1', 10);
      const correctAnswerIndex = typeof question.correctAnswer === 'number' 
        ? question.correctAnswer 
        : parseInt(question.correctAnswer as any, 10);
      
      // correctAnswer is 0-based index, so we compare directly
      if (userAnswerIndex === correctAnswerIndex) {
        correctAnswers++;
      }
    }
    
    console.log('[EmployeeDashboard] Quiz scoring:', {
      totalQuestions: quizQuestions.length,
      correctAnswers: correctAnswers,
      answers: quizAnswers,
      questions: quizQuestions.map(q => ({ 
        id: q.id, 
        correctAnswer: q.correctAnswer,
        correctAnswerType: typeof q.correctAnswer
      }))
    });

    const score = Math.round((correctAnswers / quizQuestions.length) * 100);
    const passingScore = selectedCourse.passingScore || 70;
    const passed = score >= passingScore;

    setQuizScore(score);
    setQuizPassed(passed);
    setQuizSubmitted(true);

    try {
      // Create result using Amplify Data client
      const now = new Date().toISOString();
      const resultData = await client.models.Result.create({
        assignmentId: selectedCourse.assignmentId,
        score: score,
        passed: passed,
        createdAt: now,
        updatedAt: now
      });

      console.log('[EmployeeDashboard] Result created:', resultData.data);

      // Update assignment if passed (employees have update permission after backend deployment)
      if (passed && resultData.data) {
        try {
          // Update assignment directly from frontend (employees have update permission)
          console.log('[EmployeeDashboard] Updating assignment to completed...');
          const now = new Date().toISOString();
          
          // If this is a recertification (training was already complete), update the completion date
          // Otherwise, set it for the first time
          const isRecert = selectedCourse.isTrainingComplete && isRecertificationNeeded(selectedCourse);
          
          const updateResult = await client.models.Assignment.update({
            id: selectedCourse.assignmentId,
            status: 'completed',
            isTrainingComplete: true,
            trainingCompletedAt: now // Store/update completion date for recertification tracking
          });

          console.log('[EmployeeDashboard] ✅ Assignment updated:', updateResult.data);

          // Trigger Lambda for SNS notification (non-blocking)
          if (selectedCourse.employeeId) {
            try {
              await invokeQuizCompletionLambda({
                assignmentId: selectedCourse.assignmentId,
                employeeId: selectedCourse.employeeId,
                courseId: selectedCourse.id,
                score: score,
                passed: passed
              });
              console.log('[EmployeeDashboard] ✅ Lambda invoked for notification');
            } catch (lambdaError) {
              // Lambda failure is non-critical - assignment is already updated
              console.warn('[EmployeeDashboard] ⚠️ Lambda invocation failed (non-critical):', lambdaError);
            }
          }

          // Update selectedCourse state immediately
          setSelectedCourse({
            ...selectedCourse,
            assignmentStatus: 'completed',
            isTrainingComplete: true,
            trainingCompletedAt: now
          });

          // Reload courses to update progress
          await loadCourses();
        } catch (updateError) {
          console.error('[EmployeeDashboard] ❌ Failed to update assignment:', updateError);
          // Check if it's a permission error
          if (updateError instanceof Error && updateError.message.includes('Unauthorized')) {
            alert('Permission error: Please ensure backend is deployed with employee update permission. Assignment update failed.');
          } else {
            alert('Failed to update assignment: ' + (updateError instanceof Error ? updateError.message : 'Unknown error'));
          }
          throw updateError;
        }
      }

      // Don't show alert if quiz passed (results are shown in UI)
      if (!passed) {
        alert(`Quiz failed! Score: ${score}%`);
      }
    } catch (err) {
      console.error('[EmployeeDashboard] Error submitting quiz:', err);
      alert('Failed to submit quiz: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const getStatusBadge = (status: string, isTrainingComplete?: boolean | null) => {
    if (isTrainingComplete) {
      return (
        <span style={{
          padding: '4px 12px',
          borderRadius: '12px',
          backgroundColor: '#4caf50',
          color: 'white',
          fontSize: '0.875rem',
          fontWeight: 600
        }}>
          ✅ Training Complete
        </span>
      );
    }
    if (status === 'completed') {
      return (
        <span style={{
          padding: '4px 12px',
          borderRadius: '12px',
          backgroundColor: '#e8f5e9',
          color: '#2e7d32',
          fontSize: '0.875rem',
          fontWeight: 500
        }}>
          ✅ Completed
        </span>
      );
    }
    return (
      <span style={{
        padding: '4px 12px',
        borderRadius: '12px',
        backgroundColor: '#e3f2fd',
        color: '#1565c0',
        fontSize: '0.875rem',
        fontWeight: 500
      }}>
        📚 Assigned
      </span>
    );
  };

  if (selectedCourse) {
    return (
      <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>{selectedCourse.title}</h2>
          <button
            onClick={handleCloseCourse}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f5f5f5',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ← Back to Courses
          </button>
        </div>

        {selectedCourse.description && (
          <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
            <p style={{ margin: 0, color: '#666' }}>{selectedCourse.description}</p>
          </div>
        )}

        <div style={{ marginBottom: '20px' }}>
          {getStatusBadge(selectedCourse.assignmentStatus, selectedCourse.isTrainingComplete)}
          {selectedCourse.passingScore && (
            <span style={{ marginLeft: '15px', color: '#666' }}>
              Passing Score: {selectedCourse.passingScore}%
            </span>
          )}
        </div>

        {videoUrl && (
          <div style={{ marginBottom: '20px' }}>
            <h3>Training Video</h3>
            <video
              controls
              style={{
                width: '100%',
                maxWidth: '800px',
                borderRadius: '8px',
                backgroundColor: '#000'
              }}
            >
              <source src={videoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        )}

        {selectedCourse.assignmentStatus === 'completed' && !selectedCourse.isTrainingComplete && (
          <div style={{
            padding: '15px',
            backgroundColor: '#e8f5e9',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <p style={{ margin: 0, color: '#2e7d32' }}>
              ✅ You have completed this course. You can review the video or retake the quiz.
            </p>
          </div>
        )}

        {selectedCourse.isTrainingComplete && !isRecertificationNeeded(selectedCourse) && (
          <div style={{
            padding: '15px',
            backgroundColor: '#e8f5e9',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '2px solid #4caf50'
          }}>
            <p style={{ margin: 0, color: '#2e7d32', fontWeight: 500 }}>
              ✅ Training Complete - This course has been completed and marked as training complete.
            </p>
            {selectedCourse.trainingCompletedAt && (
              <p style={{ margin: '5px 0 0 0', color: '#2e7d32', fontSize: '0.9rem' }}>
                Completed on: {new Date(selectedCourse.trainingCompletedAt).toLocaleDateString()}
                {(() => {
                  const completedDate = new Date(selectedCourse.trainingCompletedAt!);
                  const now = new Date();
                  const oneYearInMs = 365 * 24 * 60 * 60 * 1000;
                  const timeSinceCompletion = now.getTime() - completedDate.getTime();
                  const daysUntilRecert = Math.ceil((oneYearInMs - timeSinceCompletion) / (24 * 60 * 60 * 1000));
                  if (daysUntilRecert > 0 && daysUntilRecert <= 365) {
                    return ` • Recertification due in ${daysUntilRecert} days`;
                  }
                  return '';
                })()}
              </p>
            )}
            <p style={{ margin: '5px 0 0 0', color: '#2e7d32', fontSize: '0.9rem' }}>
              You can review the video content, but the quiz cannot be retaken until recertification is due.
            </p>
          </div>
        )}

        {selectedCourse.isTrainingComplete && isRecertificationNeeded(selectedCourse) && (
          <div style={{
            padding: '15px',
            backgroundColor: '#fff3e0',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '2px solid #ff9800'
          }}>
            <p style={{ margin: 0, color: '#e65100', fontWeight: 500 }}>
              🔄 Recertification Required - Your training certification has expired (over 1 year since completion).
            </p>
            {selectedCourse.trainingCompletedAt && (
              <p style={{ margin: '5px 0 0 0', color: '#e65100', fontSize: '0.9rem' }}>
                Original completion date: {new Date(selectedCourse.trainingCompletedAt).toLocaleDateString()}
              </p>
            )}
            <p style={{ margin: '5px 0 0 0', color: '#e65100', fontSize: '0.9rem' }}>
              Please retake the quiz to renew your certification.
            </p>
          </div>
        )}

        {selectedCourse.assignmentStatus === 'assigned' && (
          <div style={{
            padding: '15px',
            backgroundColor: '#fff3e0',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <p style={{ margin: 0, color: '#e65100' }}>
              📚 This course is assigned to you. Please watch the video and complete the quiz to mark it as completed.
            </p>
          </div>
        )}

        {!showQuiz && isQuizEnabled(selectedCourse) && (
          <div style={{ marginTop: '20px' }}>
            <button
              onClick={() => loadQuizQuestions(selectedCourse.id)}
              style={{
                padding: '12px 24px',
                backgroundColor: isRecertificationNeeded(selectedCourse) ? '#ff9800' : '#007AFF',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 500
              }}
            >
              {isRecertificationNeeded(selectedCourse) 
                ? '🔄 Retake Quiz for Recertification' 
                : selectedCourse.assignmentStatus === 'completed' 
                  ? 'Retake Quiz' 
                  : 'Take Quiz'}
            </button>
          </div>
        )}

        {!showQuiz && !isQuizEnabled(selectedCourse) && (
          <div style={{
            marginTop: '20px',
            padding: '15px',
            backgroundColor: '#e8f5e9',
            borderRadius: '8px',
            border: '2px solid #4caf50'
          }}>
            <p style={{ margin: 0, color: '#2e7d32', fontWeight: 500 }}>
              ✅ Training Complete - Quiz cannot be retaken
            </p>
            <p style={{ margin: '5px 0 0 0', color: '#2e7d32', fontSize: '0.9rem' }}>
              This course has been completed and marked as training complete. You can review the video content.
            </p>
          </div>
        )}

        {showQuiz && !quizSubmitted && (
          <div style={{ marginTop: '30px', padding: '20px', backgroundColor: 'white', borderRadius: '8px' }}>
            <h3 style={{ marginTop: 0 }}>Quiz</h3>
            {quizQuestions.length === 0 ? (
              <p>Loading quiz questions...</p>
            ) : (
              <>
                {quizQuestions.map((question, index) => (
                  <div key={question.id} style={{ marginBottom: '25px', paddingBottom: '25px', borderBottom: '1px solid #eee' }}>
                    <p style={{ fontWeight: 500, marginBottom: '15px' }}>
                      {index + 1}. {question.question}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {question.options.map((option: string, optionIndex: number) => (
                        <label
                          key={optionIndex}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '10px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            backgroundColor: quizAnswers[question.id] === optionIndex.toString() ? '#e3f2fd' : 'white'
                          }}
                        >
                          <input
                            type="radio"
                            name={question.id}
                            value={optionIndex}
                            checked={quizAnswers[question.id] === optionIndex.toString()}
                            onChange={() => handleQuizAnswer(question.id, optionIndex)}
                            style={{ marginRight: '10px' }}
                          />
                          {option}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                <button
                  onClick={submitQuiz}
                  disabled={Object.keys(quizAnswers).length < quizQuestions.length}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: Object.keys(quizAnswers).length < quizQuestions.length ? '#ccc' : '#007AFF',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: Object.keys(quizAnswers).length < quizQuestions.length ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                    fontWeight: 500
                  }}
                >
                  Submit Quiz
                </button>
                <p style={{ marginTop: '10px', color: '#666', fontSize: '0.9rem' }}>
                  {Object.keys(quizAnswers).length} of {quizQuestions.length} questions answered
                </p>
              </>
            )}
          </div>
        )}

        {quizSubmitted && quizScore !== null && (
          <div style={{
            marginTop: '30px',
            padding: '20px',
            backgroundColor: quizPassed ? '#e8f5e9' : '#ffebee',
            borderRadius: '8px',
            border: `2px solid ${quizPassed ? '#4caf50' : '#f44336'}`
          }}>
            <h3 style={{ marginTop: 0, color: quizPassed ? '#2e7d32' : '#c62828' }}>
              {quizPassed ? '✅ Quiz Passed!' : '❌ Quiz Failed'}
            </h3>
            <p style={{ fontSize: '1.2rem', fontWeight: 500, color: quizPassed ? '#2e7d32' : '#c62828' }}>
              Your Score: {quizScore}%
            </p>
            <p style={{ color: quizPassed ? '#2e7d32' : '#c62828' }}>
              Passing Score: {selectedCourse.passingScore || 70}%
            </p>
            {quizPassed && (
              <p style={{ marginTop: '10px', color: '#2e7d32' }}>
                🎉 Congratulations! You have completed this course.
              </p>
            )}
            <button
              onClick={() => {
                setShowQuiz(false);
                setQuizSubmitted(false);
                setQuizScore(null);
                setQuizPassed(false);
                setQuizAnswers({});
                loadCourses(); // Reload to update status and progress
              }}
              style={{
                marginTop: '15px',
                padding: '10px 20px',
                backgroundColor: '#007AFF',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Back to Course
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#007AFF',
        color: 'white',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px' }}>My Training</h1>
              <p style={{ margin: '5px 0 0 0', opacity: 0.9 }}>{userEmail || 'Employee'}</p>
            </div>
            <button
              onClick={signOut}
              style={{
                padding: '8px 16px',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Sign Out
            </button>
          </div>
          
          {/* Progress Section */}
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            padding: '15px',
            borderRadius: '8px',
            marginTop: '15px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.9 }}>Training Progress</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '1.1rem', fontWeight: 500 }}>
                  {completedCourses} of {totalCourses} courses completed
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>
                  {totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0}%
                </p>
                <p style={{ margin: '5px 0 0 0', fontSize: '0.85rem', opacity: 0.9 }}>Complete</p>
              </div>
            </div>
            {/* Progress Bar */}
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
              borderRadius: '4px',
              overflow: 'hidden',
              marginTop: '10px'
            }}>
              <div style={{
                width: `${totalCourses > 0 ? (completedCourses / totalCourses) * 100 : 0}%`,
                height: '100%',
                backgroundColor: '#4CAF50',
                transition: 'width 0.3s ease',
                borderRadius: '4px'
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="dashboard-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        <div className="employee-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: 0 }}>Assigned Courses</h2>
            <p style={{ color: '#666', margin: '5px 0 0 0' }}>
              View and complete your assigned training courses
            </p>
          </div>
          {totalCourses > 0 && (
            <div className="completion-stats" style={{
              textAlign: 'right',
              padding: '12px 20px',
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              width: '100%',
              maxWidth: '300px'
            }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>Completion Rate</p>
              <p style={{ margin: '5px 0 0 0', fontSize: '1.5rem', fontWeight: 'bold', color: '#007AFF' }}>
                {Math.round((completedCourses / totalCourses) * 100)}%
              </p>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#999' }}>
                {completedCourses}/{totalCourses} completed
              </p>
            </div>
          )}
        </div>

        {loading && <Loader message="Loading courses..." />}

        {error && (
          <div style={{
            padding: '15px',
            backgroundColor: '#ffebee',
            color: '#c62828',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <strong>Error:</strong> {error}
            <button
              onClick={loadCourses}
              style={{
                marginLeft: '15px',
                padding: '6px 12px',
                backgroundColor: '#c62828',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && courses.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            backgroundColor: 'white',
            borderRadius: '8px'
          }}>
            <p style={{ fontSize: '18px', color: '#666' }}>No courses assigned</p>
            <p style={{ color: '#999' }}>Check back later for new training courses</p>
          </div>
        )}

        {!loading && !error && courses.length > 0 && (
          <div style={{ display: 'grid', gap: '20px' }}>
            {courses.map((course) => (
              <div
                key={course.id}
                onClick={() => handleViewCourse(course)}
                style={{
                  backgroundColor: 'white',
                  padding: '20px',
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                }}
              >
                <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>{course.title}</h3>
                    {course.description && (
                      <p style={{ margin: '0 0 15px 0', color: '#666', fontSize: '0.9rem' }}>
                        {course.description.length > 150 
                          ? `${course.description.substring(0, 150)}...` 
                          : course.description}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {getStatusBadge(course.assignmentStatus, course.isTrainingComplete)}
                      {course.passingScore && (
                        <span style={{ color: '#666', fontSize: '0.875rem' }}>
                          Passing: {course.passingScore}%
                        </span>
                      )}
                      {course.duration && (
                        <span style={{ color: '#666', fontSize: '0.875rem' }}>
                          Duration: {course.duration}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ marginLeft: '20px' }}>
                    <span style={{ color: '#999', fontSize: '1.5rem' }}>→</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeDashboard;


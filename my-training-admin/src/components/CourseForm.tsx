import React, { useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import { uploadData } from 'aws-amplify/storage';
import type { Schema } from '../../../amplify/data/resource';

const client = generateClient<Schema>();

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}

const CourseForm = () => {
  const [title, setTitle] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [passingScore, setPassingScore] = useState(80);
  const [quiz, setQuiz] = useState<QuizQuestion[]>([
    { question: '', options: ['', '', '', ''], correctAnswer: 0 }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files[0] && files[0].type.startsWith('video/')) {
      setVideoFile(files[0]);
    }
  };

  const addQuizQuestion = () => {
    if (quiz.length < 10) {
      setQuiz([...quiz, { question: '', options: ['', '', '', ''], correctAnswer: 0 }]);
    }
  };

  const removeQuizQuestion = (index: number) => {
    if (quiz.length > 1) {
      setQuiz(quiz.filter((_, i) => i !== index));
    }
  };

  const updateQuizQuestion = (index: number, field: keyof QuizQuestion, value: any) => {
    const updatedQuiz = [...quiz];
    if (field === 'options') {
      updatedQuiz[index].options = value;
    } else {
      (updatedQuiz[index] as any)[field] = value;
    }
    setQuiz(updatedQuiz);
  };

  const updateQuizOption = (questionIndex: number, optionIndex: number, value: string) => {
    const updatedQuiz = [...quiz];
    updatedQuiz[questionIndex].options[optionIndex] = value;
    setQuiz(updatedQuiz);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !videoFile) {
      alert('Please provide a title and video file');
      return;
    }

    // Validate quiz questions
    const validQuestions = quiz.filter(q => 
      q.question.trim() && 
      q.options.every(opt => opt.trim()) &&
      q.correctAnswer >= 0 && q.correctAnswer < 4
    );

    if (validQuestions.length === 0) {
      alert('Please add at least one complete quiz question');
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload video to S3
      const timestamp = Date.now();
      const videoKey = `courses/videos/${timestamp}_${videoFile.name}`;
      
      const uploadResult = await uploadData({
        path: videoKey,
        data: videoFile,
        options: {
          onProgress: ({ transferredBytes, totalBytes }) => {
            if (totalBytes) {
              setUploadProgress(Math.round((transferredBytes / totalBytes) * 100));
            }
          }
        }
      });

      // Create course in database
      console.log('Creating course with data:', {
        title: title.trim(),
        videoKey: videoKey,
        passingScore,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const courseResult = await client.models.Course.create({
        title: title.trim(),
        videoKey: videoKey,
        passingScore,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      console.log('Course creation result:', courseResult);

      if (courseResult.data) {
        console.log('Created course with ID:', courseResult.data.id);
        
        // Create quiz questions
        console.log('Creating quiz questions:', validQuestions.length);
        for (const question of validQuestions) {
          const questionResult = await client.models.QuizQuestion.create({
            courseId: courseResult.data.id,
            question: question.question.trim(),
            options: question.options.map(opt => opt.trim()),
            correctAnswer: question.correctAnswer,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          console.log('Created quiz question:', questionResult);
        }

        alert('Course created successfully!');
        
        // Reset form
        setTitle('');
        setVideoFile(null);
        setPassingScore(80);
        setQuiz([{ question: '', options: ['', '', '', ''], correctAnswer: 0 }]);
        setUploadProgress(0);
      } else {
        console.error('No course data returned from creation');
        alert('Course creation failed - no data returned');
      }
    } catch (error) {
      console.error('Error creating course:', error);
      alert('Failed to create course. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h2>Create New Course</h2>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Course Title */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Course Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter course title"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
            required
          />
        </div>

        {/* Video Upload */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Course Video *
          </label>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${dragActive ? '#1976d2' : '#ccc'}`,
              borderRadius: '8px',
              padding: '2rem',
              textAlign: 'center',
              backgroundColor: dragActive ? '#f5f5f5' : 'white',
              cursor: 'pointer'
            }}
          >
            {videoFile ? (
              <div>
                <p>✅ {videoFile.name}</p>
                <button 
                  type="button" 
                  onClick={() => setVideoFile(null)}
                  style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <p>Drag and drop a video file here, or click to select</p>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                  style={{ marginTop: '1rem' }}
                />
              </div>
            )}
          </div>
          
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ 
                width: '100%', 
                backgroundColor: '#f0f0f0', 
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${uploadProgress}%`,
                  backgroundColor: '#1976d2',
                  height: '8px',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <p style={{ textAlign: 'center', margin: '0.5rem 0' }}>
                Uploading: {uploadProgress}%
              </p>
            </div>
          )}
        </div>

        {/* Passing Score */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Passing Score (%)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            value={passingScore}
            onChange={(e) => setPassingScore(Number(e.target.value))}
            style={{
              width: '100px',
              padding: '0.75rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          />
        </div>

        {/* Quiz Questions */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>Quiz Questions</h3>
            <button
              type="button"
              onClick={addQuizQuestion}
              disabled={quiz.length >= 10}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: quiz.length >= 10 ? 'not-allowed' : 'pointer',
                opacity: quiz.length >= 10 ? 0.6 : 1
              }}
            >
              Add Question
            </button>
          </div>

          {quiz.map((question, questionIndex) => (
            <div key={questionIndex} style={{ 
              border: '1px solid #e0e0e0', 
              borderRadius: '8px', 
              padding: '1.5rem', 
              marginBottom: '1rem',
              backgroundColor: '#fafafa'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4>Question {questionIndex + 1}</h4>
                {quiz.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeQuizQuestion(questionIndex)}
                    style={{
                      color: 'red',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '1rem'
                    }}
                  >
                    ✕ Remove
                  </button>
                )}
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Question:</label>
                <input
                  type="text"
                  value={question.question}
                  onChange={(e) => updateQuizQuestion(questionIndex, 'question', e.target.value)}
                  placeholder="Enter your question"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Answer Options:</label>
                {question.options.map((option, optionIndex) => (
                  <div key={optionIndex} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <input
                      type="radio"
                      name={`correct-${questionIndex}`}
                      checked={question.correctAnswer === optionIndex}
                      onChange={() => updateQuizQuestion(questionIndex, 'correctAnswer', optionIndex)}
                      style={{ marginRight: '0.5rem' }}
                    />
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateQuizOption(questionIndex, optionIndex, e.target.value)}
                      placeholder={`Option ${optionIndex + 1}`}
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        border: '1px solid #ccc',
                        borderRadius: '4px'
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            padding: '1rem 2rem',
            backgroundColor: isSubmitting ? '#ccc' : '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1.1rem',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            marginTop: '1rem'
          }}
        >
          {isSubmitting ? 'Creating Course...' : 'Create Course'}
        </button>
      </form>
    </div>
  );
};

export default CourseForm;
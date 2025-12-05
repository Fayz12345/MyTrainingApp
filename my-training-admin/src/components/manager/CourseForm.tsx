import React, { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import { uploadData, remove, getUrl } from 'aws-amplify/storage';
import type { Schema } from '../../../../amplify/data/resource';
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
const MySwal = withReactContent(Swal);

const client = generateClient<Schema>();

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}

type CourseFormProps = {
  course?: {
    readonly id: string;
    readonly title: string;
    readonly description?: string | null;
    readonly videoKey?: string | null;
    readonly imageKey?: string | null;
    readonly passingScore?: number | null;
    readonly duration?: string | null;
    readonly category?: string | null;
  };
  onSuccess?: () => void;
  onCancel?: () => void;
};

const CourseForm: React.FC<CourseFormProps> = ({ course, onSuccess, onCancel }) => {
  const isEditMode = Boolean(course);
  const [title, setTitle] = useState(course?.title ?? '');
  const [description, setDescription] = useState(course?.description ?? '');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [existingVideoKey, setExistingVideoKey] = useState<string | null>(
    course?.videoKey ?? null
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [existingImageKey, setExistingImageKey] = useState<string | null>(
    course?.imageKey ?? null
  );
  const [passingScore, setPassingScore] = useState(course?.passingScore ?? 80);
  const [duration, setDuration] = useState(course?.duration ?? '');
  const [category, setCategory] = useState(course?.category ?? '');
  const [quiz, setQuiz] = useState<QuizQuestion[]>([
    { question: '', options: ['', '', '', ''], correctAnswer: 0 }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [imageDragActive, setImageDragActive] = useState(false);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [isLoadingExistingImage, setIsLoadingExistingImage] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

  const loadExistingQuiz = async (courseId: string) => {
    setIsLoadingQuiz(true);
    try {
      const quizResult = await client.models.QuizQuestion.list({
        filter: { courseId: { eq: courseId } }
      });

      if (quizResult.data && quizResult.data.length > 0) {
        setQuiz(
          quizResult.data.map((question: { question: string; options: unknown; correctAnswer: number }) => ({
            question: question.question,
            options: question.options as string[],
            correctAnswer: question.correctAnswer
          }))
        );
      } else {
        setQuiz([{ question: '', options: ['', '', '', ''], correctAnswer: 0 }]);
      }
    } catch (error) {
      console.error('Failed to load quiz questions:', error);
      setQuiz([{ question: '', options: ['', '', '', ''], correctAnswer: 0 }]);
    } finally {
      setIsLoadingQuiz(false);
    }
  };

  const loadExistingImage = async (imageKey: string) => {
    if (!imageKey || imageKey.trim() === '') {
      console.warn('[CourseForm] loadExistingImage called with empty imageKey');
      setExistingImageUrl(null);
      setIsLoadingExistingImage(false);
      return;
    }
    
    setIsLoadingExistingImage(true);
    setExistingImageUrl(null);
    
    try {
      console.log('[CourseForm] Fetching image URL for:', imageKey);
      const urlResult = await getUrl({ path: imageKey });
      const imageUrl = urlResult.url.toString();
      console.log('[CourseForm] Image URL fetched successfully:', imageUrl.substring(0, 100) + '...');
      setExistingImageUrl(imageUrl);
    } catch (error) {
      console.error('[CourseForm] Failed to load existing image:', error);
      console.error('[CourseForm] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        imageKey: imageKey,
        error: error
      });
      setExistingImageUrl(null);
    } finally {
      setIsLoadingExistingImage(false);
    }
  };

  useEffect(() => {
    const initializeForm = async () => {
      console.log('[CourseForm] Course data received:', course);
      console.log('[CourseForm] Course data details:', {
        id: course?.id,
        title: course?.title,
        description: course?.description,
        descriptionType: typeof course?.description,
        descriptionValue: course?.description,
        imageKey: course?.imageKey,
        imageKeyType: typeof course?.imageKey,
        imageKeyValue: course?.imageKey,
        videoKey: course?.videoKey,
        duration: course?.duration,
        category: course?.category,
        fullCourse: JSON.stringify(course, null, 2)
      });
      
      if (course && course.id) {
        // Check if we need to fetch full course data
        const needsFullData = course.description === undefined || 
                             course.imageKey === undefined ||
                             (course.description === null && course.imageKey === null);
        
        let courseData = course;
        
        if (needsFullData) {
          console.log('[CourseForm] Missing description or imageKey, fetching full course data...');
          try {
            const fullCourse = await client.models.Course.get({ id: course.id });
            if (fullCourse.data) {
              console.log('[CourseForm] Full course data fetched:', fullCourse.data);
              // Map the full course data to match the expected type
              courseData = {
                id: fullCourse.data.id || course.id,
                title: fullCourse.data.title || course.title,
                description: fullCourse.data.description ?? course.description,
                videoKey: fullCourse.data.videoKey ?? course.videoKey,
                imageKey: fullCourse.data.imageKey ?? course.imageKey,
                passingScore: fullCourse.data.passingScore ?? course.passingScore,
                duration: fullCourse.data.duration ?? course.duration,
                category: fullCourse.data.category ?? course.category
              };
            } else {
              console.warn('[CourseForm] Could not fetch full course data, using provided data');
            }
          } catch (error) {
            console.error('[CourseForm] Error fetching full course data:', error);
            // Continue with provided course data
          }
        }
        
        // Handle description - check for null, undefined, or empty string
        const courseDescription = courseData.description !== null && courseData.description !== undefined 
          ? courseData.description 
          : '';
        
        console.log('[CourseForm] Setting form values:', {
          title: courseData.title,
          description: courseDescription,
          imageKey: courseData.imageKey,
          videoKey: courseData.videoKey,
          duration: courseData.duration,
          category: courseData.category
        });
        
        setTitle(courseData.title ?? '');
        setDescription(courseDescription);
        setPassingScore(courseData.passingScore ?? 80);
        setDuration(courseData.duration ?? '');
        setCategory(courseData.category ?? '');
        setExistingVideoKey(courseData.videoKey ?? null);
        setExistingImageKey(courseData.imageKey ?? null);
        
        // Load image if imageKey exists
        if (courseData.imageKey && courseData.imageKey.trim() !== '') {
          console.log('[CourseForm] Loading existing image:', courseData.imageKey);
          loadExistingImage(courseData.imageKey);
        } else {
          console.log('[CourseForm] No image key found or image key is empty');
          setExistingImageUrl(null);
          setIsLoadingExistingImage(false);
        }
        
        if (courseData.id) {
          loadExistingQuiz(courseData.id);
        }
      } else {
        // Reset form for new course
        setTitle('');
        setDescription('');
        setPassingScore(80);
        setDuration('');
        setCategory('');
        setExistingVideoKey(null);
        setExistingImageKey(null);
        setExistingImageUrl(null);
        setIsLoadingExistingImage(false);
        setQuiz([{ question: '', options: ['', '', '', ''], correctAnswer: 0 }]);
      }
      
      setVideoFile(null);
      setImageFile(null);
      setUploadProgress(0);
      setImageUploadProgress(0);
    };
    
    initializeForm();
  }, [course?.id]);

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

  const handleImageDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setImageDragActive(true);
  };

  const handleImageDragLeave = () => {
    setImageDragActive(false);
  };

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setImageDragActive(false);
    const files = e.dataTransfer.files;
    if (files[0] && (files[0].type.startsWith('image/') || files[0].type === 'image/jpeg' || files[0].type === 'image/png' || files[0].type === 'image/jpg')) {
      setImageFile(files[0]);
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
    
    // Validate title
    const errors: Record<string, string> = {};
    const touched: Record<string, boolean> = {};
    
    if (!title.trim()) {
      errors.title = 'Course title is required';
      touched.title = true;
    } else if (title.trim().length < 3) {
      errors.title = 'Course title must be at least 3 characters';
      touched.title = true;
    }
    
    setFieldErrors(errors);
    setTouchedFields(touched);
    
    if (Object.keys(errors).length > 0) {
      return;
    }
    
    if (!title.trim()) {
      await MySwal.fire({
        title: "Validation Error",
        text: "Please provide a course title",
        icon: "warning",
      });
      return;
    }

    if (!isEditMode && !videoFile) {
      await MySwal.fire({
        title: "Validation Error",
        text: "Please provide a video file",
        icon: "warning",
      });
      return;
    }

    // Validate quiz questions
    const validQuestions = quiz.filter(q => 
      q.question.trim() && 
      q.options.every(opt => opt.trim()) &&
      q.correctAnswer >= 0 && q.correctAnswer < 4
    );

    if (validQuestions.length === 0) {
      await MySwal.fire({
        title: "Validation Error",
        text: "Please add at least one complete quiz question",
        icon: "warning",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let resolvedVideoKey = existingVideoKey;
      let resolvedImageKey = existingImageKey;

      if (videoFile) {
        // Upload video to S3
        const timestamp = Date.now();
        const videoKey = `courses/videos/${timestamp}_${videoFile.name}`;

        console.log('[CourseForm] Uploading video to:', videoKey);
        console.log('[CourseForm] Video file:', {
          name: videoFile.name,
          size: videoFile.size,
          type: videoFile.type
        });

        try {
          await uploadData({
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
          console.log('[CourseForm] ✅ Video uploaded successfully to:', videoKey);
        } catch (uploadError) {
          console.error('[CourseForm] ❌ Video upload failed:', uploadError);
          throw new Error(`Failed to upload video: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`);
        }

        if (isEditMode && existingVideoKey) {
          try {
            console.log('[CourseForm] Deleting old video:', existingVideoKey);
            await remove({ path: existingVideoKey });
            console.log('[CourseForm] ✅ Old video deleted');
          } catch (storageError) {
            console.warn('[CourseForm] ⚠️ Failed to delete existing video. Continuing update.', storageError);
          }
        }

        resolvedVideoKey = videoKey;
        console.log('[CourseForm] Video key resolved to:', resolvedVideoKey);
      }

      if (imageFile) {
        // Upload image to S3
        const timestamp = Date.now();
        const imageKey = `courses/images/${timestamp}_${imageFile.name}`;

        await uploadData({
          path: imageKey,
          data: imageFile,
          options: {
            onProgress: ({ transferredBytes, totalBytes }) => {
              if (totalBytes) {
                setImageUploadProgress(Math.round((transferredBytes / totalBytes) * 100));
              }
            }
          }
        });

        if (isEditMode && existingImageKey) {
          try {
            await remove({ path: existingImageKey });
          } catch (storageError) {
            console.warn('Failed to delete existing image. Continuing update.', storageError);
          }
        }

        resolvedImageKey = imageKey;
      }

      if (!resolvedVideoKey) {
        await MySwal.fire({
          title: "Validation Error",
          text: "Please provide a course video before saving",
          icon: "warning",
        });
        return;
      }

      if (isEditMode && course) {
        await client.models.Course.update({
          id: course.id,
          title: title.trim(),
          description: description.trim() || null,
          videoKey: resolvedVideoKey,
          imageKey: resolvedImageKey || null,
          passingScore,
          duration: duration.trim() || null,
          category: category.trim() || null,
          updatedAt: new Date().toISOString()
        });

        const existingQuestions = await client.models.QuizQuestion.list({
          filter: { courseId: { eq: course.id } }
        });

        if (existingQuestions.data) {
          for (const question of existingQuestions.data) {
            await client.models.QuizQuestion.delete({ id: question.id });
          }
        }

        for (const question of validQuestions) {
          await client.models.QuizQuestion.create({
            courseId: course.id,
            question: question.question.trim(),
            options: question.options.map(opt => opt.trim()),
            correctAnswer: question.correctAnswer,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }

        await MySwal.fire({
          title: "Updated!",
          text: "Course updated successfully!",
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });
        onSuccess?.();
        return;
      }

      // Create course in database
      const courseResult = await client.models.Course.create({
        title: title.trim(),
        description: description.trim() || null,
        videoKey: resolvedVideoKey,
        imageKey: resolvedImageKey || null,
        passingScore,
        duration: duration.trim() || null,
        category: category.trim() || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      if (courseResult.data) {
        // Type assertion: create() returns a single Course object, not an array
        const courseData = courseResult.data as unknown as { id: string };
        for (const question of validQuestions) {
          await client.models.QuizQuestion.create({
            courseId: courseData.id,
            question: question.question.trim(),
            options: question.options.map(opt => opt.trim()),
            correctAnswer: question.correctAnswer,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }

        await MySwal.fire({
          title: "Created!",
          text: "Course created successfully!",
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });

        // Reset form
        setTitle('');
        setDescription('');
        setVideoFile(null);
        setImageFile(null);
        setPassingScore(80);
        setDuration('');
        setCategory('');
        setQuiz([{ question: '', options: ['', '', '', ''], correctAnswer: 0 }]);
        setUploadProgress(0);
        setImageUploadProgress(0);
        setExistingVideoKey(null);
        setExistingImageKey(null);
        onSuccess?.();
      } else {
        console.error('No course data returned from creation');
        await MySwal.fire({
          title: "Error!",
          text: "Course creation failed - no data returned",
          icon: "error",
        });
      }
    } catch (error) {
      console.error(isEditMode ? 'Error updating course:' : 'Error creating course:', error);
      await MySwal.fire({
        title: "Error!",
        text: "Failed to save course. Please try again.",
        icon: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{isEditMode ? 'Edit Course' : 'Create New Course'}</h2>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#f5f5f5',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        )}
      </div>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Course Title */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Course Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              // Clear error when user starts typing
              if (fieldErrors.title) {
                setFieldErrors(prev => {
                  const newErrors = { ...prev };
                  delete newErrors.title;
                  return newErrors;
                });
              }
            }}
            onBlur={(e) => {
              setTouchedFields(prev => ({ ...prev, title: true }));
              if (!title.trim()) {
                setFieldErrors(prev => ({ ...prev, title: 'Course title is required' }));
              } else if (title.trim().length < 3) {
                setFieldErrors(prev => ({ ...prev, title: 'Course title must be at least 3 characters' }));
              } else {
                setFieldErrors(prev => {
                  const newErrors = { ...prev };
                  delete newErrors.title;
                  return newErrors;
                });
              }
            }}
            placeholder="Enter course title"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: fieldErrors.title ? '2px solid #d32f2f' : '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '1rem',
              outline: 'none'
            }}
            required
          />
          {touchedFields.title && fieldErrors.title && (
            <div style={{ color: '#d32f2f', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {fieldErrors.title}
            </div>
          )}
        </div>

        {/* Course Description */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Course Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter course description"
            rows={4}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '1rem',
              fontFamily: 'inherit',
              resize: 'vertical'
            }}
          />
        </div>

        {/* Video Upload */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Course Video {isEditMode ? '(leave empty to keep current video)' : '*'}
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
                <p style={{ fontSize: '0.9rem', color: '#666', margin: '0.5rem 0' }}>
                  Size: {(videoFile.size / (1024 * 1024)).toFixed(2)} MB
                  {videoFile.size > 50 * 1024 * 1024 && (
                    <span style={{ color: '#ff9800', marginLeft: '0.5rem' }}>
                      ⚠️ Large file - may take longer to upload and play
                    </span>
                  )}
                </p>
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
                {isEditMode && existingVideoKey && (
                  <p style={{ marginBottom: '0.5rem', color: '#555' }}>
                    Current video key: <code>{existingVideoKey}</code>
                  </p>
                )}
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

        {/* Image Upload */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Course Image/Thumbnail {isEditMode ? '(leave empty to keep current image)' : '(optional)'}
          </label>
          <div
            onDragOver={handleImageDragOver}
            onDragLeave={handleImageDragLeave}
            onDrop={handleImageDrop}
            style={{
              border: `2px dashed ${imageDragActive ? '#1976d2' : '#ccc'}`,
              borderRadius: '8px',
              padding: '2rem',
              textAlign: 'center',
              backgroundColor: imageDragActive ? '#f5f5f5' : 'white',
              cursor: 'pointer'
            }}
          >
            {imageFile ? (
              <div>
                <p>✅ {imageFile.name}</p>
                {imageFile.type.startsWith('image/') && (
                  <img 
                    src={URL.createObjectURL(imageFile)} 
                    alt="Preview" 
                    style={{ maxWidth: '200px', maxHeight: '200px', marginTop: '1rem', borderRadius: '4px' }}
                  />
                )}
                <button 
                  type="button" 
                  onClick={() => setImageFile(null)}
                  style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer', marginTop: '0.5rem' }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                {isEditMode && existingImageKey && (
                  <div style={{ marginBottom: '1rem' }}>
                    {isLoadingExistingImage ? (
                      <p style={{ color: '#666' }}>Loading existing image...</p>
                    ) : existingImageUrl ? (
                      <div>
                        <p style={{ marginBottom: '0.5rem', color: '#555', fontWeight: 'bold' }}>
                          Current Image:
                        </p>
                        <img 
                          src={existingImageUrl} 
                          alt="Current course image" 
                          style={{ 
                            maxWidth: '200px', 
                            maxHeight: '200px', 
                            borderRadius: '4px',
                            border: '1px solid #e0e0e0',
                            marginBottom: '0.5rem'
                          }}
                        />
                        <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
                          Image key: <code>{existingImageKey}</code>
                        </p>
                      </div>
                    ) : (
                      <p style={{ marginBottom: '0.5rem', color: '#d32f2f' }}>
                        ⚠️ Could not load existing image (key: <code>{existingImageKey}</code>)
                      </p>
                    )}
                  </div>
                )}
                <p>Drag and drop an image file here, or click to select</p>
                <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                  Supported formats: JPG, PNG, GIF
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  style={{ marginTop: '1rem' }}
                />
              </div>
            )}
          </div>
          
          {imageUploadProgress > 0 && imageUploadProgress < 100 && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ 
                width: '100%', 
                backgroundColor: '#f0f0f0', 
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${imageUploadProgress}%`,
                  backgroundColor: '#1976d2',
                  height: '8px',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <p style={{ textAlign: 'center', margin: '0.5rem 0' }}>
                Uploading image: {imageUploadProgress}%
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

        {/* Duration and Category */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Duration
            </label>
            <input
              type="text"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g., 45 min, 1 hr 30 min, 2 hr"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Category
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g., Leadership, Marketing, IT"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
            />
          </div>
        </div>

        {/* Quiz Questions */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>Quiz Questions</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {isLoadingQuiz && (
                <span style={{ color: '#666', fontSize: '0.9rem' }}>Loading existing questions...</span>
              )}
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
          {isSubmitting
            ? isEditMode
              ? 'Updating Course...'
              : 'Creating Course...'
            : isEditMode
                ? 'Update Course'
                : 'Create Course'}
        </button>
      </form>
    </div>
  );
};

export default CourseForm;
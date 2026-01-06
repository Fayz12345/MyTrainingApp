import React, { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import { fetchAuthSession } from 'aws-amplify/auth';
import { uploadData, remove, getUrl } from 'aws-amplify/storage';
import type { Schema } from '../../../../amplify/data/resource';
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
const MySwal = withReactContent(Swal);

const client = generateClient<Schema>();

interface QuizQuestion {
  question: string;
  questionType?: 'multiple_choice' | 'true_false' | 'fill_blank';
  options: string[];
  correctAnswer?: number; // For multiple_choice and true_false
  correctAnswerText?: string; // For fill_blank (comma-separated accepted answers)
  caseSensitive?: boolean; // For fill_blank
  fuzzyMatching?: boolean; // For fill_blank
}

type CourseFormProps = {
  course?: {
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
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [existingPdfKey, setExistingPdfKey] = useState<string | null>(
    course?.pdfKey ?? null
  );
  const [pdfTitle, setPdfTitle] = useState(course?.pdfTitle ?? '');
  const [contentType, setContentType] = useState<'video' | 'pdf' | 'both'>(
    (course?.contentType as 'video' | 'pdf' | 'both') || 'video'
  );
  const [passingScore, setPassingScore] = useState(course?.passingScore ?? 80);
  const [duration, setDuration] = useState(course?.duration ?? '');
  const [category, setCategory] = useState(course?.category ?? '');
  const [randomizeQuestions, setRandomizeQuestions] = useState(course?.randomizeQuestions ?? false);
  const [randomizeOptions, setRandomizeOptions] = useState(course?.randomizeOptions ?? false);
  const [useQuestionPool, setUseQuestionPool] = useState(course?.useQuestionPool ?? false);
  const [poolSize, setPoolSize] = useState(course?.poolSize ?? 10);
  const [questionsToDisplay, setQuestionsToDisplay] = useState(course?.questionsToDisplay ?? 5);
  const [quiz, setQuiz] = useState<QuizQuestion[]>([
    { question: '', options: ['', '', '', ''], correctAnswer: 0 }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const [pdfUploadProgress, setPdfUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [imageDragActive, setImageDragActive] = useState(false);
  const [pdfDragActive, setPdfDragActive] = useState(false);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [isLoadingExistingImage, setIsLoadingExistingImage] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

  // Sanitize PDF filename - remove special characters and ensure .pdf extension
  const sanitizePdfFilename = (filename: string): string => {
    // Remove path if present, get just the filename
    const name = filename.split('/').pop() || filename;
    // Remove extension
    const nameWithoutExt = name.replace(/\.pdf$/i, '');
    // Sanitize: keep only alphanumeric, spaces, hyphens, underscores
    const sanitized = nameWithoutExt.replace(/[^a-zA-Z0-9\s\-_]/g, '_');
    // Replace multiple spaces/underscores with single underscore
    const cleaned = sanitized.replace(/[\s_]+/g, '_');
    // Ensure it's not empty
    const final = cleaned || 'document';
    // Add .pdf extension
    return `${final}.pdf`;
  };

  const loadExistingQuiz = async (courseId: string) => {
    setIsLoadingQuiz(true);
    try {
      const quizResult = await client.models.QuizQuestion.list({
        filter: { courseId: { eq: courseId } }
      });

      if (quizResult.data && quizResult.data.length > 0) {
        setQuiz(
          quizResult.data.map((question: any) => ({
            question: question.question,
            questionType: (question.questionType || 'multiple_choice') as 'multiple_choice' | 'true_false' | 'fill_blank',
            options: question.options as string[],
            correctAnswer: question.correctAnswer,
            correctAnswerText: question.correctAnswerText || undefined,
            caseSensitive: question.caseSensitive ?? false,
            fuzzyMatching: question.fuzzyMatching ?? false
          }))
        );
      } else {
        setQuiz([{ question: '', questionType: 'multiple_choice', options: ['', '', '', ''], correctAnswer: 0 }]);
      }
    } catch (error) {
      console.error('Failed to load quiz questions:', error);
      setQuiz([{ question: '', questionType: 'multiple_choice', options: ['', '', '', ''], correctAnswer: 0 }]);
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
        
        if (needsFullData || course.pdfKey === undefined || course.contentType === undefined) {
          console.log('[CourseForm] Missing fields, fetching full course data...');
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
                pdfKey: fullCourse.data.pdfKey ?? course.pdfKey,
                pdfTitle: fullCourse.data.pdfTitle ?? course.pdfTitle,
                contentType: fullCourse.data.contentType ?? course.contentType,
                passingScore: fullCourse.data.passingScore ?? course.passingScore,
                duration: fullCourse.data.duration ?? course.duration,
                category: fullCourse.data.category ?? course.category,
                randomizeQuestions: fullCourse.data.randomizeQuestions ?? course.randomizeQuestions ?? false,
                randomizeOptions: fullCourse.data.randomizeOptions ?? course.randomizeOptions ?? false,
                useQuestionPool: fullCourse.data.useQuestionPool ?? course.useQuestionPool ?? false,
                poolSize: fullCourse.data.poolSize ?? course.poolSize ?? null,
                questionsToDisplay: fullCourse.data.questionsToDisplay ?? course.questionsToDisplay ?? null
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
        setRandomizeQuestions(courseData.randomizeQuestions ?? false);
        setRandomizeOptions(courseData.randomizeOptions ?? false);
        setExistingVideoKey(courseData.videoKey ?? null);
        setExistingImageKey(courseData.imageKey ?? null);
        setExistingPdfKey(courseData.pdfKey ?? null);
        setPdfTitle(courseData.pdfTitle ?? '');
        // Determine content type: if both video and pdf exist, it's 'both', else check what exists
        if (courseData.videoKey && courseData.pdfKey) {
          setContentType('both');
        } else if (courseData.pdfKey) {
          setContentType('pdf');
        } else {
          setContentType('video');
        }
        
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
        setRandomizeQuestions(false);
        setRandomizeOptions(false);
        setUseQuestionPool(false);
        setPoolSize(10);
        setQuestionsToDisplay(5);
        setExistingVideoKey(null);
        setExistingImageKey(null);
        setExistingImageUrl(null);
        setIsLoadingExistingImage(false);
        setQuiz([{ question: '', questionType: 'multiple_choice', options: ['', '', '', ''], correctAnswer: 0 }]);
      }
      
      setVideoFile(null);
      setImageFile(null);
      setPdfFile(null);
      setUploadProgress(0);
      setImageUploadProgress(0);
      setPdfUploadProgress(0);
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

  const handlePdfDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setPdfDragActive(true);
  };

  const handlePdfDragLeave = () => {
    setPdfDragActive(false);
  };

  const handlePdfDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setPdfDragActive(false);
    const files = e.dataTransfer.files;
    if (files[0] && files[0].type === 'application/pdf') {
      // Validate file size (10MB limit)
      if (files[0].size > 10 * 1024 * 1024) {
        MySwal.fire({
          title: "File Too Large",
          text: "PDF file must be 10MB or smaller",
          icon: "error",
        });
        return;
      }
      setPdfFile(files[0]);
      // Auto-set PDF title from filename if not already set
      if (!pdfTitle) {
        const sanitized = sanitizePdfFilename(files[0].name);
        setPdfTitle(sanitized.replace('.pdf', ''));
      }
    }
  };

  const handlePdfFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        MySwal.fire({
          title: "Invalid File Type",
          text: "Please select a PDF file",
          icon: "error",
        });
        return;
      }
      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        MySwal.fire({
          title: "File Too Large",
          text: "PDF file must be 10MB or smaller",
          icon: "error",
        });
        return;
      }
      setPdfFile(file);
      // Auto-set PDF title from filename if not already set
      if (!pdfTitle) {
        const sanitized = sanitizePdfFilename(file.name);
        setPdfTitle(sanitized.replace('.pdf', ''));
      }
    }
  };

  const addQuizQuestion = () => {
    if (quiz.length < 10) {
      setQuiz([...quiz, { question: '', questionType: 'multiple_choice', options: ['', '', '', ''], correctAnswer: 0 }]);
    }
  };

  const handleQuestionTypeChange = (questionIndex: number, newType: 'multiple_choice' | 'true_false' | 'fill_blank') => {
    const updatedQuiz = [...quiz];
    updatedQuiz[questionIndex].questionType = newType;
    
    // If switching to true/false, set options to ["True", "False"]
    if (newType === 'true_false') {
      updatedQuiz[questionIndex].options = ['True', 'False'];
      // Reset correct answer to 0 (True) if it was out of range
      if ((updatedQuiz[questionIndex].correctAnswer ?? 0) > 1) {
        updatedQuiz[questionIndex].correctAnswer = 0;
      }
      // Clear fill_blank specific fields
      delete updatedQuiz[questionIndex].correctAnswerText;
      delete updatedQuiz[questionIndex].caseSensitive;
      delete updatedQuiz[questionIndex].fuzzyMatching;
    } else if (newType === 'fill_blank') {
      // If switching to fill_blank, initialize fields
      updatedQuiz[questionIndex].options = []; // Not used for fill_blank
      updatedQuiz[questionIndex].correctAnswerText = updatedQuiz[questionIndex].correctAnswerText || '';
      updatedQuiz[questionIndex].caseSensitive = updatedQuiz[questionIndex].caseSensitive ?? false;
      updatedQuiz[questionIndex].fuzzyMatching = updatedQuiz[questionIndex].fuzzyMatching ?? false;
      // Clear correctAnswer (used for multiple_choice/true_false)
      delete updatedQuiz[questionIndex].correctAnswer;
    } else if (newType === 'multiple_choice') {
      // If switching back to multiple choice, ensure 4 options
      if (updatedQuiz[questionIndex].options.length !== 4) {
        updatedQuiz[questionIndex].options = ['', '', '', ''];
        updatedQuiz[questionIndex].correctAnswer = 0;
      }
      // Clear fill_blank specific fields
      delete updatedQuiz[questionIndex].correctAnswerText;
      delete updatedQuiz[questionIndex].caseSensitive;
      delete updatedQuiz[questionIndex].fuzzyMatching;
    }
    
    setQuiz(updatedQuiz);
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
    
    // Get current manager's userId for createdBy field
    let currentUserId: string | undefined;
    try {
      const session = await fetchAuthSession();
      currentUserId = session.userSub || session.tokens?.idToken?.payload?.sub as string;
    } catch (err) {
      console.error('[CourseForm] Error getting auth session:', err);
    }
    
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

    // Validate that at least one content type is provided
    const hasVideo = isEditMode ? (existingVideoKey || videoFile) : videoFile;
    const hasPdf = isEditMode ? (existingPdfKey || pdfFile) : pdfFile;
    
    if (!isEditMode && !hasVideo && !hasPdf) {
      await MySwal.fire({
        title: "Validation Error",
        text: "Please provide either a video file or a PDF document",
        icon: "warning",
      });
      return;
    }

    // Validate PDF title if PDF is provided
    if ((pdfFile || existingPdfKey) && !pdfTitle.trim()) {
      await MySwal.fire({
        title: "Validation Error",
        text: "Please provide a title for the PDF document",
        icon: "warning",
      });
      return;
    }

    // Validate question pool settings
    if (useQuestionPool) {
      if (!poolSize || poolSize < 2) {
        await MySwal.fire({
          title: "Validation Error",
          text: "Question pool size must be at least 2",
          icon: "warning",
        });
        return;
      }
      if (!questionsToDisplay || questionsToDisplay < 1) {
        await MySwal.fire({
          title: "Validation Error",
          text: "Number of questions to display must be at least 1",
          icon: "warning",
        });
        return;
      }
      if (questionsToDisplay > poolSize) {
        await MySwal.fire({
          title: "Validation Error",
          text: `Questions to display (${questionsToDisplay}) cannot exceed pool size (${poolSize})`,
          icon: "warning",
        });
        return;
      }
    }

    // Validate quiz questions
    const validQuestions = quiz.filter(q => {
      if (!q.question.trim()) return false;
      
      const questionType = q.questionType || 'multiple_choice';
      
      if (questionType === 'true_false') {
        // True/False: options should be ["True", "False"], correctAnswer 0 or 1
        return q.options.length === 2 && 
               q.options[0] === 'True' && 
               q.options[1] === 'False' &&
               (q.correctAnswer === 0 || q.correctAnswer === 1);
      } else if (questionType === 'fill_blank') {
        // Fill in the blank: must have correctAnswerText with at least one answer
        return q.correctAnswerText && 
               q.correctAnswerText.trim().length > 0 &&
               q.correctAnswerText.split(',').some(ans => ans.trim().length > 0);
      } else {
        // Multiple choice: all options filled, correctAnswer within range
        return q.options.every(opt => opt.trim()) &&
               (q.correctAnswer !== undefined && q.correctAnswer >= 0) && 
               q.correctAnswer < q.options.length;
      }
    });

    if (validQuestions.length === 0) {
      await MySwal.fire({
        title: "Validation Error",
        text: "Please add at least one complete quiz question",
        icon: "warning",
      });
      return;
    }

    // Validate question pool requirements
    if (useQuestionPool) {
      if (validQuestions.length < poolSize) {
        await MySwal.fire({
          title: "Validation Error",
          text: `Question pool mode requires at least ${poolSize} questions, but you only have ${validQuestions.length}. Please add more questions or reduce the pool size.`,
          icon: "warning",
        });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      let resolvedVideoKey = existingVideoKey;
      let resolvedImageKey = existingImageKey;
      let resolvedPdfKey = existingPdfKey;

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

      if (pdfFile) {
        // Upload PDF to S3
        const timestamp = Date.now();
        const sanitizedFilename = sanitizePdfFilename(pdfFile.name);
        const pdfKey = `courses/pdfs/${timestamp}_${sanitizedFilename}`;

        console.log('[CourseForm] Uploading PDF to:', pdfKey);
        if (pdfFile) {
          console.log('[CourseForm] PDF file:', {
            name: pdfFile.name,
            size: pdfFile.size,
            type: pdfFile.type
          });
        }

        try {
          await uploadData({
            path: pdfKey,
            data: pdfFile,
            options: {
              onProgress: ({ transferredBytes, totalBytes }) => {
                if (totalBytes) {
                  setPdfUploadProgress(Math.round((transferredBytes / totalBytes) * 100));
                }
              }
            }
          });
          console.log('[CourseForm] ✅ PDF uploaded successfully to:', pdfKey);
        } catch (uploadError) {
          console.error('[CourseForm] ❌ PDF upload failed:', uploadError);
          throw new Error(`Failed to upload PDF: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`);
        }

        if (isEditMode && existingPdfKey) {
          try {
            console.log('[CourseForm] Deleting old PDF:', existingPdfKey);
            await remove({ path: existingPdfKey });
            console.log('[CourseForm] ✅ Old PDF deleted');
          } catch (storageError) {
            console.warn('[CourseForm] ⚠️ Failed to delete existing PDF. Continuing update.', storageError);
          }
        }

        resolvedPdfKey = pdfKey;
        console.log('[CourseForm] PDF key resolved to:', resolvedPdfKey);
      }

      // Determine content type based on what's available
      const finalContentType = (() => {
        if (resolvedVideoKey && resolvedPdfKey) return 'both';
        if (resolvedPdfKey) return 'pdf';
        return 'video';
      })();

      // Validate that at least one content type exists
      if (!resolvedVideoKey && !resolvedPdfKey) {
        await MySwal.fire({
          title: "Validation Error",
          text: "Please provide either a video file or a PDF document before saving",
          icon: "warning",
        });
        setIsSubmitting(false);
        return;
      }

      if (isEditMode && course) {
        await client.models.Course.update({
          id: course.id,
          title: title.trim(),
          description: description.trim() || null,
          videoKey: resolvedVideoKey || null,
          imageKey: resolvedImageKey || null,
          pdfKey: resolvedPdfKey || null,
          pdfTitle: pdfTitle.trim() || null,
          contentType: finalContentType,
          passingScore,
          duration: duration.trim() || null,
          category: category.trim() || null,
          randomizeQuestions: randomizeQuestions,
          randomizeOptions: randomizeOptions,
          useQuestionPool: useQuestionPool,
          poolSize: useQuestionPool ? poolSize : null,
          questionsToDisplay: useQuestionPool ? questionsToDisplay : null,
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
          const questionData: any = {
            courseId: course.id,
            question: question.question.trim(),
            questionType: question.questionType || 'multiple_choice',
            options: question.options.map(opt => opt.trim()),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          // Add fields based on question type
          if (question.questionType === 'fill_blank') {
            questionData.correctAnswerText = question.correctAnswerText?.trim() || null;
            questionData.caseSensitive = question.caseSensitive ?? false;
            questionData.fuzzyMatching = question.fuzzyMatching ?? false;
          } else {
            questionData.correctAnswer = question.correctAnswer;
          }

          await client.models.QuizQuestion.create(questionData);
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
        videoKey: resolvedVideoKey || null,
        imageKey: resolvedImageKey || null,
        pdfKey: resolvedPdfKey || null,
        pdfTitle: pdfTitle.trim() || null,
        contentType: finalContentType,
        passingScore,
        duration: duration.trim() || null,
        category: category.trim() || null,
        randomizeQuestions: randomizeQuestions,
        randomizeOptions: randomizeOptions,
        useQuestionPool: useQuestionPool,
        poolSize: useQuestionPool ? poolSize : null,
        questionsToDisplay: useQuestionPool ? questionsToDisplay : null,
        createdBy: currentUserId || null, // Track which manager created this course
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      if (courseResult.data) {
        // Type assertion: create() returns a single Course object, not an array
        const courseData = courseResult.data as unknown as { id: string };
        for (const question of validQuestions) {
          const questionData: any = {
            courseId: courseData.id,
            question: question.question.trim(),
            questionType: question.questionType || 'multiple_choice',
            options: question.options.map(opt => opt.trim()),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          // Add fields based on question type
          if (question.questionType === 'fill_blank') {
            questionData.correctAnswerText = question.correctAnswerText?.trim() || null;
            questionData.caseSensitive = question.caseSensitive ?? false;
            questionData.fuzzyMatching = question.fuzzyMatching ?? false;
          } else {
            questionData.correctAnswer = question.correctAnswer;
          }

          await client.models.QuizQuestion.create(questionData);
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
        setPdfFile(null);
        setPdfTitle('');
        setContentType('video');
        setPassingScore(80);
        setDuration('');
        setCategory('');
        setRandomizeQuestions(false);
        setQuiz([{ question: '', questionType: 'multiple_choice', options: ['', '', '', ''], correctAnswer: 0 }]);
        setUploadProgress(0);
        setImageUploadProgress(0);
        setPdfUploadProgress(0);
        setExistingVideoKey(null);
        setExistingImageKey(null);
        setExistingPdfKey(null);
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

        {/* Content Type Selector */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Content Type *
          </label>
          <select
            value={contentType}
            onChange={(e) => setContentType(e.target.value as 'video' | 'pdf' | 'both')}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '1rem',
              backgroundColor: 'white'
            }}
          >
            <option value="video">🎥 Video Only</option>
            <option value="pdf">📄 PDF Document Only</option>
            <option value="both">🎥📄 Both Video and PDF</option>
          </select>
          <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
            Select the type of content this course will contain. You can upload both video and PDF files.
          </p>
        </div>

        {/* Video Upload */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Course Video {isEditMode ? '(leave empty to keep current video)' : (contentType === 'both' ? '(optional if PDF is provided)' : '*')}
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

        {/* PDF Upload */}
        {(contentType === 'pdf' || contentType === 'both') && (
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              PDF Document {isEditMode ? '(leave empty to keep current PDF)' : '*'}
            </label>
            <div
              onDragOver={handlePdfDragOver}
              onDragLeave={handlePdfDragLeave}
              onDrop={handlePdfDrop}
              style={{
                border: `2px dashed ${pdfDragActive ? '#1976d2' : '#ccc'}`,
                borderRadius: '8px',
                padding: '2rem',
                textAlign: 'center',
                backgroundColor: pdfDragActive ? '#f5f5f5' : 'white',
                cursor: 'pointer'
              }}
            >
              {pdfFile ? (
                <div>
                  <p>✅ {pdfFile?.name || 'PDF file'}</p>
                  <p style={{ fontSize: '0.9rem', color: '#666', margin: '0.5rem 0' }}>
                    {(() => {
                      if (!pdfFile) return null;
                      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                      const fileSize = pdfFile!.size; // Safe: checked above and code is hidden
                      return (
                        <>
                          Size: {((fileSize / (1024 * 1024)).toFixed(2))} MB
                          {fileSize > 10 * 1024 * 1024 ? (
                            <span style={{ color: '#ff9800', marginLeft: '0.5rem' }}>
                              ⚠️ File exceeds 10MB limit
                            </span>
                          ) : null}
                        </>
                      );
                    })()}
                  </p>
                  <button 
                    type="button" 
                    onClick={() => {
                      setPdfFile(null);
                      if (!existingPdfKey) {
                        setPdfTitle('');
                      }
                    }}
                    style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  {isEditMode && existingPdfKey && (
                    <p style={{ marginBottom: '0.5rem', color: '#555' }}>
                      Current PDF: <code>{existingPdfKey}</code>
                      {pdfTitle && (
                        <span style={{ marginLeft: '0.5rem' }}>({pdfTitle})</span>
                      )}
                    </p>
                  )}
                  <p>Drag and drop a PDF file here, or click to select</p>
                  <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                    Maximum file size: 10MB
                  </p>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handlePdfFileSelect}
                    style={{ marginTop: '1rem' }}
                  />
                </div>
              )}
            </div>

            {/* PDF Title Input */}
            {(pdfFile || existingPdfKey) && (
              <div style={{ marginTop: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  PDF Document Title *
                </label>
                <input
                  type="text"
                  value={pdfTitle}
                  onChange={(e) => setPdfTitle(e.target.value)}
                  placeholder="Enter PDF document title (e.g., Safety Procedures Manual)"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '1rem'
                  }}
                  required
                />
                <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
                  This title will be displayed to employees when they view the course.
                </p>
              </div>
            )}
            
            {pdfUploadProgress > 0 && pdfUploadProgress < 100 && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ 
                  width: '100%', 
                  backgroundColor: '#f0f0f5', 
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${pdfUploadProgress}%`,
                    backgroundColor: '#1976d2',
                    height: '8px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                <p style={{ textAlign: 'center', margin: '0.5rem 0' }}>
                  Uploading PDF: {pdfUploadProgress}%
                </p>
              </div>
            )}
          </div>
        )}

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

        {/* Quiz Settings */}
        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Quiz Settings</h3>
          
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '0.75rem', marginBottom: '1rem' }}>
            <input
              type="checkbox"
              checked={randomizeQuestions}
              onChange={(e) => setRandomizeQuestions(e.target.checked)}
              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
            />
            <div>
              <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>Randomize Question Order</span>
              <p style={{ fontSize: '0.875rem', color: '#666', margin: '0.25rem 0 0 0' }}>
                When enabled, quiz questions will appear in a different random order for each employee and each attempt. 
                This helps prevent answer sharing and memorization.
              </p>
            </div>
          </label>
          
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '0.75rem' }}>
            <input
              type="checkbox"
              checked={randomizeOptions}
              onChange={(e) => setRandomizeOptions(e.target.checked)}
              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
            />
            <div>
              <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>Randomize Answer Options</span>
              <p style={{ fontSize: '0.875rem', color: '#666', margin: '0.25rem 0 0 0' }}>
                When enabled, answer options for multiple-choice and True/False questions will appear in a different random order for each employee and each attempt. 
                This prevents employees from memorizing answer patterns like "the answer is always B".
              </p>
            </div>
          </label>

          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e0e0e0' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '0.75rem', marginBottom: '1rem' }}>
              <input
                type="checkbox"
                checked={useQuestionPool}
                onChange={(e) => {
                  setUseQuestionPool(e.target.checked);
                  if (!e.target.checked) {
                    // Reset pool settings when disabled
                    setPoolSize(10);
                    setQuestionsToDisplay(5);
                  }
                }}
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
              />
              <div>
                <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>Question Pool Mode</span>
                <p style={{ fontSize: '0.875rem', color: '#666', margin: '0.25rem 0 0 0' }}>
                  Create more questions than will appear on the quiz. Each employee will get a random subset of questions, making each quiz attempt unique.
                </p>
              </div>
            </label>

            {useQuestionPool && (
              <div style={{ marginLeft: '2rem', padding: '1rem', backgroundColor: '#f0f7ff', borderRadius: '8px', border: '1px solid #b3d9ff' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                    Total Questions in Pool *
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="50"
                    value={poolSize}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      setPoolSize(value);
                      // Auto-adjust questionsToDisplay if it exceeds poolSize
                      if (questionsToDisplay > value) {
                        setQuestionsToDisplay(value);
                      }
                    }}
                    style={{
                      width: '150px',
                      padding: '0.75rem',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '1rem'
                    }}
                    required={useQuestionPool}
                  />
                  <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
                    Total number of questions you'll create for this course. Create more questions than will be displayed.
                  </p>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                    Questions to Display per Quiz *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={poolSize}
                    value={questionsToDisplay}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      if (value <= poolSize) {
                        setQuestionsToDisplay(value);
                      }
                    }}
                    style={{
                      width: '150px',
                      padding: '0.75rem',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '1rem'
                    }}
                    required={useQuestionPool}
                  />
                  <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
                    Number of questions each employee will see. Must be less than or equal to pool size.
                  </p>
                </div>

                <div style={{ padding: '0.75rem', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #b3d9ff' }}>
                  <p style={{ fontSize: '0.875rem', color: '#1976d2', margin: 0, fontWeight: 'bold' }}>
                    💡 Example: Create 20 questions, display 10 per quiz. Each employee gets a different random set of 10 questions.
                  </p>
                </div>
              </div>
            )}
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

              {/* Question Type Selector */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Question Type:</label>
                <select
                  value={question.questionType || 'multiple_choice'}
                  onChange={(e) => handleQuestionTypeChange(questionIndex, e.target.value as 'multiple_choice' | 'true_false' | 'fill_blank')}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    backgroundColor: 'white'
                  }}
                >
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="true_false">True/False</option>
                  <option value="fill_blank">Fill in the Blank</option>
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Question:</label>
                <input
                  type="text"
                  value={question.question}
                  onChange={(e) => updateQuizQuestion(questionIndex, 'question', e.target.value)}
                  placeholder={
                    question.questionType === 'true_false' 
                      ? 'e.g., Employees must wash hands for at least 20 seconds'
                      : question.questionType === 'fill_blank'
                      ? 'e.g., Food must be stored at _____ degrees Fahrenheit or below'
                      : 'Enter your question'
                  }
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                />
                {question.questionType === 'fill_blank' && (
                  <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
                    💡 Tip: Use "_____" (underscores) to indicate where the blank should be filled in
                  </p>
                )}
              </div>

              {/* Answer Options - Different UI based on question type */}
              {(question.questionType || 'multiple_choice') === 'fill_blank' ? (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                    Correct Answer(s) *
                  </label>
                  <input
                    type="text"
                    value={question.correctAnswerText || ''}
                    onChange={(e) => updateQuizQuestion(questionIndex, 'correctAnswerText', e.target.value)}
                    placeholder="Enter accepted answers separated by commas (e.g., 40,forty,40 degrees)"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '1rem'
                    }}
                  />
                  <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
                    Separate multiple acceptable answers with commas. Employee's answer will be checked against all of these.
                  </p>
                  
                  <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={question.caseSensitive || false}
                        onChange={(e) => updateQuizQuestion(questionIndex, 'caseSensitive', e.target.checked)}
                        style={{ marginRight: '0.5rem', width: '18px', height: '18px' }}
                      />
                      <span>Case-sensitive matching</span>
                    </label>
                    
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={question.fuzzyMatching || false}
                        onChange={(e) => updateQuizQuestion(questionIndex, 'fuzzyMatching', e.target.checked)}
                        style={{ marginRight: '0.5rem', width: '18px', height: '18px' }}
                      />
                      <span>Enable fuzzy matching (allows up to 2 character differences)</span>
                    </label>
                    {question.fuzzyMatching && (
                      <p style={{ fontSize: '0.75rem', color: '#666', marginLeft: '1.5rem', fontStyle: 'italic' }}>
                        This will accept answers that are close to the correct answer (e.g., "forty" matches "forty " or "fourty")
                      </p>
                    )}
                  </div>
                </div>
              ) : (question.questionType || 'multiple_choice') === 'true_false' ? (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Correct Answer:</label>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                      type="button"
                      onClick={() => updateQuizQuestion(questionIndex, 'correctAnswer', 0)}
                      style={{
                        flex: 1,
                        padding: '1rem',
                        backgroundColor: question.correctAnswer === 0 ? '#4caf50' : '#f5f5f5',
                        color: question.correctAnswer === 0 ? 'white' : '#333',
                        border: `2px solid ${question.correctAnswer === 0 ? '#4caf50' : '#ccc'}`,
                        borderRadius: '8px',
                        fontSize: '1.1rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      ✓ True
                    </button>
                    <button
                      type="button"
                      onClick={() => updateQuizQuestion(questionIndex, 'correctAnswer', 1)}
                      style={{
                        flex: 1,
                        padding: '1rem',
                        backgroundColor: question.correctAnswer === 1 ? '#f44336' : '#f5f5f5',
                        color: question.correctAnswer === 1 ? 'white' : '#333',
                        border: `2px solid ${question.correctAnswer === 1 ? '#f44336' : '#ccc'}`,
                        borderRadius: '8px',
                        fontSize: '1.1rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      ✗ False
                    </button>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
                    Selected: {question.correctAnswer === 0 ? 'True' : 'False'}
                  </p>
                </div>
              ) : (
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
              )}
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
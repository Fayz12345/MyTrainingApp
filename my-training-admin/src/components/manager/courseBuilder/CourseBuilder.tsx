import React, { useCallback, useEffect, useRef, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import { fetchAuthSession } from 'aws-amplify/auth';
import type { Schema } from '../../../../../amplify/data/resource';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Collapse,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import TitleIcon from '@mui/icons-material/Title';
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';
import QuizIcon from '@mui/icons-material/Quiz';
import VisibilityIcon from '@mui/icons-material/Visibility';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { activityLogger, getCurrentUserInfo } from '../../../utils/activityLogger';

import BlockEditor from './BlockEditor';
import CoursePreview from './CoursePreview';
import {
  CourseBlock,
  deriveLegacyFieldsFromBlocks,
  migrateCourseToBlocks,
  safeParseBlocksJson,
} from './courseBlocks';

const MySwal = withReactContent(Swal);
const client = generateClient<Schema>();

interface QuizQuestion {
  question: string;
  questionType?: 'multiple_choice' | 'true_false' | 'fill_blank';
  options: string[];
  correctAnswer?: number;
  correctAnswerText?: string;
  caseSensitive?: boolean;
  fuzzyMatching?: boolean;
}

const DEBOUNCE_MS = 1800;

type CourseInput = {
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
  readonly blocksJson?: string | null;
  readonly isTemplate?: boolean | null;
};

type CourseBuilderProps = {
  course?: CourseInput;
  onSuccess?: () => void;
  onCancel?: () => void;
};

export default function CourseBuilder({ course, onSuccess, onCancel }: CourseBuilderProps) {
  const isEditMode = Boolean(course);
  const [title, setTitle] = useState(course?.title ?? '');
  const [blocks, setBlocks] = useState<CourseBlock[]>(() => {
    const fromJson = course?.blocksJson != null ? safeParseBlocksJson(course.blocksJson) : null;
    if (fromJson && fromJson.length > 0) return fromJson;
    return migrateCourseToBlocks({
      description: course?.description,
      videoKey: course?.videoKey,
      imageKey: course?.imageKey,
      pdfKey: course?.pdfKey,
      pdfTitle: course?.pdfTitle,
    });
  });
  const [passingScore, setPassingScore] = useState(course?.passingScore ?? 80);
  const [duration, setDuration] = useState(course?.duration ?? '');
  const [category, setCategory] = useState(course?.category ?? '');
  const [randomizeQuestions, setRandomizeQuestions] = useState(course?.randomizeQuestions ?? false);
  const [randomizeOptions, setRandomizeOptions] = useState(course?.randomizeOptions ?? false);
  const [useQuestionPool, setUseQuestionPool] = useState(course?.useQuestionPool ?? false);
  const [poolSize, setPoolSize] = useState(course?.poolSize ?? 10);
  const [questionsToDisplay, setQuestionsToDisplay] = useState(course?.questionsToDisplay ?? 5);
  const [quiz, setQuiz] = useState<QuizQuestion[]>([{ question: '', questionType: 'multiple_choice', options: ['', '', '', ''], correctAnswer: 0 }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [quizOpen, setQuizOpen] = useState(true);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [savingAsTemplate, setSavingAsTemplate] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  type LessonRecord = { id: string; title: string; order: number; blocks: CourseBlock[] };
  const [lessons, setLessons] = useState<LessonRecord[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const lessonSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [renamingLessonId, setRenamingLessonId] = useState<string | null>(null);

  const handleSaveAsTemplate = async () => {
    if (!course?.id) return;
    setSavingAsTemplate(true);
    try {
      await client.models.Course.update({
        id: course.id,
        isTemplate: true,
        updatedAt: new Date().toISOString(),
      });
      await MySwal.fire({ title: 'Saved as template', text: 'This course is now available in the template gallery.', icon: 'success', timer: 2000, showConfirmButton: false });
    } catch (e) {
      await MySwal.fire({ title: 'Error', text: String(e), icon: 'error' });
    } finally {
      setSavingAsTemplate(false);
    }
  };

  const loadQuiz = useCallback(async (courseId: string) => {
    setIsLoadingQuiz(true);
    try {
      const result = await client.models.QuizQuestion.list({ filter: { courseId: { eq: courseId } } });
      if (result.data?.length) {
        setQuiz(
          result.data.map((q: any) => ({
            question: q.question,
            questionType: (q.questionType || 'multiple_choice') as QuizQuestion['questionType'],
            options: (q.options as string[]) ?? ['', '', '', ''],
            correctAnswer: q.correctAnswer,
            correctAnswerText: q.correctAnswerText ?? undefined,
            caseSensitive: q.caseSensitive ?? false,
            fuzzyMatching: q.fuzzyMatching ?? false,
          }))
        );
      }
    } catch (e) {
      console.error('Load quiz failed:', e);
    } finally {
      setIsLoadingQuiz(false);
    }
  }, []);

  useEffect(() => {
    if (course?.id) loadQuiz(course.id);
  }, [course?.id, loadQuiz]);

  // Load lessons for edit mode; migrate from blocksJson if no lessons exist yet.
  useEffect(() => {
    if (!isEditMode || !course?.id) return;
    let cancelled = false;

    const loadLessons = async () => {
      try {
        const result = await client.models.Lesson.list({
          filter: { courseId: { eq: course.id } },
        });
        let lessonItems = (result.data ?? []) as any[];

        // If no lessons yet, migrate from existing blocksJson (or current blocks state)
        if (!lessonItems.length) {
          const initialBlocks =
            safeParseBlocksJson(course.blocksJson ?? '') ??
            blocks;
          const now = new Date().toISOString();
          const created = await client.models.Lesson.create({
            courseId: course.id,
            title: course.title || 'Lesson 1',
            order: 1,
            contentBlocks: JSON.stringify(initialBlocks),
            createdAt: now,
            updatedAt: now,
          });
          if (created.data) {
            lessonItems = [created.data as any];
          }
        }

        const mapped: LessonRecord[] = lessonItems
          .slice()
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((l) => ({
            id: l.id,
            title: l.title,
            order: l.order ?? 0,
            blocks: safeParseBlocksJson(l.contentBlocks ?? '') ?? [],
          }));

        if (!cancelled) {
          setLessons(mapped);
          const first = mapped[0];
          setSelectedLessonId(first?.id ?? null);
          if (first) {
            setBlocks(first.blocks);
          }
        }
      } catch (e) {
        console.error('Failed to load lessons for course:', e);
      }
    };

    loadLessons();

    return () => {
      cancelled = true;
    };
  }, [isEditMode, course?.id]);

  // Initialize a default local lesson for new courses (create mode)
  useEffect(() => {
    if (isEditMode) return;
    if (lessons.length > 0) return;
    const localId = `local-${Date.now().toString(36)}`;
    const initial: LessonRecord = {
      id: localId,
      title: title || 'Lesson 1',
      order: 1,
      blocks,
    };
    setLessons([initial]);
    setSelectedLessonId(localId);
  }, [isEditMode]);

  const persistCourse = useCallback(
    async (
      payload: {
        title: string;
        blocksJson: string;
        description: string | null;
        videoKey: string | null;
        imageKey: string | null;
        pdfKey: string | null;
        pdfTitle: string | null;
        contentType: 'video' | 'pdf' | 'both';
        passingScore: number;
        duration: string | null;
        category: string | null;
        randomizeQuestions: boolean;
        randomizeOptions: boolean;
        useQuestionPool: boolean;
        poolSize: number | null;
        questionsToDisplay: number | null;
      },
      quizSnapshot: QuizQuestion[]
    ) => {
      if (!course?.id) return;
      setSaveStatus('saving');
      try {
        await client.models.Course.update({
          id: course.id,
          title: payload.title.trim(),
          description: payload.description,
          videoKey: payload.videoKey,
          imageKey: payload.imageKey,
          pdfKey: payload.pdfKey,
          pdfTitle: payload.pdfTitle,
          contentType: payload.contentType,
          passingScore: payload.passingScore,
          duration: payload.duration,
          category: payload.category,
          blocksJson: payload.blocksJson,
          randomizeQuestions: payload.randomizeQuestions,
          randomizeOptions: payload.randomizeOptions,
          useQuestionPool: payload.useQuestionPool,
          poolSize: payload.poolSize ?? null,
          questionsToDisplay: payload.questionsToDisplay ?? null,
          updatedAt: new Date().toISOString(),
        });
        const validQuestions = quizSnapshot.filter(
          (q) =>
            q.question.trim() &&
            (q.questionType === 'true_false'
              ? q.options.length === 2 && (q.correctAnswer === 0 || q.correctAnswer === 1)
              : q.questionType === 'fill_blank'
                ? q.correctAnswerText?.trim()
                : q.options.every((o) => o.trim()) && q.correctAnswer != null && q.correctAnswer >= 0 && q.correctAnswer < q.options.length)
        );
        const existing = await client.models.QuizQuestion.list({ filter: { courseId: { eq: course.id } } });
        if (existing.data) for (const row of existing.data) await client.models.QuizQuestion.delete({ id: row.id });
        for (const q of validQuestions) {
          await client.models.QuizQuestion.create({
            courseId: course.id,
            question: q.question.trim(),
            questionType: q.questionType || 'multiple_choice',
            options: q.options.map((o) => o.trim()),
            correctAnswer: q.correctAnswer,
            correctAnswerText: q.correctAnswerText ?? null,
            caseSensitive: q.caseSensitive ?? false,
            fuzzyMatching: q.fuzzyMatching ?? false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (e) {
        console.error('Auto-save failed:', e);
        setSaveStatus('error');
      }
    },
    [course?.id]
  );

  useEffect(() => {
    if (!isEditMode || !course?.id) return;
    const legacy = deriveLegacyFieldsFromBlocks(blocks);
    const payload = {
      title: title.trim(),
      blocksJson: JSON.stringify(blocks),
      ...legacy,
      passingScore,
      duration: duration.trim() || null,
      category: category.trim() || null,
      randomizeQuestions,
      randomizeOptions,
      useQuestionPool,
      poolSize: useQuestionPool ? poolSize : null,
      questionsToDisplay: useQuestionPool ? questionsToDisplay : null,
    };
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      if (title.trim().length >= 3) persistCourse(payload, quiz);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [isEditMode, course?.id, blocks, title, passingScore, duration, category, randomizeQuestions, randomizeOptions, useQuestionPool, poolSize, questionsToDisplay, quiz, persistCourse]);

  useEffect(() => {
    return () => {
      if (lessonSaveRef.current) clearTimeout(lessonSaveRef.current);
    };
  }, []);

  const handleCreate = async () => {
    if (!title.trim() || title.trim().length < 3) {
      await MySwal.fire({ title: 'Validation', text: 'Course title is required (min 3 characters).', icon: 'warning' });
      return;
    }
    let currentUserId: string | undefined;
    try {
      const session = await fetchAuthSession();
      currentUserId = session.userSub ?? (session.tokens?.idToken?.payload?.sub as string);
    } catch {}
    const legacy = deriveLegacyFieldsFromBlocks(blocks);
    setIsSubmitting(true);
    try {
      const result = await client.models.Course.create({
        title: title.trim(),
        description: legacy.description,
        videoKey: legacy.videoKey,
        imageKey: legacy.imageKey,
        pdfKey: legacy.pdfKey,
        pdfTitle: legacy.pdfTitle,
        contentType: legacy.contentType,
        passingScore,
        duration: duration.trim() || null,
        category: category.trim() || null,
        blocksJson: JSON.stringify(blocks),
        randomizeQuestions,
        randomizeOptions,
        useQuestionPool,
        poolSize: useQuestionPool ? poolSize : null,
        questionsToDisplay: useQuestionPool ? questionsToDisplay : null,
        createdBy: currentUserId ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      const created = result.data as { id: string } | undefined;
      if (created?.id) {
        const now = new Date().toISOString();
        const lessonsToPersist: LessonRecord[] =
          lessons.length > 0
            ? lessons
            : [
                {
                  id: '',
                  title: title || 'Lesson 1',
                  order: 1,
                  blocks,
                },
              ];

        for (const l of lessonsToPersist) {
          await client.models.Lesson.create({
            courseId: created.id,
            title: l.title || `Lesson ${l.order}`,
            order: l.order,
            contentBlocks: JSON.stringify(l.blocks),
            createdAt: now,
            updatedAt: now,
          });
        }

        const validQuestions = quiz.filter(
          (q) =>
            q.question.trim() &&
            (q.questionType === 'true_false'
              ? q.options.length === 2 && (q.correctAnswer === 0 || q.correctAnswer === 1)
              : q.questionType === 'fill_blank'
                ? q.correctAnswerText?.trim()
                : q.options.every((o) => o.trim()) && q.correctAnswer != null && q.correctAnswer >= 0 && q.correctAnswer < q.options.length)
        );
        for (const q of validQuestions) {
          await client.models.QuizQuestion.create({
            courseId: created.id,
            question: q.question.trim(),
            questionType: q.questionType || 'multiple_choice',
            options: q.options.map((o) => o.trim()),
            correctAnswer: q.correctAnswer,
            correctAnswerText: q.correctAnswerText ?? null,
            caseSensitive: q.caseSensitive ?? false,
            fuzzyMatching: q.fuzzyMatching ?? false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
        try {
          const userInfo = await getCurrentUserInfo();
          await activityLogger.logActivity('COURSE_CREATED', userInfo.userId, userInfo.userName, userInfo.userEmail, `Created course: ${title}`, { courseId: created.id, courseTitle: title });
        } catch {}
        await MySwal.fire({ title: 'Created!', text: 'Course created successfully.', icon: 'success', timer: 1500, showConfirmButton: false });
        onSuccess?.();
      }
    } catch (e) {
      await MySwal.fire({ title: 'Error', text: String(e), icon: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addQuizQuestion = () => {
    if (quiz.length < 10) setQuiz([...quiz, { question: '', options: ['', '', '', ''], correctAnswer: 0 }]);
  };
  const removeQuizQuestion = (index: number) => {
    if (quiz.length > 1) setQuiz(quiz.filter((_, i) => i !== index));
  };
  const updateQuiz = (index: number, field: keyof QuizQuestion, value: any) => {
    const next = [...quiz];
    if (field === 'options') (next[index] as any).options = value;
    else (next[index] as any)[field] = value;
    setQuiz(next);
  };

  const usingLessons = lessons.length > 0;
  const selectedLesson = usingLessons
    ? lessons.find((l) => l.id === selectedLessonId) ?? lessons[0] ?? null
    : null;

  const handleBlocksChange = (updated: CourseBlock[]) => {
    if (usingLessons && selectedLesson) {
      setLessons((prev) =>
        prev.map((l) => (l.id === selectedLesson.id ? { ...l, blocks: updated } : l))
      );
      setBlocks(updated);

      if (lessonSaveRef.current) clearTimeout(lessonSaveRef.current);
      lessonSaveRef.current = setTimeout(async () => {
        try {
          await client.models.Lesson.update({
            id: selectedLesson.id,
            contentBlocks: JSON.stringify(updated),
            updatedAt: new Date().toISOString(),
          });
        } catch (e) {
          console.error('Failed to save lesson content:', e);
        }
      }, 800);
    } else {
      setBlocks(updated);
    }
  };

  const handleAddLesson = async () => {
    if (!course?.id) {
      const nextOrder = (lessons[lessons.length - 1]?.order ?? 0) + 1;
      const localId = `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const record: LessonRecord = {
        id: localId,
        title: `Lesson ${nextOrder}`,
        order: nextOrder,
        blocks: [],
      };
      setLessons((prev) => [...prev, record]);
      setSelectedLessonId(record.id);
      setBlocks([]);
      return;
    }
    const nextOrder = (lessons[lessons.length - 1]?.order ?? 0) + 1;
    const now = new Date().toISOString();
    try {
      const created = await client.models.Lesson.create({
        courseId: course.id,
        title: `Lesson ${nextOrder}`,
        order: nextOrder,
        contentBlocks: JSON.stringify([]),
        createdAt: now,
        updatedAt: now,
      });
      if (created.data) {
        const l: any = created.data;
        const record: LessonRecord = {
          id: l.id,
          title: l.title,
          order: l.order ?? nextOrder,
          blocks: [],
        };
        setLessons((prev) => [...prev, record]);
        setSelectedLessonId(record.id);
        setBlocks([]);
      }
    } catch (e) {
      await MySwal.fire({ title: 'Error', text: String(e), icon: 'error' });
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    const lesson = lessons.find((l) => l.id === lessonId);
    if (!lesson) return;

    if (lessons.length === 1) {
      await MySwal.fire({
        title: 'Cannot delete last lesson',
        text: 'Each course must have at least one lesson. You can clear its content instead.',
        icon: 'info',
      });
      return;
    }

    const result = await MySwal.fire({
      title: 'Delete lesson?',
      text: `This will remove "${lesson.title || `Lesson ${lesson.order}`}" and its content from this course.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete lesson',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#d32f2f',
    });
    if (!result.isConfirmed) return;

    try {
      if (course?.id) {
        await client.models.Lesson.delete({ id: lessonId });
      }
      const remaining = lessons.filter((l) => l.id !== lessonId);
      setLessons(remaining);
      const nextSelected = remaining[0] ?? null;
      setSelectedLessonId(nextSelected?.id ?? null);
      setBlocks(nextSelected?.blocks ?? []);
    } catch (e) {
      await MySwal.fire({ title: 'Error', text: String(e), icon: 'error' });
    }
  };

  const handleRenameLesson = async (lessonId: string) => {
    const lesson = lessons.find((l) => l.id === lessonId);
    if (!lesson) return;

    setRenamingLessonId(lessonId);
    try {
      const result = await MySwal.fire({
        title: 'Rename lesson',
        input: 'text',
        inputValue: lesson.title || `Lesson ${lesson.order}`,
        inputLabel: 'Lesson name',
        inputPlaceholder: 'Enter lesson name',
        showCancelButton: true,
        confirmButtonText: 'Save',
      });
      if (!result.isConfirmed) return;
      const newTitle = (result.value as string || '').trim();
      if (!newTitle) return;

      setLessons((prev) =>
        prev.map((l) => (l.id === lessonId ? { ...l, title: newTitle } : l))
      );

      if (course?.id && !lessonId.startsWith('local-')) {
        try {
          await client.models.Lesson.update({
            id: lessonId,
            title: newTitle,
            updatedAt: new Date().toISOString(),
          });
        } catch (e) {
          console.error('Failed to rename lesson:', e);
          await MySwal.fire({ title: 'Error', text: String(e), icon: 'error' });
        }
      }
    } finally {
      setRenamingLessonId(null);
    }
  };

  return (
    <Box sx={{ maxWidth: 880, mx: 'auto', pb: 10 }}>
      <CoursePreview
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={title}
        blocks={usingLessons ? lessons.flatMap((l) => l.blocks) : blocks}
        quiz={quiz}
        passingScore={passingScore}
      />

      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={600}>
          {isEditMode ? 'Edit course' : 'Create a new course'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {isEditMode
            ? 'Changes are saved automatically.'
            : 'Add a title, build your content with blocks, then add quiz questions.'}
        </Typography>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 2 }} flexWrap="wrap">
          <Button
            variant="outlined"
            size="medium"
            startIcon={<VisibilityIcon />}
            onClick={() => setPreviewOpen(true)}
          >
            Preview as learner
          </Button>
          {isEditMode && !course?.isTemplate && (
            <Button
              variant="outlined"
              size="medium"
              onClick={handleSaveAsTemplate}
              disabled={savingAsTemplate}
            >
              {savingAsTemplate ? 'Saving…' : 'Save as template'}
            </Button>
          )}
          {isEditMode && (
            <Typography variant="body2" color={saveStatus === 'error' ? 'error.main' : 'text.secondary'}>
              {saveStatus === 'saving' && 'Saving…'}
              {saveStatus === 'saved' && 'Saved'}
              {saveStatus === 'error' && 'Save failed'}
            </Typography>
          )}
        </Stack>
      </Box>

      {/* 1. Course basics */}
      <Card variant="outlined" sx={{ mb: 2.5, borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
            <TitleIcon color="primary" fontSize="small" />
            <Typography variant="h6" fontWeight={600}>
              1. Course details
            </Typography>
          </Stack>
          <TextField
            fullWidth
            label="Course title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g. Safety Fundamentals"
            helperText="At least 3 characters"
            sx={{ mb: 2 }}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              fullWidth
              label="Duration"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 45 min"
              helperText="e.g. 45 min, 1 hr 30 min"
            />
            <TextField
              fullWidth
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Leadership, IT"
              helperText="e.g. Leadership, Marketing, IT"
            />
          </Stack>
        </CardContent>
      </Card>

      {/* 2. Content blocks */}
      <Card variant="outlined" sx={{ mb: 2.5, borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
            <DashboardCustomizeIcon color="primary" fontSize="small" />
            <Typography variant="h6" fontWeight={600}>
              2. Course content
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add and reorder blocks: text, video, images, PDFs, and callouts.
          </Typography>
          {usingLessons ? (
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <Box
                sx={{
                  width: { xs: '100%', md: 220 },
                  flexShrink: 0,
                  borderRight: { md: 1 },
                  borderColor: { md: 'divider' },
                  pr: { md: 2 },
                  mb: { xs: 2, md: 0 },
                }}
              >
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2">Lessons</Typography>
                  <Button size="small" variant="text" onClick={handleAddLesson}>
                    + Add
                  </Button>
                </Stack>
                <Stack spacing={0.5}>
                  {lessons.map((l) => (
                    <Stack
                      key={l.id}
                      direction="row"
                      alignItems="center"
                      spacing={0.5}
                    >
                      <Button
                        size="small"
                        variant={l.id === selectedLesson?.id ? 'contained' : 'outlined'}
                        color={l.id === selectedLesson?.id ? 'primary' : 'inherit'}
                        onClick={() => {
                          setSelectedLessonId(l.id);
                          setBlocks(l.blocks);
                        }}
                        sx={{ justifyContent: 'flex-start', textTransform: 'none', flexGrow: 1 }}
                      >
                        {l.title || `Lesson ${l.order}`}
                      </Button>
                      <IconButton
                        size="small"
                        aria-label="Rename lesson"
                        onClick={() => handleRenameLesson(l.id)}
                      >
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label="Delete lesson"
                        onClick={() => handleDeleteLesson(l.id)}
                        sx={{ color: 'error.main' }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
                </Stack>
              </Box>
              <Box sx={{ flex: 1 }}>
                {selectedLesson ? (
                  <BlockEditor blocks={blocks} onChange={handleBlocksChange} />
                ) : (
                  <Typography color="text.secondary">Select a lesson to edit its content.</Typography>
                )}
              </Box>
            </Stack>
          ) : (
            <BlockEditor blocks={blocks} onChange={handleBlocksChange} />
          )}
        </CardContent>
      </Card>

      {/* 3. Quiz */}
      <Card variant="outlined" sx={{ mb: 2.5, borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            onClick={() => setQuizOpen((o) => !o)}
            sx={{ cursor: 'pointer', userSelect: 'none' }}
          >
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <QuizIcon color="primary" fontSize="small" />
              <Typography variant="h6" fontWeight={600}>
                3. Quiz
              </Typography>
            </Stack>
            <IconButton size="small" aria-label={quizOpen ? 'Collapse quiz' : 'Expand quiz'}>
              {quizOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1 }}>
            Add questions and set passing score. Optional: randomize order or use a question pool.
          </Typography>
          <Collapse in={quizOpen}>
            {isLoadingQuiz ? (
              <Typography color="text.secondary" sx={{ py: 2 }}>Loading quiz…</Typography>
            ) : (
              <Stack spacing={3} sx={{ pt: 2 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} spacing={2}>
                  <TextField
                    type="number"
                    label="Passing score %"
                    value={passingScore}
                    onChange={(e) => setPassingScore(Math.max(0, Math.min(100, Number(e.target.value))))}
                    inputProps={{ min: 0, max: 100 }}
                    sx={{ width: 140 }}
                    size="small"
                  />
                </Stack>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>Quiz settings</Typography>
                  <Stack spacing={2}>
                    <Box>
                      <FormControlLabel
                        control={<Switch checked={randomizeQuestions} onChange={(e) => setRandomizeQuestions(e.target.checked)} color="primary" />}
                        label="Randomize question order"
                      />
                      <Typography variant="body2" color="text.secondary" sx={{ display: 'block', pl: 5.5, mt: 0.25 }}>
                        When enabled, quiz questions will appear in a different random order for each employee and each attempt. This helps prevent answer sharing and memorization.
                      </Typography>
                    </Box>
                    <Box>
                      <FormControlLabel
                        control={<Switch checked={randomizeOptions} onChange={(e) => setRandomizeOptions(e.target.checked)} color="primary" />}
                        label="Randomize answer options"
                      />
                      <Typography variant="body2" color="text.secondary" sx={{ display: 'block', pl: 5.5, mt: 0.25 }}>
                        When enabled, answer options for multiple-choice and True/False questions will appear in a different random order for each employee and each attempt. This prevents employees from memorizing answer patterns like &quot;the answer is always B&quot;.
                      </Typography>
                    </Box>
                    <Box>
                      <FormControlLabel
                        control={<Switch checked={useQuestionPool} onChange={(e) => setUseQuestionPool(e.target.checked)} color="primary" />}
                        label="Question pool mode"
                      />
                      <Typography variant="body2" color="text.secondary" sx={{ display: 'block', pl: 5.5, mt: 0.25 }}>
                        Create more questions than will appear on the quiz. Each employee will get a random subset of questions, making each quiz attempt unique.
                      </Typography>
                    </Box>
                    {useQuestionPool && (
                      <Stack spacing={2} sx={{ mt: 1, pl: 1 }}>
                        <TextField
                          type="number"
                          size="small"
                          label="Total questions in pool *"
                          value={poolSize}
                          onChange={(e) => setPoolSize(Math.max(1, Number(e.target.value) || 1))}
                          inputProps={{ min: 1 }}
                          helperText="Total number of questions you'll create for this course. Create more questions than will be displayed."
                          fullWidth
                          sx={{ maxWidth: 320 }}
                        />
                        <TextField
                          type="number"
                          size="small"
                          label="Questions to display per quiz *"
                          value={questionsToDisplay}
                          onChange={(e) => setQuestionsToDisplay(Math.max(1, Number(e.target.value) || 1))}
                          inputProps={{ min: 1 }}
                          helperText="Number of questions each employee will see. Must be less than or equal to pool size."
                          error={questionsToDisplay > (poolSize || 0)}
                          fullWidth
                          sx={{ maxWidth: 320 }}
                        />
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          💡 Example: Create 20 questions, display 10 per quiz. Each employee gets a different random set of 10 questions.
                        </Typography>
                      </Stack>
                    )}
                  </Stack>
                </Paper>
                <Divider />
                <Typography variant="subtitle2">Questions</Typography>
                {quiz.map((q, idx) => (
                  <Paper key={idx} variant="outlined" sx={{ p: 2 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                      <Chip label={`Question ${idx + 1}`} size="small" />
                      <IconButton size="small" onClick={() => removeQuizQuestion(idx)} disabled={quiz.length <= 1} aria-label="Remove question">
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                    <FormControl size="small" fullWidth sx={{ mb: 1.5 }}>
                      <InputLabel>Type</InputLabel>
                      <Select
                        value={q.questionType || 'multiple_choice'}
                        label="Type"
                        onChange={(e) => {
                          const v = e.target.value as QuizQuestion['questionType'];
                          const next = [...quiz];
                          const curr = { ...next[idx], questionType: v };
                          if (v === 'true_false') {
                            curr.options = ['True', 'False'];
                            curr.correctAnswer = 0;
                          } else if (v === 'multiple_choice') {
                            curr.options = (q.options?.length === 4 ? q.options : ['', '', '', '']) as string[];
                            curr.correctAnswer = 0;
                          }
                          next[idx] = curr;
                          setQuiz(next);
                        }}
                      >
                        <MenuItem value="multiple_choice">Multiple choice</MenuItem>
                        <MenuItem value="true_false">True / False</MenuItem>
                        <MenuItem value="fill_blank">Fill in the blank</MenuItem>
                      </Select>
                    </FormControl>
                    {q.questionType === 'fill_blank' ? (
                      <Box sx={{ mb: 2 }}>
                        <Typography component="label" variant="body2" fontWeight={500} sx={{ display: 'block', mb: 0.5 }}>
                          Question:
                        </Typography>
                        <TextField
                          fullWidth
                          size="small"
                          value={q.question}
                          onChange={(e) => updateQuiz(idx, 'question', e.target.value)}
                          placeholder="e.g., Food must be stored at _____ degrees Fahrenheit or below"
                          sx={{ mb: 0.5 }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          💡 Tip: Use "_____" (underscores) to indicate where the blank should be filled in
                        </Typography>
                      </Box>
                    ) : (
                      <TextField
                        fullWidth
                        size="small"
                        label="Question text"
                        value={q.question}
                        onChange={(e) => updateQuiz(idx, 'question', e.target.value)}
                        placeholder="Enter the question"
                        sx={{ mb: 1.5 }}
                      />
                    )}
                    {q.questionType === 'fill_blank' && (
                      <Box sx={{ mb: 2 }}>
                        <Typography component="label" variant="body2" fontWeight={700} sx={{ display: 'block', mb: 0.5 }}>
                          Correct Answer(s) *
                        </Typography>
                        <TextField
                          fullWidth
                          size="small"
                          value={q.correctAnswerText ?? ''}
                          onChange={(e) => updateQuiz(idx, 'correctAnswerText', e.target.value)}
                          placeholder="Enter accepted answers separated by commas (e.g., 40,forty,40 degrees)"
                          sx={{ mb: 0.5 }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                          Separate multiple acceptable answers with commas. Employee&apos;s answer will be checked against all of these.
                        </Typography>
                        <Stack spacing={1}>
                          <FormControlLabel
                            control={
                              <Checkbox
                                size="small"
                                checked={q.caseSensitive ?? false}
                                onChange={(e) => updateQuiz(idx, 'caseSensitive', e.target.checked)}
                                color="primary"
                              />
                            }
                            label="Case-sensitive matching"
                          />
                          <FormControlLabel
                            control={
                              <Checkbox
                                size="small"
                                checked={q.fuzzyMatching ?? false}
                                onChange={(e) => updateQuiz(idx, 'fuzzyMatching', e.target.checked)}
                                color="primary"
                              />
                            }
                            label="Enable fuzzy matching (allows up to 2 character differences)"
                          />
                        </Stack>
                      </Box>
                    )}
                    {q.questionType !== 'fill_blank' && (
                      <Box sx={{ mt: 1.5 }}>
                        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                          Answer options:
                        </Typography>
                        <RadioGroup
                          value={String(Math.min(q.correctAnswer ?? 0, Math.max(0, (q.options?.length ?? 1) - 1)))}
                          onChange={(e) => updateQuiz(idx, 'correctAnswer', Number(e.target.value))}
                        >
                          {(q.questionType === 'true_false' ? (q.options?.length ? q.options : ['True', 'False']) : (q.options?.length ? q.options : ['', '', '', ''])).map((opt, oi) => (
                            <Stack key={oi} direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
                              <Radio size="small" value={String(oi)} />
                              <TextField
                                fullWidth
                                size="small"
                                placeholder={`Option ${oi + 1}`}
                                value={q.options?.[oi] ?? opt}
                                onChange={(e) => {
                                  const opts = q.questionType === 'true_false' ? [...(q.options || ['True', 'False'])] : [...(q.options || ['', '', '', ''])];
                                  opts[oi] = e.target.value;
                                  updateQuiz(idx, 'options', opts);
                                }}
                              />
                            </Stack>
                          ))}
                        </RadioGroup>
                      </Box>
                    )}
                  </Paper>
                ))}
                <Button startIcon={<AddIcon />} onClick={addQuizQuestion} disabled={quiz.length >= 10} variant="outlined">
                  Add question
                </Button>
              </Stack>
            )}
          </Collapse>
        </CardContent>
      </Card>

      {/* Sticky action bar */}
      <Paper
        elevation={2}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          p: 2,
          zIndex: 10,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" justifyContent="center" spacing={2} sx={{ maxWidth: 880, mx: 'auto' }}>
          {!isEditMode && (
            <Button variant="contained" size="large" onClick={handleCreate} disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create course'}
            </Button>
          )}
          {onCancel && (
            <Button variant="outlined" size="large" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}

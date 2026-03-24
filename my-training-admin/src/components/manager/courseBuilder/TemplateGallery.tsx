import React, { useCallback, useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import { fetchAuthSession } from 'aws-amplify/auth';
import type { Schema } from '../../../../../amplify/data/resource';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import CoursePreview, { type PreviewQuizQuestion } from './CoursePreview';
import { safeParseBlocksJson, type CourseBlock } from './courseBlocks';

const client = generateClient<Schema>();
const MySwal = withReactContent(Swal);

type TemplateCourse = {
  id: string;
  title: string;
  description?: string | null;
  duration?: string | null;
  category?: string | null;
  blocksJson?: string | null;
  videoKey?: string | null;
  imageKey?: string | null;
  pdfKey?: string | null;
  pdfTitle?: string | null;
  contentType?: string | null;
  passingScore?: number | null;
  randomizeQuestions?: boolean | null;
  randomizeOptions?: boolean | null;
  useQuestionPool?: boolean | null;
  poolSize?: number | null;
  questionsToDisplay?: number | null;
  createdBy?: string | null;
};

type TemplateGalleryProps = {
  onUseTemplate: (newCourseId: string) => void;
  onCancel?: () => void;
};

/**
 * Lists courses with isTemplate === true. "Use this template" clones the course
 * and all its quiz questions into a new draft course and calls onUseTemplate(newCourseId).
 */
export default function TemplateGallery({ onUseTemplate, onCancel }: TemplateGalleryProps) {
  const [templates, setTemplates] = useState<TemplateCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{
    title: string;
    blocks: CourseBlock[];
    quiz: PreviewQuizQuestion[];
    passingScore: number;
  } | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const result = await client.models.Course.list({
        filter: { isTemplate: { eq: true } },
      });
      setTemplates((result.data ?? []) as TemplateCourse[]);
    } catch (e) {
      console.error('Failed to load templates:', e);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const viewTemplate = async (template: TemplateCourse) => {
    try {
      const blocks = safeParseBlocksJson(template.blocksJson ?? '') ?? [];
      const quizResult = await client.models.QuizQuestion.list({
        filter: { courseId: { eq: template.id } },
      });
      const quiz: PreviewQuizQuestion[] =
        quizResult.data?.map((q: any) => ({
          question: q.question,
          questionType: q.questionType,
          options: (q.options as string[]) ?? [],
          correctAnswer: q.correctAnswer ?? undefined,
        })) ?? [];

      setPreviewData({
        title: template.title,
        blocks,
        quiz,
        passingScore: template.passingScore ?? 80,
      });
    } catch (e) {
      console.error('Failed to load template preview:', e);
      await MySwal.fire({ title: 'Preview failed', text: String(e), icon: 'error' });
    }
  };

  const deleteTemplate = async (template: TemplateCourse) => {
    const result = await MySwal.fire({
      title: 'Delete template?',
      text: `This will remove "${template.title}" from the template gallery. The original course content will not be affected.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete template',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#d32f2f',
    });
    if (!result.isConfirmed) return;

    setDeletingId(template.id);
    try {
      await client.models.Course.update({
        id: template.id,
        isTemplate: false,
        updatedAt: new Date().toISOString(),
      });
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
      await MySwal.fire({
        title: 'Template removed',
        text: 'This course is no longer available as a template.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (e) {
      await MySwal.fire({ title: 'Delete failed', text: String(e), icon: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  const cloneTemplate = async (template: TemplateCourse) => {
    setCloningId(template.id);
    try {
      let currentUserId: string | undefined;
      try {
        const session = await fetchAuthSession();
        currentUserId = session.userSub ?? (session.tokens?.idToken?.payload?.sub as string);
      } catch {}

      const now = new Date().toISOString();
      const createPayload = {
        title: `${template.title} (Copy)`,
        description: template.description ?? null,
        videoKey: template.videoKey ?? null,
        imageKey: template.imageKey ?? null,
        pdfKey: template.pdfKey ?? null,
        pdfTitle: template.pdfTitle ?? null,
        contentType: template.contentType ?? null,
        passingScore: template.passingScore ?? 80,
        duration: template.duration ?? null,
        category: template.category ?? null,
        blocksJson: template.blocksJson ?? null,
        randomizeQuestions: template.randomizeQuestions ?? false,
        randomizeOptions: template.randomizeOptions ?? false,
        useQuestionPool: template.useQuestionPool ?? false,
        poolSize: template.poolSize ?? null,
        questionsToDisplay: template.questionsToDisplay ?? null,
        isTemplate: false,
        createdBy: currentUserId ?? null,
        createdAt: now,
        updatedAt: now,
      };

      const created = await client.models.Course.create(createPayload as any);
      const newCourse = created.data as { id: string } | undefined;
      if (!newCourse?.id) {
        throw new Error('Course create did not return an id');
      }

      const quizResult = await client.models.QuizQuestion.list({
        filter: { courseId: { eq: template.id } },
      });
      const questions = quizResult.data ?? [];
      for (const q of questions) {
        const qAny = q as any;
        await client.models.QuizQuestion.create({
          courseId: newCourse.id,
          question: qAny.question,
          questionType: qAny.questionType ?? 'multiple_choice',
          options: qAny.options ?? [],
          correctAnswer: qAny.correctAnswer ?? null,
          correctAnswerText: qAny.correctAnswerText ?? null,
          caseSensitive: qAny.caseSensitive ?? false,
          fuzzyMatching: qAny.fuzzyMatching ?? false,
          createdAt: now,
          updatedAt: now,
        });
      }

      await MySwal.fire({
        title: 'Course created',
        text: 'You can now edit the new course.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
      });
      onUseTemplate(newCourse.id);
    } catch (e) {
      await MySwal.fire({ title: 'Clone failed', text: String(e), icon: 'error' });
    } finally {
      setCloningId(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (templates.length === 0) {
    return (
      <Card variant="outlined" sx={{ p: 3 }}>
        <Typography color="text.secondary">No templates yet. Save any published course as a template from the course editor.</Typography>
        {onCancel && (
          <Button sx={{ mt: 2 }} onClick={onCancel}>
            Back
          </Button>
        )}
      </Card>
    );
  }

  return (
    <Box>
      <CoursePreview
        open={Boolean(previewData)}
        onClose={() => setPreviewData(null)}
        title={previewData?.title ?? ''}
        blocks={previewData?.blocks ?? []}
        quiz={previewData?.quiz ?? []}
        passingScore={previewData?.passingScore}
      />

      <Typography variant="h6" sx={{ mb: 2 }}>
        Start from a template
      </Typography>
      <Grid container spacing={2}>
        {templates.map((t) => (
          <Grid item xs={12} sm={6} md={4} key={t.id}>
            <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flex: 1 }}>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle1" gutterBottom noWrap title={t.title}>
                      {t.title}
                    </Typography>
                    {t.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }} noWrap title={t.description}>
                        {t.description}
                      </Typography>
                    )}
                    {(t.duration || t.category) && (
                      <Typography variant="caption" color="text.secondary">
                        {[t.duration, t.category].filter(Boolean).join(' · ')}
                      </Typography>
                    )}
                  </Box>
                  <IconButton
                    size="small"
                    aria-label="Delete template"
                    onClick={() => deleteTemplate(t)}
                    disabled={deletingId === t.id || cloningId === t.id}
                    sx={{ color: 'error.main' }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </CardContent>
              <Box sx={{ p: 1.5, pt: 0 }}>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => viewTemplate(t)}
                    fullWidth
                  >
                    View
                  </Button>
                  <Button
                    fullWidth
                    variant="contained"
                    size="small"
                    startIcon={<ContentCopyIcon />}
                    onClick={() => cloneTemplate(t)}
                    disabled={cloningId !== null || deletingId !== null}
                  >
                    {cloningId === t.id ? 'Creating…' : 'Use this template'}
                  </Button>
                </Stack>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>
      {onCancel && (
        <Button sx={{ mt: 2 }} onClick={onCancel}>
          Back to create blank course
        </Button>
      )}
    </Box>
  );
}

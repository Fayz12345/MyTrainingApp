import React from 'react';
import {
  Box,
  Checkbox,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import BlockRenderer from './BlockRenderer';
import type { CourseBlock } from './courseBlocks';

export type PreviewQuizQuestion = {
  question: string;
  questionType?: string;
  options: string[];
  correctAnswer?: number;
};

type CoursePreviewProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  blocks: CourseBlock[];
  quiz: PreviewQuizQuestion[];
  passingScore?: number;
};

/**
 * Full-screen read-only preview of a course as an employee would see it.
 * Renders content blocks (from blocksJson or lesson contentBlocks) and quiz without scoring.
 */
export default function CoursePreview({
  open,
  onClose,
  title,
  blocks,
  quiz,
  passingScore = 80,
}: CoursePreviewProps) {
  const validQuiz = quiz.filter((q) => q.question.trim());

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullScreen
      PaperProps={{ sx: { bgcolor: 'background.default' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
        <Typography variant="h6" component="span">
          Preview: {title || 'Untitled course'}
        </Typography>
        <IconButton aria-label="Close preview" onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ overflow: 'auto' }}>
        <Stack spacing={3} sx={{ maxWidth: 720, mx: 'auto', py: 2 }}>
          {/* Content blocks */}
          {blocks.length === 0 ? (
            <Typography color="text.secondary">No content yet. Add blocks in the editor.</Typography>
          ) : (
            blocks.map((block) => (
              <Box key={block.id}>
                <BlockRenderer block={block} />
              </Box>
            ))
          )}

          {/* Quiz (read-only walkthrough, no scoring) */}
          {validQuiz.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" color="text.secondary">
                Quiz preview
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Passing score: {passingScore}% (answers are not scored in preview)
              </Typography>
              {validQuiz.map((q, idx) => (
                <Paper key={idx} variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {idx + 1}. {q.question}
                  </Typography>
                  {q.options && q.options.filter((o) => o.trim()).length > 0 ? (
                    q.questionType === 'multiple_choice' ? (
                      <Stack spacing={0.5}>
                        {q.options.map((opt, oi) => (
                          <Stack key={oi} direction="row" alignItems="center" spacing={1}>
                            <Checkbox disabled size="small" />
                            <Typography variant="body2">
                              {opt.trim() || '\u00a0'}
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>
                    ) : (
                      <Stack component="ul" sx={{ listStyle: 'none', pl: 0, m: 0 }} spacing={0.5}>
                        {q.options.map((opt, oi) => (
                          <Typography key={oi} component="li" variant="body2" sx={{ pl: 2 }}>
                            {opt.trim() || '\u00a0'}
                          </Typography>
                        ))}
                      </Stack>
                    )
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      (Fill-in / open answer)
                    </Typography>
                  )}
                </Paper>
              ))}
            </>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

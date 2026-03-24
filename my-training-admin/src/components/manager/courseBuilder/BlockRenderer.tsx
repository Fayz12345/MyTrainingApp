import React, { useEffect, useState } from 'react';
import { Box, Divider, Paper, Typography } from '@mui/material';
import { useMediaUpload } from '../../../hooks/useMediaUpload';
import type { CourseBlock } from './courseBlocks';

type Props = {
  block: CourseBlock;
};

/**
 * Read-only render of a single content block (text, video, image, PDF, callout, divider).
 * Used in learner preview and anywhere we display course content without editing.
 */
export default function BlockRenderer({ block }: Props) {
  const { getSignedUrl } = useMediaUpload();
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  const key = (block as { key?: string | null }).key;

  useEffect(() => {
    if (!key || (block.type !== 'video' && block.type !== 'image' && block.type !== 'pdf')) {
      setMediaUrl(null);
      setLoadError(false);
      return;
    }
    let cancelled = false;
    setLoadError(false);
    getSignedUrl(key)
      .then((url) => {
        if (!cancelled) setMediaUrl(url);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getSignedUrl from hook is stable in practice
  }, [key, block.type]);

  if (block.type === 'text') {
    return (
      <Box
        sx={{
          '& p': { mt: 0, mb: 1 },
          '& p:last-child': { mb: 0 },
          '& img': { maxWidth: '100%', height: 'auto' },
        }}
        dangerouslySetInnerHTML={{ __html: block.contentHtml || '' }}
      />
    );
  }

  if (block.type === 'callout') {
    return (
      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover', borderLeft: 4, borderColor: 'primary.main' }}>
        <Typography component="div" sx={{ whiteSpace: 'pre-wrap' }}>
          {block.content || '\u00a0'}
        </Typography>
      </Paper>
    );
  }

  if (block.type === 'divider') {
    return <Divider sx={{ my: 2 }} />;
  }

  if (block.type === 'video') {
    if (!key) {
      return (
        <Typography variant="body2" color="text.secondary">
          No video is configured for this course.
        </Typography>
      );
    }
    if (loadError) return <Typography color="error">Could not load video.</Typography>;
    if (!mediaUrl) return <Typography color="text.secondary">Loading video…</Typography>;
    return <Box component="video" src={mediaUrl} controls sx={{ width: '100%', display: 'block' }} />;
  }

  if (block.type === 'image') {
    if (!key) {
      return (
        <Typography variant="body2" color="text.secondary">
          No image is configured for this course.
        </Typography>
      );
    }
    if (loadError) return <Typography color="error">Could not load image.</Typography>;
    if (!mediaUrl) return <Typography color="text.secondary">Loading image…</Typography>;
    return (
      <Box sx={{ borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
        <img src={mediaUrl} alt="" style={{ display: 'block', width: '100%' }} />
      </Box>
    );
  }

  if (block.type === 'pdf') {
    const title = (block as { title?: string | null }).title;
    if (!key) {
      return (
        <Typography variant="body2" color="text.secondary">
          No PDF document is configured for this course.
        </Typography>
      );
    }
    if (loadError) return <Typography color="error">Could not load PDF.</Typography>;
    if (!mediaUrl) return <Typography color="text.secondary">Loading PDF…</Typography>;
    return (
      <Box>
        {title && (
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {title}
          </Typography>
        )}
        <Box
          sx={{
            height: 480,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            overflow: 'hidden',
          }}
        >
          <iframe title={title || 'PDF'} src={mediaUrl} style={{ width: '100%', height: '100%', border: 0 }} />
        </Box>
      </Box>
    );
  }

  return null;
}

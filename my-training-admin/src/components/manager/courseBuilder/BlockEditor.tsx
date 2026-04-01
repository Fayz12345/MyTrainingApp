import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';

import { useMediaUpload } from '../../../hooks/useMediaUpload';
import { CourseBlock, createId } from './courseBlocks';

type Props = {
  blocks: CourseBlock[];
  onChange: (blocks: CourseBlock[]) => void;
};

function SortableBlockCard({
  block,
  onUpdate,
  onRemove,
}: {
  block: CourseBlock;
  onUpdate: (next: CourseBlock) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };

  const { upload, getSignedUrl } = useMediaUpload();
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const loadPreview = async (key: string) => {
    setIsPreviewLoading(true);
    try {
      const url = await getSignedUrl(key);
      setPreviewUrl(url);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const title = useMemo(() => {
    switch (block.type) {
      case 'text':
        return 'Text';
      case 'video':
        return 'Video';
      case 'image':
        return 'Image';
      case 'pdf':
        return 'PDF Viewer';
      case 'callout':
        return 'Callout / Tip';
      case 'divider':
        return 'Divider';
    }
  }, [block.type]);

  return (
    <Card ref={setNodeRef} variant="outlined" sx={{ ...style }}>
      <CardHeader
        title={<Typography variant="subtitle1">{title}</Typography>}
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton size="small" {...attributes} {...listeners} aria-label="Drag block">
              <DragIndicatorIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={onRemove} aria-label="Remove block">
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Stack>
        }
        sx={{ py: 1 }}
      />
      <Divider />
      <CardContent>
        {block.type === 'text' && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Paste formatted text here (stored as HTML).
            </Typography>
            <Box
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => {
                const html = (e.target as HTMLDivElement).innerHTML;
                onUpdate({ ...block, contentHtml: html });
              }}
              dangerouslySetInnerHTML={{ __html: block.contentHtml || '' }}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                p: 1.5,
                minHeight: 120,
                outline: 'none',
                '&:focus': { borderColor: 'primary.main' },
              }}
            />
          </Box>
        )}

        {block.type === 'callout' && (
          <TextField
            fullWidth
            label="Callout text"
            multiline
            minRows={3}
            value={block.content}
            onChange={(e) => onUpdate({ ...block, content: e.target.value })}
          />
        )}

        {block.type === 'divider' && <Divider sx={{ my: 1 }} />}

        {(block.type === 'video' || block.type === 'image' || block.type === 'pdf') && (
          <Stack spacing={1.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
              <Button variant="outlined" component="label">
                Upload {block.type.toUpperCase()}
                <input
                  hidden
                  type="file"
                  accept={
                    block.type === 'video'
                      ? 'video/*'
                      : block.type === 'image'
                        ? 'image/*'
                        : 'application/pdf'
                  }
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    setUploadPct(0);
                    const previousKey = (block as any).key as string | null | undefined;
                    const nextKey = await upload({
                      file,
                      kind: block.type,
                      previousKey,
                      onProgress: ({ transferredBytes, totalBytes }) => {
                        if (!totalBytes) return;
                        setUploadPct(Math.round((transferredBytes / totalBytes) * 100));
                      },
                    });

                    const next: any = { ...block, key: nextKey };
                    if (block.type === 'pdf' && !(block as any).title) {
                      next.title = file.name.replace(/\.pdf$/i, '');
                    }
                    onUpdate(next);
                    setUploadPct(null);
                    setPreviewUrl(null);
                  }}
                />
              </Button>

              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  {((block as any).key as string | null | undefined) ? (
                    <>Key: <code>{String((block as any).key)}</code></>
                  ) : (
                    <>No file uploaded yet.</>
                  )}
                  {typeof uploadPct === 'number' && <> — Upload: {uploadPct}%</>}
                </Typography>
              </Box>

              {!!(block as any).key && (
                <Button
                  size="small"
                  variant="text"
                  disabled={isPreviewLoading}
                  onClick={() => loadPreview(String((block as any).key))}
                >
                  {isPreviewLoading ? 'Loading…' : 'Preview'}
                </Button>
              )}
            </Stack>

            {block.type === 'pdf' && (
              <TextField
                fullWidth
                label="PDF title"
                value={(block.title ?? '') as string}
                onChange={(e) => onUpdate({ ...block, title: e.target.value })}
              />
            )}

            {previewUrl && block.type === 'image' && (
              <Box sx={{ borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                <img src={previewUrl} alt="Course" style={{ display: 'block', width: '100%' }} />
              </Box>
            )}

            {previewUrl && block.type === 'video' && (
              <video src={previewUrl} controls style={{ width: '100%' }} />
            )}

            {previewUrl && block.type === 'pdf' && (
              <Box sx={{ height: 420, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                <iframe title="PDF preview" src={previewUrl} style={{ width: '100%', height: '100%', border: 0 }} />
              </Box>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

export default function BlockEditor({ blocks, onChange }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [addAnchor, setAddAnchor] = useState<null | HTMLElement>(null);

  const ids = useMemo(() => blocks.map((b) => b.id), [blocks]);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(blocks, oldIndex, newIndex));
  };

  const addBlock = (type: CourseBlock['type']) => {
    const base = { id: createId(), type } as any;
    const next: CourseBlock =
      type === 'text'
        ? { ...base, contentHtml: '<p>New text…</p>' }
        : type === 'callout'
          ? { ...base, content: '' }
          : type === 'pdf'
            ? { ...base, key: null, title: '' }
            : type === 'video'
              ? { ...base, key: null }
              : type === 'image'
                ? { ...base, key: null }
                : { ...base };
    onChange([...blocks, next]);
    setAddAnchor(null);
  };

  return (
    <Box sx={{ minWidth: 0 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Typography variant="h6" component="h3" sx={{ minWidth: 0 }}>
          Course content
        </Typography>
        <Button
          startIcon={<AddIcon />}
          variant="contained"
          onClick={(e) => setAddAnchor(e.currentTarget)}
          sx={{
            flexShrink: 0,
            alignSelf: { xs: 'flex-start', sm: 'auto' },
            whiteSpace: 'nowrap',
          }}
        >
          Add block
        </Button>
      </Stack>
      <Menu anchorEl={addAnchor} open={Boolean(addAnchor)} onClose={() => setAddAnchor(null)}>
        <MenuItem onClick={() => addBlock('text')}>Text / Rich Text</MenuItem>
        <MenuItem onClick={() => addBlock('video')}>Video</MenuItem>
        <MenuItem onClick={() => addBlock('image')}>Image</MenuItem>
        <MenuItem onClick={() => addBlock('pdf')}>PDF Viewer</MenuItem>
        <MenuItem onClick={() => addBlock('callout')}>Callout / Tip Box</MenuItem>
        <MenuItem onClick={() => addBlock('divider')}>Divider</MenuItem>
      </Menu>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <Stack spacing={2}>
            {blocks.length === 0 ? (
              <Card variant="outlined">
                <CardContent>
                  <Typography color="text.secondary">
                    Start by adding a block (Text, Video, Image, PDF, Callout, Divider). Drag blocks to reorder.
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              blocks.map((block) => (
                <SortableBlockCard
                  key={block.id}
                  block={block}
                  onUpdate={(next) => onChange(blocks.map((b) => (b.id === next.id ? next : b)))}
                  onRemove={() => onChange(blocks.filter((b) => b.id !== block.id))}
                />
              ))
            )}
          </Stack>
        </SortableContext>
      </DndContext>
    </Box>
  );
}


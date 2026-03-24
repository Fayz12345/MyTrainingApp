export type BlockType = 'text' | 'video' | 'image' | 'pdf' | 'callout' | 'divider';

export type BaseBlock = {
  id: string;
  type: BlockType;
};

export type TextBlock = BaseBlock & {
  type: 'text';
  contentHtml: string;
};

export type VideoBlock = BaseBlock & {
  type: 'video';
  key?: string | null;
};

export type ImageBlock = BaseBlock & {
  type: 'image';
  key?: string | null;
};

export type PdfBlock = BaseBlock & {
  type: 'pdf';
  key?: string | null;
  title?: string | null;
};

export type CalloutBlock = BaseBlock & {
  type: 'callout';
  content: string;
};

export type DividerBlock = BaseBlock & {
  type: 'divider';
};

export type CourseBlock = TextBlock | VideoBlock | ImageBlock | PdfBlock | CalloutBlock | DividerBlock;

export function createId(prefix = 'blk'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function safeParseBlocksJson(raw: unknown): CourseBlock[] | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as CourseBlock[];
  } catch {
    return null;
  }
}

export function htmlToPlainText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function deriveLegacyFieldsFromBlocks(blocks: CourseBlock[]): {
  description: string | null;
  videoKey: string | null;
  imageKey: string | null;
  pdfKey: string | null;
  pdfTitle: string | null;
  contentType: 'video' | 'pdf' | 'both';
} {
  const firstText = blocks.find((b) => b.type === 'text') as TextBlock | undefined;
  const description = firstText ? htmlToPlainText(firstText.contentHtml).slice(0, 500) : '';

  const firstVideo = blocks.find((b) => b.type === 'video' && (b as VideoBlock).key) as VideoBlock | undefined;
  const firstImage = blocks.find((b) => b.type === 'image' && (b as ImageBlock).key) as ImageBlock | undefined;
  const firstPdf = blocks.find((b) => b.type === 'pdf' && (b as PdfBlock).key) as PdfBlock | undefined;

  const videoKey = firstVideo?.key ? String(firstVideo.key) : null;
  const imageKey = firstImage?.key ? String(firstImage.key) : null;
  const pdfKey = firstPdf?.key ? String(firstPdf.key) : null;
  const pdfTitle = firstPdf?.title ? String(firstPdf.title) : null;

  const contentType: 'video' | 'pdf' | 'both' = videoKey && pdfKey ? 'both' : pdfKey ? 'pdf' : 'video';

  return {
    description: description || null,
    videoKey,
    imageKey,
    pdfKey,
    pdfTitle,
    contentType,
  };
}

/** Build blocks from legacy course fields (for courses created before block editor). */
export function migrateCourseToBlocks(legacy: {
  description?: string | null;
  videoKey?: string | null;
  imageKey?: string | null;
  pdfKey?: string | null;
  pdfTitle?: string | null;
}): CourseBlock[] {
  const blocks: CourseBlock[] = [];
  if (legacy.description) {
    const escaped = String(legacy.description)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    blocks.push({
      id: createId('text'),
      type: 'text',
      contentHtml: `<p>${escaped.replace(/\n/g, '</p><p>')}</p>`,
    });
  }
  if (legacy.videoKey) {
    blocks.push({ id: createId('video'), type: 'video', key: legacy.videoKey });
  }
  if (legacy.imageKey) {
    blocks.push({ id: createId('image'), type: 'image', key: legacy.imageKey });
  }
  if (legacy.pdfKey) {
    blocks.push({
      id: createId('pdf'),
      type: 'pdf',
      key: legacy.pdfKey,
      title: legacy.pdfTitle ?? undefined,
    });
  }
  if (blocks.length === 0) {
    blocks.push({ id: createId('text'), type: 'text', contentHtml: '<p>Add your course content here.</p>' });
  }
  return blocks;
}


import { getUrl, remove, uploadData } from 'aws-amplify/storage';

export type MediaKind = 'video' | 'image' | 'pdf';

type UploadProgress = {
  transferredBytes: number;
  totalBytes?: number;
};

type UploadArgs = {
  file: File;
  kind: MediaKind;
  previousKey?: string | null;
  onProgress?: (progress: UploadProgress) => void;
};

function sanitizePdfFilename(filename: string): string {
  const name = filename.split('/').pop() || filename;
  const nameWithoutExt = name.replace(/\.pdf$/i, '');
  const sanitized = nameWithoutExt.replace(/[^a-zA-Z0-9\s\-_]/g, '_');
  const cleaned = sanitized.replace(/[\s_]+/g, '_');
  const final = cleaned || 'document';
  return `${final}.pdf`;
}

function mediaPrefix(kind: MediaKind): string {
  switch (kind) {
    case 'video':
      return 'courses/videos';
    case 'image':
      return 'courses/images';
    case 'pdf':
      return 'courses/pdfs';
  }
}

export function useMediaUpload() {
  const upload = async ({ file, kind, previousKey, onProgress }: UploadArgs): Promise<string> => {
    const timestamp = Date.now();
    const safeName = kind === 'pdf' ? sanitizePdfFilename(file.name) : file.name;
    const key = `${mediaPrefix(kind)}/${timestamp}_${safeName}`;

    await uploadData({
      path: key,
      data: file,
      options: {
        onProgress: ({ transferredBytes, totalBytes }) => {
          onProgress?.({ transferredBytes, totalBytes });
        },
      },
    });

    if (previousKey) {
      try {
        await remove({ path: previousKey });
      } catch {
        // Best-effort cleanup only
      }
    }

    return key;
  };

  const getSignedUrl = async (key: string): Promise<string> => {
    const res = await getUrl({ path: key });
    return res.url.toString();
  };

  return { upload, getSignedUrl };
}


/**
 * Shared Supabase Storage upload utilities.
 *
 * Supports both standard and TUS resumable uploads.
 * Files above TUS_THRESHOLD automatically use the resumable protocol,
 * which handles chunking, retries, and resume-after-disconnect natively.
 */
import * as tus from 'tus-js-client';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    __SUPABASE_URL__?: string;
  }
}

/** Files above this size use TUS resumable upload (6 MB). */
export const TUS_THRESHOLD = 6 * 1024 * 1024;

/** TUS chunk size — 6 MB aligns with Supabase's default. */
const TUS_CHUNK_SIZE = 6 * 1024 * 1024;

function getSupabaseUrl(): string {
  return import.meta.env.VITE_SUPABASE_URL || window.__SUPABASE_URL__ || '';
}

/**
 * Upload a blob via TUS resumable protocol.
 * Handles retries and resume-from-previous automatically.
 */
function uploadBlobWithTus(
  bucketName: string,
  objectName: string,
  blob: Blob,
  contentType: string,
  token: string,
  onProgress?: (percentage: number) => void,
): Promise<void> {
  const supabaseUrl = getSupabaseUrl();

  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(blob, {
      endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${token}`,
        'x-upsert': 'false',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName,
        objectName,
        contentType,
        cacheControl: '3600',
      },
      chunkSize: TUS_CHUNK_SIZE,
      onError: (error) => {
        reject(new Error(`Upload falhou: ${error.message || 'Erro de conexao'}`));
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const pct = Math.round((bytesUploaded / bytesTotal) * 100);
        onProgress?.(pct);
      },
      onSuccess: () => resolve(),
    });

    upload.findPreviousUploads().then((prev) => {
      if (prev.length > 0) upload.resumeFromPreviousUpload(prev[0]);
      upload.start();
    });
  });
}

/**
 * Download a file from Supabase Storage using a short-lived signed URL.
 *
 * Uses `createSignedUrl` with `download: fileName` so Supabase injects
 * `Content-Disposition: attachment; filename="..."`, which:
 *   1. Bypasses CORS issues that plague `fetch()` + `createObjectURL`.
 *   2. Forces the browser to save (not display) the file.
 *
 * @param bucket   Storage bucket name (e.g. 'card-attachments')
 * @param filePath Object path inside the bucket (no leading slash)
 * @param fileName Human-readable filename for the downloaded file
 */
export async function downloadStorageFile(
  bucket: string,
  filePath: string,
  fileName: string,
): Promise<void> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, 60, { download: fileName });

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? 'Não foi possível gerar link de download');
  }

  const a = document.createElement('a');
  a.href = data.signedUrl;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Small delay so browser starts the download before we remove the node
  setTimeout(() => document.body.removeChild(a), 150);
}

/**
 * Upload a blob to Supabase Storage.
 *
 * Small files (<6 MB) use a single PUT request.
 * Larger files use TUS resumable upload with automatic chunking.
 *
 * @returns The public URL of the uploaded file.
 */
export async function uploadBlob(
  bucketName: string,
  objectName: string,
  blob: Blob,
  contentType: string,
  onProgress?: (percentage: number) => void,
): Promise<string> {
  const useTus = blob.size > TUS_THRESHOLD;

  if (useTus) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Sessao expirada. Faca login novamente.');

    await uploadBlobWithTus(bucketName, objectName, blob, contentType, session.access_token, onProgress);
  } else {
    onProgress?.(0);
    const { error } = await supabase.storage
      .from(bucketName)
      .upload(objectName, blob, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      });
    if (error) throw error;
    onProgress?.(100);
  }

  const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(objectName);
  return urlData.publicUrl;
}

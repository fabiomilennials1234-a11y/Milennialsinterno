import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { uploadBlob } from '@/lib/storageUpload';

// ============================================
// CONSTANTS
// ============================================

export const INFO_BANK_FILES_BUCKET = 'client-info-bank-files';

/** 500 MB — matches bucket file_size_limit */
export const MAX_FILE_SIZE = 524_288_000;

// ============================================
// TYPES
// ============================================

export type InfoBankFileSection = 'anuncios' | 'criativos' | 'marca' | 'videos';

export interface InfoBankFile {
  id: string;
  info_bank_id: string;
  client_id: string;
  section: InfoBankFileSection;
  file_name: string;
  file_path: string;
  file_size: number;
  content_type: string;
  uploaded_by: string;
  version: number;
  replaced_by: string | null;
  created_at: string;
}

export const FILE_SECTIONS: Array<{ key: InfoBankFileSection; label: string }> = [
  { key: 'anuncios', label: 'Anuncios' },
  { key: 'criativos', label: 'Criativos' },
  { key: 'marca', label: 'Marca' },
  { key: 'videos', label: 'Videos' },
];

// ============================================
// QUERY KEYS
// ============================================

export const infoBankFileKeys = {
  all: (clientId: string) => ['client-info-bank-files', clientId] as const,
  section: (clientId: string, section: InfoBankFileSection) =>
    ['client-info-bank-files', clientId, section] as const,
  counts: () => ['client-info-bank-files', 'counts'] as const,
  history: (clientId: string, section: InfoBankFileSection, fileName: string) =>
    ['client-info-bank-files-history', clientId, section, fileName] as const,
};

// ============================================
// SELECT COLUMNS
// ============================================

const SELECT_COLS =
  'id, info_bank_id, client_id, section, file_name, file_path, file_size, content_type, uploaded_by, version, replaced_by, created_at';

// ============================================
// PURE HELPERS
// ============================================

/** Aggregate raw rows into nested counts: { [clientId]: { [section]: count } } */
export function buildFileCountsMap(
  rows: Array<{ client_id: string; section: string }>,
): Record<string, Record<string, number>> {
  const map: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    const client = (map[row.client_id] ??= {});
    client[row.section] = (client[row.section] ?? 0) + 1;
  }
  return map;
}

// ============================================
// HOOKS
// ============================================

/**
 * Fetches file counts per client per section.
 * Only counts current files (replaced_by IS NULL).
 * Returns { [clientId]: { [section]: count } }.
 */
export function useClientInfoBankFileCounts() {
  return useQuery<Record<string, Record<string, number>>>({
    queryKey: infoBankFileKeys.counts(),
    queryFn: async () => {
      // Select only the two columns needed for aggregation — lightweight
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types yet
      const { data, error } = await (supabase.from as any)('client_info_bank_files')
        .select('client_id, section')
        .is('replaced_by', null);

      if (error) throw error;
      return buildFileCountsMap(data as Array<{ client_id: string; section: string }>);
    },
  });
}

/**
 * Fetches files for a client's info bank.
 * Only returns current files (replaced_by IS NULL).
 * Optionally filters by section.
 */
export function useClientInfoBankFiles(clientId?: string, section?: InfoBankFileSection) {
  return useQuery<InfoBankFile[]>({
    queryKey: section
      ? infoBankFileKeys.section(clientId ?? '', section)
      : infoBankFileKeys.all(clientId ?? ''),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types yet
      let query = (supabase.from as any)('client_info_bank_files')
        .select(SELECT_COLS)
        .eq('client_id', clientId!)
        .is('replaced_by', null)
        .order('created_at', { ascending: false });

      if (section) {
        query = query.eq('section', section);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as InfoBankFile[];
    },
    enabled: !!clientId,
  });
}

/**
 * Uploads a file to the info bank.
 *
 * 1. Uploads blob to private Storage bucket via uploadBlob (TUS for large files)
 * 2. Calls RPC upload_info_bank_file to insert metadata row
 * 3. Invalidates query cache
 *
 * Note: bucket is private — uploadBlob's returned publicUrl is useless.
 * Use useInfoBankFileSignedUrl for display.
 */
export function useUploadInfoBankFile() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clientId,
      section,
      file,
      onProgress,
    }: {
      clientId: string;
      section: InfoBankFileSection;
      file: File;
      onProgress?: (percentage: number) => void;
    }): Promise<string> => {
      // Client-side size validation
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`Arquivo excede o limite de 500MB (${Math.round(file.size / 1024 / 1024)}MB)`);
      }

      const ext = file.name.split('.').pop() ?? 'bin';
      const objectName = `${clientId}/${section}/${crypto.randomUUID()}.${ext}`;

      // Upload blob to storage (TUS for files > 6MB)
      await uploadBlob(
        INFO_BANK_FILES_BUCKET,
        objectName,
        file,
        file.type,
        onProgress,
      );

      // Insert metadata via RPC
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not in generated types yet
      const { data: fileId, error: rpcError } = await (supabase.rpc as any)(
        'upload_info_bank_file',
        {
          p_client_id: clientId,
          p_section: section,
          p_file_name: file.name,
          p_file_path: objectName,
          p_file_size: file.size,
          p_content_type: file.type,
        },
      );

      if (rpcError) throw rpcError;
      return fileId as string;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: infoBankFileKeys.all(vars.clientId) });
      qc.invalidateQueries({ queryKey: infoBankFileKeys.counts() });
    },
  });
}

/**
 * Deletes a file from the info bank.
 *
 * 1. Calls RPC delete_info_bank_file — verifies ownership, deletes metadata, returns file_path
 * 2. Removes blob from Storage bucket (best-effort — orphaned blobs are cheap)
 * 3. Invalidates query cache
 */
export function useDeleteInfoBankFile() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      fileId,
      clientId,
    }: {
      fileId: string;
      clientId: string;
    }): Promise<void> => {
      // Delete metadata via RPC (returns file_path for storage cleanup)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not in generated types yet
      const { data: filePath, error: rpcError } = await (supabase.rpc as any)(
        'delete_info_bank_file',
        { p_file_id: fileId },
      );

      if (rpcError) throw rpcError;

      // Best-effort storage blob removal
      if (filePath) {
        await supabase.storage
          .from(INFO_BANK_FILES_BUCKET)
          .remove([filePath]);
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: infoBankFileKeys.all(vars.clientId) });
      qc.invalidateQueries({ queryKey: infoBankFileKeys.counts() });
    },
  });
}

/**
 * Fetches all versions of a file (same client_id + section + file_name).
 * Returns versions ordered newest-first (version DESC).
 * Used by the version history drawer.
 */
export function useFileVersionHistory(
  clientId?: string,
  section?: InfoBankFileSection,
  fileName?: string,
) {
  return useQuery<InfoBankFile[]>({
    queryKey: infoBankFileKeys.history(clientId ?? '', section ?? 'marca', fileName ?? ''),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types yet
      const { data, error } = await (supabase.from as any)('client_info_bank_files')
        .select(SELECT_COLS)
        .eq('client_id', clientId!)
        .eq('section', section!)
        .eq('file_name', fileName!)
        .order('version', { ascending: false });

      if (error) throw error;
      return data as InfoBankFile[];
    },
    enabled: !!clientId && !!section && !!fileName,
  });
}

/**
 * Creates a signed URL for a private bucket file.
 * Signed URLs are cached for 55 minutes (bucket URLs expire at 60 min).
 */
export function useInfoBankFileSignedUrl(filePath?: string) {
  return useQuery<string | null>({
    queryKey: ['info-bank-file-url', filePath],
    queryFn: async () => {
      if (!filePath) return null;

      const { data, error } = await supabase.storage
        .from(INFO_BANK_FILES_BUCKET)
        .createSignedUrl(filePath, 3600);

      if (error) throw error;
      return data.signedUrl;
    },
    enabled: !!filePath,
    staleTime: 55 * 60 * 1000, // 55 min — refresh before 60min expiry
  });
}

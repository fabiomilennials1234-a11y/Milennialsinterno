import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CardAttachment {
  id: string;
  card_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  created_by: string | null;
}

// Hook to fetch attachments for multiple cards at once (for kanban view)
export function useMultipleCardsAttachments(cardIds: string[]) {
  return useQuery({
    queryKey: ['multiple-cards-attachments', cardIds.sort().join(',')],
    queryFn: async (): Promise<Record<string, CardAttachment[]>> => {
      if (cardIds.length === 0) return {};

      const { data, error } = await supabase
        .from('card_attachments')
        .select('*')
        .in('card_id', cardIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by card_id
      const grouped: Record<string, CardAttachment[]> = {};
      for (const attachment of (data || [])) {
        if (!grouped[attachment.card_id]) {
          grouped[attachment.card_id] = [];
        }
        grouped[attachment.card_id].push(attachment);
      }

      return grouped;
    },
    enabled: cardIds.length > 0,
    staleTime: 30000, // 30 seconds
  });
}

// Maximum attachments per card
export const MAX_ATTACHMENTS_PER_CARD = 20;

// Allowed file types for upload
export const ALLOWED_FILE_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // Videos
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-ms-wmv',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Design assets (PSD/AI/EPS). Browsers report inconsistent or empty MIME
  // for these, so extension fallback below is the real gate.
  'image/vnd.adobe.photoshop',
  'application/x-photoshop',
  'application/postscript',
  'application/illustrator',
  'application/eps',
  'application/x-eps',
];

// Design asset extensions. CLOSED whitelist — used as the extension fallback
// when File.type comes empty/unrecognized (common for .psd in browsers).
export const DESIGN_ASSET_EXTENSIONS = ['.psd', '.ai', '.eps'];

function hasDesignAssetExtension(fileName?: string): boolean {
  if (!fileName) return false;
  const lower = fileName.toLowerCase();
  return DESIGN_ASSET_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

// Max file size: No limit for videos or design assets (PSD/AI/EPS), 10MB others.
export function getMaxFileSize(fileType: string, fileName?: string): number {
  if (fileType.startsWith('video/') || hasDesignAssetExtension(fileName)) {
    return Infinity;
  }
  return 10 * 1024 * 1024; // 10MB for others
}

export function isAllowedFileType(fileType: string, fileName?: string): boolean {
  if (
    ALLOWED_FILE_TYPES.includes(fileType) ||
    fileType.startsWith('image/') ||
    fileType.startsWith('video/')
  ) {
    return true;
  }
  // Empty/unrecognized MIME (e.g. .psd on some browsers): only allow when the
  // extension matches the closed design-asset whitelist. NEVER pass arbitrary
  // empty-type files — that would let a MIME-less malicious file through.
  return hasDesignAssetExtension(fileName);
}

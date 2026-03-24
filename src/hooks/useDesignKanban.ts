import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/auth';
import * as tus from 'tus-js-client';

// ============================================
// TYPES
// ============================================

export interface DesignBriefing {
  id: string;
  card_id: string;
  description: string | null;
  references_url: string | null;
  identity_url: string | null;
  client_instagram: string | null;
  script_url: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

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

export interface CardComment {
  id: string;
  card_id: string;
  content: string;
  user_id: string;
  created_at: string;
  user?: {
    name: string;
    avatar: string | null;
  };
}

// ============================================
// PERMISSION CONSTANTS
// ============================================

// Quem pode VER o Kanban de Design
export const DESIGN_BOARD_VIEWERS: UserRole[] = [
  'ceo',
  'gestor_projetos',
  'gestor_ads',
  'outbound',
  'sucesso_cliente',
  'devs',
  'design',
];

// Quem pode CRIAR cards
export const DESIGN_CARD_CREATORS: UserRole[] = [
  'ceo',
  'gestor_projetos',
  'gestor_ads',
  'design',
  'sucesso_cliente',
];

// Quem pode ARQUIVAR e EXCLUIR cards
export const DESIGN_CARD_ARCHIVERS: UserRole[] = [
  'ceo',
  'gestor_projetos',
  'gestor_ads',
  'design',
  'sucesso_cliente',
];

// Quem pode MOVER cards (drag and drop)
export const DESIGN_CARD_MOVERS: UserRole[] = [
  'ceo',
  'gestor_projetos',
  'gestor_ads',
  'design',
  'sucesso_cliente',
];

// Quem pode EDITAR briefing
export const DESIGN_BRIEFING_EDITORS: UserRole[] = [
  'ceo',
  'gestor_projetos',
  'gestor_ads',
  'design',
  'sucesso_cliente',
];

// ============================================
// PERMISSION HELPERS
// ============================================

export function canViewDesignBoard(role: UserRole | null): boolean {
  if (!role) return false;
  return DESIGN_BOARD_VIEWERS.includes(role);
}

export function canCreateDesignCard(role: UserRole | null): boolean {
  if (!role) return false;
  return DESIGN_CARD_CREATORS.includes(role);
}

export function canArchiveDesignCard(role: UserRole | null): boolean {
  if (!role) return false;
  return DESIGN_CARD_ARCHIVERS.includes(role);
}

export function canMoveDesignCard(role: UserRole | null): boolean {
  if (!role) return false;
  return DESIGN_CARD_MOVERS.includes(role);
}

export function canEditDesignBriefing(role: UserRole | null): boolean {
  if (!role) return false;
  return DESIGN_BRIEFING_EDITORS.includes(role);
}

// ============================================
// HOOKS - BRIEFING
// ============================================

export function useBriefing(cardId: string | undefined) {
  return useQuery({
    queryKey: ['briefing', cardId],
    queryFn: async (): Promise<DesignBriefing | null> => {
      if (!cardId) return null;

      const { data, error } = await supabase
        .from('design_briefings')
        .select('*')
        .eq('card_id', cardId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!cardId,
  });
}

export function useUpsertBriefing() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      cardId,
      briefing,
    }: {
      cardId: string;
      briefing: Partial<Omit<DesignBriefing, 'id' | 'card_id' | 'created_at' | 'updated_at'>>;
    }) => {
      // Check if briefing exists
      const { data: existing } = await supabase
        .from('design_briefings')
        .select('id')
        .eq('card_id', cardId)
        .maybeSingle();

      if (existing) {
        // Update
        const { data, error } = await supabase
          .from('design_briefings')
          .update(briefing)
          .eq('card_id', cardId)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert
        const { data, error } = await supabase
          .from('design_briefings')
          .insert({
            card_id: cardId,
            ...briefing,
            created_by: user?.id,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['briefing', variables.cardId] });
    },
  });
}

// ============================================
// HOOKS - COMMENTS
// ============================================

export function useCardComments(cardId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['card-comments', cardId],
    queryFn: async (): Promise<CardComment[]> => {
      if (!cardId) return [];

      const { data: comments, error } = await supabase
        .from('card_comments')
        .select('*')
        .eq('card_id', cardId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!comments) return [];

      // Fetch user profiles
      const userIds = [...new Set(comments.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, avatar')
        .in('user_id', userIds);

      const profileMap = (profiles || []).reduce((acc, p) => ({
        ...acc,
        [p.user_id]: { name: p.name, avatar: p.avatar }
      }), {} as Record<string, { name: string; avatar: string | null }>);

      return comments.map(c => ({
        ...c,
        user: profileMap[c.user_id] || { name: 'Usuário', avatar: null }
      }));
    },
    enabled: !!cardId,
  });

  // Realtime subscription
  return query;
}

export function useAddComment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      cardId,
      content,
    }: {
      cardId: string;
      content: string;
    }) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('card_comments')
        .insert({
          card_id: cardId,
          content,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['card-comments', variables.cardId] });
    },
  });
}

// ============================================
// HOOKS - ATTACHMENTS
// ============================================

export function useCardAttachments(cardId: string | undefined) {
  return useQuery({
    queryKey: ['card-attachments', cardId],
    queryFn: async (): Promise<CardAttachment[]> => {
      if (!cardId) return [];

      const { data, error } = await supabase
        .from('card_attachments')
        .select('*')
        .eq('card_id', cardId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!cardId,
  });
}

// Sanitize filename: remove accents, special chars, replace spaces
function sanitizeFileName(name: string): string {
  const lastDot = name.lastIndexOf('.');
  const ext = lastDot > 0 ? name.slice(lastDot) : '';
  const baseName = lastDot > 0 ? name.slice(0, lastDot) : name;

  const sanitized = baseName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 50);

  return sanitized + ext.toLowerCase();
}

// Upload via TUS (resumable) para arquivos grandes
function uploadWithTus(
  bucketName: string,
  fileName: string,
  file: File,
  token: string,
  onProgress?: (percentage: number) => void,
): Promise<void> {
  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL
    || (window as any).__SUPABASE_URL__
    || '';

  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
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
        objectName: fileName,
        contentType: file.type,
        cacheControl: '3600',
      },
      chunkSize: 6 * 1024 * 1024, // 6MB chunks
      onError: (error) => {
        reject(new Error(`Falha no upload: ${error.message || 'Erro de conexão'}`));
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
        onProgress?.(percentage);
      },
      onSuccess: () => {
        resolve();
      },
    });

    // Check for previous uploads to resume
    upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length > 0) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }
      upload.start();
    });
  });
}

// Limite para usar TUS (arquivos acima de 40MB usam upload resumável)
const TUS_THRESHOLD = 40 * 1024 * 1024;

export function useUploadAttachment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      cardId,
      file,
      onProgress,
    }: {
      cardId: string;
      file: File;
      onProgress?: (percentage: number) => void;
    }) => {
      if (!user) throw new Error('Usuário não autenticado');

      const sanitizedName = sanitizeFileName(file.name);
      const fileName = `${cardId}/${Date.now()}-${sanitizedName}`;
      const isLargeFile = file.size > TUS_THRESHOLD;

      let publicUrl: string;

      if (isLargeFile) {
        // Upload resumável via TUS para arquivos grandes
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Sessão expirada. Faça login novamente.');

        await uploadWithTus('card-attachments', fileName, file, session.access_token, onProgress);

        const { data: urlData } = supabase.storage
          .from('card-attachments')
          .getPublicUrl(fileName);
        publicUrl = urlData.publicUrl;
      } else {
        // Upload padrão para arquivos pequenos
        onProgress?.(0);
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('card-attachments')
          .upload(fileName, file);

        if (uploadError) throw uploadError;
        onProgress?.(100);

        const { data: urlData } = supabase.storage
          .from('card-attachments')
          .getPublicUrl(uploadData.path);
        publicUrl = urlData.publicUrl;
      }

      // Save to database (keep original filename for display)
      const { data, error } = await supabase
        .from('card_attachments')
        .insert({
          card_id: cardId,
          file_name: file.name,
          file_url: publicUrl,
          file_type: file.type,
          file_size: file.size,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['card-attachments', variables.cardId] });
      queryClient.invalidateQueries({ queryKey: ['multiple-cards-attachments'] });
    },
  });
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      attachmentId,
      cardId,
      fileUrl,
    }: {
      attachmentId: string;
      cardId: string;
      fileUrl: string;
    }) => {
      // Delete from database
      const { error } = await supabase
        .from('card_attachments')
        .delete()
        .eq('id', attachmentId);

      if (error) throw error;

      // Try to delete from storage
      try {
        const path = fileUrl.split('/card-attachments/')[1];
        if (path) {
          await supabase.storage.from('card-attachments').remove([path]);
        }
      } catch (e) {
        console.warn('Could not delete file from storage:', e);
      }

      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['card-attachments', variables.cardId] });
    },
  });
}

// ============================================
// HOOKS - CARD ACTIVITIES
// ============================================

export function useCardActivities(cardId: string | undefined) {
  return useQuery({
    queryKey: ['card-activities', cardId],
    queryFn: async () => {
      if (!cardId) return [];

      const { data: activities, error } = await supabase
        .from('card_activities')
        .select('*')
        .eq('card_id', cardId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      if (!activities) return [];

      // Fetch user profiles
      const userIds = [...new Set(activities.map(a => a.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, avatar')
        .in('user_id', userIds);

      const profileMap = (profiles || []).reduce((acc, p) => ({
        ...acc,
        [p.user_id]: { name: p.name, avatar: p.avatar }
      }), {} as Record<string, { name: string; avatar: string | null }>);

      return activities.map(a => ({
        ...a,
        user: profileMap[a.user_id] || { name: 'Usuário', avatar: null }
      }));
    },
    enabled: !!cardId,
  });
}

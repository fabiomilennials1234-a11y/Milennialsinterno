import { useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSystemNotifications } from '@/hooks/useSystemNotifications';
import {
  Palette,
  Video,
  Code,
  Drama,
  Film,
  UserPlus,
  FileText,
  AlertTriangle,
  Bell,
  type LucideIcon,
} from 'lucide-react';

export interface UnifiedNotification {
  id: string;
  type: 'design' | 'video' | 'devs' | 'atrizes' | 'produtora' | 'new_client' | 'note' | 'churn' | 'system';
  title: string;
  description: string;
  read: boolean;
  created_at: string;
  icon: LucideIcon;
  color: string;
}

// Table names for each notification type (used for mark-as-read)
const TABLE_MAP: Record<string, string> = {
  design: 'design_completion_notifications',
  video: 'video_completion_notifications',
  devs: 'dev_completion_notifications',
  atrizes: 'atrizes_completion_notifications',
  produtora: 'produtora_completion_notifications',
  new_client: 'ads_new_client_notifications',
  note: 'ads_note_notifications',
  system: 'system_notifications',
};

// Query keys for cache invalidation (must match existing hooks)
const QUERY_KEY_MAP: Record<string, string> = {
  design: 'design-completion-notifications',
  video: 'video-completion-notifications',
  devs: 'dev-completion-notifications',
  atrizes: 'atrizes-completion-notifications',
  produtora: 'produtora-completion-notifications',
  new_client: 'ads-new-client-notifications',
  note: 'ads-note-notifications',
  churn: 'churn-notifications',
  system: 'system-notifications',
};

const NOTIFICATION_META: Record<string, { icon: LucideIcon; color: string }> = {
  design: { icon: Palette, color: '#8B5CF6' },
  video: { icon: Video, color: '#3B82F6' },
  devs: { icon: Code, color: '#10B981' },
  atrizes: { icon: Drama, color: '#EC4899' },
  produtora: { icon: Film, color: '#F59E0B' },
  new_client: { icon: UserPlus, color: '#FFD400' },
  note: { icon: FileText, color: '#6366F1' },
  churn: { icon: AlertTriangle, color: '#EF4444' },
  system: { icon: Bell, color: '#F97316' },
};

// Roles that receive churn notifications
const CHURN_NOTIFICATION_ROLES = ['ceo', 'gestor_ads', 'gestor_projetos', 'sucesso_cliente', 'financeiro', 'consultor_comercial'];

export function useNotificationCenter() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // --- System notifications (from system_notifications table) ---
  const { data: systemNotifs = [] } = useSystemNotifications();

  // --- Completion notifications (share cache with existing hooks via same queryKey) ---

  const { data: designNotifs = [] } = useQuery({
    queryKey: ['design-completion-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('design_completion_notifications')
        .select('*')
        .eq('requester_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    refetchInterval: 10000,
  });

  const { data: videoNotifs = [] } = useQuery({
    queryKey: ['video-completion-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('video_completion_notifications')
        .select('*')
        .eq('requester_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    refetchInterval: 10000,
  });

  const { data: devsNotifs = [] } = useQuery({
    queryKey: ['dev-completion-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('dev_completion_notifications')
        .select('*')
        .eq('requester_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    refetchInterval: 10000,
  });

  const { data: atrizesNotifs = [] } = useQuery({
    queryKey: ['atrizes-completion-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('atrizes_completion_notifications')
        .select('*')
        .eq('requester_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false });
      if (error) return [];
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: produtoraNotifs = [] } = useQuery({
    queryKey: ['produtora-completion-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('produtora_completion_notifications')
        .select('*')
        .eq('requester_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // --- Ads notifications ---

  const { data: newClientNotifs = [] } = useQuery({
    queryKey: ['ads-new-client-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('ads_new_client_notifications')
        .select('*')
        .eq('ads_manager_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: noteNotifs = [] } = useQuery({
    queryKey: ['ads-note-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('ads_note_notifications')
        .select('*')
        .eq('ads_manager_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // --- Churn notifications ---

  const { data: churnNotifs = [] } = useQuery({
    queryKey: ['churn-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: notifications, error: notifError } = await supabase
        .from('churn_notifications')
        .select('*')
        .order('notification_date', { ascending: false });
      if (notifError) throw notifError;

      const { data: dismissals, error: dismissError } = await supabase
        .from('churn_notification_dismissals')
        .select('notification_id')
        .eq('user_id', user.id);
      if (dismissError) throw dismissError;

      const dismissedIds = new Set(dismissals?.map((d: any) => d.notification_id) || []);
      return (notifications || []).filter((n: any) => !dismissedIds.has(n.id));
    },
    enabled: !!user?.id && CHURN_NOTIFICATION_ROLES.includes(user.role || ''),
    refetchInterval: 30000,
  });

  // --- Unify all notifications ---

  const notifications = useMemo<UnifiedNotification[]>(() => {
    const unified: UnifiedNotification[] = [];

    // Completion notifications (all have same shape: card_title, completed_by_name)
    const completionTypes = [
      { data: designNotifs, type: 'design' as const, label: 'Design' },
      { data: videoNotifs, type: 'video' as const, label: 'Vídeo' },
      { data: devsNotifs, type: 'devs' as const, label: 'Desenvolvimento' },
      { data: atrizesNotifs, type: 'atrizes' as const, label: 'Gravação' },
      { data: produtoraNotifs, type: 'produtora' as const, label: 'Produtora' },
    ];

    for (const { data, type, label } of completionTypes) {
      for (const n of data as any[]) {
        const meta = NOTIFICATION_META[type];
        unified.push({
          id: n.id,
          type,
          title: `${label} pronto`,
          description: `"${n.card_title}" concluído por ${n.completed_by_name}`,
          read: false,
          created_at: n.created_at,
          icon: meta.icon,
          color: meta.color,
        });
      }
    }

    // New client notifications
    for (const n of newClientNotifs as any[]) {
      const meta = NOTIFICATION_META.new_client;
      unified.push({
        id: n.id,
        type: 'new_client',
        title: 'Novo cliente',
        description: `"${n.client_name}" atribuído por ${n.created_by_name}`,
        read: false,
        created_at: n.created_at,
        icon: meta.icon,
        color: meta.color,
      });
    }

    // Note notifications
    for (const n of noteNotifs as any[]) {
      const meta = NOTIFICATION_META.note;
      unified.push({
        id: n.id,
        type: 'note',
        title: 'Nova anotação',
        description: `Anotação em "${n.client_name}" por ${n.created_by_name}`,
        read: false,
        created_at: n.created_at,
        icon: meta.icon,
        color: meta.color,
      });
    }

    // Churn notifications
    for (const n of churnNotifs as any[]) {
      const meta = NOTIFICATION_META.churn;
      unified.push({
        id: n.id,
        type: 'churn',
        title: 'Alerta de churn',
        description: `Cliente "${n.client_name}" em churn`,
        read: false,
        created_at: n.created_at || n.notification_date,
        icon: meta.icon,
        color: meta.color,
      });
    }

    // System notifications (from system_notifications table)
    for (const n of systemNotifs as any[]) {
      const meta = NOTIFICATION_META.system;
      // Use priority-based icon colors
      const priorityColor = n.priority === 'urgent' ? '#EF4444'
        : n.priority === 'high' ? '#F97316'
        : '#3B82F6';
      unified.push({
        id: n.id,
        type: 'system',
        title: n.title || 'Notificação',
        description: n.message || '',
        read: false,
        created_at: n.created_at,
        icon: meta.icon,
        color: priorityColor,
      });
    }

    // Sort by newest first
    unified.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return unified;
  }, [designNotifs, videoNotifs, devsNotifs, atrizesNotifs, produtoraNotifs, newClientNotifs, noteNotifs, churnNotifs, systemNotifs]);

  const unreadCount = notifications.length;

  // Mark a single notification as read
  const markAsRead = useCallback(async (id: string, type: UnifiedNotification['type']) => {
    // Churn uses a different mechanism (modal with math challenge), skip here
    if (type === 'churn') return;

    const table = TABLE_MAP[type];
    if (!table) return;

    // system_notifications uses 'id' directly, not requester_id
    const { error } = await supabase
      .from(table)
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      const queryKey = QUERY_KEY_MAP[type];
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    }
  }, [queryClient]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;

    const promises: Promise<any>[] = [];

    // Mark all completion notifications as read
    const completionTables = [
      { table: 'design_completion_notifications', field: 'requester_id' },
      { table: 'video_completion_notifications', field: 'requester_id' },
      { table: 'dev_completion_notifications', field: 'requester_id' },
      { table: 'atrizes_completion_notifications', field: 'requester_id' },
      { table: 'produtora_completion_notifications', field: 'requester_id' },
    ];

    for (const { table, field } of completionTables) {
      promises.push(
        supabase
          .from(table)
          .update({ read: true, read_at: new Date().toISOString() })
          .eq(field, user.id)
          .eq('read', false)
      );
    }

    // Mark ads notifications as read
    promises.push(
      supabase
        .from('ads_new_client_notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('ads_manager_id', user.id)
        .eq('read', false)
    );
    promises.push(
      supabase
        .from('ads_note_notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('ads_manager_id', user.id)
        .eq('read', false)
    );

    // Mark system notifications as read
    promises.push(
      supabase
        .from('system_notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('recipient_id', user.id)
        .or('read.is.null,read.eq.false')
    );

    await Promise.all(promises);

    // Invalidate all notification queries
    for (const key of Object.values(QUERY_KEY_MAP)) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  }, [user?.id, queryClient]);

  return { notifications, unreadCount, markAsRead, markAllAsRead };
}

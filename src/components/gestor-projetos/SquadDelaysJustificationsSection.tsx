import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, CheckCircle2, AlertTriangle, MessageSquare, Archive, ArchiveRestore } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface DelayJustificationItem {
  id: string;
  taskId: string;
  taskTable: 'comercial_tasks' | 'ads_tasks' | 'department_tasks' | 'kanban_cards';
  title: string;
  clientName: string;
  responsibleName: string;
  department: string;
  dueDate: string;
  status: 'atrasado' | 'justificado';
  justification?: string;
  justificationAt?: string;
  isArchived: boolean;
}

// Department label map
const DEPT_LABELS: Record<string, string> = {
  comercial: 'COM',
  ads: 'ADS',
  design: 'DES',
  video: 'VID',
  financeiro: 'FIN',
};

// CEO roles that should never appear as responsible fallback
const CEO_ROLES = new Set(['ceo']);

export default function SquadDelaysJustificationsSection() {
  const { user, isCEO } = useAuth();
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['squad-delays-justifications', user?.id],
    queryFn: async (): Promise<DelayJustificationItem[]> => {
      if (!user?.id) return [];

      const today = new Date().toISOString().split('T')[0];

      // 1. Get current user's group
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('group_id')
        .eq('user_id', user.id)
        .single();

      // 2. Get all profiles (filtered by group if not CEO)
      let profilesQuery = supabase.from('profiles').select('user_id, name, group_id');
      if (!isCEO && currentProfile?.group_id) {
        profilesQuery = profilesQuery.eq('group_id', currentProfile.group_id);
      }
      const { data: profiles } = await profilesQuery;

      const teamUserIds = (profiles || []).map(p => p.user_id);
      if (teamUserIds.length === 0) return [];

      // Build name map
      const nameMap: Record<string, string> = {};
      (profiles || []).forEach(p => { nameMap[p.user_id] = p.name; });

      // 3. Identify CEO user IDs to exclude from responsible resolution
      const { data: ceoRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'ceo');
      const ceoUserIds = new Set((ceoRoles || []).map(r => r.user_id));

      // Helper: resolve name, never falling back to CEO
      const resolveName = (userId: string | null): string => {
        if (!userId) return '';
        if (ceoUserIds.has(userId)) return '';
        return nameMap[userId] || '';
      };

      // 4. Fetch overdue tasks from all tables in parallel (both archived and not)
      const [comercialRes, adsRes, deptRes, kanbanBoardsRes] = await Promise.all([
        supabase
          .from('comercial_tasks')
          .select('id, title, due_date, user_id, related_client_id, justification, justification_at, archived')
          .in('user_id', teamUserIds)
          .lt('due_date', today)
          .neq('status', 'completed')
          .order('due_date', { ascending: true }),
        supabase
          .from('ads_tasks')
          .select('id, title, due_date, ads_manager_id, justification, justification_at, archived')
          .in('ads_manager_id', teamUserIds)
          .lt('due_date', today)
          .neq('status', 'completed')
          .order('due_date', { ascending: true }),
        supabase
          .from('department_tasks')
          .select('id, title, due_date, user_id, department, related_client_id, justification, justification_at, archived')
          .in('user_id', teamUserIds)
          .lt('due_date', today)
          .neq('status', 'completed')
          .order('due_date', { ascending: true }),
        supabase
          .from('kanban_boards')
          .select('id, slug'),
      ]);

      // 5. Fetch kanban card delays (design + video)
      const designBoard = (kanbanBoardsRes.data || []).find(b => b.slug?.toLowerCase().includes('design'));
      const videoBoard = (kanbanBoardsRes.data || []).find(b => b.slug?.toLowerCase().includes('video'));
      const boardIds = [designBoard?.id, videoBoard?.id].filter(Boolean) as string[];

      let kanbanCards: any[] = [];
      if (boardIds.length > 0) {
        const [cardsRes, columnsRes] = await Promise.all([
          supabase
            .from('kanban_cards')
            .select('id, title, due_date, assigned_to, column_id, board_id, justification, justification_at, client_id, archived')
            .in('board_id', boardIds)
            .lt('due_date', today)
            .neq('status', 'completed')
            .order('due_date', { ascending: true }),
          supabase
            .from('kanban_columns')
            .select('id, title, board_id')
            .in('board_id', boardIds),
        ]);

        const columnMap: Record<string, string> = {};
        (columnsRes.data || []).forEach(c => { columnMap[c.id] = c.title; });

        kanbanCards = (cardsRes.data || []).map((c: any) => {
          const colTitle = columnMap[c.column_id] || '';
          const match = colTitle.match(/^BY\s+(.+)/i);
          const columnOwner = match ? match[1].trim() : '';
          const columnOwnerFormatted = columnOwner
            ? columnOwner.charAt(0).toUpperCase() + columnOwner.slice(1).toLowerCase()
            : '';
          const dept = c.board_id === designBoard?.id ? 'design' : 'video';
          return { ...c, _columnOwner: columnOwnerFormatted, _dept: dept };
        });
      }

      // 6. Fetch client names + assigned_comercial
      const allClientIds = [
        ...(comercialRes.data || []).map(t => t.related_client_id),
        ...(deptRes.data || []).map(t => t.related_client_id),
        ...kanbanCards.map((c: any) => c.client_id),
      ].filter((id): id is string => !!id);

      const clientNameMap: Record<string, string> = {};
      const clientToComercial: Record<string, string> = {};
      if (allClientIds.length > 0) {
        const uniqueIds = [...new Set(allClientIds)];
        const { data: clients } = await supabase
          .from('clients')
          .select('id, name, assigned_comercial')
          .in('id', uniqueIds);
        (clients || []).forEach(c => {
          clientNameMap[c.id] = c.name;
          if (c.assigned_comercial) clientToComercial[c.id] = c.assigned_comercial;
        });
      }

      // 7. Build consolidated list
      const result: DelayJustificationItem[] = [];

      // Comercial tasks — resolve via assigned_comercial on client, never CEO
      (comercialRes.data || []).forEach(t => {
        const clientName = t.related_client_id ? (clientNameMap[t.related_client_id] || '') : '';
        const assignedComercial = t.related_client_id ? clientToComercial[t.related_client_id] : null;
        const responsible = resolveName(assignedComercial) || resolveName(t.user_id) || 'Responsável não definido';
        result.push({
          id: `com-${t.id}`,
          taskId: t.id,
          taskTable: 'comercial_tasks',
          title: t.title,
          clientName,
          responsibleName: responsible,
          department: 'comercial',
          dueDate: t.due_date || today,
          status: t.justification ? 'justificado' : 'atrasado',
          justification: t.justification || undefined,
          justificationAt: t.justification_at || undefined,
          isArchived: !!t.archived,
        });
      });

      // Ads tasks
      (adsRes.data || []).forEach(t => {
        const responsible = resolveName(t.ads_manager_id) || 'Responsável não definido';
        result.push({
          id: `ads-${t.id}`,
          taskId: t.id,
          taskTable: 'ads_tasks',
          title: t.title,
          clientName: '',
          responsibleName: responsible,
          department: 'ads',
          dueDate: t.due_date || today,
          status: t.justification ? 'justificado' : 'atrasado',
          justification: t.justification || undefined,
          justificationAt: t.justification_at || undefined,
          isArchived: !!t.archived,
        });
      });

      // Department tasks — financeiro always shows "Financeiro"
      (deptRes.data || []).forEach(t => {
        const clientName = t.related_client_id ? (clientNameMap[t.related_client_id] || '') : '';
        const dept = t.department || 'outros';
        const isFinanceiro = dept === 'financeiro';
        const responsible = isFinanceiro
          ? 'Financeiro'
          : (resolveName(t.user_id) || 'Responsável não definido');
        result.push({
          id: `dept-${t.id}`,
          taskId: t.id,
          taskTable: 'department_tasks',
          title: t.title,
          clientName,
          responsibleName: responsible,
          department: dept,
          dueDate: t.due_date || today,
          status: t.justification ? 'justificado' : 'atrasado',
          justification: t.justification || undefined,
          justificationAt: t.justification_at || undefined,
          isArchived: !!t.archived,
        });
      });

      // Kanban cards (design + video)
      kanbanCards.forEach((c: any) => {
        const assignedName = resolveName(c.assigned_to);
        const clientName = c.client_id ? (clientNameMap[c.client_id] || '') : '';
        result.push({
          id: `kb-${c.id}`,
          taskId: c.id,
          taskTable: 'kanban_cards',
          title: c.title,
          clientName,
          responsibleName: assignedName || c._columnOwner || 'Responsável não definido',
          department: c._dept,
          dueDate: c.due_date || today,
          status: c.justification ? 'justificado' : 'atrasado',
          justification: c.justification || undefined,
          justificationAt: c.justification_at || undefined,
          isArchived: !!c.archived,
        });
      });

      // 8. Sort: atrasados first, then justificados, within each group by date asc
      result.sort((a, b) => {
        if (a.status !== b.status) return a.status === 'atrasado' ? -1 : 1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });

      return result;
    },
    enabled: !!user,
  });

  // Archive / Unarchive mutation
  const archiveMutation = useMutation({
    mutationFn: async ({ taskId, taskTable, archive }: { taskId: string; taskTable: string; archive: boolean }) => {
      const { error } = await supabase
        .from(taskTable)
        .update({
          archived: archive,
          archived_at: archive ? new Date().toISOString() : null,
        })
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['squad-delays-justifications'] });
      queryClient.invalidateQueries({ queryKey: ['squad-delays-by-department'] });
      toast.success(variables.archive ? 'Item arquivado' : 'Item desarquivado');
    },
    onError: () => {
      toast.error('Erro ao atualizar item');
    },
  });

  const handleArchive = useCallback((item: DelayJustificationItem) => {
    archiveMutation.mutate({ taskId: item.taskId, taskTable: item.taskTable, archive: !item.isArchived });
  }, [archiveMutation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeItems = items.filter(i => !i.isArchived);
  const archivedItems = items.filter(i => i.isArchived);
  const displayItems = showArchived ? archivedItems : activeItems;

  const atrasadosCount = activeItems.filter(i => i.status === 'atrasado').length;
  const justificadosCount = activeItems.filter(i => i.status === 'justificado').length;

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckCircle2 className="mx-auto mb-2 text-success opacity-70" size={32} />
        <p className="font-medium text-sm">Nenhum atraso no time!</p>
        <p className="text-xs mt-1">Tudo em dia</p>
      </div>
    );
  }

  const renderCard = (item: DelayJustificationItem) => (
    <div
      key={item.id}
      className={`p-3 rounded-lg border ${
        item.isArchived
          ? 'bg-muted/30 border-muted'
          : item.status === 'atrasado'
            ? 'bg-destructive/5 border-destructive/20'
            : 'bg-warning/5 border-warning/20'
      }`}
    >
      {/* Title */}
      <p className="text-sm font-medium text-foreground line-clamp-2 mb-1">
        {item.title}
      </p>

      {/* Client */}
      {item.clientName && (
        <p className="text-xs text-muted-foreground mb-0.5 truncate">
          {item.clientName}
        </p>
      )}

      {/* Responsible */}
      <p className="text-xs text-muted-foreground mb-1">
        {item.responsibleName}
      </p>

      {/* Date + badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`text-xs font-medium ${
          item.isArchived
            ? 'text-muted-foreground'
            : item.status === 'atrasado' ? 'text-destructive' : 'text-warning'
        }`}>
          {format(new Date(item.dueDate), "dd MMM", { locale: ptBR })}
        </span>

        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-muted-foreground/30 text-muted-foreground">
          {DEPT_LABELS[item.department] || item.department.toUpperCase()}
        </Badge>

        {!item.isArchived && (
          item.status === 'atrasado' ? (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 gap-0.5">
              <AlertTriangle size={8} />
              Atrasado
            </Badge>
          ) : (
            <Badge className="text-[10px] px-1.5 py-0 gap-0.5 bg-warning text-warning-foreground hover:bg-warning/90">
              <MessageSquare size={8} />
              Justificado
            </Badge>
          )
        )}
      </div>

      {/* Justification text */}
      {item.status === 'justificado' && item.justification && (
        <div className="mt-2 p-2 rounded bg-warning/10 border border-warning/20">
          <p className="text-xs text-muted-foreground line-clamp-3">
            {item.justification}
          </p>
          {item.justificationAt && (
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              {format(new Date(item.justificationAt), "dd/MM/yyyy 'às' HH:mm")}
            </p>
          )}
        </div>
      )}

      {/* Archive button */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full mt-2 h-7 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => handleArchive(item)}
        disabled={archiveMutation.isPending}
      >
        {item.isArchived ? (
          <><ArchiveRestore size={12} className="mr-1" /> Desarquivar</>
        ) : (
          <><Archive size={12} className="mr-1" /> Arquivar</>
        )}
      </Button>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 bg-destructive/10 rounded-lg text-center">
          <p className="text-lg font-bold text-destructive">{atrasadosCount}</p>
          <p className="text-[10px] text-muted-foreground">Atrasados</p>
        </div>
        <div className="p-2 bg-warning/10 rounded-lg text-center">
          <p className="text-lg font-bold text-warning">{justificadosCount}</p>
          <p className="text-[10px] text-muted-foreground">Justificados</p>
        </div>
      </div>

      {/* Toggle archived */}
      {archivedItems.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="w-full h-7 text-xs"
          onClick={() => setShowArchived(!showArchived)}
        >
          {showArchived
            ? `Ver ativos (${activeItems.length})`
            : `Ver arquivados (${archivedItems.length})`
          }
        </Button>
      )}

      {/* List */}
      {displayItems.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground text-sm">
          {showArchived ? 'Nenhum item arquivado' : 'Nenhum atraso ativo'}
        </div>
      ) : (
        <div className="space-y-2">
          {displayItems.map(renderCard)}
        </div>
      )}
    </div>
  );
}

import { useState, useCallback, useMemo } from 'react';
import {
  useJustificativasTeam,
  useArchiveJustification,
  type TeamItem,
} from '@/hooks/useJustificativas';
import { Loader2, CheckCircle2, AlertTriangle, MessageSquare, Archive, ArchiveRestore } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Real task tables — exclui pseudo-tables (CRM/tags/stalled/inactive).
const REAL_TASK_TABLES = [
  'comercial_tasks',
  'ads_tasks',
  'department_tasks',
  'kanban_cards',
] as const;

type DisplayItem = {
  key: string;
  justificationId: string | null;
  taskId: string;
  taskTable: string;
  title: string;
  clientName: string;
  responsibleName: string;
  department: string;
  dueDate: string;
  status: 'atrasado' | 'justificado' | 'requer_revisao';
  justification?: string;
  justificationAt?: string;
  masterComment?: string;
  isArchived: boolean;
};

const DEPT_LABELS: Record<string, string> = {
  comercial: 'COM',
  ads: 'ADS',
  design: 'DES',
  video: 'VID',
  financeiro: 'FIN',
};

function deriveDepartmentLabel(item: TeamItem): string {
  if (item.department) return item.department;
  // Fallback derivado de task_table — RPC sempre devolve department, mas defendemos.
  switch (item.task_table) {
    case 'comercial_tasks': return 'comercial';
    case 'ads_tasks': return 'ads';
    case 'kanban_cards': return 'kanban';
    default: return 'outros';
  }
}

function deriveStatus(item: TeamItem): DisplayItem['status'] {
  if (item.requires_revision) return 'requer_revisao';
  if (item.justification_id) return 'justificado';
  return 'atrasado';
}

function toDisplay(item: TeamItem): DisplayItem {
  const dept = deriveDepartmentLabel(item);
  return {
    key: `${item.task_table}-${item.task_id}-${item.notification_id}`,
    justificationId: item.justification_id,
    taskId: item.task_id,
    taskTable: item.task_table,
    title: item.task_title,
    clientName: item.client_name ?? '',
    responsibleName: item.user_name || 'Responsável não definido',
    department: dept === 'financeiro' ? 'financeiro' : dept,
    dueDate: item.task_due_date,
    status: deriveStatus(item),
    justification: item.justification_text ?? undefined,
    justificationAt: item.justification_at ?? undefined,
    masterComment: item.master_comment ?? undefined,
    isArchived: item.archived,
  };
}

export default function SquadDelaysJustificationsSection() {
  const [showArchived, setShowArchived] = useState(false);
  const { data: rows = [], isLoading } = useJustificativasTeam(false, REAL_TASK_TABLES);
  const archiveMutation = useArchiveJustification();

  const items = useMemo<DisplayItem[]>(() => {
    const mapped = rows.map(toDisplay);
    // Atrasados primeiro, depois requer_revisao, depois justificados; dentro
    // de cada grupo, mais antigos primeiro.
    const statusOrder: Record<DisplayItem['status'], number> = {
      atrasado: 0,
      requer_revisao: 1,
      justificado: 2,
    };
    return mapped.sort((a, b) => {
      if (a.status !== b.status) return statusOrder[a.status] - statusOrder[b.status];
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [rows]);

  const handleArchive = useCallback((item: DisplayItem) => {
    if (!item.justificationId) {
      // Sem justificativa, não há o que arquivar (semantic = archive justification, not task).
      return;
    }
    archiveMutation.mutate({ id: item.justificationId, archive: !item.isArchived });
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
  const revisaoCount = activeItems.filter(i => i.status === 'requer_revisao').length;

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckCircle2 className="mx-auto mb-2 text-success opacity-70" size={32} />
        <p className="font-medium text-sm">Nenhum atraso no time!</p>
        <p className="text-xs mt-1">Tudo em dia</p>
      </div>
    );
  }

  const renderCard = (item: DisplayItem) => {
    const cardClasses = item.isArchived
      ? 'bg-muted/30 border-muted'
      : item.status === 'atrasado'
        ? 'bg-destructive/5 border-destructive/20'
        : item.status === 'requer_revisao'
          ? 'bg-warning/10 border-warning/30'
          : 'bg-warning/5 border-warning/20';

    const dateClass = item.isArchived
      ? 'text-muted-foreground'
      : item.status === 'atrasado' ? 'text-destructive' : 'text-warning';

    return (
      <div key={item.key} className={`p-3 rounded-lg border ${cardClasses}`}>
        <p className="text-sm font-medium text-foreground line-clamp-2 mb-1">{item.title}</p>

        {item.clientName && (
          <p className="text-xs text-muted-foreground mb-0.5 truncate">{item.clientName}</p>
        )}

        <p className="text-xs text-muted-foreground mb-1">{item.responsibleName}</p>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-xs font-medium ${dateClass}`}>
            {format(new Date(item.dueDate), 'dd MMM', { locale: ptBR })}
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
            ) : item.status === 'requer_revisao' ? (
              <Badge className="text-[10px] px-1.5 py-0 gap-0.5 bg-warning text-warning-foreground hover:bg-warning/90">
                <AlertTriangle size={8} />
                Requer revisão
              </Badge>
            ) : (
              <Badge className="text-[10px] px-1.5 py-0 gap-0.5 bg-warning text-warning-foreground hover:bg-warning/90">
                <MessageSquare size={8} />
                Justificado
              </Badge>
            )
          )}
        </div>

        {item.justification && (
          <div className="mt-2 p-2 rounded bg-warning/10 border border-warning/20">
            <p className="text-xs text-muted-foreground line-clamp-3">{item.justification}</p>
            {item.justificationAt && (
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                {format(new Date(item.justificationAt), "dd/MM/yyyy 'às' HH:mm")}
              </p>
            )}
          </div>
        )}

        {item.masterComment && (
          <div className="mt-2 p-2 rounded bg-destructive/5 border border-destructive/20">
            <p className="text-[10px] uppercase tracking-wide text-destructive/80 mb-0.5">Comentário do gestor</p>
            <p className="text-xs text-foreground line-clamp-3">{item.masterComment}</p>
          </div>
        )}

        {item.justificationId && (
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
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2 bg-destructive/10 rounded-lg text-center">
          <p className="text-lg font-bold text-destructive">{atrasadosCount}</p>
          <p className="text-[10px] text-muted-foreground">Atrasados</p>
        </div>
        <div className="p-2 bg-warning/10 rounded-lg text-center">
          <p className="text-lg font-bold text-warning">{revisaoCount}</p>
          <p className="text-[10px] text-muted-foreground">Revisão</p>
        </div>
        <div className="p-2 bg-warning/10 rounded-lg text-center">
          <p className="text-lg font-bold text-warning">{justificadosCount}</p>
          <p className="text-[10px] text-muted-foreground">Justificados</p>
        </div>
      </div>

      {archivedItems.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="w-full h-7 text-xs"
          onClick={() => setShowArchived(!showArchived)}
        >
          {showArchived
            ? `Ver ativos (${activeItems.length})`
            : `Ver arquivados (${archivedItems.length})`}
        </Button>
      )}

      {displayItems.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground text-sm">
          {showArchived ? 'Nenhum item arquivado' : 'Nenhum atraso ativo'}
        </div>
      ) : (
        <div className="space-y-2">{displayItems.map(renderCard)}</div>
      )}
    </div>
  );
}
